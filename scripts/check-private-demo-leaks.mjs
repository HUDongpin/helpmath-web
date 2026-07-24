import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {access, readFile, readdir} from 'node:fs/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

import activationManifestJson from '../config/demo-activations.json';
import {DEMO_CANDIDATE_IDS, demoCandidates} from '../demos/candidates/index.ts';
import {demoLifecycleStates} from '../lib/demo-lifecycle.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PUBLIC_DYNAMIC_DEMO_ROUTES = Object.freeze([
  '/demos',
  '/es/demos',
]);

const SERVER_START_TIMEOUT_MS = 15_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;
const DYNAMIC_DEMO_RESPONSE_TIMEOUT_MS = 5_000;
const PAGES_DATA_RESPONSE_TIMEOUT_MS = 2_000;

const APPROVAL_METADATA_KEYS = Object.freeze([
  'acceptedAt',
  'acceptedBy',
  'activatedAt',
  'approvalRef',
  'artifactSha256',
  'authorityRole',
  'bundleSha256',
  'candidateId',
  'evidenceRef',
  'evidenceSha256',
  'flaSha256',
  'privatePreview',
  'productAcceptance',
  'rightsAcceptance',
  'swfSha256',
]);

const CANDIDATE_RUNTIME_TEXT = /** @type {Readonly<Record<string, readonly string[]>>} */ (
  Object.freeze({
    'conversion-1-2': Object.freeze([
      'GALLON_MOVE_MATRICES',
      '1 gallon equals 128 fluid ounces',
    ]),
    'conversion-1-4': Object.freeze([
      'LITER_SURFACE_TWIPS',
      '1 liter equals 1000 milliliters',
    ]),
  })
);

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function normalizedBuildPath(value) {
  return value.split(path.sep).join('/');
}

export function isPublicClientArtifactPath(relativePath) {
  const normalized = normalizedBuildPath(relativePath);
  if (normalized.startsWith('public/')) return true;
  if (normalized.startsWith('.next/static/')) return true;
  if (
    normalized.startsWith('.next/server/app/')
    && /\.(?:body|html|meta|rsc)$/u.test(normalized)
  ) {
    return true;
  }
  return (
    normalized.startsWith('.next/server/pages/')
    && /\.(?:html|json)$/u.test(normalized)
  );
}

export function isValidatedPublicLifecycleState(candidate, state) {
  return Boolean(
    state
    && state.id === candidate.id
    && state.active === true
    && state.public === true
    && (state.access === 'public' || state.access === 'indexable')
    && Array.isArray(state.errors)
    && state.errors.length === 0
    && state.candidate?.id === candidate.id
    && state.candidate?.candidateId === candidate.candidateId
    && state.candidate?.artifactSha256 === candidate.artifactSha256
  );
}

function addFingerprint(records, value, label, demoId) {
  if (typeof value !== 'string' || value.length === 0) return;
  records.push({value, label, demoId});
}

function candidateRuntimeTextFingerprints(candidate, extraRuntimeText) {
  const records = [];
  const add = (value, label) => addFingerprint(records, value, label, candidate.id);
  add(candidate.runtime.entry, 'runtime entry');
  add('private-demo-runtime', 'private runtime directory');
  add(`demos/modules/${candidate.id}`, 'candidate module path');
  add(`/api/executive-preview/assets/${candidate.id}/`, 'candidate asset API prefix');

  for (const artifact of candidate.artifacts) {
    if (
      artifact.path.startsWith('demos/')
      || artifact.path.startsWith('private-demo-assets/')
      || artifact.path.startsWith('private-demo-runtime/')
    ) {
      add(artifact.path, `runtime artifact path: ${artifact.path}`);
      add(
        artifact.path.replace(/\.[^./]+$/u, ''),
        `runtime artifact path without extension: ${artifact.path}`,
      );
    }
    if (artifact.path.startsWith(`private-demo-assets/${candidate.id}/`)) {
      add(path.posix.basename(artifact.path), `private asset name: ${artifact.path}`);
    }
  }

  for (const fingerprint of extraRuntimeText[candidate.id] ?? []) {
    add(fingerprint, 'candidate runtime text');
  }
  return records;
}

function candidateRuntimeFileFingerprints(candidate) {
  return [
    ...candidate.artifacts.map((artifact) => ({
      value: artifact.sha256,
      label: `runtime artifact SHA-256: ${artifact.path}`,
      demoId: candidate.id,
    })),
    {
      value: candidate.runtime.bundleSha256,
      label: 'runtime bundle SHA-256',
      demoId: candidate.id,
    },
  ];
}

