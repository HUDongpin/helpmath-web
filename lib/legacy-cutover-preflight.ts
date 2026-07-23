import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { CONTACT_PRODUCTION_VERIFICATION_CHECKS } from "./launch-gate-policy";

export const LEGACY_CUTOVER_EVIDENCE_CHECKS = {
  dnsZoneBefore: [
    "authenticatedExport",
    "completeZoneCaptured",
    "rollbackValuesCaptured",
  ],
  dnsZoneProposed: [
    "approvedWebsiteRecordsOnly",
    "mailRecordsUnchanged",
    "ownershipRecordsUnchanged",
    "noApexCnameConflict",
  ],
  mailContinuity: [
    "inboundDeliveryPassed",
    "outboundDeliveryPassed",
    "mxRecordsUnchanged",
    "mailTxtRecordsUnchanged",
  ],
  contactDelivery: [
    "repositoryGateApproved",
    "productionEnvironmentEnabled",
    "retentionAndInboxOwnersConfirmed",
    ...CONTACT_PRODUCTION_VERIFICATION_CHECKS,
  ],
  contactDisabled: [
    "repositoryGateDisabled",
    "contactPageUnavailable",
    "contactApiFailsClosed",
    "noDeliveryAttempted",
    "alternateSupportRouteVerified",
  ],
  searchConsoleControl: [
    "legacyPropertyControlled",
    "newPropertyControlled",
    "changeOfAddressOwnerNamed",
  ],
  offDeviceArchiveRestore: [
    "encryptedOffDeviceCustody",
    "independentRestorePassed",
    "restoredBytesHashVerified",
  ],
  rightsAccessibilityDisposition: [
    "allGovernedSourcesClassified",
    "republicationDecisionsRecorded",
    "accessibilityActionsRecorded",
  ],
  stableExternalLinkReview: [
    "allGovernedLinksReviewed",
    "zeroUnresolvedFailures",
    "reviewCommitMatched",
  ],
  productionAliasAssignment: [
    "canonicalWwwAssigned",
    "canonicalApexAssigned",
    "readyProductionDeployment",
    "deploymentCommitMatched",
  ],
  productionQuality: [
    "qualityRunSucceeded",
    "qualityCommitMatched",
    "qualityRunEventWasPush",
    "launchGateTransitionPassed",
    "verifyJobPassed",
    "browserQualityJobPassed",
    "lighthouseJobPassed",
  ],
  productionSmoke: [
    "productionSmokeSucceeded",
    "zeroFailures",
    "smokeCommitMatched",
  ],
  legacyHostConfigTest: [
    "targetHostVersionRecorded",
    "stagedArtifactHashMatched",
    "stagedConfigTestPassed",
  ],
  preCutoverDnsObservation: [
    "authoritativeResolversAgree",
    "publicResolversAgree",
    "websiteRecordsMatchBeforeZone",
    "mailAndOwnershipRecordsMatchBeforeZone",
  ],
  preCutoverHttpTlsObservation: [
    "allFourLegacyOriginsReachable",
    "currentRedirectStateMatchesBaseline",
    "targetCanonicalRoutesPassed",
    "tlsIdentityAndExpiryPassed",
  ],
} as const;

export const LEGACY_CUTOVER_EVIDENCE_KEYS = Object.freeze(
  Object.keys(LEGACY_CUTOVER_EVIDENCE_CHECKS),
) as Array<keyof typeof LEGACY_CUTOVER_EVIDENCE_CHECKS>;

export type LegacyCutoverEvidenceKey =
  (typeof LEGACY_CUTOVER_EVIDENCE_KEYS)[number];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
export const MIN_LEGACY_AUTHORIZATION_VALIDITY_MS = 5 * MINUTE_MS;

export const LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS: Record<
  LegacyCutoverEvidenceKey,
  number
> = {
  dnsZoneBefore: DAY_MS,
  dnsZoneProposed: DAY_MS,
  mailContinuity: DAY_MS,
  contactDelivery: DAY_MS,
  contactDisabled: DAY_MS,
  searchConsoleControl: 7 * DAY_MS,
  offDeviceArchiveRestore: 30 * DAY_MS,
  rightsAccessibilityDisposition: 30 * DAY_MS,
  stableExternalLinkReview: DAY_MS,
  productionAliasAssignment: DAY_MS,
  productionQuality: DAY_MS,
  productionSmoke: DAY_MS,
  legacyHostConfigTest: DAY_MS,
  preCutoverDnsObservation: 15 * MINUTE_MS,
  preCutoverHttpTlsObservation: 15 * MINUTE_MS,
};

export const LEGACY_CUTOVER_DECISION_EVIDENCE = {
  topology: "dnsZoneProposed",
  salesDestination: "legacyHostConfigTest",
  dnsChange: "preCutoverDnsObservation",
  mailContinuity: "mailContinuity",
  searchConsole: "searchConsoleControl",
  rollbackPlan: "dnsZoneBefore",
  sourceRightsAccessibility: "rightsAccessibilityDisposition",
  stableExternalLinks: "stableExternalLinkReview",
} as const satisfies Record<string, LegacyCutoverEvidenceKey>;

export type LegacyCutoverContactMode = "enabled" | "disabled";

export const LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE = {
  enabled: "contactDelivery",
  disabled: "contactDisabled",
} as const satisfies Record<LegacyCutoverContactMode, LegacyCutoverEvidenceKey>;

const LEGACY_CUTOVER_CONTACT_EVIDENCE_KEYS = Object.freeze(
  Object.values(LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE),
);

export function getLegacyCutoverDecisionEvidence(
  contactMode: LegacyCutoverContactMode,
): Record<string, LegacyCutoverEvidenceKey> {
  return {
    ...LEGACY_CUTOVER_DECISION_EVIDENCE,
    contactDisposition: LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE[contactMode],
  };
}

export function getLegacyCutoverEvidenceKeys(
  contactMode: LegacyCutoverContactMode,
): LegacyCutoverEvidenceKey[] {
  return LEGACY_CUTOVER_EVIDENCE_KEYS.filter(
    (key) =>
      !LEGACY_CUTOVER_CONTACT_EVIDENCE_KEYS.includes(
        key as (typeof LEGACY_CUTOVER_CONTACT_EVIDENCE_KEYS)[number],
      ) || key === LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE[contactMode],
  );
}

function requiredLegacyCutoverEvidence(
  plan: LegacyCutoverPlan,
  key: LegacyCutoverEvidenceKey,
): LegacyCutoverEvidenceReference {
  const evidence = plan.evidence[key];
  if (!evidence) {
    throw new Error(
      `plan.evidence.${key} is required for contactMode ${plan.contactMode}`,
    );
  }
  return evidence;
}

export const REQUIRED_LEGACY_PREFLIGHT_COMMANDS = [
  "check:launch-gates",
  "check:legacy-apache",
  "test:legacy-apache",
  "check:legacy-source-custody",
] as const;

export function computeLegacyCutoverValidUntil(
  plan: LegacyCutoverPlan,
  requiredGateValidUntils: readonly string[] = [],
): string {
  for (const validUntil of requiredGateValidUntils) {
    if (!isStrictIsoUtc(validUntil)) {
      throw new Error("required gate validUntil must be canonical UTC");
    }
  }
  const evidenceExpiries = getLegacyCutoverEvidenceKeys(plan.contactMode).map(
    (key) => {
      const evidence = requiredLegacyCutoverEvidence(plan, key);
      return (
        Date.parse(evidence.observedAt) +
        LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key]
      );
    },
  );
  const decisionExpiries = Object.values(plan.decisions).map(
    (decision) => Date.parse(decision.approvedAt) + 30 * DAY_MS,
  );
  return new Date(
    Math.min(
      Date.parse(plan.window.startsAt) + 15 * MINUTE_MS,
      Date.parse(plan.window.monitorUntil),
      ...evidenceExpiries,
      ...decisionExpiries,
      ...requiredGateValidUntils.map((validUntil) => Date.parse(validUntil)),
    ),
  ).toISOString();
}

export function computeLegacyAuthorizationValidityRemainingMs(
  plan: LegacyCutoverPlan,
  nowMs: number,
  requiredGateValidUntils: readonly string[] = [],
): number {
  return (
    Date.parse(computeLegacyCutoverValidUntil(plan, requiredGateValidUntils)) -
    Math.max(nowMs, Date.parse(plan.window.startsAt))
  );
}

export type LegacyCutoverEvidenceReference = {
  reference: string;
  sha256: string;
  observedAt: string;
};

export const LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY =
  "HUDongpin/helpmath-web" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW = "Quality" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH =
  ".github/workflows/quality.yml" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT = "push" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_REF =
  "refs/heads/main" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH = "main" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE =
  "github-actions-api" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION =
  "2022-11-28" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP =
  "Enforce launch-gate transition history" as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT = 2 as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS = [
  "verify",
  "browser-quality",
  "lighthouse",
] as const;
export const LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS = [
  "Authorize Lighthouse workflow attempt",
  "Classify Lighthouse runner capacity",
  "Enforce eligible Lighthouse verdict",
] as const;

export type LegacyCutoverProductionQualityRun = {
  repository: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY;
  workflow: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW;
  workflowPath: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH;
  event: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT;
  ref: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_REF;
  headBranch: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH;
  headSha: string;
  runId: number;
  runAttempt: number;
  runUrl: string;
  conclusion: "success";
  launchTransition: {
    job: "verify";
    step: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP;
    conclusion: "success";
  };
  jobs: Record<
    (typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS)[number],
    "success"
  >;
};

