import {createHash} from 'node:crypto';
import {lstat, readFile, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';

import {
  DEMO_CANDIDATE_IDS,
  demoCandidates,
  type DemoCandidateId,
} from '../demos/candidates';
import {isLaunchGateApproved} from '../lib/launch-gates';
import {
  parseNormalizedJson,
  validateDemoActivationManifest,
  validateDemoCandidate,
  type DemoActivationManifest,
  type DemoCandidate,
} from '../lib/demo-lifecycle-validation';
import {validateEvidenceDirectoryContract} from './evidence-directory-contract';

const repositoryRoot = process.cwd();
const canonicalRepositoryRoot = await realpath(repositoryRoot);
const candidatesDirectory = path.join(repositoryRoot, 'demos/candidates');
const activationPath = path.join(repositoryRoot, 'config/demo-activations.json');
const snapshotPath = path.join(repositoryRoot, 'demos/SNAPSHOT.json');
const errors: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function repositoryPath(relativePath: string): string | null {
  const resolved = path.resolve(repositoryRoot, relativePath);
  return resolved.startsWith(`${repositoryRoot}${path.sep}`) ? resolved : null;
}

async function sha256File(filePath: string): Promise<string> {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

const expectedCandidateFiles = DEMO_CANDIDATE_IDS.map((id) => `${id}.json`).sort();
const actualCandidateFiles = (await readdir(candidatesDirectory, {withFileTypes: true}))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualCandidateFiles) !== JSON.stringify(expectedCandidateFiles)) {
  errors.push(
    `demos/candidates JSON files must exactly equal ${JSON.stringify(expectedCandidateFiles)}`,
  );
}

const parsedCandidates: Partial<Record<DemoCandidateId, DemoCandidate>> = {};
for (const id of DEMO_CANDIDATE_IDS) {
  const relativePath = `demos/candidates/${id}.json`;
  const text = await readFile(path.join(repositoryRoot, relativePath), 'utf8');
  const parsed = parseNormalizedJson(text, relativePath);
  errors.push(...parsed.errors);
  errors.push(...validateDemoCandidate(parsed.value, id).map((error) => `${relativePath}: ${error}`));
  if (parsed.value && typeof parsed.value === 'object') {
    parsedCandidates[id] = parsed.value as DemoCandidate;
  }
}

for (const id of DEMO_CANDIDATE_IDS) {
  const candidate = parsedCandidates[id];
  if (!candidate) continue;
  for (const artifact of candidate.artifacts ?? []) {
    const resolved = repositoryPath(artifact.path);
    if (!resolved) {
      errors.push(`${id}: artifact escapes repository: ${artifact.path}`);
      continue;
    }
    const metadata = await lstat(resolved).catch(() => null);
    if (!metadata?.isFile() || metadata.isSymbolicLink()) {
      errors.push(`${id}: artifact must be a regular non-symlink file: ${artifact.path}`);
      continue;
    }
    const canonicalArtifact = await realpath(resolved).catch(() => null);
    if (
      canonicalArtifact === null ||
      !canonicalArtifact.startsWith(`${canonicalRepositoryRoot}${path.sep}`)
    ) {
      errors.push(`${id}: artifact resolves outside the repository: ${artifact.path}`);
      continue;
    }
    const actualSha256 = await sha256File(resolved);
    if (actualSha256 !== artifact.sha256) {
      errors.push(`${id}: artifact digest mismatch: ${artifact.path}`);
    }
  }
}

