import {createHash} from 'node:crypto';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';

import {
  archiveMarkerContents,
  archiveObjectPath,
  checksumManifest,
  isWithin,
  manifestCsv,
  matchesExpectedSignature,
  sha256,
  validateManifest,
  validateRegistry,
} from './legacy-source-custody-lib.mjs';

export const RECOVERY_BUNDLE_KIND = 'help-math-legacy-source-recovery-bundle';
export const RECOVERY_BUNDLE_SCHEMA_VERSION = 1;
export const RECOVERY_BUNDLE_SUFFIX = '.hmbundle.json';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_BUNDLE_BYTES = 256 * 1024 * 1024;
const MAX_BUNDLE_ENTRIES = 10_000;
const MARKER_PATH = '.help-math-source-archive.json';
const BUNDLED_REGISTRY_PATH = 'metadata/legacy-source-registry.json';
const MANIFEST_PATTERN = /^manifests\/(legacy-source-crawl-(\d{4}-\d{2}-\d{2}))\.json$/;
const BUNDLE_EVIDENCE_BOUNDARY =
  'Local deterministic recovery package only; it does not prove off-device, offline, or durable remote custody.';

export async function verifyArchiveClosure({archiveRoot, registryPath, evidencePath}) {
  assertAbsolutePath('archive root', archiveRoot);
  assertAbsolutePath('registry path', registryPath);
  assertAbsolutePath('evidence path', evidencePath);

  const errors = [];
  const rootMetadata = await lstat(archiveRoot);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    return {errors: ['archive root must be a real directory'], files: [], manifests: []};
  }
  if (fileMode(rootMetadata) !== DIRECTORY_MODE) {
    errors.push('archive root mode must be 0700');
  }

  const root = await realpath(archiveRoot);
  const [registryBytes, repositoryManifestBytes] = await Promise.all([
    readFile(registryPath),
    readFile(evidencePath),
  ]);
  const repositoryCsvPath = evidencePath.replace(/\.json$/, '.csv');
  const repositoryShaPath = evidencePath.replace(/\.json$/, '.sha256');
  const [repositoryCsvBytes, repositoryShaBytes] = await Promise.all([
    readFile(repositoryCsvPath),
    readFile(repositoryShaPath),
  ]);

  const registry = parseJson(registryBytes, 'source registry', errors);
  const selectedManifest = parseJson(repositoryManifestBytes, 'repository evidence manifest', errors);
  if (registry) {
    errors.push(...validateRegistry(registry).map((error) => `registry: ${error}`));
  }
  if (registry && selectedManifest) {
    errors.push(
      ...validateManifest(selectedManifest, registry, {
        sourceRegistrySha256: sha256(registryBytes),
      }).map((error) => `selected manifest: ${error}`),
    );
  }

  const selectedArchiveManifest = `manifests/${path.basename(evidencePath)}`;
  const selectedArchiveCsv = selectedArchiveManifest.replace(/\.json$/, '.csv');
  const selectedArchiveSha = selectedArchiveManifest.replace(/\.json$/, '.sha256');
  const walked = await walkPrivateTree(root);
  errors.push(...walked.errors);
  const fileMap = new Map(walked.files.map((file) => [file.path, file]));

  compareFile(fileMap, selectedArchiveManifest, repositoryManifestBytes, errors);
  compareFile(fileMap, selectedArchiveCsv, repositoryCsvBytes, errors);
  compareFile(fileMap, selectedArchiveSha, repositoryShaBytes, errors);

  const validation = validateArchiveFileSet({
    fileMap,
    selectedManifestPath: selectedArchiveManifest,
    registryBytes,
  });
  errors.push(...validation.errors);

  const expectedDirectories = parentDirectories(validation.expectedFiles);
  for (const directory of walked.directories) {
    if (!expectedDirectories.has(directory.path)) {
      errors.push(`unexpected archive directory: ${directory.path}`);
    }
  }

  return {
    errors: uniqueSorted(errors),
    files: walked.files,
    manifests: validation.manifests,
    selectedManifest,
    selectedManifestPath: selectedArchiveManifest,
    registryBytes,
    archiveRoot: root,
  };
}

