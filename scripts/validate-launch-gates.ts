import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import {
  computeLaunchGateSubjectDigest,
  type LaunchGateApproval,
  verifyLaunchGateEvidenceFile,
} from "../lib/launch-gate-evidence";
import {
  computeLaunchGateEvidenceV3SubjectDigestAtCommit,
  isLaunchGateEvidenceV3Kind,
  LAUNCH_GATE_EVIDENCE_V3_POLICY,
  verifyLaunchGateEvidenceV3File,
} from "../lib/launch-gate-evidence-v3";
import { LAUNCH_GATE_IDS, type LaunchGateId } from "../lib/launch-gate-ids";
import {
  LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES,
  resolveLaunchGateCapabilitiesV3,
  type LaunchGateLifecycleEventV3,
  type LaunchGateLifecycleManifestV3,
} from "../lib/launch-gate-lifecycle-v3";
import {
  LAUNCH_GATE_BLOCKER_REFS,
  LAUNCH_GATE_EVIDENCE_CHECKS,
  type LaunchGateEvidenceKind,
} from "../lib/launch-gate-policy";
import { validateLaunchGateManifest } from "../lib/launch-gate-validation";
import {
  isLegalCopyDraft,
  isLegalCopyReady,
} from "../lib/legal-copy-readiness";
import { parseCanonicalLaunchGateManifest } from "../lib/launch-gate-transition-lock.js";
import { validateEvidenceDirectoryContract } from "./evidence-directory-contract";

const repositoryRoot = process.cwd();
const manifestPath = path.join(repositoryRoot, "config/launch-gates.json");
const pendingContractByGate = {
  legalPublication: "docs/LEGAL_REVIEW.md",
  contactIntake: "docs/CONTACT_DELIVERY.md",
} as const;

type V2EvidenceReference = {
  kind?: string;
  reference?: string;
  sha256?: string;
  observedAt?: string;
};

type V2Gate = {
  status?: string;
  approval?: null | {
    approvedBy?: {
      name?: string;
      authorityRole?: string;
      organization?: string;
    };
    approvedAt?: string;
  };
  evidence?: V2EvidenceReference[];
  blockerRefs?: string[];
};

type ParsedManifest = {
  schemaVersion?: number;
  gates?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function v3EventAt(
  manifest: LaunchGateLifecycleManifestV3,
  gateId: LaunchGateId,
  atMs: number,
): LaunchGateLifecycleEventV3 | null {
  let selected: LaunchGateLifecycleEventV3 | null = null;
  for (const event of manifest.gates[gateId].events) {
    if (Date.parse(event.occurredAt) <= atMs) selected = event;
    else break;
  }
  return selected;
}

function v3DependencyDecisionIds(
  manifest: LaunchGateLifecycleManifestV3,
  gateId: LaunchGateId,
  atMs: number,
): Record<string, string> {
  return Object.fromEntries(
    LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId].flatMap((dependency) => {
      const decisionId = v3EventAt(manifest, dependency, atMs)?.decision
        ?.decisionId;
      return decisionId ? [[dependency, decisionId]] : [];
    }),
  );
}

async function readV3EnvelopeMetadata(reference: string): Promise<{
  recordedAt: string;
  repositoryContentSha256: string;
}> {
  try {
    const value = JSON.parse(
      await readFile(path.join(repositoryRoot, reference), "utf8"),
    ) as unknown;
    if (!isRecord(value))
      return { recordedAt: "", repositoryContentSha256: "" };
    const scope = isRecord(value.scope) ? value.scope : {};
    return {
      recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : "",
      repositoryContentSha256:
        typeof scope.repositoryContentSha256 === "string"
          ? scope.repositoryContentSha256
          : "",
    };
  } catch {
    return { recordedAt: "", repositoryContentSha256: "" };
  }
}

const v3CommitSubjectDigestCache = new Map<
  string,
  ReturnType<typeof computeLaunchGateEvidenceV3SubjectDigestAtCommit>
>();

function v3CommitSubjectDigest(
  kind: keyof typeof LAUNCH_GATE_EVIDENCE_V3_POLICY,
  repositoryCommit: string,
) {
  const key = `${kind}:${repositoryCommit}`;
  const cached = v3CommitSubjectDigestCache.get(key);
  if (cached) return cached;
  const pending = computeLaunchGateEvidenceV3SubjectDigestAtCommit(
    repositoryRoot,
    kind,
    repositoryCommit,
  );
  v3CommitSubjectDigestCache.set(key, pending);
  return pending;
}

