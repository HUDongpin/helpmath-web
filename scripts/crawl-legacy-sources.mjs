#!/usr/bin/env node

import {constants as fsConstants} from 'node:fs';
import {access, chmod, lstat, mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';

import {
  archiveObjectPath,
  checksumManifest,
  isWithin,
  LEGACY_SOURCE_REQUEST_POLICY,
  manifestCsv,
  normalizeLegacyUrl,
  prepareDedicatedArchiveRoot,
  sha256,
  summarizeCaptures,
  validateCaptureResponse,
  validateManifest,
  validateRegistry,
  verifyArchiveObjects,
} from './legacy-source-custody-lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.dirname(SCRIPT_DIR);
const REGISTRY_PATH = path.join(REPOSITORY_ROOT, 'data/legacy-source-registry.json');
const execFileAsync = promisify(execFile);
const RETRYABLE_STATUSES = new Set(LEGACY_SOURCE_REQUEST_POLICY.retryableHttpStatuses);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULTS = {
  timeoutMs: LEGACY_SOURCE_REQUEST_POLICY.timeoutMs.defaultValue,
  maxAttempts: LEGACY_SOURCE_REQUEST_POLICY.maxAttempts.defaultValue,
  maxBytes: LEGACY_SOURCE_REQUEST_POLICY.maxBytesPerResponse.defaultValue,
  concurrency: LEGACY_SOURCE_REQUEST_POLICY.concurrency.defaultValue,
};

class PolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyError';
    this.retryable = false;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const registryBytes = await readFile(REGISTRY_PATH);
  const registry = JSON.parse(registryBytes.toString('utf8'));
  const registryErrors = validateRegistry(registry);
  if (registryErrors.length > 0) {
    throw new Error(`source registry is invalid:\n- ${registryErrors.join('\n- ')}`);
  }

  const requestedArchiveRoot = options.archiveRoot ?? path.resolve(REPOSITORY_ROOT, registry.defaultArchiveRoot);
  const archiveRoot = await prepareDedicatedArchiveRoot(requestedArchiveRoot, REPOSITORY_ROOT);
  const pdfInfoTool = await detectPdfInfoTool();
  const captureDate = new Date().toISOString().slice(0, 10);
  const evidencePath = path.join(
    REPOSITORY_ROOT,
    'docs/evidence',
    `legacy-source-crawl-${captureDate}.json`,
  );
  const repositoryEvidencePath = path
    .relative(REPOSITORY_ROOT, evidencePath)
    .split(path.sep)
    .join('/');
  if (registry.currentEvidenceManifest !== repositoryEvidencePath) {
    throw new Error(
      `registry.currentEvidenceManifest must be ${repositoryEvidencePath} before capturing. ` +
        'Advance the reviewed pointer first so validation cannot silently select older evidence.',
    );
  }
  const manifestDirectory = await prepareArchiveDirectory(archiveRoot, 'manifests');
  const basename = `legacy-source-crawl-${captureDate}`;
  const outputPaths = {
    archiveJson: path.join(manifestDirectory, `${basename}.json`),
    archiveCsv: path.join(manifestDirectory, `${basename}.csv`),
    archiveSha256: path.join(manifestDirectory, `${basename}.sha256`),
    evidenceJson: evidencePath,
    evidenceCsv: evidencePath.replace(/\.json$/, '.csv'),
    evidenceSha256: evidencePath.replace(/\.json$/, '.sha256'),
  };

  await assertOutputsAbsent(outputPaths);

  process.stdout.write(
    `Capturing ${registry.sources.length} allowlisted sources to an external content-addressed archive.\n`,
  );
  const captures = await mapWithConcurrency(registry.sources, options.concurrency, async (source) => {
    const capture = await captureSource(source, archiveRoot, {...options, pdfInfoTool});
    const result = Number.isInteger(capture.status) ? `HTTP ${capture.status}` : 'request error';
    process.stdout.write(`${source.id}: ${result}\n`);
    return capture;
  });

  const manifest = {
    schemaVersion: 1,
    manifestKind: 'legacy-source-crawl-evidence',
    captureDate,
    createdAt: new Date().toISOString(),
    allowedOrigin: registry.allowedOrigin,
    sourceRegistry: 'data/legacy-source-registry.json',
    sourceRegistrySha256: sha256(registryBytes),
    archiveLayout: 'Content-addressed objects; archiveObject paths are relative to the external archive root.',
    evidenceBoundary:
      'This manifest records capture and integrity evidence only. It does not establish durable remote custody, ownership, republication permission, or accessibility conformance.',
    requestPolicy: {
      sameOriginHttpsOnly: true,
      redirectMode: 'manual-validation',
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      maxBytesPerResponse: options.maxBytes,
      concurrency: options.concurrency,
      retryableHttpStatuses: [...RETRYABLE_STATUSES],
    },
    pdfMetadataPolicy: {
      appliesTo: 'application/pdf responses',
      extractor: pdfInfoTool.name,
      extractorVersion: pdfInfoTool.version,
      extractorAvailabilityError: pdfInfoTool.error,
      missingMetadataValue: null,
    },
    summary: summarizeCaptures(captures),
    captures,
  };

  const manifestErrors = validateManifest(manifest, registry, {
    sourceRegistrySha256: sha256(registryBytes),
  });
  if (manifestErrors.length > 0) {
    throw new Error(`generated manifest is invalid:\n- ${manifestErrors.join('\n- ')}`);
  }

  const archiveErrors = await verifyArchiveObjects(manifest, archiveRoot);
  if (archiveErrors.length > 0) {
    throw new Error(`archive verification failed:\n- ${archiveErrors.join('\n- ')}`);
  }

  await mkdir(path.dirname(evidencePath), {recursive: true});
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const csv = manifestCsv(manifest);
  const checksums = checksumManifest(manifest);
  await writeGeneratedFile(outputPaths.archiveJson, json, 0o600);
  await writeGeneratedFile(outputPaths.archiveCsv, csv, 0o600);
  await writeGeneratedFile(outputPaths.archiveSha256, checksums, 0o600);
  await writeGeneratedFile(outputPaths.evidenceJson, json, 0o644);
  await writeGeneratedFile(outputPaths.evidenceCsv, csv, 0o644);
  await writeGeneratedFile(outputPaths.evidenceSha256, checksums, 0o644);

  process.stdout.write(
    `Wrote JSON/CSV/SHA-256 manifests outside the repository and metadata-only evidence at ${repositoryEvidencePath}.\n`,
  );
  if (manifest.summary.successful !== manifest.summary.registered) {
    process.stdout.write(
      `Attention: ${manifest.summary.successful}/${manifest.summary.registered} sources returned a successful HTTP status; inspect the manifest before cutover.\n`,
    );
  }
}