export type LegacyCutoverProductionQualityEvidenceBundle = {
  schemaVersion: 1;
  source: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE;
  apiVersion: typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION;
  requests: {
    run: string;
    workflow: string;
    jobs: string;
  };
  run: {
    id: number;
    run_attempt: number;
    workflow_id: number;
    name: string;
    path: string;
    event: string;
    status: string;
    conclusion: string;
    head_branch: string;
    head_sha: string;
    html_url: string;
    repository: { full_name: string };
    head_repository: { full_name: string };
    created_at: string;
    run_started_at: string;
    updated_at: string;
  };
  workflow: {
    id: number;
    name: string;
    path: string;
    state: string;
    url: string;
  };
  jobs: {
    total_count: number;
    jobs: Array<{
      id: number;
      run_id: number;
      run_attempt: number;
      name: string;
      head_sha: string;
      status: string;
      conclusion: string;
      started_at: string;
      completed_at: string;
      html_url: string;
      steps: Array<{
        number: number;
        name: string;
        status: string;
        conclusion: string;
      }>;
    }>;
  };
};

export type LegacyCutoverDecision = {
  status: "approved";
  approvedBy: string;
  approvedAt: string;
  evidenceKey: LegacyCutoverEvidenceKey;
};

export type LegacyCutoverPlan = {
  schemaVersion: 2;
  cutoverId: string;
  topology: "direct-one-hop" | "temporary-two-hop";
  repositoryCommit: string;
  vercelDeploymentId: string;
  contactMode: LegacyCutoverContactMode;
  salesDestination: "/contact" | "/resources";
  owners: {
    change: string;
    rollback: string;
    dns: string;
    mail: string;
    searchConsole: string;
  };
  window: {
    startsAt: string;
    monitorUntil: string;
    timezone: string;
  };
  ttl: {
    previousSeconds: number;
    reducedAt: string;
  };
  rollbackThresholds: {
    consecutiveProbeFailures: number;
    maxFiveXxPercent: number;
    maxTimeoutPercent: number;
    probeIntervalSeconds: number;
    minimumProbeCount: number;
    tlsFailureImmediate: true;
    mailRecordChangeImmediate: true;
  };
  decisions: Record<
    keyof typeof LEGACY_CUTOVER_DECISION_EVIDENCE | "contactDisposition",
    LegacyCutoverDecision
  >;
  evidence: Partial<
    Record<LegacyCutoverEvidenceKey, LegacyCutoverEvidenceReference>
  >;
};

export type PreflightCheck = {
  id: string;
  pass: boolean;
  detail: string;
};

export type EvidenceVerificationEntry = {
  key: LegacyCutoverEvidenceKey;
  reference: string;
  expectedSha256: string;
  actualSha256: string | null;
  observedAt: string;
  maxAgeMs: number;
  underlyingEvidence: {
    reference: string | null;
    expectedSha256: string | null;
    actualSha256: string | null;
    expectedBytes: number | null;
    actualBytes: number | null;
    collector: string | null;
    collectorVersion: string | null;
  };
  pass: boolean;
  errors: string[];
};

export type EvidenceVerification = {
  ok: boolean;
  detail: string;
  entries: EvidenceVerificationEntry[];
};

export type LegacyCutoverPreflightInput = {
  plan: LegacyCutoverPlan | null;
  planErrors: string[];
  manifestErrors: string[];
  gateStatuses: Record<string, string | undefined>;
  gateDependencies: Record<string, string[] | undefined>;
  gateAuthorizations: Record<
    "legalPublication" | "contactIntake" | "legacyCutover",
    {
      decisionId: string | null;
      repositoryCommit: string | null;
      vercelDeploymentId: string | null;
      validUntil: string | null;
    }
  >;
  decisionTimeMs: number;
  repository: {
    head: string | null;
    clean: boolean;
    candidateCommitExists: boolean;
    candidateIsAncestor: boolean;
  };
  commandResults: Record<string, { ok: boolean; detail: string }>;
  evidenceVerification: EvidenceVerification;
  salesDestinationObserved: string | null;
  receiptDirectoryReady: boolean;
};

const TOP_LEVEL_FIELDS = [
  "schemaVersion",
  "cutoverId",
  "topology",
  "repositoryCommit",
  "vercelDeploymentId",
  "contactMode",
  "salesDestination",
  "owners",
  "window",
  "ttl",
  "rollbackThresholds",
  "decisions",
  "evidence",
] as const;
const OWNER_FIELDS = [
  "change",
  "rollback",
  "dns",
  "mail",
  "searchConsole",
] as const;
const WINDOW_FIELDS = ["startsAt", "monitorUntil", "timezone"] as const;
const TTL_FIELDS = ["previousSeconds", "reducedAt"] as const;
const ROLLBACK_THRESHOLD_FIELDS = [
  "consecutiveProbeFailures",
  "maxFiveXxPercent",
  "maxTimeoutPercent",
  "probeIntervalSeconds",
  "minimumProbeCount",
  "tlsFailureImmediate",
  "mailRecordChangeImmediate",
] as const;
const EVIDENCE_FIELDS = ["reference", "sha256", "observedAt"] as const;
const DECISION_FIELDS = [
  "status",
  "approvedBy",
  "approvedAt",
  "evidenceKey",
] as const;
const ARTIFACT_FIELDS = [
  "schemaVersion",
  "evidenceKind",
  "status",
  "cutoverId",
  "observedAt",
  "repositoryCommit",
  "vercelDeploymentId",
  "topology",
  "source",
  "underlyingEvidence",
  "checks",
] as const;
const PRODUCTION_QUALITY_ARTIFACT_FIELDS = [
  ...ARTIFACT_FIELDS,
  "qualityRun",
] as const;
const UNDERLYING_EVIDENCE_FIELDS = [
  "reference",
  "sha256",
  "bytes",
  "collector",
  "collectorVersion",
] as const;
const PRODUCTION_QUALITY_RUN_FIELDS = [
  "repository",
  "workflow",
  "workflowPath",
  "event",
  "ref",
  "headBranch",
  "headSha",
  "runId",
  "runAttempt",
  "runUrl",
  "conclusion",
  "launchTransition",
  "jobs",
] as const;
const PRODUCTION_QUALITY_TRANSITION_FIELDS = [
  "job",
  "step",
  "conclusion",
] as const;
const PRODUCTION_QUALITY_BUNDLE_FIELDS = [
  "schemaVersion",
  "source",
  "apiVersion",
  "requests",
  "run",
  "workflow",
  "jobs",
] as const;
const PRODUCTION_QUALITY_REQUEST_FIELDS = [
  "run",
  "workflow",
  "jobs",
] as const;
const PRODUCTION_QUALITY_RAW_RUN_FIELDS = [
  "id",
  "run_attempt",
  "workflow_id",
  "name",
  "path",
  "event",
  "status",
  "conclusion",
  "head_branch",
  "head_sha",
  "html_url",
  "repository",
  "head_repository",
  "created_at",
  "run_started_at",
  "updated_at",
] as const;
const PRODUCTION_QUALITY_RAW_REPOSITORY_FIELDS = ["full_name"] as const;
const PRODUCTION_QUALITY_RAW_WORKFLOW_FIELDS = [
  "id",
  "name",
  "path",
  "state",
  "url",
] as const;
const PRODUCTION_QUALITY_RAW_JOBS_FIELDS = [
  "total_count",
  "jobs",
] as const;
const PRODUCTION_QUALITY_RAW_JOB_FIELDS = [
  "id",
  "run_id",
  "run_attempt",
  "name",
  "head_sha",
  "status",
  "conclusion",
  "started_at",
  "completed_at",
  "html_url",
  "steps",
] as const;
const PRODUCTION_QUALITY_RAW_STEP_FIELDS = [
  "number",
  "name",
  "status",
  "conclusion",
] as const;
const SENSITIVE_KEY =
  /(?:token|secret|password|passphrase|cookie|private.?key|credential|authorization)/iu;
const SENSITIVE_VALUE =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~-]+|gh[opsu]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|vercel_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|https?:\/\/[^/\s:@]+:[^@\s/]+@|[?&](?:token|secret|password|key)=[^&\s]+)/iu;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_UNDERLYING_EVIDENCE_BYTES = 50 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPathInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

export async function readRestrictedExternalFile(
  filePath: string,
  {
    repositoryRoot,
    maxBytes = MAX_EVIDENCE_BYTES,
    label = "external file",
  }: { repositoryRoot?: string; maxBytes?: number; label?: string } = {},
): Promise<{ bytes: Buffer; canonicalPath: string }> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error(`${label} maxBytes must be a positive safe integer`);
  }
  if (!path.isAbsolute(filePath))
    throw new Error(`${label} must use an absolute path`);
  const terminalStat = await lstat(filePath);
  if (terminalStat.isSymbolicLink() || !terminalStat.isFile()) {
    throw new Error(`${label} must be a regular file and not a symbolic link`);
  }
  const canonicalPath = await realpath(filePath);
  if (repositoryRoot && isPathInside(repositoryRoot, canonicalPath)) {
    throw new Error(`${label} resolves inside the repository`);
  }
  const parentStat = await lstat(path.dirname(canonicalPath));
  if ((parentStat.mode & 0o077) !== 0) {
    throw new Error(
      `${label} parent directory must not grant group or other permissions`,
    );
  }
  const handle = await open(
    canonicalPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const fileStat = await handle.stat();
    if (!fileStat.isFile()) throw new Error(`${label} must be a regular file`);
    if (
      fileStat.dev !== terminalStat.dev ||
      fileStat.ino !== terminalStat.ino
    ) {
      throw new Error(`${label} changed while it was being validated`);
    }
    if (fileStat.nlink !== 1) {
      throw new Error(`${label} must have exactly one hard link`);
    }
    if ((fileStat.mode & 0o077) !== 0) {
      throw new Error(`${label} must not grant group or other permissions`);
    }
    if (fileStat.size <= 0 || fileStat.size > maxBytes) {
      throw new Error(`${label} size must be between 1 and ${maxBytes} bytes`);
    }
    return { bytes: await handle.readFile(), canonicalPath };
  } finally {
    await handle.close();
  }
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function isStrictIsoUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function githubTimestampMs(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isResolvedText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    !/\b(?:pending|tbd|unknown|placeholder|named_owner|same_as_plan|evidence_key|collector_version)\b/iu.test(
      value,
    ) &&
    !/(?:FULL_40_CHARACTER|LOWERCASE_64_CHARACTER|YYYY-MM-DD)/u.test(value)
  );
}

