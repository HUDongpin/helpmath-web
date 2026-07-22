import {createHash, randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {link, lstat, open, realpath, unlink} from 'node:fs/promises';
import path from 'node:path';
import {CONTACT_PRODUCTION_VERIFICATION_CHECKS} from './launch-gate-policy';

export const LEGACY_CUTOVER_EVIDENCE_CHECKS = {
  dnsZoneBefore: [
    'authenticatedExport',
    'completeZoneCaptured',
    'rollbackValuesCaptured',
  ],
  dnsZoneProposed: [
    'approvedWebsiteRecordsOnly',
    'mailRecordsUnchanged',
    'ownershipRecordsUnchanged',
    'noApexCnameConflict',
  ],
  mailContinuity: [
    'inboundDeliveryPassed',
    'outboundDeliveryPassed',
    'mxRecordsUnchanged',
    'mailTxtRecordsUnchanged',
  ],
  contactDelivery: [
    'repositoryGateApproved',
    'productionEnvironmentEnabled',
    'retentionAndInboxOwnersConfirmed',
    ...CONTACT_PRODUCTION_VERIFICATION_CHECKS,
  ],
  searchConsoleControl: [
    'legacyPropertyControlled',
    'newPropertyControlled',
    'changeOfAddressOwnerNamed',
  ],
  offDeviceArchiveRestore: [
    'encryptedOffDeviceCustody',
    'independentRestorePassed',
    'restoredBytesHashVerified',
  ],
  rightsAccessibilityDisposition: [
    'allGovernedSourcesClassified',
    'republicationDecisionsRecorded',
    'accessibilityActionsRecorded',
  ],
  stableExternalLinkReview: [
    'allGovernedLinksReviewed',
    'zeroUnresolvedFailures',
    'reviewCommitMatched',
  ],
  productionAliasAssignment: [
    'canonicalWwwAssigned',
    'canonicalApexAssigned',
    'readyProductionDeployment',
    'deploymentCommitMatched',
  ],
  productionQuality: [
    'qualityRunSucceeded',
    'qualityCommitMatched',
  ],
  productionSmoke: [
    'productionSmokeSucceeded',
    'zeroFailures',
    'smokeCommitMatched',
  ],
  legacyHostConfigTest: [
    'targetHostVersionRecorded',
    'stagedArtifactHashMatched',
    'stagedConfigTestPassed',
  ],
  preCutoverDnsObservation: [
    'authoritativeResolversAgree',
    'publicResolversAgree',
    'websiteRecordsMatchBeforeZone',
    'mailAndOwnershipRecordsMatchBeforeZone',
  ],
  preCutoverHttpTlsObservation: [
    'allFourLegacyOriginsReachable',
    'currentRedirectStateMatchesBaseline',
    'targetCanonicalRoutesPassed',
    'tlsIdentityAndExpiryPassed',
  ],
} as const;

export const LEGACY_CUTOVER_EVIDENCE_KEYS = Object.freeze(
  Object.keys(LEGACY_CUTOVER_EVIDENCE_CHECKS),
) as Array<keyof typeof LEGACY_CUTOVER_EVIDENCE_CHECKS>;

export type LegacyCutoverEvidenceKey = (typeof LEGACY_CUTOVER_EVIDENCE_KEYS)[number];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
export const MIN_LEGACY_AUTHORIZATION_VALIDITY_MS = 5 * MINUTE_MS;

export const LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS: Record<LegacyCutoverEvidenceKey, number> = {
  dnsZoneBefore: DAY_MS,
  dnsZoneProposed: DAY_MS,
  mailContinuity: DAY_MS,
  contactDelivery: DAY_MS,
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
  topology: 'dnsZoneProposed',
  salesDestination: 'legacyHostConfigTest',
  dnsChange: 'preCutoverDnsObservation',
  mailContinuity: 'mailContinuity',
  contactDelivery: 'contactDelivery',
  searchConsole: 'searchConsoleControl',
  rollbackPlan: 'dnsZoneBefore',
  sourceRightsAccessibility: 'rightsAccessibilityDisposition',
  stableExternalLinks: 'stableExternalLinkReview',
} as const satisfies Record<string, LegacyCutoverEvidenceKey>;

export const REQUIRED_LEGACY_PREFLIGHT_COMMANDS = [
  'check:launch-gates',
  'check:legacy-apache',
  'test:legacy-apache',
  'check:legacy-source-custody',
] as const;

export function computeLegacyCutoverValidUntil(plan: LegacyCutoverPlan): string {
  const evidenceExpiries = LEGACY_CUTOVER_EVIDENCE_KEYS.map(
    (key) =>
      Date.parse(plan.evidence[key].observedAt) + LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key],
  );
  const decisionExpiries = Object.values(plan.decisions).map(
    (decision) => Date.parse(decision.approvedAt) + 30 * DAY_MS,
  );
  return new Date(Math.min(
    Date.parse(plan.window.startsAt) + 15 * MINUTE_MS,
    Date.parse(plan.window.monitorUntil),
    ...evidenceExpiries,
    ...decisionExpiries,
  )).toISOString();
}

