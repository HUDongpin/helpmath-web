import {createHash} from 'node:crypto';
import {chmod, lstat, mkdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

export const LEGACY_ALLOWED_ORIGIN = 'https://www.helpprogram.net';
export const CUSTODY_STATUSES = new Set(['pending', 'approved', 'declined']);
export const ARCHIVE_MARKER_FILENAME = '.help-math-source-archive.json';
export const LEGACY_SOURCE_REQUEST_POLICY = Object.freeze({
  timeoutMs: Object.freeze({minimum: 1_000, maximum: 60_000, defaultValue: 20_000}),
  maxAttempts: Object.freeze({minimum: 1, maximum: 5, defaultValue: 3}),
  maxBytesPerResponse: Object.freeze({
    minimum: 1_024,
    maximum: 100 * 1024 * 1024,
    defaultValue: 32 * 1024 * 1024,
  }),
  concurrency: Object.freeze({minimum: 1, maximum: 4, defaultValue: 2}),
  maxRedirects: 5,
  retryableHttpStatuses: Object.freeze([408, 425, 429, 500, 502, 503, 504]),
});

const ARCHIVE_MARKER = Object.freeze({
  schemaVersion: 1,
  archiveId: 'help-math-legacy-web-archive',
  allowedOrigin: LEGACY_ALLOWED_ORIGIN,
  purpose: 'Restricted owner custody for original legacy HELP Math web-source bytes.',
});

export function archiveMarkerContents() {
  return `${JSON.stringify(ARCHIVE_MARKER, null, 2)}\n`;
}

export async function prepareDedicatedArchiveRoot(requestedRoot, repositoryRoot) {
  if (typeof requestedRoot !== 'string' || !path.isAbsolute(requestedRoot)) {
    throw new Error('archive root must be an explicit absolute path');
  }
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new Error('repository root must be an explicit absolute path');
  }

  const normalized = path.resolve(requestedRoot);
  const filesystemRoot = path.parse(normalized).root;
  if (normalized === filesystemRoot) {
    throw new Error('archive root is too broad');
  }

  const [resolvedRepositoryRoot, resolvedHome, resolvedParent] = await Promise.all([
    realpath(repositoryRoot),
    realpath(homedir()),
    realpath(path.dirname(normalized)),
  ]);
  const projectedRoot = path.join(resolvedParent, path.basename(normalized));
  assertSafeArchiveLocation(projectedRoot, resolvedRepositoryRoot, resolvedHome);
  if (await hasGitAncestor(projectedRoot)) {
    throw new Error('archive root cannot be a Git worktree or live inside one');
  }

  let exists = true;
  let metadata;
  try {
    metadata = await lstat(normalized);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    exists = false;
  }

  let archiveRoot;
  if (exists) {
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error('existing archive root must be a real directory, not a file or symbolic link');
    }
    archiveRoot = await realpath(normalized);
    assertSafeArchiveLocation(archiveRoot, resolvedRepositoryRoot, resolvedHome);
    await assertDedicatedArchiveMarker(archiveRoot);
  } else {
    await mkdir(normalized, {recursive: false, mode: 0o700});
    archiveRoot = await realpath(normalized);
    assertSafeArchiveLocation(archiveRoot, resolvedRepositoryRoot, resolvedHome);
    const markerPath = path.join(archiveRoot, ARCHIVE_MARKER_FILENAME);
    await writeFile(markerPath, archiveMarkerContents(), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  }

  const markerPath = path.join(archiveRoot, ARCHIVE_MARKER_FILENAME);
  await chmod(markerPath, 0o600);
  await chmod(archiveRoot, 0o700);
  return archiveRoot;
}

export function validateCaptureResponse(sourceUrl, response) {
  const errors = [];
  let normalizedSource;
  try {
    normalizedSource = normalizeLegacyUrl(sourceUrl);
  } catch (error) {
    return [error.message];
  }

  if (!response || typeof response !== 'object') {
    return ['response must be an object'];
  }
  if (response.status !== 200) {
    errors.push(`response status must be HTTP 200, received ${response.status}`);
  }
  if (!(response.bytes instanceof Uint8Array) || response.bytes.byteLength === 0) {
    errors.push('response body must be non-empty bytes');
  }

  const contentType =
    typeof response.contentType === 'string' ? response.contentType.toLowerCase() : '';
  const expectsPdf = new URL(normalizedSource).pathname.toLowerCase().endsWith('.pdf');
  if (expectsPdf && !contentType.startsWith('application/pdf')) {
    errors.push('PDF locator must return application/pdf');
  } else if (!expectsPdf && !contentType.startsWith('text/html')) {
    errors.push('HTML locator must return text/html');
  }
  if (
    response.bytes instanceof Uint8Array &&
    response.bytes.byteLength > 0 &&
    !matchesExpectedSignature(normalizedSource, response.bytes)
  ) {
    errors.push('response bytes do not match the expected PDF/HTML signature');
  }
  return errors;
}