function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function findSensitiveMaterial(value: unknown, location = "value"): string[] {
  const errors: string[] = [];
  const stack: Array<{ value: unknown; location: string; depth: number }> = [
    { value, location, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > 50_000) {
      errors.push(`${location} exceeds the supported 50000-node content limit`);
      break;
    }
    if (current.depth > 100) {
      errors.push(`${location} exceeds the supported 100-level nesting limit`);
      break;
    }
    if (typeof current.value === "object" && current.value !== null) {
      if (seen.has(current.value)) {
        errors.push(`${current.location} contains a cyclic object reference`);
        continue;
      }
      seen.add(current.value);
    }
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          location: `${current.location}[${index}]`,
          depth: current.depth + 1,
        });
      }
      continue;
    }
    if (!isRecord(current.value)) {
      if (
        typeof current.value === "string" &&
        SENSITIVE_VALUE.test(current.value)
      ) {
        errors.push(`${current.location} contains credential-shaped material`);
      }
      continue;
    }
    const entries = Object.entries(current.value);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, entry] = entries[index];
      if (SENSITIVE_KEY.test(key)) {
        errors.push(
          `${current.location}.${key} is a forbidden sensitive field`,
        );
      }
      stack.push({
        value: entry,
        location: `${current.location}.${key}`,
        depth: current.depth + 1,
      });
    }
  }
  return errors;
}

function validateExactFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  location: string,
  errors: string[],
) {
  for (const field of unknownFields(value, allowed)) {
    errors.push(`${location} contains unknown field ${field}`);
  }
  for (const field of allowed) {
    if (!(field in value)) errors.push(`${location}.${field} is required`);
  }
}

function validateFreshTimestamp(
  value: unknown,
  location: string,
  nowMs: number,
  maxAgeMs: number,
  errors: string[],
) {
  if (!isStrictIsoUtc(value)) {
    errors.push(`${location} must be canonical UTC`);
    return;
  }
  const observedAtMs = Date.parse(value);
  if (observedAtMs > nowMs) {
    errors.push(`${location} cannot be in the future`);
  }
  if (nowMs - observedAtMs > maxAgeMs) {
    errors.push(`${location} is older than the permitted evidence age`);
  }
}

export function validateLegacyCutoverPlan(
  value: unknown,
  { nowMs = Date.now() } = {},
): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(nowMs)) {
    return ["plan validation nowMs must be a finite timestamp"];
  }
  if (!isRecord(value)) return ["plan must be an object"];

  validateExactFields(value, TOP_LEVEL_FIELDS, "plan", errors);
  errors.push(...findSensitiveMaterial(value, "plan"));

  if (value.schemaVersion !== 2) errors.push("plan.schemaVersion must be 2");
  if (
    !isResolvedText(value.cutoverId) ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(value.cutoverId)
  ) {
    errors.push("plan.cutoverId must be a resolved lowercase identifier");
  }
  if (
    !["direct-one-hop", "temporary-two-hop"].includes(String(value.topology))
  ) {
    errors.push("plan.topology must be direct-one-hop or temporary-two-hop");
  }
  if (
    typeof value.repositoryCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(value.repositoryCommit)
  ) {
    errors.push("plan.repositoryCommit must be a full Git SHA");
  }
  if (
    typeof value.vercelDeploymentId !== "string" ||
    !/^dpl_[A-Za-z0-9]+$/u.test(value.vercelDeploymentId)
  ) {
    errors.push("plan.vercelDeploymentId must be a Vercel deployment ID");
  }
  if (!["enabled", "disabled"].includes(String(value.contactMode))) {
    errors.push("plan.contactMode must be enabled or disabled");
  }
  if (!["/contact", "/resources"].includes(String(value.salesDestination))) {
    errors.push("plan.salesDestination must be /contact or /resources");
  }
  if (
    value.contactMode === "disabled" &&
    value.salesDestination !== "/resources"
  ) {
    errors.push(
      "plan.salesDestination must be /resources when contactMode is disabled",
    );
  }

  if (!isRecord(value.owners)) {
    errors.push("plan.owners must be an object");
  } else {
    validateExactFields(value.owners, OWNER_FIELDS, "plan.owners", errors);
    for (const field of OWNER_FIELDS) {
      if (!isResolvedText(value.owners[field]))
        errors.push(`plan.owners.${field} must be resolved`);
    }
  }

  if (!isRecord(value.window)) {
    errors.push("plan.window must be an object");
  } else {
    validateExactFields(value.window, WINDOW_FIELDS, "plan.window", errors);
    const startsAt = value.window.startsAt;
    const monitorUntil = value.window.monitorUntil;
    if (!isStrictIsoUtc(startsAt))
      errors.push("plan.window.startsAt must be canonical UTC");
    if (!isStrictIsoUtc(monitorUntil))
      errors.push("plan.window.monitorUntil must be canonical UTC");
    if (isStrictIsoUtc(startsAt) && isStrictIsoUtc(monitorUntil)) {
      if (Date.parse(monitorUntil) <= Date.parse(startsAt)) {
        errors.push("plan.window.monitorUntil must be after startsAt");
      }
      if (Date.parse(monitorUntil) - Date.parse(startsAt) < HOUR_MS) {
        errors.push("plan.window must retain at least one hour of monitoring");
      }
      if (Date.parse(startsAt) < nowMs - 15 * MINUTE_MS) {
        errors.push("plan.window.startsAt is too far in the past");
      }
      if (Date.parse(startsAt) > nowMs + HOUR_MS) {
        errors.push("plan.window.startsAt must be within the next hour");
      }
      if (Date.parse(monitorUntil) <= nowMs) {
        errors.push("plan.window.monitorUntil must still be in the future");
      }
    }
    if (!isIanaTimeZone(value.window.timezone)) {
      errors.push("plan.window.timezone must be a valid IANA timezone");
    }
  }

  if (!isRecord(value.ttl)) {
    errors.push("plan.ttl must be an object");
  } else {
    validateExactFields(value.ttl, TTL_FIELDS, "plan.ttl", errors);
    if (
      !Number.isInteger(value.ttl.previousSeconds) ||
      Number(value.ttl.previousSeconds) < 60
    ) {
      errors.push("plan.ttl.previousSeconds must be an integer of at least 60");
    }
    if (!isStrictIsoUtc(value.ttl.reducedAt)) {
      errors.push("plan.ttl.reducedAt must be canonical UTC");
    } else if (
      Number.isInteger(value.ttl.previousSeconds) &&
      nowMs - Date.parse(value.ttl.reducedAt) <
        Number(value.ttl.previousSeconds) * 1000
    ) {
      errors.push("the prior TTL has not elapsed since plan.ttl.reducedAt");
    }
  }

  if (!isRecord(value.rollbackThresholds)) {
    errors.push("plan.rollbackThresholds must be an object");
  } else {
    validateExactFields(
      value.rollbackThresholds,
      ROLLBACK_THRESHOLD_FIELDS,
      "plan.rollbackThresholds",
      errors,
    );
    if (
      !Number.isInteger(value.rollbackThresholds.consecutiveProbeFailures) ||
      Number(value.rollbackThresholds.consecutiveProbeFailures) < 1 ||
      Number(value.rollbackThresholds.consecutiveProbeFailures) > 10
    ) {
      errors.push(
        "plan.rollbackThresholds.consecutiveProbeFailures must be an integer from 1 to 10",
      );
    }
    for (const field of ["maxFiveXxPercent", "maxTimeoutPercent"] as const) {
      const threshold = value.rollbackThresholds[field];
      if (
        typeof threshold !== "number" ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold >= 100
      ) {
        errors.push(
          `plan.rollbackThresholds.${field} must be a number from 0 up to but not including 100`,
        );
      }
    }
    if (
      !Number.isInteger(value.rollbackThresholds.probeIntervalSeconds) ||
      Number(value.rollbackThresholds.probeIntervalSeconds) < 10 ||
      Number(value.rollbackThresholds.probeIntervalSeconds) > 300
    ) {
      errors.push(
        "plan.rollbackThresholds.probeIntervalSeconds must be an integer from 10 to 300",
      );
    }
    if (
      !Number.isInteger(value.rollbackThresholds.minimumProbeCount) ||
      Number(value.rollbackThresholds.minimumProbeCount) < 2 ||
      Number(value.rollbackThresholds.minimumProbeCount) > 100
    ) {
      errors.push(
        "plan.rollbackThresholds.minimumProbeCount must be an integer from 2 to 100",
      );
    }
    if (
      Number.isInteger(value.rollbackThresholds.consecutiveProbeFailures) &&
      Number.isInteger(value.rollbackThresholds.minimumProbeCount) &&
      Number(value.rollbackThresholds.consecutiveProbeFailures) >
        Number(value.rollbackThresholds.minimumProbeCount)
    ) {
      errors.push(
        "plan.rollbackThresholds.consecutiveProbeFailures cannot exceed minimumProbeCount",
      );
    }
    if (
      isRecord(value.window) &&
      isStrictIsoUtc(value.window.startsAt) &&
      isStrictIsoUtc(value.window.monitorUntil) &&
      Number.isInteger(value.rollbackThresholds.probeIntervalSeconds) &&
      Number.isInteger(value.rollbackThresholds.minimumProbeCount) &&
      Date.parse(value.window.monitorUntil) -
        Date.parse(value.window.startsAt) <
        (Number(value.rollbackThresholds.minimumProbeCount) - 1) *
          Number(value.rollbackThresholds.probeIntervalSeconds) *
          1000
    ) {
      errors.push(
        "plan monitoring window cannot fit the required probe schedule",
      );
    }
    for (const field of [
      "tlsFailureImmediate",
      "mailRecordChangeImmediate",
    ] as const) {
      if (value.rollbackThresholds[field] !== true) {
        errors.push(`plan.rollbackThresholds.${field} must be true`);
      }
    }
  }

  if (!isRecord(value.decisions)) {
    errors.push("plan.decisions must be an object");
  } else {
    const contactMode =
      value.contactMode === "enabled" || value.contactMode === "disabled"
        ? value.contactMode
        : "enabled";
    const decisionEvidenceByKey = getLegacyCutoverDecisionEvidence(contactMode);
    const decisionKeys = Object.keys(decisionEvidenceByKey);
    validateExactFields(
      value.decisions,
      decisionKeys,
      "plan.decisions",
      errors,
    );
    for (const key of decisionKeys) {
      const decision = value.decisions[key];
      if (!isRecord(decision)) {
        errors.push(`plan.decisions.${key} must be an object`);
        continue;
      }
      validateExactFields(
        decision,
        DECISION_FIELDS,
        `plan.decisions.${key}`,
        errors,
      );
      if (decision.status !== "approved") {
        errors.push(`plan.decisions.${key}.status must be approved`);
      }
      if (!isResolvedText(decision.approvedBy)) {
        errors.push(`plan.decisions.${key}.approvedBy must be resolved`);
      }
      validateFreshTimestamp(
        decision.approvedAt,
        `plan.decisions.${key}.approvedAt`,
        nowMs,
        30 * DAY_MS,
        errors,
      );
      if (decision.evidenceKey !== decisionEvidenceByKey[key]) {
        errors.push(
          `plan.decisions.${key}.evidenceKey must be ${decisionEvidenceByKey[key]}`,
        );
      }
      const decisionEvidence = isRecord(value.evidence)
        ? value.evidence[decisionEvidenceByKey[key]]
        : null;
      if (
        isStrictIsoUtc(decision.approvedAt) &&
        isRecord(decisionEvidence) &&
        isStrictIsoUtc(decisionEvidence.observedAt) &&
        Date.parse(decision.approvedAt) <
          Date.parse(decisionEvidence.observedAt)
      ) {
        errors.push(
          `plan.decisions.${key}.approvedAt must not precede its evidence observation`,
        );
      }
    }
  }

  if (!isRecord(value.evidence)) {
    errors.push("plan.evidence must be an object");
  } else {
    const contactMode =
      value.contactMode === "enabled" || value.contactMode === "disabled"
        ? value.contactMode
        : "enabled";
    const evidenceKeys = getLegacyCutoverEvidenceKeys(contactMode);
    validateExactFields(value.evidence, evidenceKeys, "plan.evidence", errors);
    for (const key of evidenceKeys) {
      const evidence = value.evidence[key];
      if (!isRecord(evidence)) {
        errors.push(`plan.evidence.${key} must be an object`);
        continue;
      }
      validateExactFields(
        evidence,
        EVIDENCE_FIELDS,
        `plan.evidence.${key}`,
        errors,
      );
      if (
        !isResolvedText(evidence.reference) ||
        !path.isAbsolute(String(evidence.reference)) ||
        String(evidence.reference).includes("\0")
      ) {
        errors.push(
          `plan.evidence.${key}.reference must be an absolute local file path`,
        );
      }
      if (
        typeof evidence.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(evidence.sha256)
      ) {
        errors.push(`plan.evidence.${key}.sha256 must be a lowercase SHA-256`);
      }
      validateFreshTimestamp(
        evidence.observedAt,
        `plan.evidence.${key}.observedAt`,
        nowMs,
        LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key],
        errors,
      );
    }
  }

  return [...new Set(errors)];
}