function approvalMetadataFingerprints(candidates, activationManifest) {
  const records = APPROVAL_METADATA_KEYS.map((key) => ({
    value: key,
    label: `approval metadata field: ${key}`,
    demoId: null,
  }));

  for (const candidate of candidates) {
    const add = (value, label) => addFingerprint(records, value, label, candidate.id);
    add(candidate.candidateId, 'immutable candidate identity');
    add(candidate.artifactSha256, 'candidate aggregate SHA-256');
    add(candidate.source?.flaSha256, 'source FLA SHA-256');
    add(candidate.source?.swfSha256, 'source SWF SHA-256');
    add(candidate.runtime?.bundleSha256, 'runtime bundle SHA-256 metadata');
    for (const artifact of candidate.artifacts ?? []) {
      add(artifact.sha256, `candidate artifact SHA-256: ${artifact.path}`);
    }
  }

  for (const [demoId, activation] of Object.entries(activationManifest?.demos ?? {})) {
    const add = (value, label) => addFingerprint(records, value, label, demoId);
    add(activation?.candidateId, 'activation candidate identity');
    add(activation?.artifactSha256, 'activation artifact SHA-256');

    const privatePreview = activation?.approvals?.privatePreview;
    add(privatePreview?.audience, 'private-preview approval audience');
    add(privatePreview?.purpose, 'private-preview approval purpose');
    add(privatePreview?.approvalRef, 'private-preview approval reference');

    for (const acceptance of [
      activation?.approvals?.rightsAcceptance,
      activation?.approvals?.productAcceptance,
    ]) {
      if (!acceptance) continue;
      add(acceptance.candidateId, 'acceptance candidate identity');
      add(acceptance.artifactSha256, 'acceptance artifact SHA-256');
      add(acceptance.evidenceRef, 'acceptance evidence reference');
      add(acceptance.evidenceSha256, 'acceptance evidence SHA-256');
      add(acceptance.acceptedBy?.name, 'acceptance authority name');
      add(acceptance.acceptedBy?.authorityRole, 'acceptance authority role');
      if (acceptance.acceptedBy) {
        add(JSON.stringify(acceptance.acceptedBy), 'acceptance authority identity object');
      }
    }
  }
  return records;
}

function dedupeRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.value}\0${record.demoId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createDemoClientLeakPolicy({
  activationManifest,
  candidates,
  lifecycleStates,
  runtimeText = CANDIDATE_RUNTIME_TEXT,
}) {
  const candidateList = Object.values(candidates).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const publicDemoIds = candidateList
    .filter((candidate) =>
      isValidatedPublicLifecycleState(candidate, lifecycleStates[candidate.id]),
    )
    .map((candidate) => candidate.id);
  const publicIdSet = new Set(publicDemoIds);

  const runtimeTextByCandidate = new Map(candidateList.map((candidate) => [
    candidate.id,
    candidateRuntimeTextFingerprints(candidate, runtimeText),
  ]));
  const runtimeFilesByCandidate = new Map(candidateList.map((candidate) => [
    candidate.id,
    candidateRuntimeFileFingerprints(candidate),
  ]));
  const allowedRuntimeText = new Set(
    publicDemoIds.flatMap((id) =>
      (runtimeTextByCandidate.get(id) ?? []).map((record) => record.value),
    ),
  );
  const allowedRuntimeFiles = new Set(
    publicDemoIds.flatMap((id) =>
      (runtimeFilesByCandidate.get(id) ?? []).map((record) => record.value),
    ),
  );

  const privateCandidates = candidateList.filter((candidate) => !publicIdSet.has(candidate.id));
  return Object.freeze({
    publicDemoIds: Object.freeze(publicDemoIds),
    privateDemoIds: Object.freeze(privateCandidates.map((candidate) => candidate.id)),
    forbiddenApprovalText: Object.freeze(dedupeRecords(
      approvalMetadataFingerprints(candidateList, activationManifest),
    )),
    forbiddenRuntimeText: Object.freeze(dedupeRecords(
      privateCandidates
        .flatMap((candidate) => runtimeTextByCandidate.get(candidate.id) ?? [])
        .filter((record) => !allowedRuntimeText.has(record.value)),
    )),
    forbiddenRuntimeFileHashes: Object.freeze(dedupeRecords(
      privateCandidates
        .flatMap((candidate) => runtimeFilesByCandidate.get(candidate.id) ?? [])
        .filter((record) => !allowedRuntimeFiles.has(record.value)),
    )),
  });
}

export function findDemoClientLeaks(artifacts, policy) {
  const leaks = [];
  const seen = new Set();
  const addLeak = (leak) => {
    const key = JSON.stringify(leak);
    if (seen.has(key)) return;
    seen.add(key);
    leaks.push(leak);
  };

  for (const artifact of artifacts) {
    const contents = typeof artifact.contents === 'string'
      ? Buffer.from(artifact.contents)
      : Buffer.from(artifact.contents);
    const fileHash = sha256(contents);
    const text = contents.toString('utf8');

    for (const record of policy.forbiddenRuntimeFileHashes) {
      if (fileHash === record.value) {
        addLeak({
          file: artifact.file,
          category: 'inactive-runtime-file',
          demoId: record.demoId,
          fingerprint: record.label,
        });
      }
    }
    for (const record of policy.forbiddenRuntimeText) {
      if (text.includes(record.value)) {
        addLeak({
          file: artifact.file,
          category: 'inactive-runtime-text',
          demoId: record.demoId,
          fingerprint: record.label,
        });
      }
    }
    for (const record of policy.forbiddenApprovalText) {
      if (text.includes(record.value)) {
        addLeak({
          file: artifact.file,
          category: 'approval-metadata',
          demoId: record.demoId,
          fingerprint: record.label,
        });
      }
    }
  }
  return leaks;
}

async function filesBelow(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  }));
  return nested.flat();
}