const snapshotText = await readFile(snapshotPath, 'utf8');
const parsedSnapshot = parseNormalizedJson(snapshotText, 'demos/SNAPSHOT.json');
errors.push(...parsedSnapshot.errors);
if (!isRecord(parsedSnapshot.value) || parsedSnapshot.value.schemaVersion !== 2) {
  errors.push('demos/SNAPSHOT.json: schemaVersion must be 2');
} else if (!isRecord(parsedSnapshot.value.sources)) {
  errors.push('demos/SNAPSHOT.json: sources must be an object');
} else {
  const snapshotSources = parsedSnapshot.value.sources;
  const snapshotIds = Object.keys(snapshotSources).sort();
  if (JSON.stringify(snapshotIds) !== JSON.stringify([...DEMO_CANDIDATE_IDS].sort())) {
    errors.push(
      `demos/SNAPSHOT.json: source ids must exactly equal ${JSON.stringify([...DEMO_CANDIDATE_IDS].sort())}`,
    );
  }
  for (const id of DEMO_CANDIDATE_IDS) {
    const candidate = parsedCandidates[id];
    const source = snapshotSources[id];
    if (!candidate || !isRecord(source)) {
      errors.push(`demos/SNAPSHOT.json: sources.${id} must be an object`);
      continue;
    }
    if (source.flaSha256 !== candidate.source.flaSha256) {
      errors.push(`demos/SNAPSHOT.json: sources.${id}.flaSha256 must match the candidate`);
    }
    if (source.swfSha256 !== candidate.source.swfSha256) {
      errors.push(`demos/SNAPSHOT.json: sources.${id}.swfSha256 must match the candidate`);
    }
    if (JSON.stringify(source.runtimeMovie) !== JSON.stringify(candidate.movie)) {
      errors.push(`demos/SNAPSHOT.json: sources.${id}.runtimeMovie must match the candidate`);
    }
    if (source.maturity !== candidate.maturity) {
      errors.push(`demos/SNAPSHOT.json: sources.${id}.maturity must match the candidate`);
    }
    if (source.validationStatus !== candidate.validationStatus) {
      errors.push(`demos/SNAPSHOT.json: sources.${id}.validationStatus must match the candidate`);
    }
  }
}

const activationText = await readFile(activationPath, 'utf8');
const parsedActivation = parseNormalizedJson(activationText, 'config/demo-activations.json');
errors.push(...parsedActivation.errors);
errors.push(...validateDemoActivationManifest(parsedActivation.value, {
  candidates: demoCandidates,
  demoPublicationGateApproved: isLaunchGateApproved('demoPublication'),
}).map((error) => `config/demo-activations.json: ${error}`));

const activationManifest = parsedActivation.value as DemoActivationManifest | null;
const demoPublicationEvidenceReferences = Object.values(activationManifest?.demos ?? {})
  .flatMap((activation) => [
    activation.approvals?.rightsAcceptance,
    activation.approvals?.productAcceptance,
  ])
  .flatMap((acceptance) =>
    acceptance && typeof acceptance.evidenceRef === 'string'
      ? [{
          reference: acceptance.evidenceRef,
          sha256: typeof acceptance.evidenceSha256 === 'string'
            ? acceptance.evidenceSha256
            : '',
        }]
      : [],
  );
errors.push(...(
  await validateEvidenceDirectoryContract({
    repositoryRoot,
    relativeDirectory: 'docs/evidence/demo-publication',
    references: demoPublicationEvidenceReferences,
  })
).map((error) => `demo-publication evidence directory: ${error}`));

for (const [id, activation] of Object.entries(activationManifest?.demos ?? {})) {
  for (const acceptance of [
    activation.approvals?.rightsAcceptance,
    activation.approvals?.productAcceptance,
  ]) {
    if (!acceptance) continue;
    const resolved = repositoryPath(acceptance.evidenceRef);
    if (!resolved) {
      errors.push(`${id}: acceptance evidence escapes repository: ${acceptance.evidenceRef}`);
      continue;
    }
    const metadata = await lstat(resolved).catch(() => null);
    if (!metadata?.isFile() || metadata.isSymbolicLink()) {
      errors.push(`${id}: acceptance evidence must be a regular non-symlink file`);
      continue;
    }
    const canonicalEvidence = await realpath(resolved).catch(() => null);
    if (
      canonicalEvidence === null ||
      !canonicalEvidence.startsWith(`${canonicalRepositoryRoot}${path.sep}`)
    ) {
      errors.push(`${id}: acceptance evidence resolves outside the repository`);
      continue;
    }
    if (await sha256File(resolved) !== acceptance.evidenceSha256) {
      errors.push(`${id}: acceptance evidence digest mismatch: ${acceptance.evidenceRef}`);
    }
  }
}

const result = {
  schemaVersion: 1,
  candidates: Object.fromEntries(DEMO_CANDIDATE_IDS.map((id) => [id, {
    candidateId: demoCandidates[id].candidateId,
    artifactSha256: demoCandidates[id].artifactSha256,
    runtimeBundleSha256: demoCandidates[id].runtime.bundleSha256,
  }])),
  demoPublicationGateApproved: isLaunchGateApproved('demoPublication'),
  errors: [...new Set(errors)],
};

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) process.exitCode = 1;