function validateEvidenceArtifact(
  value: unknown,
  key: LegacyCutoverEvidenceKey,
  plan: LegacyCutoverPlan,
  nowMs: number,
): string[] {
  const errors: string[] = [];
  const expectedEvidence = requiredLegacyCutoverEvidence(plan, key);
  if (!isRecord(value)) return ["artifact must be a JSON object"];
  validateExactFields(
    value,
    key === "productionQuality"
      ? PRODUCTION_QUALITY_ARTIFACT_FIELDS
      : ARTIFACT_FIELDS,
    `artifact.${key}`,
    errors,
  );
  errors.push(...findSensitiveMaterial(value, `artifact.${key}`));
  if (value.schemaVersion !== 1)
    errors.push(`artifact.${key}.schemaVersion must be 1`);
  if (value.evidenceKind !== key)
    errors.push(`artifact.${key}.evidenceKind must be ${key}`);
  if (value.status !== "pass")
    errors.push(`artifact.${key}.status must be pass`);
  if (value.cutoverId !== plan.cutoverId)
    errors.push(`artifact.${key}.cutoverId does not match plan`);
  if (value.repositoryCommit !== plan.repositoryCommit) {
    errors.push(`artifact.${key}.repositoryCommit does not match plan`);
  }
  if (value.vercelDeploymentId !== plan.vercelDeploymentId) {
    errors.push(`artifact.${key}.vercelDeploymentId does not match plan`);
  }
  if (value.topology !== plan.topology)
    errors.push(`artifact.${key}.topology does not match plan`);
  if (!isResolvedText(value.source))
    errors.push(`artifact.${key}.source must be resolved`);
  if (key === "productionQuality") {
    validateProductionQualityRun(value.qualityRun, plan, errors);
  }
  if (!isRecord(value.underlyingEvidence)) {
    errors.push(`artifact.${key}.underlyingEvidence must be an object`);
  } else {
    validateExactFields(
      value.underlyingEvidence,
      UNDERLYING_EVIDENCE_FIELDS,
      `artifact.${key}.underlyingEvidence`,
      errors,
    );
    if (
      !isResolvedText(value.underlyingEvidence.reference) ||
      !path.isAbsolute(String(value.underlyingEvidence.reference))
    ) {
      errors.push(
        `artifact.${key}.underlyingEvidence.reference must be an absolute local file path`,
      );
    }
    if (
      typeof value.underlyingEvidence.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(value.underlyingEvidence.sha256)
    ) {
      errors.push(
        `artifact.${key}.underlyingEvidence.sha256 must be a lowercase SHA-256`,
      );
    }
    if (
      !Number.isInteger(value.underlyingEvidence.bytes) ||
      Number(value.underlyingEvidence.bytes) < 1 ||
      Number(value.underlyingEvidence.bytes) > MAX_UNDERLYING_EVIDENCE_BYTES
    ) {
      errors.push(
        `artifact.${key}.underlyingEvidence.bytes must be an integer from 1 to ${MAX_UNDERLYING_EVIDENCE_BYTES}`,
      );
    }
    if (!isResolvedText(value.underlyingEvidence.collector)) {
      errors.push(
        `artifact.${key}.underlyingEvidence.collector must be resolved`,
      );
    }
    if (!isResolvedText(value.underlyingEvidence.collectorVersion)) {
      errors.push(
        `artifact.${key}.underlyingEvidence.collectorVersion must be resolved`,
      );
    }
  }
  validateFreshTimestamp(
    value.observedAt,
    `artifact.${key}.observedAt`,
    nowMs,
    LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key],
    errors,
  );
  if (value.observedAt !== expectedEvidence.observedAt) {
    errors.push(`artifact.${key}.observedAt does not match plan`);
  }
  if (!isRecord(value.checks)) {
    errors.push(`artifact.${key}.checks must be an object`);
  } else {
    const requiredChecks = LEGACY_CUTOVER_EVIDENCE_CHECKS[key];
    validateExactFields(
      value.checks,
      requiredChecks,
      `artifact.${key}.checks`,
      errors,
    );
    for (const check of requiredChecks) {
      if (value.checks[check] !== true) {
        errors.push(`artifact.${key}.checks.${check} must be true`);
      }
    }
  }
  return [...new Set(errors)];
}

function validateProductionQualityRun(
  value: unknown,
  plan: LegacyCutoverPlan,
  errors: string[],
): void {
  const location = "artifact.productionQuality.qualityRun";
  if (!isRecord(value)) {
    errors.push(`${location} must be an object`);
    return;
  }
  validateExactFields(value, PRODUCTION_QUALITY_RUN_FIELDS, location, errors);
  if (value.repository !== LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY) {
    errors.push(
      `${location}.repository must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}`,
    );
  }
  if (value.workflow !== LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW) {
    errors.push(
      `${location}.workflow must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW}`,
    );
  }
  if (
    value.workflowPath !== LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH
  ) {
    errors.push(
      `${location}.workflowPath must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH}`,
    );
  }
  if (value.event !== LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT) {
    errors.push(
      `${location}.event must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT}; workflow_dispatch and pull_request runs are not Production release evidence`,
    );
  }
  if (value.ref !== LEGACY_CUTOVER_PRODUCTION_QUALITY_REF) {
    errors.push(
      `${location}.ref must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_REF}`,
    );
  }
  if (value.headBranch !== LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH) {
    errors.push(
      `${location}.headBranch must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH}`,
    );
  }
  if (value.headSha !== plan.repositoryCommit) {
    errors.push(`${location}.headSha does not match plan`);
  }
  if (!Number.isSafeInteger(value.runId) || Number(value.runId) < 1) {
    errors.push(`${location}.runId must be a positive safe integer`);
  }
  allowedProductionQualityRunAttempt(
    value.runAttempt,
    `${location}.runAttempt`,
    errors,
  );
  const expectedRunUrl =
    Number.isSafeInteger(value.runId) && Number(value.runId) >= 1
      ? `https://github.com/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(value.runId)}`
      : null;
  if (expectedRunUrl === null || value.runUrl !== expectedRunUrl) {
    errors.push(
      `${location}.runUrl must identify runId in ${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}`,
    );
  }
  if (value.conclusion !== "success") {
    errors.push(`${location}.conclusion must be success`);
  }

  if (!isRecord(value.launchTransition)) {
    errors.push(`${location}.launchTransition must be an object`);
  } else {
    validateExactFields(
      value.launchTransition,
      PRODUCTION_QUALITY_TRANSITION_FIELDS,
      `${location}.launchTransition`,
      errors,
    );
    if (value.launchTransition.job !== "verify") {
      errors.push(`${location}.launchTransition.job must be verify`);
    }
    if (
      value.launchTransition.step !==
      LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP
    ) {
      errors.push(
        `${location}.launchTransition.step must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP}`,
      );
    }
    if (value.launchTransition.conclusion !== "success") {
      errors.push(`${location}.launchTransition.conclusion must be success`);
    }
  }

  if (!isRecord(value.jobs)) {
    errors.push(`${location}.jobs must be an object`);
  } else {
    validateExactFields(
      value.jobs,
      LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS,
      `${location}.jobs`,
      errors,
    );
    for (const job of LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS) {
      if (value.jobs[job] !== "success") {
        errors.push(`${location}.jobs.${job} must be success`);
      }
    }
  }
}

