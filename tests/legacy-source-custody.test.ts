import assert from 'node:assert/strict';
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import {
  ARCHIVE_MARKER_FILENAME,
  archiveObjectPath,
  archiveMarkerContents,
  checksumManifest,
  expectedDocumentedLocators,
  isSuccessfulCapture,
  manifestCsv,
  normalizeLegacyUrl,
  prepareDedicatedArchiveRoot,
  sha256,
  validateCaptureResponse,
  validateManifest,
  validateRegistry,
  verifyArchiveObjects,
} from '../scripts/legacy-source-custody-lib.mjs';
import {
  prepareArchiveDirectory,
  writeArchiveObject,
} from '../scripts/crawl-legacy-sources.mjs';

const repositoryRoot = process.cwd();
const registryPath = path.join(repositoryRoot, 'data/legacy-source-registry.json');
const contentSourcesPath = path.join(repositoryRoot, 'docs/CONTENT_SOURCES.md');
const legacyMapPath = path.join(repositoryRoot, 'docs/LEGACY_RESOURCE_MAP.md');
const launchDecisionsPath = path.join(repositoryRoot, 'docs/LAUNCH_DECISIONS.md');

type MutablePolicyManifest = {
  requestPolicy: {
    timeoutMs: number;
    concurrency: number;
    retryableHttpStatuses: Array<number | string>;
    maxBytesPerResponse: number;
  };
  captures: Array<{
    attempts: number;
    redirectChain: string[];
    url: string;
    finalURL: string | null;
    bytes: number | null;
  }>;
};

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