export async function buildRecoveryBundle({
  archiveRoot,
  registryPath,
  evidencePath,
  outputDirectory,
  forbiddenRoots = /** @type {string[]} */ ([]),
}) {
  assertAbsolutePath('output directory', outputDirectory);
  const outputMetadata = await lstat(outputDirectory);
  if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
    throw new Error('output directory must be a real existing directory');
  }
  const resolvedOutputDirectory = await realpath(outputDirectory);
  const resolvedHome = await realpath(homedir());
  if (
    resolvedOutputDirectory === path.parse(resolvedOutputDirectory).root ||
    resolvedOutputDirectory === resolvedHome
  ) {
    throw new Error('recovery bundle output directory is too broad');
  }
  for (const forbiddenRoot of forbiddenRoots) {
    const resolvedForbidden = await realpath(forbiddenRoot);
    if (
      resolvedOutputDirectory === resolvedForbidden ||
      isWithin(resolvedForbidden, resolvedOutputDirectory) ||
      isWithin(resolvedOutputDirectory, resolvedForbidden)
    ) {
      throw new Error('recovery bundle output must remain outside protected source/repository roots');
    }
  }
  if ((await readdir(resolvedOutputDirectory)).length > 0) {
    throw new Error('recovery bundle output directory must be a new empty directory');
  }
  await chmod(resolvedOutputDirectory, DIRECTORY_MODE);

  const closure = await verifyArchiveClosure({archiveRoot, registryPath, evidencePath});
  if (closure.errors.length > 0) {
    throw new Error(`archive closure validation failed:\n- ${closure.errors.join('\n- ')}`);
  }

  const archiveEntries = closure.files.map((file) => ({
    path: `archive/${file.path}`,
    mode: '0600',
    bytes: file.bytes,
  }));
  const entries = [
    ...archiveEntries,
    {
      path: BUNDLED_REGISTRY_PATH,
      mode: '0600',
      bytes: closure.registryBytes,
    },
  ]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => ({
      path: entry.path,
      mode: entry.mode,
      bytes: entry.bytes.length,
      sha256: sha256(entry.bytes),
      dataBase64: entry.bytes.toString('base64'),
    }));

  const entryMetadata = entries.map(withoutData);
  const packageRootSha256 = packageRootHash(entryMetadata);
  const selectedCaptureDate = closure.selectedManifest.captureDate;
  const bundle = {
    schemaVersion: RECOVERY_BUNDLE_SCHEMA_VERSION,
    bundleKind: RECOVERY_BUNDLE_KIND,
    captureDate: selectedCaptureDate,
    selectedManifest: `archive/${closure.selectedManifestPath}`,
    sourceRegistry: BUNDLED_REGISTRY_PATH,
    evidenceBoundary: BUNDLE_EVIDENCE_BOUNDARY,
    entryCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    packageRootSha256,
    entries,
  };
  const bundleBytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  const bundleSha256 = sha256(bundleBytes);
  const baseName = `help-math-legacy-source-recovery-${selectedCaptureDate}`;
  const bundlePath = path.join(resolvedOutputDirectory, `${baseName}${RECOVERY_BUNDLE_SUFFIX}`);
  const indexPath = path.join(resolvedOutputDirectory, `${baseName}.index.json`);
  const checksumPath = path.join(resolvedOutputDirectory, `${baseName}.sha256`);
  await assertAbsent([bundlePath, indexPath, checksumPath]);

  const index = {
    schemaVersion: RECOVERY_BUNDLE_SCHEMA_VERSION,
    bundleKind: RECOVERY_BUNDLE_KIND,
    bundleFile: path.basename(bundlePath),
    bundleSha256,
    captureDate: selectedCaptureDate,
    selectedManifest: bundle.selectedManifest,
    sourceRegistry: bundle.sourceRegistry,
    evidenceBoundary: bundle.evidenceBoundary,
    entryCount: bundle.entryCount,
    totalBytes: bundle.totalBytes,
    packageRootSha256,
    entries: entryMetadata,
  };
  const indexBytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`, 'utf8');
  const checksumBytes = Buffer.from(`${bundleSha256}  ${path.basename(bundlePath)}\n`, 'utf8');

  await writePrivateFile(bundlePath, bundleBytes);
  await writePrivateFile(indexPath, indexBytes);
  await writePrivateFile(checksumPath, checksumBytes);
  return {bundlePath, indexPath, checksumPath, bundleSha256, index};
}

export async function verifyRecoveryBundle(bundlePath) {
  assertAbsolutePath('bundle path', bundlePath);
  const bundleMetadata = await lstat(bundlePath);
  if (
    bundleMetadata.isSymbolicLink() ||
    !bundleMetadata.isFile() ||
    bundleMetadata.nlink !== 1 ||
    fileMode(bundleMetadata) !== FILE_MODE ||
    bundleMetadata.size <= 0 ||
    bundleMetadata.size > MAX_BUNDLE_BYTES
  ) {
    throw new Error(
      `bundle must be one non-empty, unlinked 0600 regular file no larger than ${MAX_BUNDLE_BYTES} bytes`,
    );
  }
  const bundleBytes = await readFile(bundlePath);
  const bundle = parseJson(bundleBytes, 'recovery bundle', []);
  const errors = [];
  if (!bundle) {
    throw new Error('recovery bundle is not valid JSON');
  }
  if (bundle.schemaVersion !== RECOVERY_BUNDLE_SCHEMA_VERSION) {
    errors.push(`bundle.schemaVersion must equal ${RECOVERY_BUNDLE_SCHEMA_VERSION}`);
  }
  if (bundle.bundleKind !== RECOVERY_BUNDLE_KIND) {
    errors.push(`bundle.bundleKind must equal ${RECOVERY_BUNDLE_KIND}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.captureDate ?? '')) {
    errors.push('bundle.captureDate must use YYYY-MM-DD');
  }
  if (bundle.evidenceBoundary !== BUNDLE_EVIDENCE_BOUNDARY) {
    errors.push('bundle.evidenceBoundary does not match the recovery evidence contract');
  }
  if (!Array.isArray(bundle.entries) || bundle.entries.length === 0) {
    errors.push('bundle.entries must be a non-empty array');
  } else if (bundle.entries.length > MAX_BUNDLE_ENTRIES) {
    errors.push(`bundle.entries cannot exceed ${MAX_BUNDLE_ENTRIES}`);
  }

  const decodedEntries = [];
  const seen = new Set();
  const bundleEntries = Array.isArray(bundle.entries) ? bundle.entries : [];
  for (const [index, entry] of bundleEntries.entries()) {
    const prefix = `bundle.entries[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    try {
      validateBundlePath(entry.path);
    } catch (error) {
      errors.push(`${prefix}.path: ${error.message}`);
      continue;
    }
    if (seen.has(entry.path)) {
      errors.push(`${prefix}.path duplicates ${entry.path}`);
      continue;
    }
    seen.add(entry.path);
    if (entry.mode !== '0600') {
      errors.push(`${prefix}.mode must equal 0600`);
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      errors.push(`${prefix}.bytes must be a non-negative safe integer`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) {
      errors.push(`${prefix}.sha256 must be a lowercase SHA-256 value`);
    }
    if (typeof entry.dataBase64 !== 'string') {
      errors.push(`${prefix}.dataBase64 must be a string`);
      continue;
    }
    const bytes = Buffer.from(entry.dataBase64, 'base64');
    if (bytes.toString('base64') !== entry.dataBase64) {
      errors.push(`${prefix}.dataBase64 must use canonical base64 encoding`);
    }
    if (bytes.length !== entry.bytes) {
      errors.push(`${prefix}.bytes does not match decoded data`);
    }
    if (sha256(bytes) !== entry.sha256) {
      errors.push(`${prefix}.sha256 does not match decoded data`);
    }
    decodedEntries.push({...withoutData(entry), bytes});
  }

  decodedEntries.sort((left, right) => left.path.localeCompare(right.path));
  const metadata = decodedEntries.map(({bytes, ...entry}) => ({...entry, bytes: bytes.length}));
  if (bundle.entryCount !== decodedEntries.length) {
    errors.push('bundle.entryCount does not match the decoded entries');
  }
  const totalBytes = decodedEntries.reduce((total, entry) => total + entry.bytes.length, 0);
  if (bundle.totalBytes !== totalBytes) {
    errors.push('bundle.totalBytes does not match the decoded entries');
  }
  if (bundle.packageRootSha256 !== packageRootHash(metadata)) {
    errors.push('bundle.packageRootSha256 does not match the entry inventory');
  }

  const entryMap = new Map(decodedEntries.map((entry) => [entry.path, entry]));
  const registryEntry = entryMap.get(bundle.sourceRegistry);
  if (bundle.sourceRegistry !== BUNDLED_REGISTRY_PATH || !registryEntry) {
    errors.push(`bundle.sourceRegistry must identify ${BUNDLED_REGISTRY_PATH}`);
  }
  const selectedManifestPath =
    typeof bundle.selectedManifest === 'string' && bundle.selectedManifest.startsWith('archive/')
      ? bundle.selectedManifest.slice('archive/'.length)
      : null;
  if (!selectedManifestPath || !MANIFEST_PATTERN.test(selectedManifestPath)) {
    errors.push('bundle.selectedManifest must identify an archive manifest entry');
  }

  if (registryEntry && selectedManifestPath) {
    const archiveFileMap = new Map();
    for (const entry of decodedEntries) {
      if (entry.path.startsWith('archive/')) {
        archiveFileMap.set(entry.path.slice('archive/'.length), entry);
      } else if (entry.path !== BUNDLED_REGISTRY_PATH) {
        errors.push(`unexpected bundle entry: ${entry.path}`);
      }
    }
    const validation = validateArchiveFileSet({
      fileMap: archiveFileMap,
      selectedManifestPath,
      registryBytes: registryEntry.bytes,
    });
    errors.push(...validation.errors);
    const selectedManifest = validation.manifests.find(
      (manifest) => manifest.captureDate === selectedManifestPath.match(MANIFEST_PATTERN)?.[2],
    );
    if (!selectedManifest || bundle.captureDate !== selectedManifest.captureDate) {
      errors.push('bundle.captureDate must match the selected manifest');
    }
    const expectedBundleEntries = new Set([
      ...validation.expectedFiles].map((entryPath) => `archive/${entryPath}`),
    );
    expectedBundleEntries.add(BUNDLED_REGISTRY_PATH);
    for (const entry of decodedEntries) {
      if (!expectedBundleEntries.has(entry.path)) {
        errors.push(`bundle contains an unexpected or orphan entry: ${entry.path}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`recovery bundle validation failed:\n- ${uniqueSorted(errors).join('\n- ')}`);
  }
  return {
    bundle,
    bundleBytes,
    bundleSha256: sha256(bundleBytes),
    entries: decodedEntries,
    index: {
      captureDate: bundle.captureDate,
      selectedManifest: bundle.selectedManifest,
      entryCount: bundle.entryCount,
      totalBytes: bundle.totalBytes,
      packageRootSha256: bundle.packageRootSha256,
    },
  };
}