function assertSafeArchiveLocation(candidate, repositoryRoot, homeRoot) {
  const filesystemRoot = path.parse(candidate).root;
  if (
    candidate === filesystemRoot ||
    candidate === homeRoot ||
    candidate === repositoryRoot ||
    isWithin(candidate, repositoryRoot) ||
    isWithin(repositoryRoot, candidate)
  ) {
    throw new Error('archive root is too broad or overlaps the website repository');
  }
}

async function hasGitAncestor(candidate) {
  let current = candidate;
  while (true) {
    try {
      await lstat(path.join(current, '.git'));
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return false;
    }
    current = parent;
  }
}

async function assertDedicatedArchiveMarker(archiveRoot) {
  const markerPath = path.join(archiveRoot, ARCHIVE_MARKER_FILENAME);
  let metadata;
  try {
    metadata = await lstat(markerPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `existing archive root is not dedicated: missing ${ARCHIVE_MARKER_FILENAME}`,
      );
    }
    throw error;
  }
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) {
    throw new Error('archive marker must be one regular, unlinked file');
  }
  if ((await readFile(markerPath, 'utf8')) !== archiveMarkerContents()) {
    throw new Error('archive marker contents do not match the HELP Math custody contract');
  }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function normalizeLegacyUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('legacy source URL must be a non-empty string');
  }

  const url = new URL(value);
  if (url.origin !== LEGACY_ALLOWED_ORIGIN) {
    throw new Error(`legacy source URL must use ${LEGACY_ALLOWED_ORIGIN}: ${value}`);
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error(`legacy source URL cannot contain credentials, a port, query, or fragment: ${value}`);
  }

  url.pathname = url.pathname.replaceAll('(', '%28').replaceAll(')', '%29');
  return url.href;
}

export function normalizeExactDocumentPath(value) {
  const unescaped = value.replace(/\\([()])/g, '$1');
  const encoded = unescaped.replaceAll('(', '%28').replaceAll(')', '%29');
  return normalizeLegacyUrl(new URL(encoded, `${LEGACY_ALLOWED_ORIGIN}/`).href);
}

