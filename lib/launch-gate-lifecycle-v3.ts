import {LAUNCH_GATE_IDS, type LaunchGateId} from './launch-gate-ids';
import {inspectForSensitiveContent} from './sensitive-content';

export const LAUNCH_GATE_LIFECYCLE_V3_STATUSES = [
  'holding',
  'candidate',
  'approved',
  'disabled',
  'private',
  'revoked',
] as const;

export type LaunchGateLifecycleStatusV3 =
  (typeof LAUNCH_GATE_LIFECYCLE_V3_STATUSES)[number];
export type LaunchGateResolvedStatusV3 = 'approved' | 'disabled' | 'private';

export const LAUNCH_GATE_LIFECYCLE_V3_TRANSITIONS = [
  'initialize',
  'submit',
  'withdraw',
  'approve',
  'disable',
  'keep-private',
  'renew',
  'revoke',
  'reopen',
] as const;

export type LaunchGateLifecycleTransitionV3 =
  (typeof LAUNCH_GATE_LIFECYCLE_V3_TRANSITIONS)[number];

export const MAX_LAUNCH_GATE_CANDIDATE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES = {
  legalPublication: [],
  contactIntake: ['legalPublication'],
  demoPublication: [],
  legacyCutover: ['legalPublication', 'contactIntake'],
  productionLaunch: [
    'legalPublication',
    'contactIntake',
    'demoPublication',
    'legacyCutover',
  ],
} as const satisfies Record<LaunchGateId, readonly LaunchGateId[]>;

export const LAUNCH_GATE_LIFECYCLE_V3_ALLOWED_RESOLUTIONS = {
  legalPublication: ['approved'],
  contactIntake: ['approved', 'disabled'],
  demoPublication: ['approved', 'private'],
  legacyCutover: ['approved'],
  productionLaunch: ['approved'],
} as const satisfies Record<LaunchGateId, readonly LaunchGateResolvedStatusV3[]>;

const AUTHORITY_ROLES = {
  legalPublication: 'legal-review-authority',
  contactIntake: 'contact-release-authority',
  demoPublication: 'demo-publication-authority',
  legacyCutover: 'legacy-cutover-authority',
  productionLaunch: 'production-release-authority',
} as const satisfies Record<LaunchGateId, string>;

const V2_BLOCKER_REFS = {
  legalPublication: ['docs/LEGAL_REVIEW.md'],
  contactIntake: ['docs/CONTACT_DELIVERY.md'],
  demoPublication: ['docs/DEMO_PROMOTION.md', 'docs/LAUNCH_DECISIONS.md'],
  legacyCutover: ['docs/LEGACY_CUTOVER.md'],
  productionLaunch: ['docs/LAUNCH_DECISIONS.md'],
} as const satisfies Record<LaunchGateId, readonly string[]>;

const APPROVED_EVIDENCE_KINDS = {
  legalPublication: {
    standard: ['legal-review'],
  },
  contactIntake: {
    standard: ['contact-readiness'],
  },
  demoPublication: {
    standard: ['demo-rights', 'demo-product-acceptance'],
  },
  legacyCutover: {
    contactEnabled: [
      'contact-production-verification',
      'legacy-cutover-authorization',
    ],
    contactDisabled: [
      'contact-disabled-verification',
      'legacy-cutover-authorization',
    ],
  },
  productionLaunch: {
    contactEnabled: [
      'post-cutover-verification',
      'contact-production-verification',
      'production-release',
    ],
    contactDisabled: [
      'post-cutover-verification',
      'contact-disabled-verification',
      'production-release',
    ],
  },
} as const;

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REPOSITORY_COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const VERCEL_DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]{20,}$/u;
const EVIDENCE_REFERENCE_PATTERN =
  /^docs\/evidence\/launch-gates\/[a-z0-9][a-z0-9._-]*\.json$/u;
const PLACEHOLDER_PATTERN =
  /\b(?:pending|tbd|unknown|placeholder|authorized reviewer|named owner|test|testing|fixture|sample|example|dummy|n\/?a|none)\b/iu;

type JsonObject = Record<string, unknown>;

export type LaunchGateLifecycleDecisionV3 = Readonly<{
  decisionId: string;
  outcome: 'approved' | 'disabled' | 'private' | 'revoked';
  decidedAt: string;
  decidedBy: Readonly<{
    name: string;
    authorityRole: string;
    organization: string;
  }>;
  candidate: Readonly<{
    candidateEventId: string;
    repositoryCommit: string;
    vercelDeploymentId: string | null;
  }>;
  supersedesDecisionId: string | null;
}>;

export type LaunchGateCandidateSubjectV3 = Readonly<{
  repositoryCommit: string;
  vercelDeploymentId: string | null;
}>;

export type LaunchGateLifecycleEvidenceV3 = Readonly<{
  kind: string;
  reference: string;
  sha256: string;
  observedAt: string;
  validUntil: string | null;
}>;

export type LaunchGateLifecycleEventV3 = Readonly<{
  eventId: string;
  transition: LaunchGateLifecycleTransitionV3;
  from: LaunchGateLifecycleStatusV3 | null;
  to: LaunchGateLifecycleStatusV3;
  targetStatus: LaunchGateResolvedStatusV3 | null;
  candidate: LaunchGateCandidateSubjectV3 | null;
  occurredAt: string;
  validUntil: string | null;
  previousEventId: string | null;
  supersedes: string | null;
  decision: LaunchGateLifecycleDecisionV3 | null;
  evidence: readonly LaunchGateLifecycleEvidenceV3[];
}>;

export type LaunchGateLifecycleManifestV3 = Readonly<{
  schemaVersion: 3;
  updatedAt: string;
  gates: Readonly<Record<LaunchGateId, Readonly<{
    description: string;
    dependencies: readonly LaunchGateId[];
    events: readonly LaunchGateLifecycleEventV3[];
  }>>>;
}>;

export type LaunchGateLifecycleValidationOptionsV3 = Readonly<{
  nowMs?: number;
}>;

export type ResolvedLaunchGateV3 = Readonly<{
  gateId: LaunchGateId;
  declaredStatus: LaunchGateLifecycleStatusV3 | null;
  effectiveStatus: LaunchGateLifecycleStatusV3;
  targetStatus: LaunchGateResolvedStatusV3 | null;
  candidate: LaunchGateCandidateSubjectV3 | null;
  validUntil: string | null;
  decision: LaunchGateLifecycleDecisionV3 | null;
  evidence: readonly LaunchGateLifecycleEvidenceV3[];
  expired: boolean;
  explicitlyRevoked: boolean;
  locallySatisfied: boolean;
  dependenciesSatisfied: boolean;
  satisfied: boolean;
  active: boolean;
  failureReasons: readonly string[];
}>;