export async function runStandaloneRestoreDrill({
  bundlePath,
  receiptPath,
  temporaryParent = tmpdir(),
  now = () => new Date(),
}) {
  assertAbsolutePath('receipt path', receiptPath);
  assertAbsolutePath('temporary parent', temporaryParent);
  const startedAt = now().toISOString();
  const verified = await verifyRecoveryBundle(bundlePath);
  const temporaryRoot = await mkdtemp(path.join(await realpath(temporaryParent), 'help-math-recovery-drill-'));
  let restored = false;
  try {
    const destination = path.join(temporaryRoot, 'restored');
    await extractVerifiedBundle(verified, destination);
    await verifyExtractedBundle(verified, destination);
    restored = true;
  } finally {
    await rm(temporaryRoot, {recursive: true, force: false});
  }
  if (!restored) {
    throw new Error('restore drill did not complete');
  }

  const completedAt = now().toISOString();
  const receipt = {
    schemaVersion: 1,
    receiptKind: 'help-math-legacy-source-local-restore-drill',
    status: 'passed',
    startedAt,
    completedAt,
    captureDate: verified.bundle.captureDate,
    bundleSha256: verified.bundleSha256,
    packageRootSha256: verified.bundle.packageRootSha256,
    entryCount: verified.bundle.entryCount,
    totalBytes: verified.bundle.totalBytes,
    selectedManifest: verified.bundle.selectedManifest,
    restoredIntoFreshTemporaryDirectory: true,
    temporaryRestoreRemoved: true,
    evidenceBoundary:
      'This same-machine temporary restore proves package readability and integrity only; it does not establish off-device, offline, or durable remote custody.',
  };
  await writeGeneratedFile(receiptPath, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8'), 0o644);
  return receipt;
}

function validateArchiveFileSet({fileMap, selectedManifestPath, registryBytes}) {
  const errors = [];
  const manifests = [];
  const expectedFiles = new Set([MARKER_PATH]);
  const marker = fileMap.get(MARKER_PATH);
  if (!marker) {
    errors.push(`archive is missing ${MARKER_PATH}`);
  } else if (!Buffer.from(marker.bytes).equals(Buffer.from(archiveMarkerContents(), 'utf8'))) {
    errors.push('archive marker contents do not match the custody contract');
  }
  const registry = parseJson(registryBytes, 'bundled source registry', errors);
  if (registry) {
    errors.push(...validateRegistry(registry).map((error) => `registry: ${error}`));
  }

  const manifestPaths = [...fileMap.keys()]
    .filter((filePath) => MANIFEST_PATTERN.test(filePath))
    .sort();
  if (manifestPaths.length !== 1) {
    errors.push('recovery schema v1 requires exactly one dated JSON manifest');
  }
  if (!manifestPaths.includes(selectedManifestPath)) {
    errors.push(`selected archive manifest is missing: ${selectedManifestPath}`);
  }

  for (const manifestPath of manifestPaths) {
    const match = manifestPath.match(MANIFEST_PATTERN);
    const csvPath = manifestPath.replace(/\.json$/, '.csv');
    const checksumPath = manifestPath.replace(/\.json$/, '.sha256');
    expectedFiles.add(manifestPath);
    expectedFiles.add(csvPath);
    expectedFiles.add(checksumPath);
    const manifestFile = fileMap.get(manifestPath);
    const csvFile = fileMap.get(csvPath);
    const checksumFile = fileMap.get(checksumPath);
    if (!csvFile || !checksumFile) {
      errors.push(`${manifestPath} is missing its CSV or SHA-256 companion`);
      continue;
    }
    const manifest = parseJson(manifestFile.bytes, manifestPath, errors);
    if (!manifest) {
      continue;
    }
    manifests.push(manifest);
    if (manifest.captureDate !== match[2]) {
      errors.push(`${manifestPath} captureDate does not match its filename`);
    }
    if (manifest.manifestKind !== 'legacy-source-crawl-evidence' || manifest.schemaVersion !== 1) {
      errors.push(`${manifestPath} is not a supported custody manifest`);
    }
    if (!Array.isArray(manifest.captures)) {
      errors.push(`${manifestPath} captures must be an array`);
      continue;
    }
    if (csvFile.bytes.toString('utf8') !== manifestCsv(manifest)) {
      errors.push(`${csvPath} does not match ${manifestPath}`);
    }
    if (checksumFile.bytes.toString('utf8') !== checksumManifest(manifest)) {
      errors.push(`${checksumPath} does not match ${manifestPath}`);
    }
    if (manifestPath === selectedManifestPath && registry) {
      errors.push(
        ...validateManifest(manifest, registry, {
          sourceRegistrySha256: sha256(registryBytes),
        }).map((error) => `${manifestPath}: ${error}`),
      );
    }
    for (const capture of manifest.captures) {
      if (!capture.archiveObject) {
        continue;
      }
      try {
        if (capture.archiveObject !== archiveObjectPath(capture.sha256)) {
          errors.push(`${manifestPath}:${capture.id} has a non-content-addressed object path`);
          continue;
        }
      } catch (error) {
        errors.push(`${manifestPath}:${capture.id} ${error.message}`);
        continue;
      }
      expectedFiles.add(capture.archiveObject);
      const object = fileMap.get(capture.archiveObject);
      if (!object) {
        errors.push(`${manifestPath}:${capture.id} is missing ${capture.archiveObject}`);
        continue;
      }
      if (object.bytes.length !== capture.bytes) {
        errors.push(`${manifestPath}:${capture.id} byte size differs from the manifest`);
      }
      if (sha256(object.bytes) !== capture.sha256) {
        errors.push(`${manifestPath}:${capture.id} SHA-256 differs from the manifest`);
      }
      if (!matchesExpectedSignature(capture.url, object.bytes)) {
        errors.push(`${manifestPath}:${capture.id} object signature does not match its locator`);
      }
    }
  }

  for (const filePath of fileMap.keys()) {
    if (!expectedFiles.has(filePath)) {
      errors.push(`unexpected or orphan archive file: ${filePath}`);
    }
  }
  return {errors: uniqueSorted(errors), expectedFiles, manifests};
}

async function walkPrivateTree(root) {
  const files = [];
  const directories = [];
  const errors = [];
  let totalBytes = 0;

  async function visit(directory, relativeDirectory) {
    const names = (await readdir(directory)).sort();
    for (const name of names) {
      const absolute = path.join(directory, name);
      const relative = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (files.length + directories.length >= MAX_BUNDLE_ENTRIES) {
        errors.push(`archive tree cannot exceed ${MAX_BUNDLE_ENTRIES} entries`);
        return;
      }
      if (relative.length > 512) {
        errors.push(`archive relative path cannot exceed 512 characters: ${relative.slice(0, 512)}`);
        continue;
      }
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) {
        errors.push(`archive path cannot be a symbolic link: ${relative}`);
        continue;
      }
      if (metadata.isDirectory()) {
        if (fileMode(metadata) !== DIRECTORY_MODE) {
          errors.push(`archive directory mode must be 0700: ${relative}`);
        }
        directories.push({path: relative, absolute});
        await visit(absolute, relative);
      } else if (metadata.isFile()) {
        if (metadata.nlink !== 1) {
          errors.push(`archive file must have exactly one hard link: ${relative}`);
        }
        if (fileMode(metadata) !== FILE_MODE) {
          errors.push(`archive file mode must be 0600: ${relative}`);
        }
        if (metadata.size > MAX_BUNDLE_BYTES || totalBytes + metadata.size > MAX_BUNDLE_BYTES) {
          errors.push(`archive byte total cannot exceed ${MAX_BUNDLE_BYTES} bytes`);
          continue;
        }
        totalBytes += metadata.size;
        files.push({
          path: relative,
          absolute,
          bytes: await readFile(absolute),
          mode: '0600',
        });
      } else {
        errors.push(`archive path must be a regular file or directory: ${relative}`);
      }
    }
  }

  await visit(root, '');
  files.sort((left, right) => left.path.localeCompare(right.path));
  directories.sort((left, right) => left.path.localeCompare(right.path));
  return {files, directories, errors};
}

