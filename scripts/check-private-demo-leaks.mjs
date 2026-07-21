import {createHash} from 'node:crypto';
import {access, readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import activationManifestJson from '../config/demo-activations.json';
import {DEMO_CANDIDATE_IDS, demoCandidates} from '../demos/candidates/index.ts';
import {demoLifecycleStates} from '../lib/demo-lifecycle.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
