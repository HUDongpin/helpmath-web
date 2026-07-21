import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {siteContent} from '../content';
import {demoIds, reviewDemoIds} from '../demos/catalog';
import {loadAnimationModule, registeredAnimationKeys} from '../demos/animation-registry';
import {
  DEMO_CANDIDATE_IDS,
  demoCandidates,
  isDemoCandidateId,
} from '../demos/candidates';
import {
  loadReviewAnimationModule,
  registeredReviewAnimationKeys,
} from '../demos/review-animation-registry';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbiddenArchiveDirectory =
  /(?:^|\/)(?:catalog|flash|HELP MATH_ORIGINAL FILES|migrations|output|outputs|ruffle|source|source-assets)(?:\/|$)/i;

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  }));
  return nested.flat();
}

test('the reviewed demo snapshot matches every pinned runtime and image hash', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repositoryRoot, 'demos/SNAPSHOT.json'), 'utf8')
  ) as {
    schemaVersion: number;
    validationStatus: string;
    publicationPolicy: {
      defaultAccess: string;
      internalReviewAccessRequires: string[];
      publicAccessRequires: string[];
      indexingRequires: string[];
    };
    sources: Record<string, {
      route: string;
      workbenchMigrationId: string;
      flaSha256: string;
      swfSha256: string;
      runtimeMovie: {stage: {width: number; height: number}; fps: number; frameCount: number; durationMs: number};
      maturity: string;
      validationStatus: string;
      evidenceStatus: {
        workbenchStatus: string;
        machineAudit: string;
        actionScriptVersion: string;
        backgroundColor: string;
        languages: string[];
        scenarios: string[];
        audioRequired: boolean;
        audioImplemented: boolean;
        externalDependencies: string[];
        keyframeRows: number;
        rmseStatus: string;
        strictValidator: string;
      };
      knownExceptions: string[];
    }>;
    files: Record<string, string>;
  };

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.validationStatus, 'conditional');
  assert.equal(manifest.publicationPolicy.defaultAccess, 'private');
  assert.deepEqual(manifest.publicationPolicy.internalReviewAccessRequires, [
    'explicit owner authorization for a named internal audience',
    'application-authenticated short-lived session',
    'visible non-public and unvalidated status notice',
  ]);
  assert.deepEqual(manifest.publicationPolicy.publicAccessRequires, [
    'publication-rights approval',
  ]);
  assert.deepEqual(manifest.publicationPolicy.indexingRequires, [
    'strict-complete validation',
    'technical acceptance',
    'publication-rights approval',
  ]);
  const pinnedPaths = Object.keys(manifest.files).sort();
  assert.ok(pinnedPaths.length > 0);
  assert.equal(pinnedPaths.some((file) => file.startsWith('demos/candidates/')), false);
  assert.equal(pinnedPaths.some((file) => /(?:catalog|registry)\.ts$/u.test(file)), false);

  await assert.rejects(
    access(path.join(repositoryRoot, 'public/flash-assets')),
    {code: 'ENOENT'},
  );

  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(repositoryRoot, relativePath));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, relativePath);
  }

  const sourceEntries = Object.entries(manifest.sources);
  const allSourceIds = sourceEntries.map(([id]) => id).sort();
  const publicSourceIds = [...demoIds].sort();
  const reviewSourceIds = [...reviewDemoIds].sort();
  assert.deepEqual(allSourceIds, [...DEMO_CANDIDATE_IDS].sort());
  assert.deepEqual([...registeredAnimationKeys].sort(), publicSourceIds);
  assert.deepEqual([...registeredReviewAnimationKeys].sort(), reviewSourceIds);
  assert.deepEqual(Object.keys(siteContent.en.pages.demoDetails).sort(), allSourceIds);
  assert.deepEqual(Object.keys(siteContent.es.pages.demoDetails).sort(), allSourceIds);
  assert.deepEqual(siteContent.en.pages.demos.items.map((item) => item.id).sort(), publicSourceIds);
  assert.deepEqual(siteContent.es.pages.demos.items.map((item) => item.id).sort(), publicSourceIds);

  for (const id of allSourceIds) {
    if (!isDemoCandidateId(id)) throw new Error(`Unknown demo candidate: ${id}`);
    const source = manifest.sources[id];
    const candidate = demoCandidates[id];
    const animationModule = await loadAnimationModule(id);
    const reviewAnimationModule = await loadReviewAnimationModule(id);
    assert.equal(candidate.source.flaSha256, source.flaSha256);
    assert.equal(candidate.source.swfSha256, source.swfSha256);
    assert.deepEqual(candidate.movie, source.runtimeMovie);
    assert.equal(candidate.maturity, source.maturity);
    assert.equal(candidate.validationStatus, source.validationStatus);
    assert.equal(source.validationStatus, 'conditional');
    assert.equal(source.evidenceStatus.workbenchStatus, 'preserved');
    assert.equal(source.evidenceStatus.machineAudit, 'partial');
    assert.equal(source.evidenceStatus.actionScriptVersion, 'AS1/2');
    assert.equal(source.evidenceStatus.backgroundColor, '#e4e4e4');
    assert.deepEqual(source.evidenceStatus.languages, ['en', 'es']);
    assert.deepEqual(source.evidenceStatus.scenarios, ['default']);
    assert.equal(source.evidenceStatus.audioRequired, true);
    assert.equal(source.evidenceStatus.audioImplemented, false);
    assert.deepEqual(source.evidenceStatus.externalDependencies, []);
    assert.equal(source.evidenceStatus.keyframeRows, 0);
    assert.equal(source.evidenceStatus.rmseStatus, 'not-run');
    assert.equal(source.evidenceStatus.strictValidator, 'not-passed');
    assert.equal(Object.hasOwn(source, 'public'), false);
    assert.equal(Object.hasOwn(source, 'publication'), false);
    assert.equal(animationModule, undefined);
    assert.ok(reviewAnimationModule, id);
    assert.equal(reviewAnimationModule.key, id);
    assert.deepEqual(reviewAnimationModule.movie, source.runtimeMovie);
    assert.equal(reviewAnimationModule.maturity, source.maturity);
    assert.equal(source.route, `/demos/${id}`);
    assert.match(source.workbenchMigrationId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(source.flaSha256, /^[a-f0-9]{64}$/);
    assert.match(source.swfSha256, /^[a-f0-9]{64}$/);
    assert.ok(source.knownExceptions.length >= 1);
  }
});

test('the public repository contains no raw Flash or Ruffle payload', async () => {
  const files = await filesBelow(repositoryRoot);
  const relevant = files.filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
  assert.deepEqual(relevant.filter((file) => /\.(?:fla|swf)$/i.test(file)), []);
  assert.deepEqual(relevant.filter((file) => forbiddenArchiveDirectory.test(file)), []);
});