export function validateRegistry(registry) {
  const errors = [];
  const ids = new Set();
  const urls = new Set();

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['registry must be an object'];
  }
  if (registry.schemaVersion !== 1) {
    errors.push('registry.schemaVersion must equal 1');
  }
  if (registry.allowedOrigin !== LEGACY_ALLOWED_ORIGIN) {
    errors.push(`registry.allowedOrigin must equal ${LEGACY_ALLOWED_ORIGIN}`);
  }
  if (registry.defaultArchiveRoot !== '../helpmath-legacy-web-archive') {
    errors.push('registry.defaultArchiveRoot must identify the portable repository-sibling archive');
  }
  if (!/^docs\/evidence\/legacy-source-crawl-\d{4}-\d{2}-\d{2}\.json$/.test(registry.currentEvidenceManifest ?? '')) {
    errors.push('registry.currentEvidenceManifest must identify a dated repository evidence JSON file');
  }
  if (!registry.defaults || typeof registry.defaults !== 'object') {
    errors.push('registry.defaults must be an object');
  } else {
    for (const field of ['rightsStatus', 'accessibilityStatus', 'republishStatus']) {
      if (registry.defaults[field] !== 'pending') {
        errors.push(`registry.defaults.${field} must equal pending`);
      }
    }
  }
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) {
    errors.push('registry.sources must be a non-empty array');
    return errors;
  }

  for (const [index, source] of registry.sources.entries()) {
    const prefix = `registry.sources[${index}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id ?? '')) {
      errors.push(`${prefix}.id must be a lowercase kebab-case identifier`);
    } else if (ids.has(source.id)) {
      errors.push(`${prefix}.id duplicates ${source.id}`);
    } else {
      ids.add(source.id);
    }

    try {
      const normalized = normalizeLegacyUrl(source.url);
      if (normalized !== source.url) {
        errors.push(`${prefix}.url must use canonical percent encoding: ${normalized}`);
      }
      if (urls.has(normalized)) {
        errors.push(`${prefix}.url duplicates ${normalized}`);
      } else {
        urls.add(normalized);
      }
    } catch (error) {
      errors.push(`${prefix}.url: ${error.message}`);
    }

    if (
      !Array.isArray(source.claimUse) ||
      source.claimUse.length === 0 ||
      source.claimUse.some((claim) => typeof claim !== 'string' || claim.trim().length === 0)
    ) {
      errors.push(`${prefix}.claimUse must be a non-empty string array`);
    }

    if (source.stableReplacement !== null) {
      try {
        const replacement = new URL(source.stableReplacement);
        if (replacement.protocol !== 'https:') {
          errors.push(`${prefix}.stableReplacement must use HTTPS`);
        }
        if (replacement.username || replacement.password || replacement.port) {
          errors.push(
            `${prefix}.stableReplacement cannot contain credentials or a custom port`,
          );
        }
        if (replacement.hash) {
          errors.push(`${prefix}.stableReplacement cannot contain a fragment`);
        }
        if (
          replacement.search &&
          !(
            replacement.hostname === 'eric.ed.gov' &&
            [...replacement.searchParams].length === 1 &&
            /^[A-Z]{2}\d{6}$/.test(replacement.searchParams.get('id') ?? '')
          )
        ) {
          errors.push(
            `${prefix}.stableReplacement query must match the explicit ERIC id allowlist`,
          );
        }
        if (replacement.hostname === 'helpprogram.net' || replacement.hostname.endsWith('.helpprogram.net')) {
          errors.push(`${prefix}.stableReplacement cannot point to the retiring domain`);
        }
      } catch {
        errors.push(`${prefix}.stableReplacement must be null or an absolute URL`);
      }
    }

    for (const field of ['rightsStatus', 'accessibilityStatus', 'republishStatus']) {
      if (!CUSTODY_STATUSES.has(source[field])) {
        errors.push(`${prefix}.${field} must be pending, approved, or declined`);
      }
    }

    if (
      !Array.isArray(source.referencedBy) ||
      source.referencedBy.length === 0 ||
      source.referencedBy.some((document) =>
        ![
          'docs/CONTENT_SOURCES.md',
          'docs/LEGACY_RESOURCE_MAP.md',
          'docs/LAUNCH_DECISIONS.md',
        ].includes(document),
      )
    ) {
      errors.push(`${prefix}.referencedBy must name one or both source-register documents`);
    }
  }

  return errors;
}

export function extractAbsoluteLegacyLocators(markdown) {
  const matches = markdown.match(/https:\/\/www\.helpprogram\.net\/[^\s)>|]*/g) ?? [];
  return new Set(matches.map((value) => normalizeLegacyUrl(value)));
}

export function extractExactDocumentLocators(markdown) {
  const section = markdown.match(/## Exact document mapping\n([\s\S]*?)\n## Stable external records/);
  if (!section) {
    throw new Error('LEGACY_RESOURCE_MAP.md is missing the Exact document mapping section');
  }

  const locators = new Set();
  for (const line of section[1].split('\n')) {
    const match = line.match(/^\| `([^`]+)` \|/);
    if (match) {
      locators.add(normalizeExactDocumentPath(match[1]));
    }
  }
  if (locators.size === 0) {
    throw new Error('Exact document mapping section contains no finite locators');
  }
  return locators;
}

export function expectedDocumentedLocators(contentSources, legacyResourceMap, launchDecisions = '') {
  return new Set([
    ...extractAbsoluteLegacyLocators(contentSources),
    ...extractExactDocumentLocators(legacyResourceMap),
    ...extractAbsoluteLegacyLocators(launchDecisions),
  ]);
}

export function archiveObjectPath(hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`invalid SHA-256 value: ${hash}`);
  }
  return `objects/sha256/${hash.slice(0, 2)}/${hash}`;
}