export function computeLegacyAuthorizationValidityRemainingMs(
  plan: LegacyCutoverPlan,
  nowMs: number,
): number {
  return Date.parse(computeLegacyCutoverValidUntil(plan)) - Math.max(
    nowMs,
    Date.parse(plan.window.startsAt),
  );
}

export type LegacyCutoverEvidenceReference = {
  reference: string;
  sha256: string;
  observedAt: string;
};

export type LegacyCutoverDecision = {
  status: 'approved';
  approvedBy: string;
  approvedAt: string;
  evidenceKey: LegacyCutoverEvidenceKey;
};

export type LegacyCutoverPlan = {
  schemaVersion: 1;
  cutoverId: string;
  topology: 'direct-one-hop' | 'temporary-two-hop';
  repositoryCommit: string;
  vercelDeploymentId: string;
  salesDestination: '/contact' | '/resources';
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
  decisions: Record<keyof typeof LEGACY_CUTOVER_DECISION_EVIDENCE, LegacyCutoverDecision>;
  evidence: Record<LegacyCutoverEvidenceKey, LegacyCutoverEvidenceReference>;
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
  repository: {head: string | null; clean: boolean};
  commandResults: Record<string, {ok: boolean; detail: string}>;
  evidenceVerification: EvidenceVerification;
  salesDestinationObserved: string | null;
  receiptDirectoryReady: boolean;
  authorizationValidityRemainingMs: number;
};

const TOP_LEVEL_FIELDS = [
  'schemaVersion',
  'cutoverId',
  'topology',
  'repositoryCommit',
  'vercelDeploymentId',
  'salesDestination',
  'owners',
  'window',
  'ttl',
  'rollbackThresholds',
  'decisions',
  'evidence',
] as const;
const OWNER_FIELDS = ['change', 'rollback', 'dns', 'mail', 'searchConsole'] as const;
const WINDOW_FIELDS = ['startsAt', 'monitorUntil', 'timezone'] as const;
const TTL_FIELDS = ['previousSeconds', 'reducedAt'] as const;
const ROLLBACK_THRESHOLD_FIELDS = [
  'consecutiveProbeFailures',
  'maxFiveXxPercent',
  'maxTimeoutPercent',
  'probeIntervalSeconds',
  'minimumProbeCount',
  'tlsFailureImmediate',
  'mailRecordChangeImmediate',
] as const;
const EVIDENCE_FIELDS = ['reference', 'sha256', 'observedAt'] as const;
const DECISION_FIELDS = ['status', 'approvedBy', 'approvedAt', 'evidenceKey'] as const;
const ARTIFACT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'status',
  'cutoverId',
  'observedAt',
  'repositoryCommit',
  'vercelDeploymentId',
  'topology',
  'source',
  'underlyingEvidence',
  'checks',
] as const;
const UNDERLYING_EVIDENCE_FIELDS = [
  'reference',
  'sha256',
  'bytes',
  'collector',
  'collectorVersion',
] as const;
const SENSITIVE_KEY = /(?:token|secret|password|passphrase|cookie|private.?key|credential|authorization)/iu;
const SENSITIVE_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~-]+|gh[opsu]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|vercel_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|https?:\/\/[^/\s:@]+:[^@\s/]+@|[?&](?:token|secret|password|key)=[^&\s]+)/iu;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_UNDERLYING_EVIDENCE_BYTES = 50 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPathInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export async function readRestrictedExternalFile(
  filePath: string,
  {
    repositoryRoot,
    maxBytes = MAX_EVIDENCE_BYTES,
    label = 'external file',
  }: {repositoryRoot?: string; maxBytes?: number; label?: string} = {},
): Promise<{bytes: Buffer; canonicalPath: string}> {
  if (!path.isAbsolute(filePath)) throw new Error(`${label} must use an absolute path`);
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
    throw new Error(`${label} parent directory must not grant group or other permissions`);
  }
  const handle = await open(canonicalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const fileStat = await handle.stat();
    if (!fileStat.isFile()) throw new Error(`${label} must be a regular file`);
    if (fileStat.dev !== terminalStat.dev || fileStat.ino !== terminalStat.ino) {
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
    return {bytes: await handle.readFile(), canonicalPath};
  } finally {
    await handle.close();
  }
}