async function captureSource(source, archiveRoot, options) {
  const capturedAtForError = () => new Date().toISOString();
  let attempts = 0;

  try {
    const result = await fetchWithRetry(source.url, options, (attempt) => {
      attempts = attempt;
    });
    const responseErrors = validateCaptureResponse(source.url, result);
    if (responseErrors.length > 0) {
      throw new PolicyError(
        `source response failed pre-parser validation: ${responseErrors.join('; ')}`,
      );
    }
    const hash = sha256(result.bytes);
    const relativeObjectPath = archiveObjectPath(hash);
    const archiveObject = await writeArchiveObject(archiveRoot, relativeObjectPath, result.bytes);
    const pdfMetadata = result.contentType.toLowerCase().startsWith('application/pdf')
      ? await extractPdfMetadata(archiveObject, options.pdfInfoTool)
      : null;
    return {
      id: source.id,
      url: source.url,
      finalURL: result.finalURL,
      status: result.status,
      contentType: result.contentType,
      lastModified: result.lastModified,
      bytes: result.bytes.length,
      sha256: hash,
      capturedAt: result.capturedAt,
      attempts,
      redirectChain: result.redirectChain,
      sourceFilename: sourceFilename(source.url),
      pdfMetadata,
      claimUse: source.claimUse,
      stableReplacement: source.stableReplacement,
      rightsStatus: source.rightsStatus,
      accessibilityStatus: source.accessibilityStatus,
      republishStatus: source.republishStatus,
      archiveObject: relativeObjectPath,
      error: null,
    };
  } catch (error) {
    return {
      id: source.id,
      url: source.url,
      finalURL: null,
      status: null,
      contentType: null,
      lastModified: null,
      bytes: null,
      sha256: null,
      capturedAt: capturedAtForError(),
      attempts: Math.max(attempts, 1),
      redirectChain: [],
      sourceFilename: sourceFilename(source.url),
      pdfMetadata: null,
      claimUse: source.claimUse,
      stableReplacement: source.stableReplacement,
      rightsStatus: source.rightsStatus,
      accessibilityStatus: source.accessibilityStatus,
      republishStatus: source.republishStatus,
      archiveObject: null,
      error: safeErrorMessage(error, [archiveRoot]),
    };
  }
}