async function loadPublicBuildArtifacts() {
  const nextDirectory = path.join(repositoryRoot, '.next');
  await access(path.join(nextDirectory, 'BUILD_ID'));
  const roots = [
    path.join(repositoryRoot, 'public'),
    path.join(nextDirectory, 'static'),
    path.join(nextDirectory, 'server', 'app'),
    path.join(nextDirectory, 'server', 'pages'),
  ];
  const files = (await Promise.all(roots.map((root) => filesBelow(root)))).flat();
  const publicFiles = files.filter((file) =>
    isPublicClientArtifactPath(path.relative(repositoryRoot, file)),
  );
  return Promise.all(publicFiles.map(async (file) => ({
    file: path.relative(repositoryRoot, file),
    contents: await readFile(file),
  })));
}

function responseArtifactName(route) {
  return `http-response:${route}`;
}

export function publicDemoDataRoutes(buildId) {
  if (typeof buildId !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(buildId)) {
    throw new Error('A valid Next.js build ID is required for the Pages data scan.');
  }
  return Object.freeze([
    `/_next/data/${buildId}/demos.json`,
    `/_next/data/${buildId}/es/demos.json`,
    `/_next/data/${buildId}/static/en/demos.json`,
    `/_next/data/${buildId}/static/es/demos.json`,
  ]);
}