function positiveSafeInteger(
  value: unknown,
  location: string,
  errors: string[],
): value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    errors.push(`${location} must be a positive safe integer`);
    return false;
  }
  return true;
}

function allowedProductionQualityRunAttempt(
  value: unknown,
  location: string,
  errors: string[],
): value is number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 1 ||
    Number(value) > LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT
  ) {
    errors.push(
      `${location} must be 1 or ${String(LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT)}`,
    );
    return false;
  }
  return true;
}

function crossCheckProductionQualityRun(
  artifactValue: unknown,
  derived: LegacyCutoverProductionQualityRun,
  errors: string[],
): void {
  const location = "artifact.productionQuality.qualityRun";
  if (!isRecord(artifactValue)) {
    errors.push(`${location} cannot be checked against underlying evidence`);
    return;
  }
  for (const field of [
    "repository",
    "workflow",
    "workflowPath",
    "event",
    "ref",
    "headBranch",
    "headSha",
    "runId",
    "runAttempt",
    "runUrl",
    "conclusion",
  ] as const) {
    if (artifactValue[field] !== derived[field]) {
      errors.push(
        `${location}.${field} does not match the retained GitHub API evidence`,
      );
    }
  }
  if (!isRecord(artifactValue.launchTransition)) {
    errors.push(
      `${location}.launchTransition cannot be checked against underlying evidence`,
    );
  } else {
    for (const field of ["job", "step", "conclusion"] as const) {
      if (
        artifactValue.launchTransition[field] !==
        derived.launchTransition[field]
      ) {
        errors.push(
          `${location}.launchTransition.${field} does not match the retained GitHub API evidence`,
        );
      }
    }
  }
  if (!isRecord(artifactValue.jobs)) {
    errors.push(
      `${location}.jobs cannot be checked against underlying evidence`,
    );
  } else {
    for (const job of LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS) {
      if (artifactValue.jobs[job] !== derived.jobs[job]) {
        errors.push(
          `${location}.jobs.${job} does not match the retained GitHub API evidence`,
        );
      }
    }
  }
}

