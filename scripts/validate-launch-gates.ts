import {access, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

import {
  computeLaunchGateSubjectDigest,
  type LaunchGateApproval,
  verifyLaunchGateEvidenceFile,
} from '../lib/launch-gate-evidence';
import {LAUNCH_GATE_IDS, type LaunchGateId} from '../lib/launch-gate-ids';
import {
  LAUNCH_GATE_EVIDENCE_CHECKS,
  type LaunchGateEvidenceKind,
} from '../lib/launch-gate-policy';
import {validateLaunchGateManifest} from '../lib/launch-gate-validation';
import {isLegalCopyDraft, isLegalCopyReady} from '../lib/legal-copy-readiness';
import {parseCanonicalLaunchGateManifest} from '../lib/launch-gate-transition-lock.js';
import {validateEvidenceDirectoryContract} from './evidence-directory-contract';

const repositoryRoot = process.cwd();
const manifestPath = path.join(repositoryRoot, 'config/launch-gates.json');
const pendingContractByGate = {
  legalPublication: 'docs/LEGAL_REVIEW.md',
  contactIntake: 'docs/CONTACT_DELIVERY.md',
} as const;

const manifestText = await readFile(manifestPath, 'utf8');
const parsedManifest = parseCanonicalLaunchGateManifest(manifestText);
const manifest = (parsedManifest.manifest ?? {}) as {
  schemaVersion?: number;
  gates?: Record<string, {
    status?: string;
    approval?: null | {
      approvedBy?: {
        name?: string;
        authorityRole?: string;
        organization?: string;
      };
      approvedAt?: string;
    };
    evidence?: Array<{
      kind?: string;
      reference?: string;
      sha256?: string;
      observedAt?: string;
    }>;
    blockerRefs?: string[];
  }>;
};
const nowMs = Date.now();
const errors = [
  ...parsedManifest.errors,
  ...validateLaunchGateManifest(manifest, {nowMs}),
];
const subjectDigest = await computeLaunchGateSubjectDigest(repositoryRoot).catch((error) => {
  errors.push(
    `launch-gate repository subject could not be computed: ${error instanceof Error ? error.message : String(error)}`,
  );
  return null;
});

if (manifest.gates?.legalPublication?.status === 'holding' && !isLegalCopyDraft()) {
  errors.push('legalPublication is holding but both localized legal notices are not marked draft');
}
if (manifest.gates?.legalPublication?.status === 'approved' && !isLegalCopyReady()) {
  errors.push('legalPublication is approved while English or Spanish legal copy remains draft');
}
for (const [gateId, reference] of Object.entries(pendingContractByGate)) {
  const status = manifest.gates?.[gateId]?.status;
  const expectedStatus = status === 'holding' ? 'Pending' : status === 'approved' ? 'Satisfied' : null;
  if (expectedStatus === null) continue;
  const contents = await readFile(path.join(repositoryRoot, reference), 'utf8').catch(() => '');
  if (!new RegExp(`^\\*\\*Status:\\*\\* ${expectedStatus}\\s*$`, 'mu').test(contents)) {
    errors.push(`${reference} must state Status: ${expectedStatus} while ${gateId} is ${status}`);
  }
}

if (
  process.env.NEXT_PUBLIC_CONTACT_ENABLED === 'true' &&
  !(
    manifest.gates?.legalPublication?.status === 'approved' &&
    manifest.gates?.contactIntake?.status === 'approved'
  )
) {
  errors.push(
    'NEXT_PUBLIC_CONTACT_ENABLED=true is forbidden until legalPublication and contactIntake are approved',
  );
}

const launchGateEvidenceReferences = Object.values(manifest.gates ?? {}).flatMap((gate) =>
  Array.isArray(gate.evidence)
    ? gate.evidence.flatMap((entry) =>
        typeof entry.reference === 'string'
          ? [{
              reference: entry.reference,
              sha256: typeof entry.sha256 === 'string' ? entry.sha256 : '',
            }]
          : [],
      )
    : [],
);
errors.push(...(
  await validateEvidenceDirectoryContract({
    repositoryRoot,
    relativeDirectory: 'docs/evidence/launch-gates',
    references: launchGateEvidenceReferences,
  })
).map((error) => `launch-gate evidence directory: ${error}`));

for (const [gateId, gate] of Object.entries(manifest.gates ?? {})) {
  for (const reference of gate.blockerRefs ?? []) {
    const resolved = path.resolve(repositoryRoot, reference);
    if (!resolved.startsWith(`${repositoryRoot}${path.sep}`)) {
      errors.push(`gates.${gateId} reference escapes the repository: ${reference}`);
      continue;
    }
    await access(resolved).catch(() => {
      errors.push(`gates.${gateId} reference does not exist: ${reference}`);
    });
  }
  if (!LAUNCH_GATE_IDS.includes(gateId as LaunchGateId) || !Array.isArray(gate.evidence)) {
    continue;
  }
  for (const entry of gate.evidence) {
    if (
      typeof entry.kind !== 'string' ||
      !Object.hasOwn(LAUNCH_GATE_EVIDENCE_CHECKS, entry.kind) ||
      typeof entry.reference !== 'string' ||
      typeof entry.sha256 !== 'string' ||
      typeof entry.observedAt !== 'string'
    ) {
      continue;
    }
    const approval = gate.approval;
    if (
      !approval ||
      typeof approval.approvedAt !== 'string' ||
      !approval.approvedBy ||
      typeof approval.approvedBy.name !== 'string' ||
      typeof approval.approvedBy.authorityRole !== 'string' ||
      typeof approval.approvedBy.organization !== 'string'
    ) {
      continue;
    }
    const verification = await verifyLaunchGateEvidenceFile({
      gateId: gateId as LaunchGateId,
      kind: entry.kind as LaunchGateEvidenceKind,
      reference: entry.reference,
      sha256: entry.sha256,
      observedAt: entry.observedAt,
      approval: approval as LaunchGateApproval,
      repositoryRoot,
      nowMs,
      ...(subjectDigest ? {repositoryContentSha256: subjectDigest.sha256} : {}),
    });
    errors.push(...verification.errors.map((error) => `gates.${gateId}: ${error}`));
  }
}

const result = {
  manifest: path.relative(repositoryRoot, manifestPath),
  schemaVersion: manifest.schemaVersion ?? null,
  sha256: createHash('sha256').update(manifestText).digest('hex'),
  subject: subjectDigest,
  gates: Object.fromEntries(
    LAUNCH_GATE_IDS.map((id) => [id, manifest.gates?.[id]?.status ?? 'missing']),
  ),
  errors: [...new Set(errors)],
};

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) process.exitCode = 1;