export function summarizeCaptures(captures) {
  const httpResponses = captures.filter((capture) => Number.isInteger(capture.status)).length;
  const successful = captures.filter(isSuccessfulCapture).length;
  return {
    registered: captures.length,
    httpResponses,
    successful,
    nonSuccessfulHttp: httpResponses - successful,
    requestErrors: captures.length - httpResponses,
    totalBytes: captures.reduce((total, capture) => total + (capture.bytes ?? 0), 0),
  };
}

export function validateManifest(manifest, registry, options = {}) {
  const errors = [];
  const registryErrors = validateRegistry(registry);
  errors.push(...registryErrors.map((error) => `registry: ${error}`));

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [...errors, 'manifest must be an object'];
  }
  if (manifest.schemaVersion !== 1) {
    errors.push('manifest.schemaVersion must equal 1');
  }
  if (manifest.manifestKind !== 'legacy-source-crawl-evidence') {
    errors.push('manifest.manifestKind must equal legacy-source-crawl-evidence');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.captureDate ?? '')) {
    errors.push('manifest.captureDate must use YYYY-MM-DD');
  }
  if (!isUtcIsoTimestamp(manifest.createdAt)) {
    errors.push('manifest.createdAt must be an ISO UTC timestamp');
  } else if (!manifest.createdAt.startsWith(`${manifest.captureDate}T`)) {
    errors.push('manifest.createdAt must fall on manifest.captureDate');
  }
  if (manifest.allowedOrigin !== registry.allowedOrigin) {
    errors.push('manifest.allowedOrigin must match the registry');
  }
  if (manifest.sourceRegistry !== 'data/legacy-source-registry.json') {
    errors.push('manifest.sourceRegistry must identify data/legacy-source-registry.json');
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.sourceRegistrySha256 ?? '')) {
    errors.push('manifest.sourceRegistrySha256 must be a lowercase SHA-256 value');
  } else if (
    options.sourceRegistrySha256 &&
    manifest.sourceRegistrySha256 !== options.sourceRegistrySha256
  ) {
    errors.push('manifest.sourceRegistrySha256 does not match the registry bytes');
  }
  if (Object.hasOwn(manifest, 'archiveRoot')) {
    errors.push('repository evidence must not embed a workstation-specific archive root');
  }
  if (typeof manifest.archiveLayout !== 'string' || manifest.archiveLayout.length === 0) {
    errors.push('manifest.archiveLayout must describe the external object layout');
  }
  if (typeof manifest.evidenceBoundary !== 'string' || manifest.evidenceBoundary.length === 0) {
    errors.push('manifest.evidenceBoundary must state the evidence limitations');
  }
  const requestPolicy = manifest.requestPolicy;
  if (!requestPolicy || typeof requestPolicy !== 'object' || Array.isArray(requestPolicy)) {
    errors.push('manifest.requestPolicy must record the bounded same-origin request policy');
  } else {
    if (
      requestPolicy.sameOriginHttpsOnly !== true ||
      requestPolicy.redirectMode !== 'manual-validation'
    ) {
      errors.push('manifest.requestPolicy must record the bounded same-origin request policy');
    }
    validatePolicyInteger(
      requestPolicy.timeoutMs,
      LEGACY_SOURCE_REQUEST_POLICY.timeoutMs,
      'manifest.requestPolicy.timeoutMs',
      errors,
    );
    validatePolicyInteger(
      requestPolicy.maxAttempts,
      LEGACY_SOURCE_REQUEST_POLICY.maxAttempts,
      'manifest.requestPolicy.maxAttempts',
      errors,
    );
    validatePolicyInteger(
      requestPolicy.maxBytesPerResponse,
      LEGACY_SOURCE_REQUEST_POLICY.maxBytesPerResponse,
      'manifest.requestPolicy.maxBytesPerResponse',
      errors,
    );
    validatePolicyInteger(
      requestPolicy.concurrency,
      LEGACY_SOURCE_REQUEST_POLICY.concurrency,
      'manifest.requestPolicy.concurrency',
      errors,
    );
    if (
      JSON.stringify(requestPolicy.retryableHttpStatuses) !==
      JSON.stringify(LEGACY_SOURCE_REQUEST_POLICY.retryableHttpStatuses)
    ) {
      errors.push(
        'manifest.requestPolicy.retryableHttpStatuses must match the reviewed transient-status allowlist',
      );
    }
  }
  if (
    !manifest.pdfMetadataPolicy ||
    manifest.pdfMetadataPolicy.extractor !== 'pdfinfo (Poppler)' ||
    !Object.hasOwn(manifest.pdfMetadataPolicy, 'extractorVersion') ||
    !Object.hasOwn(manifest.pdfMetadataPolicy, 'extractorAvailabilityError')
  ) {
    errors.push('manifest.pdfMetadataPolicy must record the pdfinfo extractor and availability');
  }
  if (!Array.isArray(manifest.captures)) {
    errors.push('manifest.captures must be an array');
    return errors;
  }
  if (manifest.captures.length !== registry.sources.length) {
    errors.push('manifest must contain exactly one capture for every registry source');
  }

  for (const [index, source] of registry.sources.entries()) {
    const capture = manifest.captures[index];
    const prefix = `manifest.captures[${index}]`;
    if (!capture) {
      errors.push(`${prefix} is missing`);
      continue;
    }
    for (const field of ['id', 'url', 'stableReplacement', 'rightsStatus', 'accessibilityStatus', 'republishStatus']) {
      if (capture[field] !== source[field]) {
        errors.push(`${prefix}.${field} must match the registry`);
      }
    }
    if (JSON.stringify(capture.claimUse) !== JSON.stringify(source.claimUse)) {
      errors.push(`${prefix}.claimUse must match the registry`);
    }
    if (!isUtcIsoTimestamp(capture.capturedAt)) {
      errors.push(`${prefix}.capturedAt must be an ISO UTC timestamp`);
    } else {
      if (!capture.capturedAt.startsWith(`${manifest.captureDate}T`)) {
        errors.push(`${prefix}.capturedAt must fall on manifest.captureDate`);
      }
      if (isUtcIsoTimestamp(manifest.createdAt) && capture.capturedAt > manifest.createdAt) {
        errors.push(`${prefix}.capturedAt cannot be later than manifest.createdAt`);
      }
    }
    if (!Number.isInteger(capture.attempts) || capture.attempts < 1) {
      errors.push(`${prefix}.attempts must be a positive integer`);
    } else if (
      Number.isSafeInteger(requestPolicy?.maxAttempts) &&
      capture.attempts > requestPolicy.maxAttempts
    ) {
      errors.push(`${prefix}.attempts cannot exceed manifest.requestPolicy.maxAttempts`);
    }
    if (!Array.isArray(capture.redirectChain) || capture.redirectChain.some((url) => {
      try {
        normalizeLegacyUrl(url);
        return false;
      } catch {
        return true;
      }
    })) {
      errors.push(`${prefix}.redirectChain must contain only same-origin HTTPS URLs`);
    } else if (capture.redirectChain.length > LEGACY_SOURCE_REQUEST_POLICY.maxRedirects) {
      errors.push(
        `${prefix}.redirectChain cannot exceed ${LEGACY_SOURCE_REQUEST_POLICY.maxRedirects} redirects`,
      );
    }
    const expectedFinalURL = capture.redirectChain?.at(-1) ?? source.url;
    if (capture.finalURL !== null && capture.finalURL !== expectedFinalURL) {
      errors.push(`${prefix}.finalURL must match the source URL or final validated redirect`);
    }
    if (capture.sourceFilename !== sourceFilename(source.url)) {
      errors.push(`${prefix}.sourceFilename must match the source URL path`);
    }

    if (Number.isInteger(capture.status)) {
      if (capture.status < 100 || capture.status > 599) {
        errors.push(`${prefix}.status must be a valid HTTP status`);
      }
      try {
        normalizeLegacyUrl(capture.finalURL);
      } catch (error) {
        errors.push(`${prefix}.finalURL: ${error.message}`);
      }
      if (typeof capture.contentType !== 'string') {
        errors.push(`${prefix}.contentType must be a string for an HTTP response`);
      }
      if (capture.lastModified !== null && typeof capture.lastModified !== 'string') {
        errors.push(`${prefix}.lastModified must be null or a string`);
      }
      if (!Number.isInteger(capture.bytes) || capture.bytes < 0) {
        errors.push(`${prefix}.bytes must be a non-negative integer`);
      } else if (
        Number.isSafeInteger(requestPolicy?.maxBytesPerResponse) &&
        capture.bytes > requestPolicy.maxBytesPerResponse
      ) {
        errors.push(
          `${prefix}.bytes cannot exceed manifest.requestPolicy.maxBytesPerResponse`,
        );
      }
      if (!/^[a-f0-9]{64}$/.test(capture.sha256 ?? '')) {
        errors.push(`${prefix}.sha256 must be a lowercase SHA-256 value`);
      } else if (capture.archiveObject !== archiveObjectPath(capture.sha256)) {
        errors.push(`${prefix}.archiveObject must be the content-addressed object path`);
      }
      if (capture.error !== null) {
        errors.push(`${prefix}.error must be null for an HTTP response`);
      }
      const isPdf = capture.contentType.toLowerCase().startsWith('application/pdf');
      const expectsPdf = new URL(source.url).pathname.toLowerCase().endsWith('.pdf');
      if (expectsPdf && !isPdf) {
        errors.push(`${prefix}.contentType must be application/pdf for a PDF locator`);
      } else if (!expectsPdf && !capture.contentType.toLowerCase().startsWith('text/html')) {
        errors.push(`${prefix}.contentType must be text/html for an HTML locator`);
      }
      if (isPdf) {
        validatePdfMetadata(capture.pdfMetadata, prefix, errors);
      } else if (capture.pdfMetadata !== null) {
        errors.push(`${prefix}.pdfMetadata must be null for a non-PDF response`);
      }
    } else {
      for (const field of ['status', 'finalURL', 'contentType', 'lastModified', 'bytes', 'sha256', 'archiveObject']) {
        if (capture[field] !== null) {
          errors.push(`${prefix}.${field} must be null for a request error`);
        }
      }
      if (typeof capture.error !== 'string' || capture.error.length === 0) {
        errors.push(`${prefix}.error must describe the request failure`);
      }
      if (capture.pdfMetadata !== null) {
        errors.push(`${prefix}.pdfMetadata must be null for a request error`);
      }
    }
  }

  const expectedSummary = summarizeCaptures(manifest.captures);
  if (JSON.stringify(manifest.summary) !== JSON.stringify(expectedSummary)) {
    errors.push('manifest.summary does not match the capture records');
  }
  return errors;
}