function validateProductionQualityEvidenceBundle(
  value: unknown,
  plan: LegacyCutoverPlan,
  artifactQualityRun: unknown,
  expectedObservedAt: string,
  nowMs: number,
): string[] {
  const errors: string[] = [];
  const location = "underlying productionQuality GitHub API evidence";
  if (!isRecord(value)) return [`${location} must be an object`];
  validateExactFields(value, PRODUCTION_QUALITY_BUNDLE_FIELDS, location, errors);
  errors.push(...findSensitiveMaterial(value, location));
  if (value.schemaVersion !== 1) {
    errors.push(`${location}.schemaVersion must be 1`);
  }
  if (value.source !== LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE) {
    errors.push(
      `${location}.source must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE}`,
    );
  }
  if (value.apiVersion !== LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION) {
    errors.push(
      `${location}.apiVersion must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION}`,
    );
  }

  const requests = isRecord(value.requests) ? value.requests : null;
  const run = isRecord(value.run) ? value.run : null;
  const workflow = isRecord(value.workflow) ? value.workflow : null;
  const jobsEnvelope = isRecord(value.jobs) ? value.jobs : null;
  if (requests === null) errors.push(`${location}.requests must be an object`);
  if (run === null) errors.push(`${location}.run must be an object`);
  if (workflow === null) errors.push(`${location}.workflow must be an object`);
  if (jobsEnvelope === null) errors.push(`${location}.jobs must be an object`);
  if (
    requests === null ||
    run === null ||
    workflow === null ||
    jobsEnvelope === null
  ) {
    return [...new Set(errors)];
  }
  validateExactFields(
    requests,
    PRODUCTION_QUALITY_REQUEST_FIELDS,
    `${location}.requests`,
    errors,
  );

  const runLocation = `${location}.run`;
  validateExactFields(
    run,
    PRODUCTION_QUALITY_RAW_RUN_FIELDS,
    runLocation,
    errors,
  );
  const runIdValid = positiveSafeInteger(
    run.id,
    `${runLocation}.id`,
    errors,
  );
  const runAttemptValid = allowedProductionQualityRunAttempt(
    run.run_attempt,
    `${runLocation}.run_attempt`,
    errors,
  );
  const workflowIdValid = positiveSafeInteger(
    run.workflow_id,
    `${runLocation}.workflow_id`,
    errors,
  );
  if (run.name !== LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW) {
    errors.push(
      `${runLocation}.name must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW}`,
    );
  }
  const allowedRunPaths = [
    LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH,
    `${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH}@${LEGACY_CUTOVER_PRODUCTION_QUALITY_REF}`,
    `${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH}@${LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH}`,
  ];
  if (!allowedRunPaths.includes(String(run.path))) {
    errors.push(
      `${runLocation}.path must identify ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH} on main`,
    );
  }
  if (run.event !== LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT) {
    errors.push(
      `${runLocation}.event must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT}`,
    );
  }
  if (run.status !== "completed") {
    errors.push(`${runLocation}.status must be completed`);
  }
  if (run.conclusion !== "success") {
    errors.push(`${runLocation}.conclusion must be success`);
  }
  if (run.head_branch !== LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH) {
    errors.push(
      `${runLocation}.head_branch must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH}`,
    );
  }
  if (run.head_sha !== plan.repositoryCommit) {
    errors.push(`${runLocation}.head_sha does not match plan`);
  }
  const expectedRunUrl = runIdValid
    ? `https://github.com/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(run.id)}`
    : null;
  if (expectedRunUrl === null || run.html_url !== expectedRunUrl) {
    errors.push(
      `${runLocation}.html_url must identify the retained run in ${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}`,
    );
  }

  for (const repositoryField of ["repository", "head_repository"] as const) {
    const repository = isRecord(run[repositoryField])
      ? run[repositoryField]
      : null;
    const repositoryLocation = `${runLocation}.${repositoryField}`;
    if (repository === null) {
      errors.push(`${repositoryLocation} must be an object`);
      continue;
    }
    validateExactFields(
      repository,
      PRODUCTION_QUALITY_RAW_REPOSITORY_FIELDS,
      repositoryLocation,
      errors,
    );
    if (
      repository.full_name !== LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY
    ) {
      errors.push(
        `${repositoryLocation}.full_name must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}`,
      );
    }
  }

  for (const timestampField of [
    "created_at",
    "run_started_at",
    "updated_at",
  ] as const) {
    if (githubTimestampMs(run[timestampField]) === null) {
      errors.push(
        `${runLocation}.${timestampField} must be a GitHub UTC timestamp`,
      );
    }
  }
  const runCreatedAtMs = githubTimestampMs(run.created_at);
  const runStartedAtMs = githubTimestampMs(run.run_started_at);
  const runUpdatedAtMs = githubTimestampMs(run.updated_at);
  if (
    runCreatedAtMs !== null &&
    runStartedAtMs !== null &&
    runStartedAtMs < runCreatedAtMs
  ) {
    errors.push(`${runLocation}.run_started_at must not precede created_at`);
  }
  if (
    runStartedAtMs !== null &&
    runUpdatedAtMs !== null &&
    runUpdatedAtMs < runStartedAtMs
  ) {
    errors.push(`${runLocation}.updated_at must not precede run_started_at`);
  }
  if (
    runUpdatedAtMs === null ||
    !isStrictIsoUtc(expectedObservedAt) ||
    runUpdatedAtMs !== Date.parse(expectedObservedAt)
  ) {
    errors.push(
      `artifact.productionQuality.observedAt must represent the same instant as ${runLocation}.updated_at`,
    );
  }
  if (runUpdatedAtMs !== null) {
    if (runUpdatedAtMs > nowMs) {
      errors.push(`${runLocation}.updated_at cannot be in the future`);
    }
    if (
      nowMs - runUpdatedAtMs >
      LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS.productionQuality
    ) {
      errors.push(
        `${runLocation}.updated_at is older than the permitted evidence age`,
      );
    }
  }

  const workflowLocation = `${location}.workflow`;
  validateExactFields(
    workflow,
    PRODUCTION_QUALITY_RAW_WORKFLOW_FIELDS,
    workflowLocation,
    errors,
  );
  const rawWorkflowIdValid = positiveSafeInteger(
    workflow.id,
    `${workflowLocation}.id`,
    errors,
  );
  if (
    workflowIdValid &&
    rawWorkflowIdValid &&
    run.workflow_id !== workflow.id
  ) {
    errors.push(`${runLocation}.workflow_id must match ${workflowLocation}.id`);
  }
  if (workflow.name !== LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW) {
    errors.push(
      `${workflowLocation}.name must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW}`,
    );
  }
  if (workflow.path !== LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH) {
    errors.push(
      `${workflowLocation}.path must be ${LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH}`,
    );
  }
  if (workflow.state !== "active") {
    errors.push(`${workflowLocation}.state must be active`);
  }
  const expectedWorkflowUrl = rawWorkflowIdValid
    ? `https://api.github.com/repos/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/workflows/${String(workflow.id)}`
    : null;
  if (expectedWorkflowUrl === null || workflow.url !== expectedWorkflowUrl) {
    errors.push(
      `${workflowLocation}.url must identify the retained workflow ID`,
    );
  }

  const jobsLocation = `${location}.jobs`;
  validateExactFields(
    jobsEnvelope,
    PRODUCTION_QUALITY_RAW_JOBS_FIELDS,
    jobsLocation,
    errors,
  );
  const expectedRunRequest = runIdValid
    ? `https://api.github.com/repos/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(run.id)}`
    : null;
  const expectedWorkflowRequest = rawWorkflowIdValid
    ? `https://api.github.com/repos/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/workflows/${String(workflow.id)}`
    : null;
  const expectedJobsRequest =
    runIdValid && runAttemptValid
      ? `https://api.github.com/repos/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(run.id)}/attempts/${String(run.run_attempt)}/jobs?per_page=100`
      : null;
  for (const [requestKind, expectedRequest] of [
    ["run", expectedRunRequest],
    ["workflow", expectedWorkflowRequest],
    ["jobs", expectedJobsRequest],
  ] as const) {
    if (
      expectedRequest === null ||
      requests[requestKind] !== expectedRequest
    ) {
      errors.push(
        `${location}.requests.${requestKind} must identify the exact retained GitHub API request`,
      );
    }
  }
  if (
    expectedWorkflowRequest !== null &&
    workflow.url !== expectedWorkflowRequest
  ) {
    errors.push(
      `${workflowLocation}.url must match ${location}.requests.workflow`,
    );
  }
  const expectedJobCount = LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS.length;
  if (
    !Number.isSafeInteger(jobsEnvelope.total_count) ||
    jobsEnvelope.total_count !== expectedJobCount
  ) {
    errors.push(`${jobsLocation}.total_count must be ${expectedJobCount}`);
  }
  if (!Array.isArray(jobsEnvelope.jobs)) {
    errors.push(`${jobsLocation}.jobs must be an array`);
    return [...new Set(errors)];
  }
  if (jobsEnvelope.jobs.length !== expectedJobCount) {
    errors.push(
      `${jobsLocation}.jobs must contain exactly ${expectedJobCount} required jobs`,
    );
  }

  const jobByName = new Map<string, Record<string, unknown>>();
  const jobIds = new Set<number>();
  for (const [jobIndex, jobValue] of jobsEnvelope.jobs.entries()) {
    const jobLocation = `${jobsLocation}.jobs[${jobIndex}]`;
    if (!isRecord(jobValue)) {
      errors.push(`${jobLocation} must be an object`);
      continue;
    }
    validateExactFields(
      jobValue,
      PRODUCTION_QUALITY_RAW_JOB_FIELDS,
      jobLocation,
      errors,
    );
    const jobIdValid = positiveSafeInteger(
      jobValue.id,
      `${jobLocation}.id`,
      errors,
    );
    if (jobIdValid) {
      if (jobIds.has(jobValue.id as number)) {
        errors.push(`${jobLocation}.id must be unique`);
      }
      jobIds.add(jobValue.id as number);
    }
    if (
      typeof jobValue.name !== "string" ||
      !(LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS as readonly string[]).includes(
        jobValue.name,
      )
    ) {
      errors.push(`${jobLocation}.name is not a required Quality job`);
    } else if (jobByName.has(jobValue.name)) {
      errors.push(`${jobLocation}.name must be unique`);
    } else {
      jobByName.set(jobValue.name, jobValue);
    }
    if (jobValue.run_id !== run.id) {
      errors.push(`${jobLocation}.run_id must match ${runLocation}.id`);
    }
    if (jobValue.run_attempt !== run.run_attempt) {
      errors.push(
        `${jobLocation}.run_attempt must match ${runLocation}.run_attempt`,
      );
    }
    if (jobValue.head_sha !== plan.repositoryCommit) {
      errors.push(`${jobLocation}.head_sha does not match plan`);
    }
    if (jobValue.status !== "completed") {
      errors.push(`${jobLocation}.status must be completed`);
    }
    if (jobValue.conclusion !== "success") {
      errors.push(`${jobLocation}.conclusion must be success`);
    }
    const expectedJobUrls =
      runIdValid && jobIdValid
        ? [
            `${expectedRunUrl}/job/${String(jobValue.id)}`,
            `https://github.com/${LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY}/runs/${String(run.id)}/jobs/${String(jobValue.id)}`,
          ]
        : [];
    if (!expectedJobUrls.includes(String(jobValue.html_url))) {
      errors.push(`${jobLocation}.html_url must identify this run and job`);
    }
    for (const timestampField of ["started_at", "completed_at"] as const) {
      if (githubTimestampMs(jobValue[timestampField]) === null) {
        errors.push(
          `${jobLocation}.${timestampField} must be a GitHub UTC timestamp`,
        );
      }
    }
    const jobStartedAtMs = githubTimestampMs(jobValue.started_at);
    const jobCompletedAtMs = githubTimestampMs(jobValue.completed_at);
    if (
      runStartedAtMs !== null &&
      jobStartedAtMs !== null &&
      jobStartedAtMs < runStartedAtMs
    ) {
      errors.push(
        `${jobLocation}.started_at must not precede ${runLocation}.run_started_at`,
      );
    }
    if (
      jobStartedAtMs !== null &&
      jobCompletedAtMs !== null &&
      jobCompletedAtMs < jobStartedAtMs
    ) {
      errors.push(`${jobLocation}.completed_at must not precede started_at`);
    }
    if (
      jobCompletedAtMs !== null &&
      runUpdatedAtMs !== null &&
      jobCompletedAtMs > runUpdatedAtMs
    ) {
      errors.push(
        `${jobLocation}.completed_at must not be later than ${runLocation}.updated_at`,
      );
    }
    if (!Array.isArray(jobValue.steps) || jobValue.steps.length === 0) {
      errors.push(`${jobLocation}.steps must be a non-empty array`);
      continue;
    }
    const stepNumbers = new Set<number>();
    let previousStepNumber = 0;
    for (const [stepIndex, stepValue] of jobValue.steps.entries()) {
      const stepLocation = `${jobLocation}.steps[${stepIndex}]`;
      if (!isRecord(stepValue)) {
        errors.push(`${stepLocation} must be an object`);
        continue;
      }
      validateExactFields(
        stepValue,
        PRODUCTION_QUALITY_RAW_STEP_FIELDS,
        stepLocation,
        errors,
      );
      if (
        !positiveSafeInteger(
          stepValue.number,
          `${stepLocation}.number`,
          errors,
        )
      ) {
        continue;
      }
      if (stepNumbers.has(stepValue.number as number)) {
        errors.push(`${stepLocation}.number must be unique within the job`);
      }
      if (Number(stepValue.number) <= previousStepNumber) {
        errors.push(
          `${stepLocation}.number must be strictly increasing in canonical step order`,
        );
      }
      stepNumbers.add(stepValue.number as number);
      previousStepNumber = Number(stepValue.number);
      if (
        typeof stepValue.name !== "string" ||
        stepValue.name.trim().length < 2 ||
        stepValue.name.length > 200
      ) {
        errors.push(`${stepLocation}.name must be a substantive bounded string`);
      }
      if (stepValue.status !== "completed") {
        errors.push(`${stepLocation}.status must be completed`);
      }
      if (stepValue.conclusion !== "success") {
        errors.push(`${stepLocation}.conclusion must be success`);
      }
    }
  }

  for (const job of LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS) {
    if (!jobByName.has(job)) {
      errors.push(`${jobsLocation}.jobs must include exactly one ${job} job`);
    }
  }
  const verifyJob = jobByName.get("verify");
  const transitionSteps =
    verifyJob && Array.isArray(verifyJob.steps)
      ? verifyJob.steps.filter(
          (step) =>
            isRecord(step) &&
            step.name === LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP,
        )
      : [];
  if (transitionSteps.length !== 1) {
    errors.push(
      `${jobsLocation}.jobs verify steps must include exactly one ${LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP}`,
    );
  }
  const lighthouseJob = jobByName.get("lighthouse");
  const lighthouseSteps =
    lighthouseJob && Array.isArray(lighthouseJob.steps)
      ? lighthouseJob.steps.filter((step) => isRecord(step))
      : [];
  for (const requiredStep of LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS) {
    const matchingSteps = lighthouseSteps.filter(
      (step) => step.name === requiredStep,
    );
    if (
      matchingSteps.length !== 1 ||
      matchingSteps[0]?.status !== "completed" ||
      matchingSteps[0]?.conclusion !== "success"
    ) {
      errors.push(
        `${jobsLocation}.jobs lighthouse steps must include exactly one successful ${requiredStep}`,
      );
    }
  }

  if (
    typeof run.id === "number" &&
    typeof run.run_attempt === "number" &&
    isRecord(run.repository) &&
    typeof run.repository.full_name === "string" &&
    typeof run.name === "string" &&
    typeof run.path === "string" &&
    typeof run.event === "string" &&
    typeof run.head_branch === "string" &&
    typeof run.head_sha === "string" &&
    typeof run.html_url === "string" &&
    typeof run.conclusion === "string" &&
    transitionSteps.length === 1 &&
    isRecord(transitionSteps[0]) &&
    typeof transitionSteps[0].conclusion === "string" &&
    LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS.every((job) => jobByName.has(job))
  ) {
    const derived = {
      repository: run.repository.full_name,
      workflow: run.name,
      workflowPath: workflow.path,
      event: run.event,
      ref: `refs/heads/${run.head_branch}`,
      headBranch: run.head_branch,
      headSha: run.head_sha,
      runId: run.id,
      runAttempt: run.run_attempt,
      runUrl: run.html_url,
      conclusion: run.conclusion,
      launchTransition: {
        job: "verify",
        step: LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP,
        conclusion: transitionSteps[0].conclusion,
      },
      jobs: Object.fromEntries(
        LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS.map((job) => [
          job,
          jobByName.get(job)?.conclusion,
        ]),
      ),
    } as LegacyCutoverProductionQualityRun;
    crossCheckProductionQualityRun(artifactQualityRun, derived, errors);
  }

  return [...new Set(errors)];
}