async function fetchWithRetry(sourceUrl, options, onAttempt) {
  let lastError;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    onAttempt(attempt);
    try {
      const response = await fetchSameOrigin(sourceUrl, options);
      if (RETRYABLE_STATUSES.has(response.status) && attempt < options.maxAttempts) {
        await response.body?.cancel();
        await delay(retryDelay(attempt));
        continue;
      }
      const bytes = await readLimitedBody(response, options.maxBytes);
      return {
        finalURL: normalizeLegacyUrl(response.url),
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        lastModified: response.headers.get('last-modified'),
        bytes,
        capturedAt: new Date().toISOString(),
        redirectChain: response.redirectChain,
      };
    } catch (error) {
      lastError = error;
      if (error.retryable === false || attempt === options.maxAttempts) {
        throw error;
      }
      await delay(retryDelay(attempt));
    }
  }
  throw lastError ?? new Error('request failed without an error');
}

async function fetchSameOrigin(sourceUrl, options) {
  let current = normalizeLegacyUrl(sourceUrl);
  const redirectChain = [];
  const signal = AbortSignal.timeout(options.timeoutMs);

  for (
    let redirectCount = 0;
    redirectCount <= LEGACY_SOURCE_REQUEST_POLICY.maxRedirects;
    redirectCount += 1
  ) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        accept: '*/*',
        'accept-encoding': 'identity',
        'user-agent': 'HELP-Math-source-custody/1.0 (+https://www.helpmath.ai/)',
      },
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      Object.defineProperty(response, 'redirectChain', {value: redirectChain});
      return response;
    }
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) {
      throw new PolicyError(`HTTP ${response.status} redirect did not include Location`);
    }
    if (redirectCount === LEGACY_SOURCE_REQUEST_POLICY.maxRedirects) {
      throw new PolicyError('redirect limit exceeded');
    }
    const next = normalizeLegacyUrl(new URL(location, current).href);
    redirectChain.push(next);
    current = next;
  }
  throw new PolicyError('redirect loop ended unexpectedly');
}