export function manifestCsv(manifest) {
  const fields = [
    'id',
    'url',
    'finalURL',
    'status',
    'contentType',
    'lastModified',
    'bytes',
    'sha256',
    'capturedAt',
    'attempts',
    'claimUse',
    'stableReplacement',
    'rightsStatus',
    'accessibilityStatus',
    'republishStatus',
    'archiveObject',
    'error',
    'pdfMetadataExtractor',
    'pdfMetadataExtractorVersion',
    'pdfPageCount',
    'pdfTitle',
    'pdfAuthor',
    'pdfCreationDate',
    'pdfModificationDate',
    'pdfMetadataExtractionError',
  ];
  const rows = manifest.captures.map((capture) => {
    const values = {
      ...capture,
      claimUse: capture.claimUse.join(' | '),
      pdfMetadataExtractor: capture.pdfMetadata?.extractor ?? null,
      pdfMetadataExtractorVersion: capture.pdfMetadata?.extractorVersion ?? null,
      pdfPageCount: capture.pdfMetadata?.pageCount ?? null,
      pdfTitle: capture.pdfMetadata?.title ?? null,
      pdfAuthor: capture.pdfMetadata?.author ?? null,
      pdfCreationDate: capture.pdfMetadata?.creationDate ?? null,
      pdfModificationDate: capture.pdfMetadata?.modificationDate ?? null,
      pdfMetadataExtractionError: capture.pdfMetadata?.extractionError ?? null,
    };
    return fields.map((field) => csvCell(values[field])).join(',');
  });
  return `${fields.join(',')}\n${rows.join('\n')}\n`;
}

