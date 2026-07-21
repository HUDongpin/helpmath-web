import assert from 'node:assert/strict';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import {
  LEGACY_SOURCE_REQUEST_POLICY,
  archiveMarkerContents,
  archiveObjectPath,
  checksumManifest,
  manifestCsv,
  sha256,
  summarizeCaptures,
} from '../scripts/legacy-source-custody-lib.mjs';
import {
  buildRecoveryBundle,
  runStandaloneRestoreDrill,
  verifyArchiveClosure,
  verifyRecoveryBundle,
} from '../scripts/legacy-source-recovery-lib.mjs';

async function writePrivate(filePath: string, bytes: string | Uint8Array) {
  await mkdir(path.dirname(filePath), {recursive: true, mode: 0o700});
  await writeFile(filePath, bytes, {mode: 0o600});
  await chmod(filePath, 0o600);
}

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'helpmath-recovery-test-'));
  const repositoryRoot = path.join(root, 'repository');
  const archiveRoot = path.join(root, 'archive');
  const registryPath = path.join(repositoryRoot, 'data/legacy-source-registry.json');
  const evidencePath = path.join(
    repositoryRoot,
    'docs/evidence/legacy-source-crawl-2026-07-21.json',
  );
  await Promise.all([
    mkdir(repositoryRoot, {mode: 0o700}),
    mkdir(archiveRoot, {mode: 0o700}),
  ]);

  const source = {
    id: 'fixture-home',
    url: 'https://www.helpprogram.net/',
    claimUse: ['Recovery test fixture'],
    stableReplacement: null,
    rightsStatus: 'pending',
    accessibilityStatus: 'pending',
    republishStatus: 'pending',
    referencedBy: ['docs/CONTENT_SOURCES.md'],
  };
  const registry = {
    schemaVersion: 1,
    registryId: 'help-math-legacy-source-custody',
    reviewedAt: '2026-07-21',
    allowedOrigin: 'https://www.helpprogram.net',
    defaultArchiveRoot: '../helpmath-legacy-web-archive',
    currentEvidenceManifest: 'docs/evidence/legacy-source-crawl-2026-07-21.json',
    scope: 'Synthetic recovery test fixture.',
    defaults: {
      rightsStatus: 'pending',
      accessibilityStatus: 'pending',
      republishStatus: 'pending',
    },
    sources: [source],
  };
  const registryBytes = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`);
  const objectBytes = Buffer.from('<!doctype html><html><title>fixture</title></html>');
  const objectHash = sha256(objectBytes);
  const capture = {
    id: source.id,
    url: source.url,
    finalURL: source.url,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    lastModified: null,
    bytes: objectBytes.length,
    sha256: objectHash,
    capturedAt: '2026-07-21T00:00:00.000Z',
    attempts: 1,
    redirectChain: [],
    sourceFilename: 'index',
    pdfMetadata: null,
    claimUse: source.claimUse,
    stableReplacement: source.stableReplacement,
    rightsStatus: source.rightsStatus,
    accessibilityStatus: source.accessibilityStatus,
    republishStatus: source.republishStatus,
    archiveObject: archiveObjectPath(objectHash),
    error: null,
  };
  const manifest = {
    schemaVersion: 1,
    manifestKind: 'legacy-source-crawl-evidence',
    captureDate: '2026-07-21',
    createdAt: '2026-07-21T00:00:01.000Z',
    allowedOrigin: registry.allowedOrigin,
    sourceRegistry: 'data/legacy-source-registry.json',
    sourceRegistrySha256: sha256(registryBytes),
    archiveLayout: 'Content-addressed test objects.',
    evidenceBoundary: 'Synthetic test evidence only.',
    requestPolicy: {
      sameOriginHttpsOnly: true,
      redirectMode: 'manual-validation',
      timeoutMs: LEGACY_SOURCE_REQUEST_POLICY.timeoutMs.defaultValue,
      maxAttempts: LEGACY_SOURCE_REQUEST_POLICY.maxAttempts.defaultValue,
      maxBytesPerResponse: LEGACY_SOURCE_REQUEST_POLICY.maxBytesPerResponse.defaultValue,
      concurrency: LEGACY_SOURCE_REQUEST_POLICY.concurrency.defaultValue,
      retryableHttpStatuses: [...LEGACY_SOURCE_REQUEST_POLICY.retryableHttpStatuses],
    },
    pdfMetadataPolicy: {
      appliesTo: 'application/pdf responses',
      extractor: 'pdfinfo (Poppler)',
      extractorVersion: '1.0.0',
      extractorAvailabilityError: null,
      missingMetadataValue: null,
    },
    summary: summarizeCaptures([capture]),
    captures: [capture],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const csvBytes = Buffer.from(manifestCsv(manifest));
  const checksumBytes = Buffer.from(checksumManifest(manifest));
  const archiveManifestPath = path.join(archiveRoot, 'manifests', path.basename(evidencePath));

  await Promise.all([
    writePrivate(registryPath, registryBytes),
    writePrivate(evidencePath, manifestBytes),
    writePrivate(evidencePath.replace(/\.json$/u, '.csv'), csvBytes),
    writePrivate(evidencePath.replace(/\.json$/u, '.sha256'), checksumBytes),
    writePrivate(path.join(archiveRoot, '.help-math-source-archive.json'), archiveMarkerContents()),
    writePrivate(archiveManifestPath, manifestBytes),
    writePrivate(archiveManifestPath.replace(/\.json$/u, '.csv'), csvBytes),
    writePrivate(archiveManifestPath.replace(/\.json$/u, '.sha256'), checksumBytes),
    writePrivate(path.join(archiveRoot, capture.archiveObject), objectBytes),
  ]);

  return {root, repositoryRoot, archiveRoot, registryPath, evidencePath};
}

describe('legacy source archive recovery', () => {
  it('retains a metadata-only receipt for the completed same-machine drill', async () => {
    const repositoryRoot = process.cwd();
    const receiptPath = path.join(
      repositoryRoot,
      'docs/evidence/legacy-source-recovery-2026-07-21.json',
    );
    const [receiptText, custodyDocument] = await Promise.all([
      readFile(receiptPath, 'utf8'),
      readFile(path.join(repositoryRoot, 'docs/LEGACY_SOURCE_CUSTODY.md'), 'utf8'),
    ]);
    const receipt = JSON.parse(receiptText);

    assert.equal(receipt.status, 'passed');
    assert.equal(receipt.entryCount, 28);
    assert.match(receipt.bundleSha256, /^[a-f0-9]{64}$/u);
    assert.match(receipt.packageRootSha256, /^[a-f0-9]{64}$/u);
    assert.match(receipt.evidenceBoundary, /does not establish off-device/u);
    assert.ok(Buffer.byteLength(receiptText) < 5_000);
    assert.doesNotMatch(receiptText, /(?:archiveRoot|bundlePath|dataBase64|payload)/u);
    assert.match(custodyDocument, new RegExp(receipt.bundleSha256));
    assert.match(custodyDocument, new RegExp(receipt.packageRootSha256));
  });

  it('verifies a closed archive and rejects unexpected files', async () => {
    const fixture = await makeFixture();
    try {
      const verified = await verifyArchiveClosure(fixture);
      assert.deepEqual(verified.errors, []);
      assert.equal(verified.files.length, 5);
      assert.equal(verified.manifests.length, 1);

      await writePrivate(path.join(fixture.archiveRoot, 'orphan.txt'), 'unexpected');
      const withOrphan = await verifyArchiveClosure(fixture);
      assert.match(withOrphan.errors.join('\n'), /unexpected or orphan archive file: orphan\.txt/u);

      const selectedManifest = path.join(
        fixture.archiveRoot,
        'manifests/legacy-source-crawl-2026-07-21.json',
      );
      for (const extension of ['.json', '.csv', '.sha256']) {
        const source = selectedManifest.replace(/\.json$/u, extension);
        const second = source.replace('2026-07-21', '2026-07-22');
        await writePrivate(second, await readFile(source));
      }
      const withSecondManifest = await verifyArchiveClosure(fixture);
      assert.match(
        withSecondManifest.errors.join('\n'),
        /recovery schema v1 requires exactly one dated JSON manifest/u,
      );
    } finally {
      await rm(fixture.root, {recursive: true, force: true});
    }
  });

  it('builds byte-identical packages and restores one into a fresh temporary tree', async () => {
    const fixture = await makeFixture();
    const firstOutput = path.join(fixture.root, 'recovery-one');
    const secondOutput = path.join(fixture.root, 'recovery-two');
    await Promise.all([
      mkdir(firstOutput, {mode: 0o700}),
      mkdir(secondOutput, {mode: 0o700}),
    ]);

    try {
      const options = {
        archiveRoot: fixture.archiveRoot,
        registryPath: fixture.registryPath,
        evidencePath: fixture.evidencePath,
        forbiddenRoots: [fixture.repositoryRoot, fixture.archiveRoot],
      };
      const first = await buildRecoveryBundle({...options, outputDirectory: firstOutput});
      const second = await buildRecoveryBundle({...options, outputDirectory: secondOutput});
      assert.equal(first.bundleSha256, second.bundleSha256);
      assert.deepEqual(await readFile(first.bundlePath), await readFile(second.bundlePath));

      const verified = await verifyRecoveryBundle(first.bundlePath);
      assert.equal(verified.bundle.entryCount, 6);
      assert.equal(verified.entries.length, 6);
      const receiptPath = path.join(firstOutput, 'restore-receipt.json');
      const receipt = await runStandaloneRestoreDrill({
        bundlePath: first.bundlePath,
        receiptPath,
        temporaryParent: fixture.root,
        now: (() => {
          const timestamps = [
            new Date('2026-07-21T01:00:00.000Z'),
            new Date('2026-07-21T01:00:01.000Z'),
          ];
          return () => timestamps.shift() ?? new Date('2026-07-21T01:00:01.000Z');
        })(),
      });
      assert.equal(receipt.status, 'passed');
      assert.equal(receipt.bundleSha256, first.bundleSha256);
      assert.equal(receipt.restoredIntoFreshTemporaryDirectory, true);
      assert.equal(receipt.temporaryRestoreRemoved, true);
      assert.deepEqual(JSON.parse(await readFile(receiptPath, 'utf8')), receipt);

      const symbolicBundle = path.join(fixture.root, 'linked-bundle.json');
      await symlink(first.bundlePath, symbolicBundle);
      await assert.rejects(verifyRecoveryBundle(symbolicBundle), /unlinked 0600 regular file/u);
      const hardLinkedBundle = path.join(fixture.root, 'hard-linked-bundle.json');
      await link(first.bundlePath, hardLinkedBundle);
      await assert.rejects(verifyRecoveryBundle(first.bundlePath), /unlinked 0600 regular file/u);
      await rm(hardLinkedBundle);
      assert.equal((await verifyRecoveryBundle(first.bundlePath)).bundleSha256, first.bundleSha256);

      await chmod(first.bundlePath, 0o644);
      await assert.rejects(verifyRecoveryBundle(first.bundlePath), /unlinked 0600 regular file/u);
      await chmod(first.bundlePath, 0o600);
      assert.equal((await verifyRecoveryBundle(first.bundlePath)).bundleSha256, first.bundleSha256);
    } finally {
      await rm(fixture.root, {recursive: true, force: true});
    }
  });

  it('rejects tampered bytes and path traversal before extraction', async () => {
    const fixture = await makeFixture();
    const output = path.join(fixture.root, 'recovery');
    await mkdir(output, {mode: 0o700});

    try {
      const built = await buildRecoveryBundle({
        archiveRoot: fixture.archiveRoot,
        registryPath: fixture.registryPath,
        evidencePath: fixture.evidencePath,
        outputDirectory: output,
        forbiddenRoots: [fixture.repositoryRoot, fixture.archiveRoot],
      });
      const bundle = JSON.parse(await readFile(built.bundlePath, 'utf8'));

      const tampered = structuredClone(bundle);
      tampered.entries[0].dataBase64 = Buffer.from('tampered').toString('base64');
      const tamperedPath = path.join(fixture.root, 'tampered.hmbundle.json');
      await writePrivate(tamperedPath, `${JSON.stringify(tampered)}\n`);
      await assert.rejects(verifyRecoveryBundle(tamperedPath), /does not match decoded data/u);

      const traversal = structuredClone(bundle);
      traversal.entries[0].path = '../escape';
      const traversalPath = path.join(fixture.root, 'traversal.hmbundle.json');
      await writePrivate(traversalPath, `${JSON.stringify(traversal)}\n`);
      await assert.rejects(verifyRecoveryBundle(traversalPath), /normalized relative POSIX path/u);
    } finally {
      await rm(fixture.root, {recursive: true, force: true});
    }
  });
});