const manifestText = await readFile(manifestPath, "utf8");
const parsedManifest = parseCanonicalLaunchGateManifest(manifestText);
const manifest = (parsedManifest.manifest ?? {}) as ParsedManifest;
const nowMs = Date.now();
const errors = [
  ...parsedManifest.errors,
  ...validateLaunchGateManifest(manifest, { nowMs }),
];
const schemaVersion = manifest.schemaVersion ?? null;
const v2Gates =
  schemaVersion === 2 ? ((manifest.gates ?? {}) as Record<string, V2Gate>) : {};
const v3Manifest =
  schemaVersion === 3 && errors.length === 0
    ? (manifest as unknown as LaunchGateLifecycleManifestV3)
    : null;
const v3Resolution = v3Manifest
  ? resolveLaunchGateCapabilitiesV3(v3Manifest, { nowMs })
  : null;
const subjectDigest =
  schemaVersion === 2
    ? await computeLaunchGateSubjectDigest(repositoryRoot).catch((error) => {
        errors.push(
          `launch-gate repository subject could not be computed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      })
    : null;

if (
  schemaVersion === 2 &&
  v2Gates.legalPublication?.status === "holding" &&
  !isLegalCopyDraft()
) {
  errors.push(
    "legalPublication is holding but both localized legal notices are not marked draft",
  );
}
const legalPublicationActive =
  schemaVersion === 2
    ? v2Gates.legalPublication?.status === "approved"
    : v3Resolution?.gates.legalPublication.active === true;
const contactIntakeActive =
  schemaVersion === 2
    ? v2Gates.contactIntake?.status === "approved"
    : v3Resolution?.gates.contactIntake.active === true;
if (legalPublicationActive && !isLegalCopyReady()) {
  errors.push(
    "legalPublication is active while English or Spanish legal copy remains draft",
  );
}
for (const [gateId, reference] of Object.entries(pendingContractByGate)) {
  const status =
    schemaVersion === 2
      ? v2Gates[gateId]?.status
      : v3Resolution?.gates[gateId as LaunchGateId].effectiveStatus;
  const expectedStatus =
    status === "approved"
      ? "Satisfied"
      : gateId === "contactIntake" && status === "disabled"
        ? "Disabled"
        : status
          ? "Pending"
          : null;
  if (expectedStatus === null) continue;
  const contents = await readFile(
    path.join(repositoryRoot, reference),
    "utf8",
  ).catch(() => "");
  if (
    !new RegExp(`^\\*\\*Status:\\*\\* ${expectedStatus}\\s*$`, "mu").test(
      contents,
    )
  ) {
    errors.push(
      `${reference} must state Status: ${expectedStatus} while ${gateId} is ${status}`,
    );
  }
}

if (
  process.env.NEXT_PUBLIC_CONTACT_ENABLED === "true" &&
  !(legalPublicationActive && contactIntakeActive)
) {
  errors.push(
    "NEXT_PUBLIC_CONTACT_ENABLED=true is forbidden until legalPublication and contactIntake are approved",
  );
}

const launchGateEvidenceReferences =
  schemaVersion === 3 && v3Manifest
    ? LAUNCH_GATE_IDS.flatMap((gateId) =>
        v3Manifest.gates[gateId].events.flatMap((event) =>
          event.evidence.map((entry) => ({
            reference: entry.reference,
            sha256: entry.sha256,
          })),
        ),
      )
    : Object.values(v2Gates).flatMap((gate) =>
        Array.isArray(gate.evidence)
          ? gate.evidence.flatMap((entry) =>
              typeof entry.reference === "string"
                ? [
                    {
                      reference: entry.reference,
                      sha256:
                        typeof entry.sha256 === "string" ? entry.sha256 : "",
                    },
                  ]
                : [],
            )
          : [],
      );
errors.push(
  ...(
    await validateEvidenceDirectoryContract({
      repositoryRoot,
      relativeDirectory: "docs/evidence/launch-gates",
      references: launchGateEvidenceReferences,
    })
  ).map((error) => `launch-gate evidence directory: ${error}`),
);

const blockerReferences =
  schemaVersion === 3
    ? Object.entries(LAUNCH_GATE_BLOCKER_REFS)
    : Object.entries(v2Gates).map(
        ([gateId, gate]) => [gateId, gate.blockerRefs ?? []] as const,
      );
for (const [gateId, references] of blockerReferences) {
  for (const reference of references) {
    const resolved = path.resolve(repositoryRoot, reference);
    if (!resolved.startsWith(`${repositoryRoot}${path.sep}`)) {
      errors.push(
        `gates.${gateId} reference escapes the repository: ${reference}`,
      );
      continue;
    }
    await access(resolved).catch(() => {
      errors.push(`gates.${gateId} reference does not exist: ${reference}`);
    });
  }
}

if (schemaVersion === 2) {
  for (const [gateId, gate] of Object.entries(v2Gates)) {
    if (
      !LAUNCH_GATE_IDS.includes(gateId as LaunchGateId) ||
      !Array.isArray(gate.evidence)
    ) {
      continue;
    }
    for (const entry of gate.evidence) {
      if (
        typeof entry.kind !== "string" ||
        !Object.hasOwn(LAUNCH_GATE_EVIDENCE_CHECKS, entry.kind) ||
        typeof entry.reference !== "string" ||
        typeof entry.sha256 !== "string" ||
        typeof entry.observedAt !== "string"
      ) {
        continue;
      }
      const approval = gate.approval;
      if (
        !approval ||
        typeof approval.approvedAt !== "string" ||
        !approval.approvedBy ||
        typeof approval.approvedBy.name !== "string" ||
        typeof approval.approvedBy.authorityRole !== "string" ||
        typeof approval.approvedBy.organization !== "string"
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
        ...(subjectDigest
          ? { repositoryContentSha256: subjectDigest.sha256 }
          : {}),
      });
      errors.push(
        ...verification.errors.map((error) => `gates.${gateId}: ${error}`),
      );
    }
  }
}

if (schemaVersion === 3 && v3Manifest) {
  for (const gateId of LAUNCH_GATE_IDS) {
    const events = v3Manifest.gates[gateId].events;
    for (const [eventIndex, event] of events.entries()) {
      if (!event.decision) continue;
      const isLatestEvent = eventIndex === events.length - 1;
      const currentlyEffective =
        event.to === "revoked" ||
        ((event.to === "approved" ||
          event.to === "disabled" ||
          event.to === "private") &&
          event.validUntil !== null &&
          nowMs < Date.parse(event.validUntil));
      const requireCurrentBinding = isLatestEvent && currentlyEffective;
      const dependencyDecisionIds = v3DependencyDecisionIds(
        v3Manifest,
        gateId,
        Date.parse(event.occurredAt),
      );
      for (const entry of event.evidence) {
        if (!isLaunchGateEvidenceV3Kind(entry.kind)) continue;
        const metadata = await readV3EnvelopeMetadata(entry.reference);
        const policy = LAUNCH_GATE_EVIDENCE_V3_POLICY[entry.kind];
        let repositoryContentSha256 = metadata.repositoryContentSha256;
        if (event.to !== "revoked") {
          try {
            repositoryContentSha256 = (
              await v3CommitSubjectDigest(
                entry.kind,
                event.decision.candidate.repositoryCommit,
              )
            ).sha256;
          } catch (error) {
            errors.push(
              `gates.${gateId}.events[${eventIndex}]: candidate commit subject could not be computed for ${entry.kind}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
        const verification = await verifyLaunchGateEvidenceV3File({
          gateId,
          kind: entry.kind,
          outcome: event.to as "approved" | "disabled" | "private" | "revoked",
          candidateId: event.decision.candidate.candidateEventId,
          decisionId: event.decision.decisionId,
          observedAt: entry.observedAt,
          recordedAt: metadata.recordedAt,
          validUntil: entry.validUntil,
          decision: {
            approvedBy: {
              name: event.decision.decidedBy.name,
              authorityRole: event.decision.decidedBy.authorityRole,
              organization: event.decision.decidedBy.organization,
            },
            approvedAt: event.decision.decidedAt,
          },
          repositoryCommit: event.decision.candidate.repositoryCommit,
          repositoryContentSha256,
          vercelDeploymentId: policy.requiresDeployment
            ? event.decision.candidate.vercelDeploymentId
            : null,
          dependencyDecisionIds,
          repositoryRoot,
          reference: entry.reference,
          sha256: entry.sha256,
          nowMs,
          requireCurrentlyValid: requireCurrentBinding,
          requireCurrentSubject: requireCurrentBinding,
        });
        errors.push(
          ...verification.errors.map(
            (error) => `gates.${gateId}.events[${eventIndex}]: ${error}`,
          ),
        );
      }
    }
  }
}

const gateStates =
  schemaVersion === 3 && v3Resolution
    ? Object.fromEntries(
        LAUNCH_GATE_IDS.map((id) => [
          id,
          v3Resolution.gates[id].effectiveStatus,
        ]),
      )
    : Object.fromEntries(
        LAUNCH_GATE_IDS.map((id) => [id, v2Gates[id]?.status ?? "missing"]),
      );
const result = {
  manifest: path.relative(repositoryRoot, manifestPath),
  schemaVersion,
  sha256: createHash("sha256").update(manifestText).digest("hex"),
  subject: subjectDigest,
  gates: gateStates,
  errors: [...new Set(errors)],
};

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) process.exitCode = 1;