export function checksumManifest(manifest) {
  const objects = new Map();
  for (const capture of manifest.captures) {
    if (capture.sha256 && capture.archiveObject) {
      objects.set(capture.archiveObject, capture.sha256);
    }
  }
  return `${[...objects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([objectPath, hash]) => `${hash}  ${objectPath}`)
    .join('\n')}\n`;
}

export async function verifyArchiveObjects(manifest, archiveRoot) {
  const root = await realpath(archiveRoot);
  const errors = [];
  try {
    await assertDedicatedArchiveMarker(root);
  } catch (error) {
    return [`archive root marker is invalid: ${error.message}`];
  }

  for (const capture of manifest.captures) {
    if (!capture.archiveObject) {
      continue;
    }
    const candidate = path.resolve(root, capture.archiveObject);
    if (!isWithin(root, candidate)) {
      errors.push(`${capture.id}: archive object escapes the archive root`);
      continue;
    }
    try {
      const resolved = await realpath(candidate);
      if (!isWithin(root, resolved)) {
        errors.push(`${capture.id}: archive object resolves outside the archive root`);
        continue;
      }
      const metadata = await stat(resolved);
      if (!metadata.isFile()) {
        errors.push(`${capture.id}: archive object is not a regular file`);
        continue;
      }
      const bytes = await readFile(resolved);
      if (bytes.length !== capture.bytes) {
        errors.push(`${capture.id}: byte size differs from the manifest`);
      }
      if (sha256(bytes) !== capture.sha256) {
        errors.push(`${capture.id}: SHA-256 differs from the manifest`);
      }
      if (!matchesExpectedSignature(capture.url, bytes)) {
        errors.push(`${capture.id}: archived bytes do not match the expected PDF/HTML signature`);
      }
    } catch (error) {
      errors.push(`${capture.id}: cannot verify archive object (${error.message})`);
    }
  }
  return errors;
}