function unknownFields(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function isStrictIsoUtc(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isResolvedText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 2 &&
    !/\b(?:pending|tbd|unknown|placeholder|named_owner|same_as_plan|evidence_key|collector_version)\b/iu.test(value) &&
    !/(?:FULL_40_CHARACTER|LOWERCASE_64_CHARACTER|YYYY-MM-DD)/u.test(value)
  );
}

function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: value}).format();
    return true;
  } catch {
    return false;
  }
}

function findSensitiveMaterial(value: unknown, location = 'value'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findSensitiveMaterial(entry, `${location}[${index}]`));
  }
  if (!isRecord(value)) {
    return typeof value === 'string' && SENSITIVE_VALUE.test(value)
      ? [`${location} contains credential-shaped material`]
      : [];
  }

  return Object.entries(value).flatMap(([key, entry]) => [
    ...(SENSITIVE_KEY.test(key) ? [`${location}.${key} is a forbidden sensitive field`] : []),
    ...findSensitiveMaterial(entry, `${location}.${key}`),
  ]);
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
  if (observedAtMs > nowMs + 5 * MINUTE_MS) {
    errors.push(`${location} cannot be in the future`);
  }
  if (nowMs - observedAtMs > maxAgeMs) {
    errors.push(`${location} is older than the permitted evidence age`);
  }
}