export type LaunchGateCapabilitiesV3 = Readonly<{
  publishLegal: boolean;
  enableContactIntake: boolean;
  publishDemos: boolean;
  executeLegacyCutover: boolean;
  declareProductionLaunch: boolean;
}>;

export type LaunchGateLifecycleResolutionV3 = Readonly<{
  valid: boolean;
  errors: readonly string[];
  gates: Readonly<Record<LaunchGateId, ResolvedLaunchGateV3>>;
  capabilities: LaunchGateCapabilitiesV3;
}>;

export type LaunchGateV2MigrationResult = Readonly<{
  manifest: LaunchGateLifecycleManifestV3 | null;
  errors: readonly string[];
}>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: JsonObject,
  allowed: readonly string[],
  field: string,
  errors: string[],
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${field} contains unknown field ${key}`);
  }
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isGateId(value: unknown): value is LaunchGateId {
  return typeof value === 'string' && (LAUNCH_GATE_IDS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is LaunchGateLifecycleStatusV3 {
  return (
    typeof value === 'string' &&
    (LAUNCH_GATE_LIFECYCLE_V3_STATUSES as readonly string[]).includes(value)
  );
}

function isResolvedStatus(value: unknown): value is LaunchGateResolvedStatusV3 {
  return value === 'approved' || value === 'disabled' || value === 'private';
}

function isTransition(value: unknown): value is LaunchGateLifecycleTransitionV3 {
  return (
    typeof value === 'string' &&
    (LAUNCH_GATE_LIFECYCLE_V3_TRANSITIONS as readonly string[]).includes(value)
  );
}

function isSubstantiveAuthorityValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !PLACEHOLDER_PATTERN.test(value)
  );
}

function arraysEqual<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function stringArray(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    errors.push(`${field} must be an array of strings`);
    return [];
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${field} must not contain duplicates`);
  }
  return value;
}

function validateNow(options: LaunchGateLifecycleValidationOptionsV3): {
  nowMs: number;
  errors: string[];
} {
  const nowMs = options.nowMs ?? Date.now();
  return Number.isFinite(nowMs) && nowMs >= 0
    ? {nowMs, errors: []}
    : {nowMs: 0, errors: ['nowMs must be a finite non-negative timestamp']};
}

function parseCandidateSubject(
  value: unknown,
  field: string,
  errors: string[],
  includeEventId: false,
): LaunchGateCandidateSubjectV3 | null;
function parseCandidateSubject(
  value: unknown,
  field: string,
  errors: string[],
  includeEventId: true,
): LaunchGateLifecycleDecisionV3['candidate'] | null;
function parseCandidateSubject(
  value: unknown,
  field: string,
  errors: string[],
  includeEventId: boolean,
): LaunchGateCandidateSubjectV3 | LaunchGateLifecycleDecisionV3['candidate'] | null {
  if (value === null) return null;
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  rejectUnknownKeys(
    value,
    includeEventId
      ? ['candidateEventId', 'repositoryCommit', 'vercelDeploymentId']
      : ['repositoryCommit', 'vercelDeploymentId'],
    field,
    errors,
  );
  const candidateEventId =
    includeEventId && typeof value.candidateEventId === 'string'
      ? value.candidateEventId
      : '';
  if (includeEventId && !ID_PATTERN.test(candidateEventId)) {
    errors.push(`${field}.candidateEventId is invalid`);
  }
  const repositoryCommit =
    typeof value.repositoryCommit === 'string' ? value.repositoryCommit : '';
  if (
    !REPOSITORY_COMMIT_PATTERN.test(repositoryCommit) ||
    repositoryCommit === '0'.repeat(40)
  ) {
    errors.push(`${field}.repositoryCommit must be a nonzero lowercase Git SHA`);
  }
  const vercelDeploymentId =
    value.vercelDeploymentId === null ||
    typeof value.vercelDeploymentId === 'string'
      ? value.vercelDeploymentId
      : null;
  if (
    vercelDeploymentId !== null &&
    !VERCEL_DEPLOYMENT_PATTERN.test(vercelDeploymentId)
  ) {
    errors.push(`${field}.vercelDeploymentId must be null or a Vercel deployment ID`);
  }
  return includeEventId
    ? {candidateEventId, repositoryCommit, vercelDeploymentId}
    : {repositoryCommit, vercelDeploymentId};
}

function parseDecision(
  value: unknown,
  gateId: LaunchGateId,
  field: string,
  errors: string[],
): LaunchGateLifecycleDecisionV3 | null {
  if (value === null) return null;
  if (!isObject(value)) {
    errors.push(`${field} must be null or an object`);
    return null;
  }
  rejectUnknownKeys(
    value,
    [
      'decisionId',
      'outcome',
      'decidedAt',
      'decidedBy',
      'candidate',
      'supersedesDecisionId',
    ],
    field,
    errors,
  );
  const decisionId = typeof value.decisionId === 'string' ? value.decisionId : '';
  if (!ID_PATTERN.test(decisionId)) errors.push(`${field}.decisionId is invalid`);
  const outcome = value.outcome;
  if (
    outcome !== 'approved' &&
    outcome !== 'disabled' &&
    outcome !== 'private' &&
    outcome !== 'revoked'
  ) {
    errors.push(`${field}.outcome is invalid`);
  }
  const decidedAt = typeof value.decidedAt === 'string' ? value.decidedAt : '';
  if (!isCanonicalUtcTimestamp(decidedAt)) {
    errors.push(`${field}.decidedAt must be a canonical UTC timestamp`);
  }
  if (!isObject(value.decidedBy)) {
    errors.push(`${field}.decidedBy must be an object`);
  } else {
    rejectUnknownKeys(
      value.decidedBy,
      ['name', 'authorityRole', 'organization'],
      `${field}.decidedBy`,
      errors,
    );
    if (!isSubstantiveAuthorityValue(value.decidedBy.name)) {
      errors.push(`${field}.decidedBy.name must identify a non-placeholder authority`);
    }
    if (value.decidedBy.authorityRole !== AUTHORITY_ROLES[gateId]) {
      errors.push(
        `${field}.decidedBy.authorityRole must be ${AUTHORITY_ROLES[gateId]}`,
      );
    }
    if (!isSubstantiveAuthorityValue(value.decidedBy.organization)) {
      errors.push(
        `${field}.decidedBy.organization must identify a non-placeholder organization`,
      );
    }
  }
  const supersedesDecisionId =
    value.supersedesDecisionId === null ||
    typeof value.supersedesDecisionId === 'string'
      ? value.supersedesDecisionId
      : null;
  if (
    value.supersedesDecisionId !== null &&
    (typeof value.supersedesDecisionId !== 'string' ||
      !ID_PATTERN.test(value.supersedesDecisionId))
  ) {
    errors.push(`${field}.supersedesDecisionId must be null or a valid decision ID`);
  }
  const candidate = parseCandidateSubject(
    value.candidate,
    `${field}.candidate`,
    errors,
    true,
  ) ?? {
    candidateEventId: '',
    repositoryCommit: '',
    vercelDeploymentId: null,
  };
  const decidedBy = isObject(value.decidedBy)
    ? {
        name: typeof value.decidedBy.name === 'string' ? value.decidedBy.name : '',
        authorityRole:
          typeof value.decidedBy.authorityRole === 'string'
            ? value.decidedBy.authorityRole
            : '',
        organization:
          typeof value.decidedBy.organization === 'string'
            ? value.decidedBy.organization
            : '',
      }
    : {name: '', authorityRole: '', organization: ''};
  return {
    decisionId,
    outcome:
      outcome === 'disabled' || outcome === 'private' || outcome === 'revoked'
        ? outcome
        : 'approved',
    decidedAt,
    decidedBy,
    candidate,
    supersedesDecisionId,
  };
}