export async function loadPublicDemoResponseArtifacts(origin, fetchImpl = fetch) {
  const normalizedOrigin = new URL(origin);
  if (normalizedOrigin.pathname !== '/' || normalizedOrigin.search || normalizedOrigin.hash) {
    throw new Error('Public demo scan origin must not include a path, query, or fragment.');
  }

  return Promise.all(PUBLIC_DYNAMIC_DEMO_ROUTES.map(async (route) => {
    let response;
    try {
      response = await fetchImpl(new URL(route, normalizedOrigin), {
        headers: {Accept: 'text/html'},
        redirect: 'manual',
        signal: AbortSignal.timeout(DYNAMIC_DEMO_RESPONSE_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'request failure';
      throw new Error(
        `Public demo response scan could not complete for ${route} (${reason}).`,
      );
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (response.status !== 200) {
      throw new Error(
        `Public demo response scan requires HTTP 200 for ${route}; received ${response.status}.`,
      );
    }
    if (!/^text\/html(?:;|$)/iu.test(contentType)) {
      throw new Error(
        `Public demo response scan requires HTML for ${route}; received ${contentType || 'no content type'}.`,
      );
    }

    const contents = Buffer.from(await response.arrayBuffer());
    if (contents.length === 0) {
      throw new Error(`Public demo response scan received an empty body for ${route}.`);
    }
    return {file: responseArtifactName(route), contents};
  }));
}

export async function loadBlockedPublicDemoDataArtifacts(
  origin,
  buildId,
  fetchImpl = fetch,
) {
  const normalizedOrigin = new URL(origin);
  if (normalizedOrigin.pathname !== '/' || normalizedOrigin.search || normalizedOrigin.hash) {
    throw new Error('Pages data scan origin must not include a path, query, or fragment.');
  }

  const routes = publicDemoDataRoutes(buildId);
  return Promise.all(routes.map(async (route) => {
    let response;
    try {
      response = await fetchImpl(new URL(route, normalizedOrigin), {
        headers: {Accept: 'application/json'},
        redirect: 'manual',
        signal: AbortSignal.timeout(PAGES_DATA_RESPONSE_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'request failure';
      throw new Error(
        `Blocked Pages data response scan could not complete for ${route} (${reason}).`,
      );
    }
    if (response.status !== 404) {
      throw new Error(
        `Blocked Pages data response scan requires HTTP 404 for ${route}; `
        + `received ${response.status}.`,
      );
    }
    if (response.headers.get('cache-control') !== 'private, no-store, max-age=0') {
      throw new Error(`Blocked Pages data response is not private/no-store for ${route}.`);
    }
    if (response.headers.get('x-robots-tag') !== 'noindex, nofollow, noarchive') {
      throw new Error(`Blocked Pages data response is not noindex for ${route}.`);
    }
    return {
      file: responseArtifactName(route),
      contents: Buffer.from(await response.arrayBuffer()),
    };
  }));
}

async function availableLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((resolve) => server.close(resolve));
    throw new Error('Could not allocate a loopback port for the public demo response scan.');
  }
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return address.port;
}

async function startBuiltApplication() {
  const port = await availableLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;
  const nextCli = path.join(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: repositoryRoot,
      env: {...process.env, NODE_ENV: 'production'},
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const recordOutput = (chunk) => {
    output = `${output}${chunk}`.slice(-4_000);
  };
  child.stdout.on('data', recordOutput);
  child.stderr.on('data', recordOutput);

  const exit = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({code, signal}));
  });
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await Promise.race([
      exit.then((result) => ({kind: 'exit', result})),
      fetch(`${origin}/demos`, {
        headers: {Accept: 'text/html'},
        redirect: 'manual',
        signal: AbortSignal.timeout(1_000),
      })
        .then(() => ({kind: 'ready'}))
        .catch(() => ({kind: 'retry'})),
    ]);
    if (state.kind === 'ready') {
      return {
        origin,
        async stop() {
          if (child.exitCode !== null || child.signalCode !== null) return;
          child.kill('SIGTERM');
          const stopped = await Promise.race([
            exit.then(() => true),
            delay(SERVER_STOP_TIMEOUT_MS, false),
          ]);
          if (!stopped && child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
            await exit;
          }
        },
      };
    }
    if (state.kind === 'exit') {
      throw new Error(
        `Built application exited before the public demo response scan `
        + `(code ${state.result.code ?? 'null'}, signal ${state.result.signal ?? 'null'}).\n${output}`,
      );
    }
    await delay(100);
  }

  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exit.then(() => true),
    delay(SERVER_STOP_TIMEOUT_MS, false),
  ]);
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exit;
  }
  throw new Error(
    `Built application did not become ready for the public demo response scan.\n${output}`,
  );
}

async function main() {
  const candidateIds = Object.keys(demoCandidates).sort();
  if (JSON.stringify(candidateIds) !== JSON.stringify([...DEMO_CANDIDATE_IDS].sort())) {
    throw new Error('Demo candidate catalog is inconsistent.');
  }
  const policy = createDemoClientLeakPolicy({
    activationManifest: activationManifestJson,
    candidates: demoCandidates,
    lifecycleStates: demoLifecycleStates,
  });
  const artifacts = await loadPublicBuildArtifacts();
  const buildId = (await readFile(path.join(repositoryRoot, '.next', 'BUILD_ID'), 'utf8')).trim();
  const server = await startBuiltApplication();
  try {
    artifacts.push(...await loadPublicDemoResponseArtifacts(server.origin));
    artifacts.push(...await loadBlockedPublicDemoDataArtifacts(server.origin, buildId));
  } finally {
    await server.stop();
  }
  const leaks = findDemoClientLeaks(artifacts, policy);

  if (leaks.length > 0) {
    console.error(JSON.stringify({privateDemoStaticLeaks: leaks}, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    privateDemoStaticLeaks: 0,
    privateDemoIds: policy.privateDemoIds,
    publicDemoIds: policy.publicDemoIds,
    protectedApprovalFingerprints: policy.forbiddenApprovalText.length,
    protectedRuntimeFileHashes: policy.forbiddenRuntimeFileHashes.length,
    protectedRuntimeTextFingerprints: policy.forbiddenRuntimeText.length,
    blockedPagesDataRoutes: publicDemoDataRoutes(buildId),
    scannedDynamicDemoRoutes: PUBLIC_DYNAMIC_DEMO_ROUTES,
    scannedFiles: artifacts.length,
  }));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
