import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {siteContent} from '../content';
import {demoIds, indexableDemoIds} from '../demos/catalog';
import {loadAnimationModule, registeredAnimationKeys} from '../demos/animation-registry';

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
    validationStatus: string;
    publicationPolicy: {
      defaultAccess: string;
      publicAccessRequires: string[];
      indexingRequires: string[];
    };
    sources: Record<string, {
      public: boolean;
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
      publication: {
        access: string;
        indexable: boolean;
        technicalAcceptance: string;
        rightsApproval: string;
      };
      knownExceptions: string[];
    }>;
    files: Record<string, string>;
    integrationFiles: Record<string, string>;
  };

  assert.equal(manifest.validationStatus, 'conditional');
  assert.equal(manifest.publicationPolicy.defaultAccess, 'private');
  assert.deepEqual(manifest.publicationPolicy.publicAccessRequires, [
    'publication-rights approval',
  ]);
  assert.deepEqual(manifest.publicationPolicy.indexingRequires, [
    'strict-complete validation',
    'technical acceptance',
    'publication-rights approval',
  ]);
  const runtimeFiles = [
    ...(await filesBelow(path.join(repositoryRoot, 'demos'))),
    ...(await filesBelow(path.join(repositoryRoot, 'public/flash-assets'))),
  ]
    .map((file) => path.relative(repositoryRoot, file).split(path.sep).join('/'))
    .filter((file) => file !== 'demos/SNAPSHOT.json')
    .sort();
  assert.deepEqual(Object.keys(manifest.files).sort(), runtimeFiles);

  const expectedIntegrationFiles = [
    'app/[locale]/demos/[id]/page.tsx',
    'app/[locale]/demos/page.tsx',
    'app/sitemap.ts',
    'components/demo-player.tsx',
    'components/demos-pages.tsx',
    'components/home-page.tsx',
    'lib/public-paths.ts',
    'next.config.ts',
    'proxy.ts',
    'scripts/generate-registry.mjs',
  ].sort();
  assert.deepEqual(Object.keys(manifest.integrationFiles).sort(), expectedIntegrationFiles);

  for (const [relativePath, expected] of Object.entries({
    ...manifest.files,
    ...manifest.integrationFiles,
  })) {
    const bytes = await readFile(path.join(repositoryRoot, relativePath));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, relativePath);
  }

  const sourceEntries = Object.entries(manifest.sources);
  const allSourceIds = sourceEntries.map(([id]) => id).sort();
  const declaredPublicSourceIds = sourceEntries
    .filter(([, source]) => source.public)
    .map(([id]) => id)
    .sort();
  const publicSourceIds = sourceEntries
    .filter(([, source]) =>
      source.public &&
      source.publication.access === 'public-preview' &&
      source.publication.rightsApproval === 'approved'
    )
    .map(([id]) => id)
    .sort();
  const indexableSourceIds = sourceEntries
    .filter(([, source]) =>
      source.public &&
      source.validationStatus === 'strict-complete' &&
      source.publication.indexable &&
      source.publication.technicalAcceptance === 'approved' &&
      source.publication.rightsApproval === 'approved'
    )
    .map(([id]) => id)
    .sort();

  assert.deepEqual(declaredPublicSourceIds, publicSourceIds);
  assert.deepEqual([...demoIds].sort(), publicSourceIds);
  assert.deepEqual([...indexableDemoIds].sort(), indexableSourceIds);
  assert.deepEqual([...registeredAnimationKeys].sort(), publicSourceIds);
  assert.deepEqual(Object.keys(siteContent.en.pages.demoDetails).sort(), allSourceIds);
  assert.deepEqual(Object.keys(siteContent.es.pages.demoDetails).sort(), allSourceIds);
  assert.deepEqual(siteContent.en.pages.demos.items.map((item) => item.id).sort(), publicSourceIds);
  assert.deepEqual(siteContent.es.pages.demos.items.map((item) => item.id).sort(), publicSourceIds);

  for (const id of allSourceIds) {
    const source = manifest.sources[id];
    const animationModule = await loadAnimationModule(id);
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
    assert.equal(source.publication.indexable, false);
    assert.equal(source.publication.technicalAcceptance, 'pending');
    if (source.public) {
      assert.equal(source.publication.access, 'public-preview');
      assert.equal(source.publication.rightsApproval, 'approved');
      assert.ok(animationModule, id);
      assert.equal(animationModule.key, id);
      assert.deepEqual(animationModule.movie, source.runtimeMovie);
      assert.equal(animationModule.maturity, source.maturity);
    } else {
      assert.equal(source.publication.access, 'private');
      assert.equal(source.publication.rightsApproval, 'pending');
      assert.equal(animationModule, undefined);
    }
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