async function readLimitedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new PolicyError(`response Content-Length ${declaredLength} exceeds ${maxBytes} bytes`);
  }
  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PolicyError(`response body exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function prepareArchiveDirectory(archiveRoot, relativeDirectory) {
  const resolvedArchiveRoot = await realpath(archiveRoot);
  const candidate = path.resolve(resolvedArchiveRoot, relativeDirectory);
  if (!isWithin(resolvedArchiveRoot, candidate)) {
    throw new Error('archive directory escaped the archive root');
  }

  const relative = path.relative(resolvedArchiveRoot, candidate);
  let current = resolvedArchiveRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      await mkdir(current, {mode: 0o700});
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error('archive directory chain must contain only real directories');
    }
    const resolved = await realpath(current);
    if (!isWithin(resolvedArchiveRoot, resolved)) {
      throw new Error('archive directory resolved outside the archive root');
    }
    await chmod(resolved, 0o700);
    current = resolved;
  }
  return current;
}

export async function writeArchiveObject(archiveRoot, relativeObjectPath, bytes) {
  const resolvedArchiveRoot = await realpath(archiveRoot);
  const target = path.resolve(resolvedArchiveRoot, relativeObjectPath);
  if (!isWithin(resolvedArchiveRoot, target)) {
    throw new PolicyError('archive object path escaped the archive root');
  }
  const resolvedParent = await prepareArchiveDirectory(
    resolvedArchiveRoot,
    path.dirname(relativeObjectPath),
  );
  const resolvedTarget = path.join(resolvedParent, path.basename(relativeObjectPath));

  try {
    await writeFile(resolvedTarget, bytes, {flag: 'wx', mode: 0o600});
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    const metadata = await lstat(resolvedTarget);
    if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) {
      throw new PolicyError('existing archive object must be one regular, unlinked file');
    }
    const existing = await readFile(resolvedTarget);
    if (existing.length !== bytes.length || sha256(existing) !== sha256(bytes)) {
      throw new PolicyError(`existing content-addressed object does not match ${relativeObjectPath}`);
    }
  }
  const metadata = await lstat(resolvedTarget);
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) {
    throw new PolicyError('archive object must be one regular, unlinked file');
  }
  await chmod(resolvedTarget, 0o600);
  return resolvedTarget;
}

async function detectPdfInfoTool() {
  try {
    const {stdout, stderr} = await execFileAsync('pdfinfo', ['-v'], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
      encoding: 'utf8',
    });
    const output = `${stdout}\n${stderr}`;
    const version = output.match(/pdfinfo version\s+([^\s]+)/i)?.[1] ?? null;
    return {name: 'pdfinfo (Poppler)', version, error: null};
  } catch (error) {
    return {name: 'pdfinfo (Poppler)', version: null, error: safeErrorMessage(error)};
  }
}

async function extractPdfMetadata(pdfPath, tool) {
  const empty = {
    extractor: tool.name,
    extractorVersion: tool.version,
    pageCount: null,
    title: null,
    author: null,
    creationDate: null,
    modificationDate: null,
    extractionError: tool.error,
  };
  if (tool.error) {
    return empty;
  }

  try {
    const {stdout} = await execFileAsync('pdfinfo', ['-isodates', pdfPath], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    });
    const fields = parsePdfInfo(stdout);
    const pages = Number(fields.get('Pages'));
    return {
      ...empty,
      pageCount: Number.isSafeInteger(pages) && pages > 0 ? pages : null,
      title: nullableMetadata(fields.get('Title')),
      author: nullableMetadata(fields.get('Author')),
      creationDate: nullableMetadata(fields.get('CreationDate')),
      modificationDate: nullableMetadata(fields.get('ModDate')),
      extractionError: null,
    };
  } catch (error) {
    return {...empty, extractionError: safeErrorMessage(error, [pdfPath])};
  }
}

function parsePdfInfo(output) {
  const fields = new Map();
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return fields;
}

function nullableMetadata(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function assertOutputsAbsent(outputPaths) {
  const existing = [];
  for (const [kind, outputPath] of Object.entries(outputPaths)) {
    try {
      await access(outputPath, fsConstants.F_OK);
      existing.push(`${kind}: ${outputPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  if (existing.length > 0) {
    throw new Error(`refusing to overwrite append-only custody manifests:\n${existing.join('\n')}`);
  }
}

async function writeGeneratedFile(outputPath, contents, mode) {
  await writeFile(outputPath, contents, {encoding: 'utf8', flag: 'wx', mode});
  await chmod(outputPath, mode);
}

function parseArguments(arguments_) {
  const options = {...DEFAULTS, archiveRoot: undefined, help: false};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (['--archive-root', '--timeout-ms', '--max-attempts', '--max-bytes', '--concurrency'].includes(argument)) {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      const key = {
        '--archive-root': 'archiveRoot',
        '--timeout-ms': 'timeoutMs',
        '--max-attempts': 'maxAttempts',
        '--max-bytes': 'maxBytes',
        '--concurrency': 'concurrency',
      }[argument];
      options[key] = key === 'archiveRoot' ? value : parseInteger(argument, value);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  assertRange(
    '--timeout-ms',
    options.timeoutMs,
    LEGACY_SOURCE_REQUEST_POLICY.timeoutMs.minimum,
    LEGACY_SOURCE_REQUEST_POLICY.timeoutMs.maximum,
  );
  assertRange(
    '--max-attempts',
    options.maxAttempts,
    LEGACY_SOURCE_REQUEST_POLICY.maxAttempts.minimum,
    LEGACY_SOURCE_REQUEST_POLICY.maxAttempts.maximum,
  );
  assertRange(
    '--max-bytes',
    options.maxBytes,
    LEGACY_SOURCE_REQUEST_POLICY.maxBytesPerResponse.minimum,
    LEGACY_SOURCE_REQUEST_POLICY.maxBytesPerResponse.maximum,
  );
  assertRange(
    '--concurrency',
    options.concurrency,
    LEGACY_SOURCE_REQUEST_POLICY.concurrency.minimum,
    LEGACY_SOURCE_REQUEST_POLICY.concurrency.maximum,
  );
  return options;
}

function parseInteger(name, value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return Number(value);
}

function assertRange(name, value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, () => worker()));
  return results;
}

function retryDelay(attempt) {
  return Math.min(2_000, 300 * 2 ** (attempt - 1));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function safeErrorMessage(error, sensitivePaths = []) {
  let message = error instanceof Error ? error.message : String(error);
  for (const sensitivePath of [REPOSITORY_ROOT, ...sensitivePaths]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .sort((left, right) => right.length - left.length)) {
    message = message.replaceAll(sensitivePath, '<redacted-path>');
  }
  return message.slice(0, 500);
}

function helpText() {
  return `Usage: node scripts/crawl-legacy-sources.mjs [options]\n\nOptions:\n  --archive-root <absolute-path>  External archive destination\n  --timeout-ms <1000-60000>      Per-attempt timeout (default: 20000)\n  --max-attempts <1-5>           Network/transient-status attempts (default: 3)\n  --max-bytes <1024-104857600>   Maximum bytes per response (default: 33554432)\n  --concurrency <1-4>            Concurrent allowlisted requests (default: 2)\n  --help                         Show this help\n`;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (entryPoint === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