describe('legacy source custody', () => {
  it('covers every governed legacy locator exactly once', async () => {
    const [registry, contentSources, legacyMap, launchDecisions] = await Promise.all([
      readJson(registryPath),
      readFile(contentSourcesPath, 'utf8'),
      readFile(legacyMapPath, 'utf8'),
      readFile(launchDecisionsPath, 'utf8'),
    ]);
    assert.deepEqual(validateRegistry(registry), []);

    const expected = [
      ...expectedDocumentedLocators(contentSources, legacyMap, launchDecisions),
    ].sort();
    const registered = registry.sources.map((source: {url: string}) => normalizeLegacyUrl(source.url)).sort();
    assert.deepEqual(registered, expected);
    assert.equal(registered.length, 23);
    assert.equal(new Set(registered).size, registered.length);
  });

  it('keeps rights, accessibility, and republication pending by default', async () => {
    const registry = await readJson(registryPath);
    assert.deepEqual(registry.defaults, {
      rightsStatus: 'pending',
      accessibilityStatus: 'pending',
      republishStatus: 'pending',
    });
    for (const source of registry.sources) {
      assert.equal(source.rightsStatus, 'pending');
      assert.equal(source.accessibilityStatus, 'pending');
      assert.equal(source.republishStatus, 'pending');
    }
  });

  it('records one internally consistent metadata capture per registry source', async () => {
    const registryText = await readFile(registryPath);
    const registry = JSON.parse(registryText.toString('utf8'));
    const evidencePath = path.join(repositoryRoot, registry.currentEvidenceManifest);
    const csvPath = evidencePath.replace(/\.json$/, '.csv');
    const sha256Path = evidencePath.replace(/\.json$/, '.sha256');
    const [manifest, evidenceText, csvEvidence, sha256Evidence] = await Promise.all([
      readJson(evidencePath),
      readFile(evidencePath, 'utf8'),
      readFile(csvPath, 'utf8'),
      readFile(sha256Path, 'utf8'),
    ]);

    assert.deepEqual(
      validateManifest(manifest, registry, {sourceRegistrySha256: sha256(registryText)}),
      [],
    );
    assert.equal(manifest.captures.length, registry.sources.length);
    assert.equal(manifest.summary.successful, registry.sources.length);
    assert.ok(manifest.captures.every(isSuccessfulCapture));
    assert.equal(csvEvidence, manifestCsv(manifest));
    assert.equal(sha256Evidence, checksumManifest(manifest));
    assert.equal(manifest.pdfMetadataPolicy.extractor, 'pdfinfo (Poppler)');
    assert.match(manifest.pdfMetadataPolicy.extractorVersion, /^\d+(?:\.\d+)+$/);
    const pdfCaptures = manifest.captures.filter((capture: {contentType: string}) =>
      capture.contentType.startsWith('application/pdf'),
    );
    assert.equal(pdfCaptures.length, 18);
    for (const capture of pdfCaptures) {
      assert.equal(capture.pdfMetadata.extractor, 'pdfinfo (Poppler)');
      assert.equal(capture.pdfMetadata.extractionError, null);
      assert.ok(capture.pdfMetadata.pageCount > 0);
      for (const field of ['title', 'author', 'creationDate', 'modificationDate']) {
        assert.ok(Object.hasOwn(capture.pdfMetadata, field));
        assert.ok(capture.pdfMetadata[field] === null || typeof capture.pdfMetadata[field] === 'string');
      }
    }
    assert.doesNotMatch(evidenceText, /"(?:body|payload|base64|archiveRoot)"\s*:/i);
    assert.ok(
      Buffer.byteLength(evidenceText) + Buffer.byteLength(csvEvidence) + Buffer.byteLength(sha256Evidence) <
        500_000,
      'metadata evidence must not embed source bytes',
    );
  });

  it('rejects non-HTTPS, cross-origin, credentialed, and query-bearing source URLs', () => {
    for (const unsafe of [
      'http://www.helpprogram.net/ProgramInfo.htm',
      'https://helpprogram.net/ProgramInfo.htm',
      'https://example.com/ProgramInfo.htm',
      'https://user:password@www.helpprogram.net/ProgramInfo.htm',
      'https://www.helpprogram.net/ProgramInfo.htm?source=test',
    ]) {
      assert.throws(() => normalizeLegacyUrl(unsafe));
    }
    assert.equal(
      normalizeLegacyUrl('https://www.helpprogram.net/ProgramInfo.htm'),
      'https://www.helpprogram.net/ProgramInfo.htm',
    );
  });

  it('rejects credential-bearing stable replacements', async () => {
    const registry = await readJson(registryPath);
    const withCredentials = structuredClone(registry);
    withCredentials.sources[0].stableReplacement = 'https://user:secret@example.com/source';
    assert.match(validateRegistry(withCredentials).join('\n'), /cannot contain credentials/);

    const withSecretQuery = structuredClone(registry);
    withSecretQuery.sources[0].stableReplacement =
      'https://example.com/source?access_token=secret';
    assert.match(
      validateRegistry(withSecretQuery).join('\n'),
      /explicit ERIC id allowlist/,
    );

    const withAzureStyleSecret = structuredClone(registry);
    withAzureStyleSecret.sources[0].stableReplacement =
      'https://example.com/source?sp=r&se=2030-01-01&sig=secret';
    assert.match(
      validateRegistry(withAzureStyleSecret).join('\n'),
      /explicit ERIC id allowlist/,
    );

    const withFragmentSecret = structuredClone(registry);
    withFragmentSecret.sources[0].stableReplacement =
      'https://example.com/source#access_token=secret';
    assert.match(
      validateRegistry(withFragmentSecret).join('\n'),
      /cannot contain a fragment/,
    );
  });

  it('validates response bytes before a native PDF parser can receive them', () => {
    const pdfUrl = 'https://www.helpprogram.net/source.pdf';
    assert.deepEqual(
      validateCaptureResponse(pdfUrl, {
        status: 200,
        contentType: 'application/pdf',
        bytes: Buffer.from('%PDF-1.4\n'),
      }),
      [],
    );
    assert.match(
      validateCaptureResponse(pdfUrl, {
        status: 404,
        contentType: 'application/pdf',
        bytes: Buffer.from('<html>not found</html>'),
      }).join('\n'),
      /HTTP 200[\s\S]*signature/,
    );
    assert.match(
      validateCaptureResponse(pdfUrl, {
        status: 200,
        contentType: 'text/html',
        bytes: Buffer.alloc(0),
      }).join('\n'),
      /non-empty[\s\S]*application\/pdf/,
    );
  });

  it('rejects manifests outside every reviewed request-policy bound', async () => {
    const registryText = await readFile(registryPath);
    const registry = JSON.parse(registryText.toString('utf8'));
    const manifest = (await readJson(
      path.join(repositoryRoot, registry.currentEvidenceManifest),
    )) as MutablePolicyManifest;
    const validateMutation = (mutate: (candidate: MutablePolicyManifest) => void) => {
      const candidate = structuredClone(manifest);
      mutate(candidate);
      return validateManifest(candidate, registry, {
        sourceRegistrySha256: sha256(registryText),
      }).join('\n');
    };

    assert.match(
      validateMutation((candidate) => {
        candidate.requestPolicy.timeoutMs = -1;
      }),
      /timeoutMs must be an integer between/,
    );
    assert.match(
      validateMutation((candidate) => {
        candidate.requestPolicy.concurrency = 0;
      }),
      /concurrency must be an integer between/,
    );
    assert.match(
      validateMutation((candidate) => {
        candidate.requestPolicy.retryableHttpStatuses = ['500'];
      }),
      /transient-status allowlist/,
    );
    assert.match(
      validateMutation((candidate) => {
        candidate.captures[0].attempts = 999;
      }),
      /attempts cannot exceed/,
    );
    assert.match(
      validateMutation((candidate) => {
        candidate.captures[0].redirectChain = Array(6).fill(candidate.captures[0].url);
        candidate.captures[0].finalURL = candidate.captures[0].url;
      }),
      /redirectChain cannot exceed/,
    );
    assert.match(
      validateMutation((candidate) => {
        candidate.captures[0].bytes = candidate.requestPolicy.maxBytesPerResponse + 1;
      }),
      /bytes cannot exceed/,
    );
  });

  it('requires a dedicated marked archive root without mutating broad directories', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'helpmath-custody-policy-'));
    const syntheticRepository = path.join(temporaryRoot, 'website-repository');
    const unmarked = path.join(temporaryRoot, 'existing-unmarked');
    const marked = path.join(temporaryRoot, 'dedicated-archive');
    const gitProject = path.join(temporaryRoot, 'other-project');
    await Promise.all([
      mkdir(syntheticRepository),
      mkdir(unmarked),
      mkdir(path.join(gitProject, '.git'), {recursive: true}),
    ]);
    const modeBefore = (await stat(unmarked)).mode & 0o777;

    try {
      await assert.rejects(
        prepareDedicatedArchiveRoot(unmarked, syntheticRepository),
        /missing \.help-math-source-archive\.json/,
      );
      assert.equal((await stat(unmarked)).mode & 0o777, modeBefore);
      await assert.rejects(
        prepareDedicatedArchiveRoot(temporaryRoot, syntheticRepository),
        /too broad or overlaps/,
      );
      await assert.rejects(
        prepareDedicatedArchiveRoot(path.join(gitProject, 'archive'), syntheticRepository),
        /Git worktree/,
      );
      await assert.rejects(
        prepareDedicatedArchiveRoot(homedir(), syntheticRepository),
        /too broad or overlaps/,
      );

      const preparedMarked = await prepareDedicatedArchiveRoot(
        marked,
        syntheticRepository,
      );
      const resolvedMarked = await realpath(marked);
      assert.equal(preparedMarked, resolvedMarked);
      assert.equal(
        await readFile(path.join(marked, ARCHIVE_MARKER_FILENAME), 'utf8'),
        archiveMarkerContents(),
      );
      assert.equal(
        await prepareDedicatedArchiveRoot(marked, syntheticRepository),
        resolvedMarked,
      );
    } finally {
      await rm(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('checks duplicate content-addressed objects against every capture record', async () => {
    const archiveRoot = await mkdtemp(path.join(tmpdir(), 'helpmath-custody-object-'));
    await rm(archiveRoot, {recursive: true, force: true});
    const bytes = Buffer.from('<!doctype html><title>source</title>');
    const hash = sha256(bytes);
    const relativeObject = archiveObjectPath(hash);

    try {
      await prepareDedicatedArchiveRoot(archiveRoot, repositoryRoot);
      await mkdir(path.dirname(path.join(archiveRoot, relativeObject)), {recursive: true});
      await writeFile(path.join(archiveRoot, relativeObject), bytes);
      const common = {
        archiveObject: relativeObject,
        sha256: hash,
        url: 'https://www.helpprogram.net/',
      };
      const errors = await verifyArchiveObjects(
        {
          captures: [
            {id: 'first', ...common, bytes: bytes.length},
            {id: 'second', ...common, bytes: bytes.length + 1},
          ],
        },
        archiveRoot,
      );
      assert.deepEqual(errors, ['second: byte size differs from the manifest']);
    } finally {
      await rm(archiveRoot, {recursive: true, force: true});
    }
  });

  it('reuses private directory chains and rejects linked archive paths', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'helpmath-custody-writes-'));
    const archiveRoot = path.join(temporaryRoot, 'archive');
    const outsideRoot = path.join(temporaryRoot, 'outside');
    await mkdir(outsideRoot);

    try {
      await prepareDedicatedArchiveRoot(archiveRoot, repositoryRoot);
      const relativeDirectory = 'objects/sha256/aa';
      const firstDirectory = await prepareArchiveDirectory(
        archiveRoot,
        relativeDirectory,
      );
      const secondDirectory = await prepareArchiveDirectory(
        archiveRoot,
        relativeDirectory,
      );
      assert.equal(firstDirectory, secondDirectory);
      assert.equal((await stat(firstDirectory)).mode & 0o777, 0o700);

      const bytes = Buffer.from('<!doctype html><title>repeatable</title>');
      const objectPath = archiveObjectPath(sha256(bytes));
      const firstObject = await writeArchiveObject(archiveRoot, objectPath, bytes);
      const secondObject = await writeArchiveObject(archiveRoot, objectPath, bytes);
      assert.equal(firstObject, secondObject);
      assert.equal((await stat(firstObject)).mode & 0o777, 0o600);

      await symlink(outsideRoot, path.join(archiveRoot, 'linked-directory'));
      await assert.rejects(
        prepareArchiveDirectory(archiveRoot, 'linked-directory/nested'),
        /only real directories/,
      );

      const linkedBytes = Buffer.from('<!doctype html><title>linked</title>');
      const linkedObjectPath = archiveObjectPath(sha256(linkedBytes));
      const linkedTarget = path.join(archiveRoot, linkedObjectPath);
      await prepareArchiveDirectory(archiveRoot, path.dirname(linkedObjectPath));
      const outsideFile = path.join(outsideRoot, 'linked-source');
      await writeFile(outsideFile, linkedBytes);
      await link(outsideFile, linkedTarget);
      await assert.rejects(
        writeArchiveObject(archiveRoot, linkedObjectPath, linkedBytes),
        /regular, unlinked file/,
      );
    } finally {
      await rm(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('neutralizes spreadsheet formula prefixes in metadata CSV cells', () => {
    const csv = manifestCsv({
      captures: [
        {
          id: 'formula-test',
          claimUse: ['@external-value'],
          pdfMetadata: {
            extractor: 'pdfinfo (Poppler)',
            extractorVersion: '1.0',
            pageCount: 1,
            title: '=1+1',
            author: '+cmd',
            creationDate: null,
            modificationDate: null,
            extractionError: null,
          },
        },
      ],
    });
    assert.match(csv, /"'@external-value"/);
    assert.match(csv, /"'=1\+1"/);
    assert.match(csv, /"'\+cmd"/);
  });

  it('derives archive object paths only from validated SHA-256 values', () => {
    const hash = 'a'.repeat(64);
    assert.equal(archiveObjectPath(hash), `objects/sha256/aa/${hash}`);
    assert.throws(() => archiveObjectPath('../source.pdf'));
  });
});