export async function verifyLegacyCutoverEvidence(
  plan: LegacyCutoverPlan,
  {
    nowMs = Date.now(),
    repositoryRoot,
  }: { nowMs?: number; repositoryRoot?: string } = {},
): Promise<EvidenceVerification> {
  if (!Number.isFinite(nowMs)) {
    return {
      ok: false,
      detail: "external evidence verification nowMs must be a finite timestamp",
      entries: [],
    };
  }
  const evidenceKeys = getLegacyCutoverEvidenceKeys(plan.contactMode);
  const entries = await Promise.all(
    evidenceKeys.map(async (key): Promise<EvidenceVerificationEntry> => {
      const expected = requiredLegacyCutoverEvidence(plan, key);
      const errors: string[] = [];
      let actualSha256: string | null = null;
      let artifactReference = expected.reference;
      const underlyingEvidence: EvidenceVerificationEntry["underlyingEvidence"] =
        {
          reference: null,
          expectedSha256: null,
          actualSha256: null,
          expectedBytes: null,
          actualBytes: null,
          collector: null,
          collectorVersion: null,
        };
      try {
        const { bytes, canonicalPath } = await readRestrictedExternalFile(
          expected.reference,
          {
            repositoryRoot,
            maxBytes: MAX_EVIDENCE_BYTES,
            label: `artifact ${key}`,
          },
        );
        artifactReference = canonicalPath;
        actualSha256 = createHash("sha256").update(bytes).digest("hex");
        if (actualSha256 !== expected.sha256)
          errors.push("artifact SHA-256 does not match plan");
        const parsedArtifact = parseCanonicalLegacyJson(
          bytes,
          `artifact ${key}`,
        );
        errors.push(...parsedArtifact.errors);
        const parsed = parsedArtifact.value;
        if (parsedArtifact.canonical) {
          errors.push(...validateEvidenceArtifact(parsed, key, plan, nowMs));
        }
        if (
          parsedArtifact.canonical &&
          isRecord(parsed) &&
          isRecord(parsed.underlyingEvidence)
        ) {
          const underlying = parsed.underlyingEvidence;
          underlyingEvidence.reference =
            typeof underlying.reference === "string"
              ? underlying.reference
              : null;
          underlyingEvidence.expectedSha256 =
            typeof underlying.sha256 === "string" ? underlying.sha256 : null;
          underlyingEvidence.expectedBytes = Number.isInteger(underlying.bytes)
            ? Number(underlying.bytes)
            : null;
          underlyingEvidence.collector =
            typeof underlying.collector === "string"
              ? underlying.collector
              : null;
          underlyingEvidence.collectorVersion =
            typeof underlying.collectorVersion === "string"
              ? underlying.collectorVersion
              : null;
          if (underlyingEvidence.reference) {
            try {
              const underlyingFile = await readRestrictedExternalFile(
                underlyingEvidence.reference,
                {
                  repositoryRoot,
                  maxBytes: MAX_UNDERLYING_EVIDENCE_BYTES,
                  label: `underlying evidence for ${key}`,
                },
              );
              underlyingEvidence.reference = underlyingFile.canonicalPath;
              underlyingEvidence.actualSha256 = createHash("sha256")
                .update(underlyingFile.bytes)
                .digest("hex");
              underlyingEvidence.actualBytes = underlyingFile.bytes.length;
              if (
                underlyingEvidence.actualSha256 !==
                underlyingEvidence.expectedSha256
              ) {
                errors.push(
                  `underlying evidence SHA-256 does not match artifact for ${key}`,
                );
              }
              if (
                underlyingEvidence.actualBytes !==
                underlyingEvidence.expectedBytes
              ) {
                errors.push(
                  `underlying evidence byte length does not match artifact for ${key}`,
                );
              }
              if (key === "productionQuality") {
                const parsedBundle = parseCanonicalLegacyJson(
                  underlyingFile.bytes,
                  "underlying productionQuality GitHub API evidence",
                );
                errors.push(...parsedBundle.errors);
                if (parsedBundle.canonical) {
                  errors.push(
                    ...validateProductionQualityEvidenceBundle(
                      parsedBundle.value,
                      plan,
                      isRecord(parsed) ? parsed.qualityRun : null,
                      expected.observedAt,
                      nowMs,
                    ),
                  );
                }
              }
            } catch (error) {
              errors.push(
                error instanceof Error ? error.message : String(error),
              );
            }
          }
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      return {
        key,
        reference: artifactReference,
        expectedSha256: expected.sha256,
        actualSha256,
        observedAt: expected.observedAt,
        maxAgeMs: LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key],
        underlyingEvidence,
        pass: errors.length === 0,
        errors: [...new Set(errors)],
      };
    }),
  );
  const passed = entries.filter((entry) => entry.pass).length;
  return {
    ok: passed === entries.length,
    detail: `${passed}/${entries.length} external evidence artifacts passed byte, hash, identity, status, check, and freshness validation`,
    entries,
  };
}

function gateCheck(
  id: string,
  statuses: Record<string, string | undefined>,
  gate: string,
  acceptedStatuses: readonly string[] = ["approved"],
): PreflightCheck {
  const status = statuses[gate] ?? "missing";
  return {
    id,
    pass: acceptedStatuses.includes(status),
    detail: `${gate} is ${status}; accepted: ${acceptedStatuses.join(" or ")}`,
  };
}

export function evaluateLegacyCutoverPreflight(
  input: LegacyCutoverPreflightInput,
): {
  decision: "GO_TO_CHANGE" | "NO_GO";
  checks: PreflightCheck[];
  failures: string[];
} {
  const checks: PreflightCheck[] = [];
  checks.push({
    id: "plan-valid",
    pass: Boolean(input.plan) && input.planErrors.length === 0,
    detail:
      input.planErrors.length === 0
        ? "cutover plan is valid"
        : input.planErrors.join("; "),
  });
  checks.push({
    id: "launch-manifest-valid",
    pass: input.manifestErrors.length === 0,
    detail:
      input.manifestErrors.length === 0
        ? "launch manifest is valid"
        : input.manifestErrors.join("; "),
  });
  checks.push(
    gateCheck("legal-approved", input.gateStatuses, "legalPublication"),
  );
  const expectedContactGateStatus = input.plan
    ? input.plan.contactMode === "enabled"
      ? "approved"
      : "disabled"
    : null;
  checks.push(
    gateCheck(
      "contact-disposition-matches-plan",
      input.gateStatuses,
      "contactIntake",
      expectedContactGateStatus ? [expectedContactGateStatus] : [],
    ),
  );
  checks.push(
    gateCheck("legacy-cutover-approved", input.gateStatuses, "legacyCutover"),
  );
  const legalAuthorization = input.gateAuthorizations.legalPublication;
  const contactAuthorization = input.gateAuthorizations.contactIntake;
  const legacyAuthorization = input.gateAuthorizations.legacyCutover;
  const requiredGateAuthorizations = Object.values(input.gateAuthorizations);
  const requiredGateValidUntils = requiredGateAuthorizations
    .map((authorization) => authorization.validUntil)
    .filter((validUntil): validUntil is string => validUntil !== null);
  let authorizationValidityRemainingMs = -1;
  if (
    input.plan &&
    requiredGateValidUntils.length === requiredGateAuthorizations.length &&
    requiredGateValidUntils.every(isStrictIsoUtc)
  ) {
    try {
      authorizationValidityRemainingMs =
        computeLegacyAuthorizationValidityRemainingMs(
          input.plan,
          input.decisionTimeMs,
          requiredGateValidUntils,
        );
    } catch {
      authorizationValidityRemainingMs = -1;
    }
  }
  checks.push({
    id: "required-gate-authorizations-present",
    pass: requiredGateAuthorizations.every(
      (authorization) =>
        Boolean(authorization.decisionId) &&
        authorization.validUntil !== null &&
        isStrictIsoUtc(authorization.validUntil),
    ),
    detail: Object.entries(input.gateAuthorizations)
      .map(
        ([gateId, authorization]) =>
          `${gateId}=${authorization.decisionId ?? "missing"}@` +
          `${authorization.validUntil ?? "missing"}`,
      )
      .join("; "),
  });
  checks.push({
    id: "legal-publication-subject-bound",
    pass: Boolean(
      input.plan &&
      legalAuthorization.decisionId &&
      legalAuthorization.repositoryCommit === input.plan.repositoryCommit &&
      legalAuthorization.vercelDeploymentId === null,
    ),
    detail:
      `gate decision ${legalAuthorization.decisionId ?? "missing"}; ` +
      `gate subject ${legalAuthorization.repositoryCommit ?? "missing"}/` +
      `${legalAuthorization.vercelDeploymentId ?? "none"}; ` +
      `plan subject ${input.plan?.repositoryCommit ?? "missing"}/none`,
  });
  const expectedContactDeploymentId =
    input.plan?.contactMode === "enabled"
      ? input.plan.vercelDeploymentId
      : null;
  checks.push({
    id: "contact-intake-subject-bound",
    pass: Boolean(
      input.plan &&
      contactAuthorization.decisionId &&
      contactAuthorization.repositoryCommit === input.plan.repositoryCommit &&
      contactAuthorization.vercelDeploymentId === expectedContactDeploymentId,
    ),
    detail:
      `gate decision ${contactAuthorization.decisionId ?? "missing"}; ` +
      `gate subject ${contactAuthorization.repositoryCommit ?? "missing"}/` +
      `${contactAuthorization.vercelDeploymentId ?? "none"}; ` +
      `plan subject ${input.plan?.repositoryCommit ?? "missing"}/` +
      `${expectedContactDeploymentId ?? "none"}`,
  });
  checks.push({
    id: "legacy-cutover-subject-bound",
    pass: Boolean(
      input.plan &&
      legacyAuthorization.decisionId &&
      legacyAuthorization.repositoryCommit === input.plan.repositoryCommit &&
      legacyAuthorization.vercelDeploymentId === input.plan.vercelDeploymentId,
    ),
    detail:
      `gate decision ${legacyAuthorization?.decisionId ?? "missing"}; ` +
      `gate subject ${legacyAuthorization?.repositoryCommit ?? "missing"}/` +
      `${legacyAuthorization?.vercelDeploymentId ?? "missing"}; ` +
      `plan subject ${input.plan?.repositoryCommit ?? "missing"}/` +
      `${input.plan?.vercelDeploymentId ?? "missing"}`,
  });
  const legacyDependencies = input.gateDependencies.legacyCutover ?? [];
  checks.push({
    id: "legacy-dependencies-declared",
    pass:
      legacyDependencies.includes("legalPublication") &&
      legacyDependencies.includes("contactIntake"),
    detail: `legacyCutover dependencies: ${legacyDependencies.join(", ") || "none"}`,
  });
  checks.push({
    id: "repository-clean",
    pass: input.repository.clean,
    detail: input.repository.clean
      ? "working tree is clean"
      : "working tree has changes",
  });
  checks.push({
    id: "candidate-commit-lineage",
    pass: Boolean(
      input.plan &&
      input.repository.head &&
      input.repository.candidateCommitExists &&
      input.repository.candidateIsAncestor,
    ),
    detail:
      `governance HEAD ${input.repository.head ?? "unavailable"}; ` +
      `candidate ${input.plan?.repositoryCommit ?? "missing"}; ` +
      `exists=${input.repository.candidateCommitExists}; ` +
      `ancestor=${input.repository.candidateIsAncestor}`,
  });

  for (const command of REQUIRED_LEGACY_PREFLIGHT_COMMANDS) {
    const result = input.commandResults[command];
    checks.push({
      id: `command:${command}`,
      pass: result?.ok === true,
      detail: result?.detail ?? "required command result is missing",
    });
  }

  const verifiedEvidenceKeys = new Set(
    input.evidenceVerification.entries
      .filter(
        (entry) =>
          entry.pass &&
          entry.errors.length === 0 &&
          entry.actualSha256 === entry.expectedSha256 &&
          entry.underlyingEvidence.actualSha256 ===
            entry.underlyingEvidence.expectedSha256 &&
          entry.underlyingEvidence.actualBytes ===
            entry.underlyingEvidence.expectedBytes,
      )
      .map((entry) => entry.key),
  );
  const requiredEvidenceKeys = input.plan
    ? getLegacyCutoverEvidenceKeys(input.plan.contactMode)
    : [];
  const evidenceEntriesComplete =
    input.evidenceVerification.entries.length === requiredEvidenceKeys.length &&
    verifiedEvidenceKeys.size === requiredEvidenceKeys.length &&
    requiredEvidenceKeys.every((key) => verifiedEvidenceKeys.has(key));
  checks.push({
    id: "external-evidence-verified",
    pass: input.evidenceVerification.ok && evidenceEntriesComplete,
    detail: evidenceEntriesComplete
      ? input.evidenceVerification.detail
      : `${input.evidenceVerification.detail}; required evidence entries are missing or failed`,
  });
  checks.push({
    id: "sales-destination",
    pass: Boolean(
      input.plan &&
      input.salesDestinationObserved === input.plan.salesDestination,
    ),
    detail: `configured ${input.salesDestinationObserved ?? "missing"}; plan ${input.plan?.salesDestination ?? "missing"}`,
  });
  checks.push({
    id: "machine-decisions-approved",
    pass: Boolean(
      input.plan &&
      Object.keys(
        getLegacyCutoverDecisionEvidence(input.plan.contactMode),
      ).every(
        (key) =>
          input.plan?.decisions[key as keyof LegacyCutoverPlan["decisions"]]
            ?.status === "approved",
      ),
    ),
    detail: input.plan
      ? "all required machine-readable cutover decisions are approved"
      : "cutover plan is missing",
  });
  checks.push({
    id: "receipt-directory-ready",
    pass: input.receiptDirectoryReady,
    detail: input.receiptDirectoryReady
      ? "private external receipt directory is ready"
      : "a private external --evidence-dir is required before GO_TO_CHANGE",
  });
  checks.push({
    id: "authorization-validity-buffer",
    pass:
      authorizationValidityRemainingMs >= MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
    detail:
      `authorization validity remaining: ${Math.max(0, authorizationValidityRemainingMs)} ms; ` +
      `minimum required: ${MIN_LEGACY_AUTHORIZATION_VALIDITY_MS} ms`,
  });

  const failures = checks
    .filter((check) => !check.pass)
    .map((check) => `${check.id}: ${check.detail}`);
  return {
    decision: failures.length === 0 ? "GO_TO_CHANGE" : "NO_GO",
    checks,
    failures,
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

export function parseCanonicalLegacyJson(
  bytes: Buffer,
  label: string,
): { value: unknown | null; canonical: boolean; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return {
      value: null,
      canonical: false,
      errors: [`${label} is not valid JSON`],
    };
  }
  try {
    if (bytes.equals(Buffer.from(canonicalJson(value), "utf8"))) {
      return { value, canonical: true, errors: [] };
    }
    return {
      value,
      canonical: false,
      errors: [
        `${label} must use canonical sorted JSON with no duplicate object keys`,
      ],
    };
  } catch {
    return {
      value,
      canonical: false,
      errors: [`${label} exceeds the supported JSON nesting limit`],
    };
  }
}

export async function prepareLegacyCutoverReceiptDirectory(
  evidenceDirectory: string,
  { repositoryRoot }: { repositoryRoot?: string } = {},
): Promise<string> {
  if (!path.isAbsolute(evidenceDirectory)) {
    throw new Error(
      "--evidence-dir must be an absolute path outside the repository",
    );
  }
  const directoryStat = await lstat(evidenceDirectory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error(
      "--evidence-dir must be a pre-existing real directory, not a symbolic link",
    );
  }
  if ((directoryStat.mode & 0o077) !== 0) {
    throw new Error("--evidence-dir must not grant group or other permissions");
  }
  const canonicalDirectory = await realpath(evidenceDirectory);
  if (repositoryRoot && isPathInside(repositoryRoot, canonicalDirectory)) {
    throw new Error("--evidence-dir resolves inside the repository");
  }
  return canonicalDirectory;
}

export async function writeLegacyCutoverReceipt(
  evidenceDirectory: string,
  receipt: unknown,
  {
    repositoryRoot,
    notAfter,
    minimumRemainingMs = 0,
    fileTimestamp = new Date().toISOString(),
    beforePublish,
  }: {
    repositoryRoot?: string;
    notAfter?: string;
    minimumRemainingMs?: number;
    fileTimestamp?: string;
    beforePublish?: () => void | Promise<void>;
  } = {},
): Promise<{ jsonPath: string; sha256Path: string; sha256: string }> {
  if (!Number.isSafeInteger(minimumRemainingMs) || minimumRemainingMs < 0) {
    throw new Error("minimumRemainingMs must be a nonnegative safe integer");
  }
  if (!isStrictIsoUtc(fileTimestamp)) {
    throw new Error("fileTimestamp must be a canonical UTC timestamp");
  }
  if (notAfter !== undefined && !isStrictIsoUtc(notAfter)) {
    throw new Error("notAfter must be a canonical UTC timestamp");
  }
  if (
    isRecord(receipt) &&
    receipt.decision === "GO_TO_CHANGE" &&
    (notAfter === undefined ||
      minimumRemainingMs < MIN_LEGACY_AUTHORIZATION_VALIDITY_MS)
  ) {
    throw new Error(
      `GO_TO_CHANGE receipts require notAfter and at least ${MIN_LEGACY_AUTHORIZATION_VALIDITY_MS}ms remaining validity`,
    );
  }
  const canonicalDirectory = await prepareLegacyCutoverReceiptDirectory(
    evidenceDirectory,
    { repositoryRoot },
  );
  const contents = canonicalJson(receipt);
  const sha256 = createHash("sha256").update(contents).digest("hex");
  const timestamp = fileTimestamp.replaceAll(":", "").replaceAll(".", "");
  const basename = `legacy-cutover-preflight-${timestamp}-${sha256.slice(0, 12)}.json`;
  const jsonPath = path.join(canonicalDirectory, basename);
  const sha256Path = `${jsonPath}.sha256`;
  const temporaryJsonPath = path.join(
    canonicalDirectory,
    `.${basename}.${process.pid}.${randomUUID()}.tmp`,
  );

  let temporaryCreated = false;
  let hashCreated = false;
  let jsonPublished = false;
  try {
    const temporaryJsonHandle = await open(temporaryJsonPath, "wx", 0o600);
    temporaryCreated = true;
    try {
      await temporaryJsonHandle.writeFile(contents, "utf8");
      await temporaryJsonHandle.sync();
    } finally {
      await temporaryJsonHandle.close();
    }
    const hashHandle = await open(sha256Path, "wx", 0o600);
    hashCreated = true;
    try {
      await hashHandle.writeFile(`${sha256}  ${basename}\n`, "utf8");
      await hashHandle.sync();
    } finally {
      await hashHandle.close();
    }
    await beforePublish?.();
    if (notAfter && Date.parse(notAfter) - Date.now() < minimumRemainingMs) {
      throw new Error(
        "authorization validity buffer expired before receipt publication",
      );
    }
    await link(temporaryJsonPath, jsonPath);
    jsonPublished = true;
    await unlink(temporaryJsonPath).catch(() => undefined);
    temporaryCreated = false;
    const directoryHandle = await open(canonicalDirectory, "r");
    try {
      await directoryHandle.sync();
    } catch {
      // Some filesystems do not support directory fsync; the two files are already fsynced.
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    await Promise.all([
      ...(jsonPublished ? [unlink(jsonPath).catch(() => undefined)] : []),
      ...(hashCreated ? [unlink(sha256Path).catch(() => undefined)] : []),
      ...(temporaryCreated
        ? [unlink(temporaryJsonPath).catch(() => undefined)]
        : []),
    ]);
    throw error;
  }

  return { jsonPath, sha256Path, sha256 };
}