export function validateLegacyCutoverPlan(
  value: unknown,
  {nowMs = Date.now()} = {},
): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['plan must be an object'];

  validateExactFields(value, TOP_LEVEL_FIELDS, 'plan', errors);
  errors.push(...findSensitiveMaterial(value, 'plan'));

  if (value.schemaVersion !== 1) errors.push('plan.schemaVersion must be 1');
  if (!isResolvedText(value.cutoverId) || !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(value.cutoverId)) {
    errors.push('plan.cutoverId must be a resolved lowercase identifier');
  }
  if (!['direct-one-hop', 'temporary-two-hop'].includes(String(value.topology))) {
    errors.push('plan.topology must be direct-one-hop or temporary-two-hop');
  }
  if (typeof value.repositoryCommit !== 'string' || !/^[0-9a-f]{40}$/u.test(value.repositoryCommit)) {
    errors.push('plan.repositoryCommit must be a full Git SHA');
  }
  if (typeof value.vercelDeploymentId !== 'string' || !/^dpl_[A-Za-z0-9]+$/u.test(value.vercelDeploymentId)) {
    errors.push('plan.vercelDeploymentId must be a Vercel deployment ID');
  }
  if (!['/contact', '/resources'].includes(String(value.salesDestination))) {
    errors.push('plan.salesDestination must be /contact or /resources');
  }

  if (!isRecord(value.owners)) {
    errors.push('plan.owners must be an object');
  } else {
    validateExactFields(value.owners, OWNER_FIELDS, 'plan.owners', errors);
    for (const field of OWNER_FIELDS) {
      if (!isResolvedText(value.owners[field])) errors.push(`plan.owners.${field} must be resolved`);
    }
  }

  if (!isRecord(value.window)) {
    errors.push('plan.window must be an object');
  } else {
    validateExactFields(value.window, WINDOW_FIELDS, 'plan.window', errors);
    const startsAt = value.window.startsAt;
    const monitorUntil = value.window.monitorUntil;
    if (!isStrictIsoUtc(startsAt)) errors.push('plan.window.startsAt must be canonical UTC');
    if (!isStrictIsoUtc(monitorUntil)) errors.push('plan.window.monitorUntil must be canonical UTC');
    if (isStrictIsoUtc(startsAt) && isStrictIsoUtc(monitorUntil)) {
      if (Date.parse(monitorUntil) <= Date.parse(startsAt)) {
        errors.push('plan.window.monitorUntil must be after startsAt');
      }
      if (Date.parse(monitorUntil) - Date.parse(startsAt) < HOUR_MS) {
        errors.push('plan.window must retain at least one hour of monitoring');
      }
      if (Date.parse(startsAt) < nowMs - 15 * MINUTE_MS) {
        errors.push('plan.window.startsAt is too far in the past');
      }
      if (Date.parse(startsAt) > nowMs + HOUR_MS) {
        errors.push('plan.window.startsAt must be within the next hour');
      }
      if (Date.parse(monitorUntil) <= nowMs) {
        errors.push('plan.window.monitorUntil must still be in the future');
      }
    }
    if (!isIanaTimeZone(value.window.timezone)) {
      errors.push('plan.window.timezone must be a valid IANA timezone');
    }
  }

  if (!isRecord(value.ttl)) {
    errors.push('plan.ttl must be an object');
  } else {
    validateExactFields(value.ttl, TTL_FIELDS, 'plan.ttl', errors);
    if (!Number.isInteger(value.ttl.previousSeconds) || Number(value.ttl.previousSeconds) < 60) {
      errors.push('plan.ttl.previousSeconds must be an integer of at least 60');
    }
    if (!isStrictIsoUtc(value.ttl.reducedAt)) {
      errors.push('plan.ttl.reducedAt must be canonical UTC');
    } else if (
      Number.isInteger(value.ttl.previousSeconds) &&
      nowMs - Date.parse(value.ttl.reducedAt) < Number(value.ttl.previousSeconds) * 1000
    ) {
      errors.push('the prior TTL has not elapsed since plan.ttl.reducedAt');
    }
  }

  if (!isRecord(value.rollbackThresholds)) {
    errors.push('plan.rollbackThresholds must be an object');
  } else {
    validateExactFields(
      value.rollbackThresholds,
      ROLLBACK_THRESHOLD_FIELDS,
      'plan.rollbackThresholds',
      errors,
    );
    if (
      !Number.isInteger(value.rollbackThresholds.consecutiveProbeFailures) ||
      Number(value.rollbackThresholds.consecutiveProbeFailures) < 1 ||
      Number(value.rollbackThresholds.consecutiveProbeFailures) > 10
    ) {
      errors.push('plan.rollbackThresholds.consecutiveProbeFailures must be an integer from 1 to 10');
    }
    for (const field of ['maxFiveXxPercent', 'maxTimeoutPercent'] as const) {
      const threshold = value.rollbackThresholds[field];
      if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold >= 100) {
        errors.push(`plan.rollbackThresholds.${field} must be a number from 0 up to but not including 100`);
      }
    }
    if (
      !Number.isInteger(value.rollbackThresholds.probeIntervalSeconds) ||
      Number(value.rollbackThresholds.probeIntervalSeconds) < 10 ||
      Number(value.rollbackThresholds.probeIntervalSeconds) > 300
    ) {
      errors.push('plan.rollbackThresholds.probeIntervalSeconds must be an integer from 10 to 300');
    }
    if (
      !Number.isInteger(value.rollbackThresholds.minimumProbeCount) ||
      Number(value.rollbackThresholds.minimumProbeCount) < 2 ||
      Number(value.rollbackThresholds.minimumProbeCount) > 100
    ) {
      errors.push('plan.rollbackThresholds.minimumProbeCount must be an integer from 2 to 100');
    }
    if (
      Number.isInteger(value.rollbackThresholds.consecutiveProbeFailures) &&
      Number.isInteger(value.rollbackThresholds.minimumProbeCount) &&
      Number(value.rollbackThresholds.consecutiveProbeFailures) >
        Number(value.rollbackThresholds.minimumProbeCount)
    ) {
      errors.push('plan.rollbackThresholds.consecutiveProbeFailures cannot exceed minimumProbeCount');
    }
    if (
      isRecord(value.window) &&
      isStrictIsoUtc(value.window.startsAt) &&
      isStrictIsoUtc(value.window.monitorUntil) &&
      Number.isInteger(value.rollbackThresholds.probeIntervalSeconds) &&
      Number.isInteger(value.rollbackThresholds.minimumProbeCount) &&
      Date.parse(value.window.monitorUntil) - Date.parse(value.window.startsAt) <
        (Number(value.rollbackThresholds.minimumProbeCount) - 1) *
          Number(value.rollbackThresholds.probeIntervalSeconds) * 1000
    ) {
      errors.push('plan monitoring window cannot fit the required probe schedule');
    }
    for (const field of ['tlsFailureImmediate', 'mailRecordChangeImmediate'] as const) {
      if (value.rollbackThresholds[field] !== true) {
        errors.push(`plan.rollbackThresholds.${field} must be true`);
      }
    }
  }

  if (!isRecord(value.decisions)) {
    errors.push('plan.decisions must be an object');
  } else {
    const decisionKeys = Object.keys(LEGACY_CUTOVER_DECISION_EVIDENCE);
    validateExactFields(value.decisions, decisionKeys, 'plan.decisions', errors);
    for (const key of decisionKeys as Array<keyof typeof LEGACY_CUTOVER_DECISION_EVIDENCE>) {
      const decision = value.decisions[key];
      if (!isRecord(decision)) {
        errors.push(`plan.decisions.${key} must be an object`);
        continue;
      }
      validateExactFields(decision, DECISION_FIELDS, `plan.decisions.${key}`, errors);
      if (decision.status !== 'approved') {
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
      if (decision.evidenceKey !== LEGACY_CUTOVER_DECISION_EVIDENCE[key]) {
        errors.push(
          `plan.decisions.${key}.evidenceKey must be ${LEGACY_CUTOVER_DECISION_EVIDENCE[key]}`,
        );
      }
      const decisionEvidence = isRecord(value.evidence)
        ? value.evidence[LEGACY_CUTOVER_DECISION_EVIDENCE[key]]
        : null;
      if (
        isStrictIsoUtc(decision.approvedAt) &&
        isRecord(decisionEvidence) &&
        isStrictIsoUtc(decisionEvidence.observedAt) &&
        Date.parse(decision.approvedAt) < Date.parse(decisionEvidence.observedAt)
      ) {
        errors.push(`plan.decisions.${key}.approvedAt must not precede its evidence observation`);
      }
    }
  }

  if (!isRecord(value.evidence)) {
    errors.push('plan.evidence must be an object');
  } else {
    validateExactFields(value.evidence, LEGACY_CUTOVER_EVIDENCE_KEYS, 'plan.evidence', errors);
    for (const key of LEGACY_CUTOVER_EVIDENCE_KEYS) {
      const evidence = value.evidence[key];
      if (!isRecord(evidence)) {
        errors.push(`plan.evidence.${key} must be an object`);
        continue;
      }
      validateExactFields(evidence, EVIDENCE_FIELDS, `plan.evidence.${key}`, errors);
      if (
        !isResolvedText(evidence.reference) ||
        !path.isAbsolute(String(evidence.reference)) ||
        String(evidence.reference).includes('\0')
      ) {
        errors.push(`plan.evidence.${key}.reference must be an absolute local file path`);
      }
      if (typeof evidence.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(evidence.sha256)) {
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
  if (!isRecord(value)) return ['artifact must be a JSON object'];
  validateExactFields(value, ARTIFACT_FIELDS, `artifact.${key}`, errors);
  errors.push(...findSensitiveMaterial(value, `artifact.${key}`));
  if (value.schemaVersion !== 1) errors.push(`artifact.${key}.schemaVersion must be 1`);
  if (value.evidenceKind !== key) errors.push(`artifact.${key}.evidenceKind must be ${key}`);
  if (value.status !== 'pass') errors.push(`artifact.${key}.status must be pass`);
  if (value.cutoverId !== plan.cutoverId) errors.push(`artifact.${key}.cutoverId does not match plan`);
  if (value.repositoryCommit !== plan.repositoryCommit) {
    errors.push(`artifact.${key}.repositoryCommit does not match plan`);
  }
  if (value.vercelDeploymentId !== plan.vercelDeploymentId) {
    errors.push(`artifact.${key}.vercelDeploymentId does not match plan`);
  }
  if (value.topology !== plan.topology) errors.push(`artifact.${key}.topology does not match plan`);
  if (!isResolvedText(value.source)) errors.push(`artifact.${key}.source must be resolved`);
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
      errors.push(`artifact.${key}.underlyingEvidence.reference must be an absolute local file path`);
    }
    if (
      typeof value.underlyingEvidence.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(value.underlyingEvidence.sha256)
    ) {
      errors.push(`artifact.${key}.underlyingEvidence.sha256 must be a lowercase SHA-256`);
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
      errors.push(`artifact.${key}.underlyingEvidence.collector must be resolved`);
    }
    if (!isResolvedText(value.underlyingEvidence.collectorVersion)) {
      errors.push(`artifact.${key}.underlyingEvidence.collectorVersion must be resolved`);
    }
  }
  validateFreshTimestamp(
    value.observedAt,
    `artifact.${key}.observedAt`,
    nowMs,
    LEGACY_CUTOVER_EVIDENCE_MAX_AGE_MS[key],
    errors,
  );
  if (value.observedAt !== plan.evidence[key].observedAt) {
    errors.push(`artifact.${key}.observedAt does not match plan`);
  }
  if (!isRecord(value.checks)) {
    errors.push(`artifact.${key}.checks must be an object`);
  } else {
    const requiredChecks = LEGACY_CUTOVER_EVIDENCE_CHECKS[key];
    validateExactFields(value.checks, requiredChecks, `artifact.${key}.checks`, errors);
    for (const check of requiredChecks) {
      if (value.checks[check] !== true) {
        errors.push(`artifact.${key}.checks.${check} must be true`);
      }
    }
  }
  return [...new Set(errors)];
}

export async function verifyLegacyCutoverEvidence(
  plan: LegacyCutoverPlan,
  {nowMs = Date.now(), repositoryRoot}: {nowMs?: number; repositoryRoot?: string} = {},
): Promise<EvidenceVerification> {
  const entries = await Promise.all(
    LEGACY_CUTOVER_EVIDENCE_KEYS.map(async (key): Promise<EvidenceVerificationEntry> => {
      const expected = plan.evidence[key];
      const errors: string[] = [];
      let actualSha256: string | null = null;
      let artifactReference = expected.reference;
      const underlyingEvidence: EvidenceVerificationEntry['underlyingEvidence'] = {
        reference: null,
        expectedSha256: null,
        actualSha256: null,
        expectedBytes: null,
        actualBytes: null,
        collector: null,
        collectorVersion: null,
      };
      try {
        const {bytes, canonicalPath} = await readRestrictedExternalFile(expected.reference, {
          repositoryRoot,
          maxBytes: MAX_EVIDENCE_BYTES,
          label: `artifact ${key}`,
        });
        artifactReference = canonicalPath;
        actualSha256 = createHash('sha256').update(bytes).digest('hex');
        if (actualSha256 !== expected.sha256) errors.push('artifact SHA-256 does not match plan');
        let parsed: unknown;
        try {
          parsed = JSON.parse(bytes.toString('utf8')) as unknown;
        } catch {
          errors.push('artifact is not valid JSON');
        }
        if (parsed !== undefined) {
          errors.push(...validateEvidenceArtifact(parsed, key, plan, nowMs));
          if (isRecord(parsed) && isRecord(parsed.underlyingEvidence)) {
            const underlying = parsed.underlyingEvidence;
            underlyingEvidence.reference = typeof underlying.reference === 'string'
              ? underlying.reference
              : null;
            underlyingEvidence.expectedSha256 = typeof underlying.sha256 === 'string'
              ? underlying.sha256
              : null;
            underlyingEvidence.expectedBytes = Number.isInteger(underlying.bytes)
              ? Number(underlying.bytes)
              : null;
            underlyingEvidence.collector = typeof underlying.collector === 'string'
              ? underlying.collector
              : null;
            underlyingEvidence.collectorVersion = typeof underlying.collectorVersion === 'string'
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
                underlyingEvidence.actualSha256 = createHash('sha256')
                  .update(underlyingFile.bytes)
                  .digest('hex');
                underlyingEvidence.actualBytes = underlyingFile.bytes.length;
                if (underlyingEvidence.actualSha256 !== underlyingEvidence.expectedSha256) {
                  errors.push(`underlying evidence SHA-256 does not match artifact for ${key}`);
                }
                if (underlyingEvidence.actualBytes !== underlyingEvidence.expectedBytes) {
                  errors.push(`underlying evidence byte length does not match artifact for ${key}`);
                }
              } catch (error) {
                errors.push(error instanceof Error ? error.message : String(error));
              }
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
): PreflightCheck {
  const status = statuses[gate] ?? 'missing';
  return {id, pass: status === 'approved', detail: `${gate} is ${status}`};
}

export function evaluateLegacyCutoverPreflight(input: LegacyCutoverPreflightInput): {
  decision: 'GO_TO_CHANGE' | 'NO_GO';
  checks: PreflightCheck[];
  failures: string[];
} {
  const checks: PreflightCheck[] = [];
  checks.push({
    id: 'holding-only-transition-lock',
    pass: false,
    detail: 'launch-gate transitions are locked; legacy cutover cannot be authorized',
  });
  checks.push({
    id: 'plan-valid',
    pass: Boolean(input.plan) && input.planErrors.length === 0,
    detail: input.planErrors.length === 0 ? 'cutover plan is valid' : input.planErrors.join('; '),
  });
  checks.push({
    id: 'launch-manifest-valid',
    pass: input.manifestErrors.length === 0,
    detail: input.manifestErrors.length === 0
      ? 'launch manifest is valid'
      : input.manifestErrors.join('; '),
  });
  checks.push(gateCheck('legal-approved', input.gateStatuses, 'legalPublication'));
  checks.push(gateCheck('contact-approved', input.gateStatuses, 'contactIntake'));
  checks.push(gateCheck('legacy-cutover-approved', input.gateStatuses, 'legacyCutover'));
  const legacyDependencies = input.gateDependencies.legacyCutover ?? [];
  checks.push({
    id: 'legacy-dependencies-declared',
    pass:
      legacyDependencies.includes('legalPublication') &&
      legacyDependencies.includes('contactIntake'),
    detail: `legacyCutover dependencies: ${legacyDependencies.join(', ') || 'none'}`,
  });
  checks.push({
    id: 'repository-clean',
    pass: input.repository.clean,
    detail: input.repository.clean ? 'working tree is clean' : 'working tree has changes',
  });
  checks.push({
    id: 'repository-commit',
    pass: Boolean(input.plan && input.repository.head === input.plan.repositoryCommit),
    detail: `HEAD ${input.repository.head ?? 'unavailable'}; plan ${input.plan?.repositoryCommit ?? 'missing'}`,
  });

  for (const command of REQUIRED_LEGACY_PREFLIGHT_COMMANDS) {
    const result = input.commandResults[command];
    checks.push({
      id: `command:${command}`,
      pass: result?.ok === true,
      detail: result?.detail ?? 'required command result is missing',
    });
  }

  const verifiedEvidenceKeys = new Set(
    input.evidenceVerification.entries
      .filter(
        (entry) =>
          entry.pass &&
          entry.errors.length === 0 &&
          entry.actualSha256 === entry.expectedSha256 &&
          entry.underlyingEvidence.actualSha256 === entry.underlyingEvidence.expectedSha256 &&
          entry.underlyingEvidence.actualBytes === entry.underlyingEvidence.expectedBytes,
      )
      .map((entry) => entry.key),
  );
  const evidenceEntriesComplete =
    input.evidenceVerification.entries.length === LEGACY_CUTOVER_EVIDENCE_KEYS.length &&
    verifiedEvidenceKeys.size === LEGACY_CUTOVER_EVIDENCE_KEYS.length &&
    LEGACY_CUTOVER_EVIDENCE_KEYS.every((key) => verifiedEvidenceKeys.has(key));
  checks.push({
    id: 'external-evidence-verified',
    pass: input.evidenceVerification.ok && evidenceEntriesComplete,
    detail: evidenceEntriesComplete
      ? input.evidenceVerification.detail
      : `${input.evidenceVerification.detail}; required evidence entries are missing or failed`,
  });
  checks.push({
    id: 'sales-destination',
    pass: Boolean(input.plan && input.salesDestinationObserved === input.plan.salesDestination),
    detail: `configured ${input.salesDestinationObserved ?? 'missing'}; plan ${input.plan?.salesDestination ?? 'missing'}`,
  });
  checks.push({
    id: 'machine-decisions-approved',
    pass: Boolean(
      input.plan &&
      Object.keys(LEGACY_CUTOVER_DECISION_EVIDENCE).every(
        (key) => input.plan?.decisions[key as keyof LegacyCutoverPlan['decisions']]?.status === 'approved',
      )
    ),
    detail: input.plan
      ? 'all required machine-readable cutover decisions are approved'
      : 'cutover plan is missing',
  });
  checks.push({
    id: 'receipt-directory-ready',
    pass: input.receiptDirectoryReady,
    detail: input.receiptDirectoryReady
      ? 'private external receipt directory is ready'
      : 'a private external --evidence-dir is required before GO_TO_CHANGE',
  });
  checks.push({
    id: 'authorization-validity-buffer',
    pass: input.authorizationValidityRemainingMs >= MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
    detail:
      `authorization validity remaining: ${Math.max(0, input.authorizationValidityRemainingMs)} ms; ` +
      `minimum required: ${MIN_LEGACY_AUTHORIZATION_VALIDITY_MS} ms`,
  });

  const failures = checks.filter((check) => !check.pass).map((check) => `${check.id}: ${check.detail}`);
  return {decision: failures.length === 0 ? 'GO_TO_CHANGE' : 'NO_GO', checks, failures};
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

export async function prepareLegacyCutoverReceiptDirectory(
  evidenceDirectory: string,
  {repositoryRoot}: {repositoryRoot?: string} = {},
): Promise<string> {
  if (!path.isAbsolute(evidenceDirectory)) {
    throw new Error('--evidence-dir must be an absolute path outside the repository');
  }
  const directoryStat = await lstat(evidenceDirectory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error('--evidence-dir must be a pre-existing real directory, not a symbolic link');
  }
  if ((directoryStat.mode & 0o077) !== 0) {
    throw new Error('--evidence-dir must not grant group or other permissions');
  }
  const canonicalDirectory = await realpath(evidenceDirectory);
  if (repositoryRoot && isPathInside(repositoryRoot, canonicalDirectory)) {
    throw new Error('--evidence-dir resolves inside the repository');
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
  }: {
    repositoryRoot?: string;
    notAfter?: string;
    minimumRemainingMs?: number;
    fileTimestamp?: string;
  } = {},
): Promise<{jsonPath: string; sha256Path: string; sha256: string}> {
  const canonicalDirectory = await prepareLegacyCutoverReceiptDirectory(
    evidenceDirectory,
    {repositoryRoot},
  );
  const contents = canonicalJson(receipt);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const timestamp = fileTimestamp.replaceAll(':', '').replaceAll('.', '');
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
    const temporaryJsonHandle = await open(temporaryJsonPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await temporaryJsonHandle.writeFile(contents, 'utf8');
      await temporaryJsonHandle.sync();
    } finally {
      await temporaryJsonHandle.close();
    }
    const hashHandle = await open(sha256Path, 'wx', 0o600);
    hashCreated = true;
    try {
      await hashHandle.writeFile(`${sha256}  ${basename}\n`, 'utf8');
      await hashHandle.sync();
    } finally {
      await hashHandle.close();
    }
    if (
      notAfter &&
      Date.parse(notAfter) - Date.now() < minimumRemainingMs
    ) {
      throw new Error('authorization validity buffer expired before receipt publication');
    }
    await link(temporaryJsonPath, jsonPath);
    jsonPublished = true;
    await unlink(temporaryJsonPath).catch(() => undefined);
    temporaryCreated = false;
    const directoryHandle = await open(canonicalDirectory, 'r');
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
      ...(temporaryCreated ? [unlink(temporaryJsonPath).catch(() => undefined)] : []),
    ]);
    throw error;
  }

  return {jsonPath, sha256Path, sha256};
}