async function extractVerifiedBundle(verified, destination) {
  await mkdir(destination, {recursive: false, mode: DIRECTORY_MODE});
  await chmod(destination, DIRECTORY_MODE);
  for (const entry of verified.entries) {
    const segments = entry.path.split('/');
    const fileName = segments.pop();
    let current = destination;
    for (const segment of segments) {
      current = path.join(current, segment);
      try {
        await mkdir(current, {mode: DIRECTORY_MODE});
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(`restore directory chain is unsafe: ${entry.path}`);
      }
      await chmod(current, DIRECTORY_MODE);
    }
    const target = path.join(current, fileName);
    await writeFile(target, entry.bytes, {flag: 'wx', mode: FILE_MODE});
    await chmod(target, FILE_MODE);
  }
}

async function verifyExtractedBundle(verified, destination) {
  const walked = await walkPrivateTree(destination);
  const errors = [...walked.errors];
  const actual = new Map(walked.files.map((file) => [file.path, file]));
  for (const entry of verified.entries) {
    const file = actual.get(entry.path);
    if (!file) {
      errors.push(`restored entry is missing: ${entry.path}`);
      continue;
    }
    if (file.bytes.length !== entry.bytes.length || sha256(file.bytes) !== entry.sha256) {
      errors.push(`restored entry differs from the bundle: ${entry.path}`);
    }
  }
  for (const filePath of actual.keys()) {
    if (!verified.entries.some((entry) => entry.path === filePath)) {
      errors.push(`restored tree contains an unexpected file: ${filePath}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`restored bundle validation failed:\n- ${uniqueSorted(errors).join('\n- ')}`);
  }
}

function packageRootHash(entries) {
  const canonical = entries
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.sha256}\t${entry.bytes}\t${entry.mode}\t${entry.path}\n`)
    .join('');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function withoutData(entry) {
  return {
    path: entry.path,
    mode: entry.mode,
    bytes: entry.bytes,
    sha256: entry.sha256,
  };
}

function validateBundlePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 512 ||
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('must be a normalized relative POSIX path');
  }
}

function parentDirectories(files) {
  const directories = new Set();
  for (const filePath of files) {
    let current = path.posix.dirname(filePath);
    while (current !== '.') {
      directories.add(current);
      current = path.posix.dirname(current);
    }
  }
  return directories;
}

function compareFile(fileMap, filePath, expectedBytes, errors) {
  const file = fileMap.get(filePath);
  if (!file) {
    errors.push(`archive is missing ${filePath}`);
  } else if (!file.bytes.equals(expectedBytes)) {
    errors.push(`archive ${filePath} does not match repository evidence`);
  }
}

function parseJson(bytes, label, errors) {
  try {
    return JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes));
  } catch (error) {
    errors.push(`${label} is not valid JSON (${error.message})`);
    return null;
  }
}

function fileMode(metadata) {
  return metadata.mode & 0o777;
}

function assertAbsolutePath(label, value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${label} must be an explicit absolute path`);
  }
}

async function assertAbsent(paths) {
  const existing = [];
  for (const target of paths) {
    try {
      await access(target);
      existing.push(target);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  if (existing.length > 0) {
    throw new Error(`refusing to overwrite recovery artifacts:\n${existing.join('\n')}`);
  }
}

async function writePrivateFile(target, bytes) {
  await writeGeneratedFile(target, bytes, FILE_MODE);
}

async function writeGeneratedFile(target, bytes, mode) {
  await writeFile(target, bytes, {flag: 'wx', mode});
  await chmod(target, mode);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