export function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function isSuccessfulCapture(capture) {
  return (
    capture.status === 200 &&
    Number.isSafeInteger(capture.bytes) &&
    capture.bytes > 0 &&
    expectedMetadataTypeMatches(capture)
  );
}

function isUtcIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function validatePdfMetadata(metadata, prefix, errors) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push(`${prefix}.pdfMetadata must be an object for a PDF response`);
    return;
  }
  if (metadata.extractor !== 'pdfinfo (Poppler)') {
    errors.push(`${prefix}.pdfMetadata.extractor must identify pdfinfo (Poppler)`);
  }
  if (metadata.extractorVersion !== null && typeof metadata.extractorVersion !== 'string') {
    errors.push(`${prefix}.pdfMetadata.extractorVersion must be null or a string`);
  }
  if (metadata.pageCount !== null && (!Number.isSafeInteger(metadata.pageCount) || metadata.pageCount < 1)) {
    errors.push(`${prefix}.pdfMetadata.pageCount must be null or a positive integer`);
  }
  for (const field of ['title', 'author', 'creationDate', 'modificationDate', 'extractionError']) {
    if (metadata[field] !== null && typeof metadata[field] !== 'string') {
      errors.push(`${prefix}.pdfMetadata.${field} must be null or a string`);
    }
  }
  if (metadata.extractionError === null && metadata.pageCount === null) {
    errors.push(`${prefix}.pdfMetadata.pageCount is required when extraction succeeds`);
  }
}

function expectedMetadataTypeMatches(capture) {
  const expectsPdf = new URL(capture.url).pathname.toLowerCase().endsWith('.pdf');
  if (expectsPdf) {
    return (
      capture.contentType?.toLowerCase().startsWith('application/pdf') === true &&
      capture.pdfMetadata?.extractionError === null &&
      Number.isSafeInteger(capture.pdfMetadata?.pageCount) &&
      capture.pdfMetadata.pageCount > 0
    );
  }
  return capture.contentType?.toLowerCase().startsWith('text/html') === true;
}

export function matchesExpectedSignature(sourceUrl, bytes) {
  if (new URL(sourceUrl).pathname.toLowerCase().endsWith('.pdf')) {
    return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  const prefix = bytes.subarray(0, Math.min(bytes.length, 2048)).toString('utf8').toLowerCase();
  return prefix.includes('<!doctype html') || prefix.includes('<html');
}

function sourceFilename(sourceUrl) {
  const pathname = new URL(sourceUrl).pathname;
  const name = pathname.split('/').filter(Boolean).at(-1) ?? 'index';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function csvCell(value) {
  let stringValue = value === null || value === undefined ? '' : String(value);
  if (/^\s*[=+\-@]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function validatePolicyInteger(value, limits, field, errors) {
  if (
    !Number.isSafeInteger(value) ||
    value < limits.minimum ||
    value > limits.maximum
  ) {
    errors.push(
      `${field} must be an integer between ${limits.minimum} and ${limits.maximum}`,
    );
  }
}