function parseEvidence(
  value: unknown,
  field: string,
  errors: string[],
): LaunchGateLifecycleEvidenceV3[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const parsed: LaunchGateLifecycleEvidenceV3[] = [];
  for (const [index, entry] of value.entries()) {
    const prefix = `${field}[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    rejectUnknownKeys(
      entry,
      ['kind', 'reference', 'sha256', 'observedAt', 'validUntil'],
      prefix,
      errors,
    );
    const kind = typeof entry.kind === 'string' ? entry.kind : '';
    const reference = typeof entry.reference === 'string' ? entry.reference : '';
    const sha256 = typeof entry.sha256 === 'string' ? entry.sha256 : '';
    const observedAt = typeof entry.observedAt === 'string' ? entry.observedAt : '';
    const validUntil =
      entry.validUntil === null || typeof entry.validUntil === 'string'
        ? entry.validUntil
        : null;
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/u.test(kind)) {
      errors.push(`${prefix}.kind is invalid`);
    }
    if (!EVIDENCE_REFERENCE_PATTERN.test(reference)) {
      errors.push(`${prefix}.reference must be a direct launch-gate evidence JSON file`);
    }
    if (!SHA256_PATTERN.test(sha256) || sha256 === '0'.repeat(64)) {
      errors.push(`${prefix}.sha256 must be a nonzero lowercase SHA-256`);
    }
    if (!isCanonicalUtcTimestamp(observedAt)) {
      errors.push(`${prefix}.observedAt must be a canonical UTC timestamp`);
    }
    if (validUntil !== null && !isCanonicalUtcTimestamp(validUntil)) {
      errors.push(`${prefix}.validUntil must be null or a canonical UTC timestamp`);
    }
    parsed.push({kind, reference, sha256, observedAt, validUntil});
  }
  const kinds = parsed.map(({kind}) => kind);
  const references = parsed.map(({reference}) => reference);
  if (new Set(kinds).size !== kinds.length) errors.push(`${field} must not repeat a kind`);
  if (new Set(references).size !== references.length) {
    errors.push(`${field} must not repeat a reference`);
  }
  return parsed;
}

function parseEvent(
  value: unknown,
  gateId: LaunchGateId,
  field: string,
  errors: string[],
): LaunchGateLifecycleEventV3 | null {
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  rejectUnknownKeys(
    value,
    [
      'eventId',
      'transition',
      'from',
      'to',
      'targetStatus',
      'candidate',
      'occurredAt',
      'validUntil',
      'previousEventId',
      'supersedes',
      'decision',
      'evidence',
    ],
    field,
    errors,
  );
  const eventId = typeof value.eventId === 'string' ? value.eventId : '';
  if (!ID_PATTERN.test(eventId)) errors.push(`${field}.eventId is invalid`);
  const transition = value.transition;
  if (!isTransition(transition)) errors.push(`${field}.transition is invalid`);
  const from = value.from;
  if (from !== null && !isStatus(from)) errors.push(`${field}.from is invalid`);
  const to = value.to;
  if (!isStatus(to)) errors.push(`${field}.to is invalid`);
  const targetStatus = value.targetStatus;
  if (targetStatus !== null && !isResolvedStatus(targetStatus)) {
    errors.push(`${field}.targetStatus is invalid`);
  }
  const candidate = parseCandidateSubject(
    value.candidate,
    `${field}.candidate`,
    errors,
    false,
  );
  const occurredAt = typeof value.occurredAt === 'string' ? value.occurredAt : '';
  if (!isCanonicalUtcTimestamp(occurredAt)) {
    errors.push(`${field}.occurredAt must be a canonical UTC timestamp`);
  }
  const validUntil =
    value.validUntil === null || typeof value.validUntil === 'string'
      ? value.validUntil
      : null;
  if (validUntil !== null && !isCanonicalUtcTimestamp(validUntil)) {
    errors.push(`${field}.validUntil must be null or a canonical UTC timestamp`);
  }
  const previousEventId =
    value.previousEventId === null || typeof value.previousEventId === 'string'
      ? value.previousEventId
      : null;
  if (
    value.previousEventId !== null &&
    (typeof value.previousEventId !== 'string' ||
      !ID_PATTERN.test(value.previousEventId))
  ) {
    errors.push(`${field}.previousEventId must be null or a valid event ID`);
  }
  const supersedes =
    value.supersedes === null || typeof value.supersedes === 'string'
      ? value.supersedes
      : null;
  if (
    value.supersedes !== null &&
    (typeof value.supersedes !== 'string' || !ID_PATTERN.test(value.supersedes))
  ) {
    errors.push(`${field}.supersedes must be null or a valid event ID`);
  }
  const decision = parseDecision(value.decision, gateId, `${field}.decision`, errors);
  const evidence = parseEvidence(value.evidence, `${field}.evidence`, errors);
  return {
    eventId,
    transition: isTransition(transition) ? transition : 'initialize',
    from: from === null || isStatus(from) ? from : null,
    to: isStatus(to) ? to : 'revoked',
    targetStatus: isResolvedStatus(targetStatus) ? targetStatus : null,
    candidate,
    occurredAt,
    validUntil,
    previousEventId,
    supersedes,
    decision,
    evidence,
  };
}

function expectedTransition(
  previous: LaunchGateLifecycleEventV3 | null,
  next: LaunchGateLifecycleEventV3,
): boolean {
  if (previous === null) {
    return (
      next.transition === 'initialize' &&
      next.from === null &&
      next.to === 'holding'
    );
  }
  if (previous.to === 'holding') {
    return (
      next.transition === 'submit' &&
      next.from === 'holding' &&
      next.to === 'candidate'
    );
  }
  if (previous.to === 'candidate') {
    if (
      next.transition === 'reopen' &&
      next.from === 'candidate' &&
      next.to === 'candidate'
    ) {
      return true;
    }
    if (
      next.transition === 'withdraw' &&
      next.from === 'candidate' &&
      next.to === 'holding'
    ) {
      return true;
    }
    return (
      next.from === 'candidate' &&
      ((next.transition === 'approve' && next.to === 'approved') ||
        (next.transition === 'disable' && next.to === 'disabled') ||
        (next.transition === 'keep-private' && next.to === 'private'))
    );
  }
  if (isResolvedStatus(previous.to)) {
    return (
      (next.transition === 'renew' &&
        next.from === previous.to &&
        next.to === previous.to) ||
      (next.transition === 'revoke' &&
        next.from === previous.to &&
        next.to === 'revoked')
    );
  }
  return (
    previous.to === 'revoked' &&
    next.transition === 'reopen' &&
    next.from === 'revoked' &&
    next.to === 'candidate'
  );
}

function expectedEvidenceKinds(
  gateId: LaunchGateId,
  outcome: LaunchGateResolvedStatusV3 | 'revoked',
  contactStatus?: 'approved' | 'disabled',
): readonly string[] | null {
  if (outcome === 'revoked') return ['gate-revocation'];
  if (outcome === 'disabled') {
    return gateId === 'contactIntake' ? ['contact-disabled-disposition'] : null;
  }
  if (outcome === 'private') {
    return gateId === 'demoPublication' ? ['demo-private-disposition'] : null;
  }
  if (gateId === 'legacyCutover' || gateId === 'productionLaunch') {
    if (contactStatus === 'approved') {
      return APPROVED_EVIDENCE_KINDS[gateId].contactEnabled;
    }
    if (contactStatus === 'disabled') {
      return APPROVED_EVIDENCE_KINDS[gateId].contactDisabled;
    }
    return null;
  }
  return APPROVED_EVIDENCE_KINDS[gateId].standard;
}

function decisionCandidateMatches(
  decision: LaunchGateLifecycleDecisionV3 | null,
  eventId: string,
  candidate: LaunchGateCandidateSubjectV3 | null,
): boolean {
  return (
    decision !== null &&
    candidate !== null &&
    decision.candidate.candidateEventId === eventId &&
    decision.candidate.repositoryCommit === candidate.repositoryCommit &&
    decision.candidate.vercelDeploymentId === candidate.vercelDeploymentId
  );
}

function validateEventStateContract(
  gateId: LaunchGateId,
  event: LaunchGateLifecycleEventV3,
  field: string,
  nowMs: number,
  errors: string[],
) {
  const resolved = isResolvedStatus(event.to);
  if (event.to === 'candidate') {
    if (
      event.targetStatus === null ||
      !LAUNCH_GATE_LIFECYCLE_V3_ALLOWED_RESOLUTIONS[gateId].includes(
        event.targetStatus as never,
      )
    ) {
      errors.push(`${field}.targetStatus is not allowed for ${gateId}`);
    }
    if (event.validUntil === null) {
      errors.push(`${field}.validUntil is required for a candidate window`);
    } else if (
      isCanonicalUtcTimestamp(event.occurredAt) &&
      Date.parse(event.validUntil) <= Date.parse(event.occurredAt)
    ) {
      errors.push(`${field}.validUntil must be later than occurredAt`);
    } else if (
      isCanonicalUtcTimestamp(event.occurredAt) &&
      Date.parse(event.validUntil) - Date.parse(event.occurredAt) >
        MAX_LAUNCH_GATE_CANDIDATE_TTL_MS
    ) {
      errors.push(`${field}.candidate window must not exceed 7 days`);
    }
    if (event.candidate === null) {
      errors.push(`${field}.candidate is required for a candidate event`);
    }
    if (event.decision !== null) {
      errors.push(`${field}.decision must be null for candidate`);
    }
    if (event.evidence.length !== 0) {
      errors.push(`${field}.evidence must be empty for candidate`);
    }
  } else if (event.targetStatus !== null) {
    errors.push(`${field}.targetStatus must be null unless status is candidate`);
  }
  if (event.to !== 'candidate' && event.candidate !== null) {
    errors.push(`${field}.candidate must be null unless status is candidate`);
  }

  if (resolved) {
    if (
      !LAUNCH_GATE_LIFECYCLE_V3_ALLOWED_RESOLUTIONS[gateId].includes(
        event.to as never,
      )
    ) {
      errors.push(`${field}.to ${event.to} is not allowed for ${gateId}`);
    }
    if (event.validUntil === null) {
      errors.push(`${field}.validUntil is required for a resolved decision`);
    } else if (
      isCanonicalUtcTimestamp(event.occurredAt) &&
      Date.parse(event.validUntil) <= Date.parse(event.occurredAt)
    ) {
      errors.push(`${field}.validUntil must be later than occurredAt`);
    }
    if (event.decision === null) {
      errors.push(`${field}.decision is required for a resolved decision`);
    } else if (event.decision.outcome !== event.to) {
      errors.push(`${field}.decision.outcome must equal ${event.to}`);
    }
    if (event.evidence.length === 0) {
      errors.push(`${field}.evidence is required for a resolved decision`);
    }
    const actualKinds = event.evidence.map(({kind}) => kind);
    const acceptableKinds =
      gateId === 'legacyCutover' || gateId === 'productionLaunch'
        ? [
            expectedEvidenceKinds(gateId, event.to, 'approved'),
            expectedEvidenceKinds(gateId, event.to, 'disabled'),
          ]
        : [expectedEvidenceKinds(gateId, event.to)];
    if (
      !acceptableKinds.some(
        (expectedKinds) =>
          expectedKinds !== null && arraysEqual(actualKinds, expectedKinds),
      )
    ) {
      errors.push(`${field}.evidence kinds are not allowed for ${gateId} ${event.to}`);
    }
  } else if (event.to === 'revoked') {
    if (event.validUntil !== null) {
      errors.push(`${field}.validUntil must be null for revocation`);
    }
    if (event.decision === null || event.decision.outcome !== 'revoked') {
      errors.push(`${field}.decision must be an explicit revocation decision`);
    }
    const kinds = event.evidence.map(({kind}) => kind);
    if (!arraysEqual(kinds, ['gate-revocation'])) {
      errors.push(`${field}.evidence kinds must exactly equal [gate-revocation]`);
    }
  } else if (event.to !== 'candidate') {
    if (event.validUntil !== null) {
      errors.push(`${field}.validUntil must be null for ${event.to}`);
    }
    if (event.decision !== null) {
      errors.push(`${field}.decision must be null for ${event.to}`);
    }
    if (event.evidence.length !== 0) {
      errors.push(`${field}.evidence must be empty for ${event.to}`);
    }
  }

  if (isCanonicalUtcTimestamp(event.occurredAt) && Date.parse(event.occurredAt) > nowMs) {
    errors.push(`${field}.occurredAt must not be in the future`);
  }
  if (event.decision !== null) {
    if (event.decision.decidedAt !== event.occurredAt) {
      errors.push(`${field}.decision.decidedAt must equal occurredAt`);
    }
  }
  for (const [index, evidence] of event.evidence.entries()) {
    const prefix = `${field}.evidence[${index}]`;
    if (
      isCanonicalUtcTimestamp(evidence.observedAt) &&
      isCanonicalUtcTimestamp(event.occurredAt) &&
      Date.parse(evidence.observedAt) > Date.parse(event.occurredAt)
    ) {
      errors.push(`${prefix}.observedAt must not be later than occurredAt`);
    }
    if (resolved) {
      if (evidence.validUntil === null) {
        errors.push(`${prefix}.validUntil is required for resolved evidence`);
      } else if (
        event.validUntil !== null &&
        Date.parse(evidence.validUntil) < Date.parse(event.validUntil)
      ) {
        errors.push(`${prefix}.validUntil must cover the decision validUntil`);
      }
    } else if (evidence.validUntil !== null) {
      errors.push(`${prefix}.validUntil must be null for non-expiring evidence`);
    }
  }
}

function validateTypedTransition(
  gateId: LaunchGateId,
  previous: LaunchGateLifecycleEventV3 | null,
  next: LaunchGateLifecycleEventV3,
  field: string,
  errors: string[],
) {
  if (!expectedTransition(previous, next)) {
    errors.push(
      `${field} is not a legal ${previous?.to ?? 'initial'} -> ${next.to} transition`,
    );
    return;
  }
  if (previous === null) {
    if (next.previousEventId !== null) {
      errors.push(`${field}.previousEventId must be null for initialization`);
    }
    if (next.supersedes !== null) {
      errors.push(`${field}.supersedes must be null for initialization`);
    }
    return;
  }
  if (next.previousEventId !== previous.eventId) {
    errors.push(`${field}.previousEventId must equal ${previous.eventId}`);
  }
  if (
    isCanonicalUtcTimestamp(previous.occurredAt) &&
    isCanonicalUtcTimestamp(next.occurredAt) &&
    Date.parse(next.occurredAt) <= Date.parse(previous.occurredAt)
  ) {
    errors.push(`${field}.occurredAt must be later than the previous event`);
  }

  if (previous.to === 'candidate' && isResolvedStatus(next.to)) {
    if (previous.targetStatus !== next.to) {
      errors.push(
        `${field}.to must equal the candidate targetStatus ${previous.targetStatus}`,
      );
    }
    if (!decisionCandidateMatches(next.decision, previous.eventId, previous.candidate)) {
      errors.push(`${field}.decision.candidate must exactly bind the candidate event`);
    }
  }
  if (
    previous.to === 'candidate' &&
    previous.validUntil !== null &&
    isCanonicalUtcTimestamp(next.occurredAt)
  ) {
    const candidateExpired =
      Date.parse(next.occurredAt) >= Date.parse(previous.validUntil);
    if (next.transition === 'reopen') {
      if (!candidateExpired) {
        errors.push(`${field} cannot reopen an unexpired candidate`);
      }
    } else if (candidateExpired && next.transition !== 'withdraw') {
      errors.push(`${field} cannot transition an expired candidate without reopen`);
    }
  }

  if (next.transition === 'renew' || next.transition === 'revoke') {
    if (next.supersedes !== previous.eventId) {
      errors.push(`${field}.supersedes must equal ${previous.eventId}`);
    }
    if (
      next.decision === null ||
      previous.decision === null ||
      next.decision.supersedesDecisionId !== previous.decision.decisionId
    ) {
      errors.push(`${field}.decision must link the superseded decision`);
    }
    if (
      next.decision === null ||
      previous.decision === null ||
      JSON.stringify(next.decision.candidate) !==
        JSON.stringify(previous.decision.candidate)
    ) {
      errors.push(`${field}.decision.candidate must preserve the superseded subject`);
    }
  } else {
    if (next.supersedes !== null) {
      errors.push(`${field}.supersedes must be null for ${next.transition}`);
    }
    if (next.decision?.supersedesDecisionId !== null && next.decision !== null) {
      errors.push(
        `${field}.decision.supersedesDecisionId must be null for ${next.transition}`,
      );
    }
  }

  if (next.transition === 'renew') {
    if (
      previous.validUntil === null ||
      next.validUntil === null ||
      Date.parse(next.occurredAt) >= Date.parse(previous.validUntil)
    ) {
      errors.push(`${field} cannot renew an already expired decision`);
    } else if (Date.parse(next.validUntil) <= Date.parse(previous.validUntil)) {
      errors.push(`${field}.validUntil must extend the superseded decision`);
    }
    for (const [index, evidence] of next.evidence.entries()) {
      if (Date.parse(evidence.observedAt) <= Date.parse(previous.occurredAt)) {
        errors.push(`${field}.evidence[${index}] must be fresh for renewal`);
      }
    }
  }
}

export function validateLaunchGateTransitionV3(
  gateIdValue: unknown,
  previousValue: unknown,
  nextValue: unknown,
  options: LaunchGateLifecycleValidationOptionsV3 = {},
): string[] {
  const errors = validateNow(options).errors;
  if (!isGateId(gateIdValue)) {
    errors.push('gateId is not a recognized launch gate');
    return errors;
  }
  const {nowMs} = validateNow(options);
  const previous =
    previousValue === null
      ? null
      : parseEvent(previousValue, gateIdValue, 'previous', errors);
  const next = parseEvent(nextValue, gateIdValue, 'next', errors);
  if (previousValue !== null && previous === null) {
    errors.push('previous must be null or a launch-gate event');
  }
  if (previous !== null) {
    validateEventStateContract(gateIdValue, previous, 'previous', nowMs, errors);
  }
  if (next !== null) {
    validateEventStateContract(gateIdValue, next, 'next', nowMs, errors);
  }
  if (next !== null && (previousValue === null || previous !== null)) {
    validateTypedTransition(gateIdValue, previous, next, 'next', errors);
  }
  return errors;
}

type ParsedManifest = LaunchGateLifecycleManifestV3;

function eventAt(
  manifest: ParsedManifest,
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

function decisionEventById(
  manifest: ParsedManifest,
  gateId: LaunchGateId,
  decisionId: string,
): LaunchGateLifecycleEventV3 | null {
  return (
    manifest.gates[gateId].events.find(
      (event) => event.decision?.decisionId === decisionId,
    ) ?? null
  );
}

function decisionLineageContains(
  manifest: ParsedManifest,
  gateId: LaunchGateId,
  currentEvent: LaunchGateLifecycleEventV3,
  requiredDecisionId: string,
): boolean {
  let cursor: LaunchGateLifecycleEventV3 | null = currentEvent;
  const seen = new Set<string>();
  while (cursor?.decision) {
    const currentDecisionId = cursor.decision.decisionId;
    if (currentDecisionId === requiredDecisionId) return true;
    if (
      cursor.transition !== 'renew' ||
      cursor.decision.supersedesDecisionId === null ||
      seen.has(currentDecisionId)
    ) {
      return false;
    }
    seen.add(currentDecisionId);
    cursor = decisionEventById(
      manifest,
      gateId,
      cursor.decision.supersedesDecisionId,
    );
  }
  return false;
}

function dependencyDecisionLineageSatisfiedAt(
  manifest: ParsedManifest,
  ownerEvent: LaunchGateLifecycleEventV3 | null,
  dependency: LaunchGateId,
  atMs: number,
): boolean {
  if (ownerEvent?.decision === null || ownerEvent === null) return false;
  const dependencyAtDecision = eventAt(
    manifest,
    dependency,
    Date.parse(ownerEvent.occurredAt),
  );
  const currentDependency = eventAt(manifest, dependency, atMs);
  if (
    dependencyAtDecision?.decision === null ||
    dependencyAtDecision === null ||
    currentDependency?.decision === null ||
    currentDependency === null
  ) {
    return false;
  }
  return decisionLineageContains(
    manifest,
    dependency,
    currentDependency,
    dependencyAtDecision.decision.decisionId,
  );
}

function localStatusAt(
  manifest: ParsedManifest,
  gateId: LaunchGateId,
  atMs: number,
): {
  event: LaunchGateLifecycleEventV3 | null;
  effectiveStatus: LaunchGateLifecycleStatusV3;
  expired: boolean;
  locallySatisfied: boolean;
  active: boolean;
} {
  const event = eventAt(manifest, gateId, atMs);
  if (event === null) {
    return {
      event: null,
      effectiveStatus: 'revoked',
      expired: false,
      locallySatisfied: false,
      active: false,
    };
  }
  const expired =
    (isResolvedStatus(event.to) || event.to === 'candidate') &&
    event.validUntil !== null &&
    atMs >= Date.parse(event.validUntil);
  const effectiveStatus = expired ? 'revoked' : event.to;
  const locallySatisfied =
    effectiveStatus === 'approved' ||
    (gateId === 'contactIntake' && effectiveStatus === 'disabled') ||
    (gateId === 'demoPublication' && effectiveStatus === 'private');
  return {
    event,
    effectiveStatus,
    expired,
    locallySatisfied,
    active: effectiveStatus === 'approved',
  };
}

function isSatisfiedAt(
  manifest: ParsedManifest,
  gateId: LaunchGateId,
  atMs: number,
  cache: Map<LaunchGateId, boolean>,
): boolean {
  const cached = cache.get(gateId);
  if (cached !== undefined) return cached;
  const local = localStatusAt(manifest, gateId, atMs);
  const dependenciesSatisfied =
    LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId].every(
      (dependency) =>
        isSatisfiedAt(manifest, dependency, atMs, cache) &&
        dependencyDecisionLineageSatisfiedAt(
          manifest,
          local.event,
          dependency,
          atMs,
        ),
    );
  const satisfied = local.locallySatisfied && dependenciesSatisfied;
  cache.set(gateId, satisfied);
  return satisfied;
}

function parseManifest(
  value: unknown,
  options: LaunchGateLifecycleValidationOptionsV3,
): {manifest: ParsedManifest | null; errors: string[]} {
  const {nowMs, errors} = validateNow(options);
  if (!isObject(value)) return {manifest: null, errors: [...errors, 'manifest must be an object']};
  inspectForSensitiveContent(value, 'manifest', errors);
  rejectUnknownKeys(value, ['schemaVersion', 'updatedAt', 'gates'], 'manifest', errors);
  if (value.schemaVersion !== 3) errors.push('schemaVersion must be 3');
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  if (!isCanonicalUtcTimestamp(updatedAt)) {
    errors.push('updatedAt must be a canonical UTC timestamp');
  } else if (Date.parse(updatedAt) > nowMs) {
    errors.push('updatedAt must not be in the future');
  }
  if (!isObject(value.gates)) {
    return {manifest: null, errors: [...errors, 'gates must be an object']};
  }
  rejectUnknownKeys(value.gates, LAUNCH_GATE_IDS, 'gates', errors);
  for (const gateId of LAUNCH_GATE_IDS) {
    if (!(gateId in value.gates)) errors.push(`gates.${gateId} is missing`);
  }

  const parsedGates = {} as Record<
    LaunchGateId,
    {description: string; dependencies: LaunchGateId[]; events: LaunchGateLifecycleEventV3[]}
  >;
  const eventIds = new Set<string>();
  const decisionIds = new Set<string>();
  const evidenceReferences = new Set<string>();

  for (const gateId of LAUNCH_GATE_IDS) {
    const gateValue = value.gates[gateId];
    const prefix = `gates.${gateId}`;
    if (!isObject(gateValue)) {
      errors.push(`${prefix} must be an object`);
      parsedGates[gateId] = {
        description: '',
        dependencies: [],
        events: [],
      };
      continue;
    }
    rejectUnknownKeys(gateValue, ['description', 'dependencies', 'events'], prefix, errors);
    const description =
      typeof gateValue.description === 'string' ? gateValue.description : '';
    if (description.trim().length < 20 || description.length > 500) {
      errors.push(`${prefix}.description must be a substantive bounded string`);
    }
    const dependencies = stringArray(
      gateValue.dependencies,
      `${prefix}.dependencies`,
      errors,
    );
    const expectedDependencies = LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId];
    if (!arraysEqual(dependencies, expectedDependencies)) {
      errors.push(
        `${prefix}.dependencies must exactly equal [${expectedDependencies.join(', ')}]`,
      );
    }
    if (!Array.isArray(gateValue.events) || gateValue.events.length === 0) {
      errors.push(`${prefix}.events must be a non-empty array`);
    }
    const events: LaunchGateLifecycleEventV3[] = [];
    if (Array.isArray(gateValue.events)) {
      for (const [index, eventValue] of gateValue.events.entries()) {
        const eventField = `${prefix}.events[${index}]`;
        const event = parseEvent(eventValue, gateId, eventField, errors);
        if (event === null) continue;
        validateEventStateContract(gateId, event, eventField, nowMs, errors);
        if (isCanonicalUtcTimestamp(updatedAt) && Date.parse(event.occurredAt) > Date.parse(updatedAt)) {
          errors.push(`${eventField}.occurredAt must not be later than updatedAt`);
        }
        const previous = events.at(-1) ?? null;
        validateTypedTransition(gateId, previous, event, eventField, errors);
        if (eventIds.has(event.eventId)) {
          errors.push(`${eventField}.eventId must be globally unique`);
        }
        eventIds.add(event.eventId);
        if (event.decision !== null) {
          if (decisionIds.has(event.decision.decisionId)) {
            errors.push(`${eventField}.decision.decisionId must be globally unique`);
          }
          decisionIds.add(event.decision.decisionId);
        }
        for (const [evidenceIndex, evidence] of event.evidence.entries()) {
          if (evidenceReferences.has(evidence.reference)) {
            errors.push(
              `${eventField}.evidence[${evidenceIndex}].reference must be globally unique`,
            );
          }
          evidenceReferences.add(evidence.reference);
        }
        events.push(event);
      }
    }
    parsedGates[gateId] = {
      description,
      dependencies: dependencies.filter(isGateId),
      events,
    };
  }

  const manifest: ParsedManifest = {
    schemaVersion: 3,
    updatedAt,
    gates: parsedGates,
  };

  if (errors.length === 0) {
    for (const gateId of LAUNCH_GATE_IDS) {
      for (const [index, event] of manifest.gates[gateId].events.entries()) {
        if (!isResolvedStatus(event.to)) continue;
        const atMs = Date.parse(event.occurredAt);
        const cache = new Map<LaunchGateId, boolean>();
        for (const dependency of LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId]) {
          if (!isSatisfiedAt(manifest, dependency, atMs, cache)) {
            errors.push(
              `gates.${gateId}.events[${index}] resolves while dependency ${dependency} is not satisfied`,
            );
          }
        }
        const contactLocal = localStatusAt(manifest, 'contactIntake', atMs);
        const expectedKinds = expectedEvidenceKinds(
          gateId,
          event.to,
          contactLocal.effectiveStatus === 'approved' ||
            contactLocal.effectiveStatus === 'disabled'
            ? contactLocal.effectiveStatus
            : undefined,
        );
        const actualKinds = event.evidence.map(({kind}) => kind);
        if (expectedKinds === null || !arraysEqual(actualKinds, expectedKinds)) {
          errors.push(
            `gates.${gateId}.events[${index}].evidence kinds do not match the resolved path`,
          );
        }
      }
    }
  }
  return {manifest: errors.length === 0 ? manifest : null, errors};
}

export function validateLaunchGateLifecycleManifestV3(
  value: unknown,
  options: LaunchGateLifecycleValidationOptionsV3 = {},
): string[] {
  return parseManifest(value, options).errors;
}

export function validateLaunchGateManifestTransitionV3(
  previousValue: unknown,
  nextValue: unknown,
  options: LaunchGateLifecycleValidationOptionsV3 = {},
): string[] {
  const previousResult = parseManifest(previousValue, options);
  const nextResult = parseManifest(nextValue, options);
  const errors = [
    ...previousResult.errors.map((error) => `previous ${error}`),
    ...nextResult.errors.map((error) => `next ${error}`),
  ];
  const previousGates =
    isObject(previousValue) && isObject(previousValue.gates)
      ? previousValue.gates
      : null;
  const nextGates =
    isObject(nextValue) && isObject(nextValue.gates) ? nextValue.gates : null;
  let additions = 0;
  if (previousGates !== null && nextGates !== null) {
    for (const gateId of LAUNCH_GATE_IDS) {
      const previousGate = previousGates[gateId];
      const nextGate = nextGates[gateId];
      if (!isObject(previousGate) || !isObject(nextGate)) continue;
      if (nextGate.description !== previousGate.description) {
        errors.push(
          `next gates.${gateId}.description must exactly preserve the previous policy text`,
        );
      }
      if (!Array.isArray(previousGate.events) || !Array.isArray(nextGate.events)) {
        continue;
      }
      if (nextGate.events.length < previousGate.events.length) {
        errors.push(`next gates.${gateId}.events must not delete lifecycle events`);
      }
      for (const [index, previousEvent] of previousGate.events.entries()) {
        if (JSON.stringify(nextGate.events[index]) !== JSON.stringify(previousEvent)) {
          errors.push(
            `next gates.${gateId}.events[${index}] must exactly preserve the previous event`,
          );
        }
      }
      additions += Math.max(0, nextGate.events.length - previousGate.events.length);
    }
  }
  if (
    isObject(previousValue) &&
    isObject(nextValue) &&
    isCanonicalUtcTimestamp(previousValue.updatedAt) &&
    isCanonicalUtcTimestamp(nextValue.updatedAt)
  ) {
    const previousUpdatedAtMs = Date.parse(previousValue.updatedAt);
    const nextUpdatedAtMs = Date.parse(nextValue.updatedAt);
    if (nextUpdatedAtMs < previousUpdatedAtMs) {
      errors.push('next updatedAt must not be earlier than previous updatedAt');
    }
    if (additions > 0 && nextUpdatedAtMs <= previousUpdatedAtMs) {
      errors.push('next updatedAt must advance when lifecycle events are appended');
    }
    if (additions === 0 && nextUpdatedAtMs !== previousUpdatedAtMs) {
      errors.push('next updatedAt must remain unchanged when no lifecycle event is appended');
    }
  }
  return errors;
}

function closedGate(gateId: LaunchGateId, reason: string): ResolvedLaunchGateV3 {
  return {
    gateId,
    declaredStatus: null,
    effectiveStatus: 'revoked',
    targetStatus: null,
    candidate: null,
    validUntil: null,
    decision: null,
    evidence: [],
    expired: false,
    explicitlyRevoked: false,
    locallySatisfied: false,
    dependenciesSatisfied: false,
    satisfied: false,
    active: false,
    failureReasons: [reason],
  };
}

export function resolveLaunchGateCapabilitiesV3(
  value: unknown,
  options: LaunchGateLifecycleValidationOptionsV3 = {},
): LaunchGateLifecycleResolutionV3 {
  const {nowMs} = validateNow(options);
  const {manifest, errors} = parseManifest(value, options);
  if (manifest === null) {
    return {
      valid: false,
      errors,
      gates: Object.fromEntries(
        LAUNCH_GATE_IDS.map((gateId) => [gateId, closedGate(gateId, 'invalid manifest')]),
      ) as Record<LaunchGateId, ResolvedLaunchGateV3>,
      capabilities: {
        publishLegal: false,
        enableContactIntake: false,
        publishDemos: false,
        executeLegacyCutover: false,
        declareProductionLaunch: false,
      },
    };
  }

  const gates = {} as Record<LaunchGateId, ResolvedLaunchGateV3>;
  for (const gateId of LAUNCH_GATE_IDS) {
    const local = localStatusAt(manifest, gateId, nowMs);
    const dependencyCache = new Map<LaunchGateId, boolean>();
    const dependenciesSatisfied =
      LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId].every(
        (dependency) =>
          isSatisfiedAt(manifest, dependency, nowMs, dependencyCache) &&
          dependencyDecisionLineageSatisfiedAt(
            manifest,
            local.event,
            dependency,
            nowMs,
          ),
      );
    const satisfied = local.locallySatisfied && dependenciesSatisfied;
    const failureReasons: string[] = [];
    if (local.expired) failureReasons.push('decision or evidence validity expired');
    if (!local.locallySatisfied && !local.expired) {
      failureReasons.push(`effective status ${local.effectiveStatus} is not resolved`);
    }
    if (!dependenciesSatisfied) {
      failureReasons.push(
        'one or more dependencies are closed or no longer on the authorized decision lineage',
      );
    }
    gates[gateId] = {
      gateId,
      declaredStatus: local.event?.to ?? null,
      effectiveStatus: local.effectiveStatus,
      targetStatus: local.event?.targetStatus ?? null,
      candidate:
        local.event?.decision?.candidate ??
        local.event?.candidate ??
        null,
      validUntil: local.event?.validUntil ?? null,
      decision: local.event?.decision ?? null,
      evidence: local.event?.evidence ?? [],
      expired: local.expired,
      explicitlyRevoked: local.event?.to === 'revoked',
      locallySatisfied: local.locallySatisfied,
      dependenciesSatisfied,
      satisfied,
      active: local.active && dependenciesSatisfied,
      failureReasons,
    };
  }

  return {
    valid: true,
    errors: [],
    gates,
    capabilities: {
      publishLegal: gates.legalPublication.active,
      enableContactIntake: gates.contactIntake.active,
      publishDemos: gates.demoPublication.active,
      executeLegacyCutover: gates.legacyCutover.active,
      declareProductionLaunch: gates.productionLaunch.active,
    },
  };
}

function validateV2HoldingManifest(
  value: unknown,
  nowMs: number,
): {
  value: {
    updatedAt: string;
    gates: Record<LaunchGateId, {description: string; dependencies: LaunchGateId[]}>;
  } | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isObject(value)) return {value: null, errors: ['v2 manifest must be an object']};
  rejectUnknownKeys(value, ['schemaVersion', 'updatedAt', 'gates'], 'v2 manifest', errors);
  if (value.schemaVersion !== 2) errors.push('v2 manifest schemaVersion must be 2');
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  if (!isCanonicalUtcTimestamp(updatedAt)) {
    errors.push('v2 manifest updatedAt must be a canonical UTC timestamp');
  } else if (Date.parse(updatedAt) > nowMs) {
    errors.push('v2 manifest updatedAt must not be in the future');
  }
  if (!isObject(value.gates)) {
    return {value: null, errors: [...errors, 'v2 manifest gates must be an object']};
  }
  rejectUnknownKeys(value.gates, LAUNCH_GATE_IDS, 'v2 gates', errors);
  const gates = {} as Record<
    LaunchGateId,
    {description: string; dependencies: LaunchGateId[]}
  >;
  for (const gateId of LAUNCH_GATE_IDS) {
    const gate = value.gates[gateId];
    const prefix = `v2 gates.${gateId}`;
    if (!isObject(gate)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    rejectUnknownKeys(
      gate,
      ['description', 'status', 'dependencies', 'approval', 'evidence', 'blockerRefs'],
      prefix,
      errors,
    );
    const description = typeof gate.description === 'string' ? gate.description : '';
    if (description.trim().length < 20 || description.length > 500) {
      errors.push(`${prefix}.description must be a substantive bounded string`);
    }
    const dependencies = stringArray(gate.dependencies, `${prefix}.dependencies`, errors);
    if (!arraysEqual(dependencies, LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId])) {
      errors.push(`${prefix}.dependencies do not match the fixed v3 graph`);
    }
    if (gate.status !== 'holding') {
      errors.push(
        `${prefix}.status must be holding; resolved v2 state cannot be migrated without audited history`,
      );
    }
    if (gate.approval !== null) errors.push(`${prefix}.approval must be null`);
    if (!Array.isArray(gate.evidence) || gate.evidence.length !== 0) {
      errors.push(`${prefix}.evidence must be empty`);
    }
    const blockerRefs = stringArray(gate.blockerRefs, `${prefix}.blockerRefs`, errors);
    if (!arraysEqual(blockerRefs, V2_BLOCKER_REFS[gateId])) {
      errors.push(`${prefix}.blockerRefs do not match the fixed holding contract`);
    }
    gates[gateId] = {
      description,
      dependencies: dependencies.filter(isGateId),
    };
  }
  return {
    value: errors.length === 0 ? {updatedAt, gates} : null,
    errors,
  };
}

export function migrateLaunchGateManifestV2ToV3(
  value: unknown,
  options: LaunchGateLifecycleValidationOptionsV3 = {},
): LaunchGateV2MigrationResult {
  const now = validateNow(options);
  if (now.errors.length > 0) return {manifest: null, errors: now.errors};
  const migrated = validateV2HoldingManifest(value, now.nowMs);
  if (migrated.value === null) return {manifest: null, errors: migrated.errors};
  const {updatedAt} = migrated.value;
  const gates = {} as Record<
    LaunchGateId,
    LaunchGateLifecycleManifestV3['gates'][LaunchGateId]
  >;
  for (const gateId of LAUNCH_GATE_IDS) {
    gates[gateId] = {
      description: migrated.value.gates[gateId].description,
      dependencies: [...LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId]],
      events: [
        {
          eventId: `v2-${gateId.toLowerCase()}-holding`,
          transition: 'initialize',
          from: null,
          to: 'holding',
          targetStatus: null,
          candidate: null,
          occurredAt: updatedAt,
          validUntil: null,
          previousEventId: null,
          supersedes: null,
          decision: null,
          evidence: [],
        },
      ],
    };
  }
  const manifest: LaunchGateLifecycleManifestV3 = {
    schemaVersion: 3,
    updatedAt,
    gates,
  };
  const errors = validateLaunchGateLifecycleManifestV3(manifest, {nowMs: now.nowMs});
  return errors.length === 0 ? {manifest, errors: []} : {manifest: null, errors};
}
