import {LAUNCH_GATE_IDS, type LaunchGateId} from './launch-gate-ids';
import {
  LAUNCH_GATE_AUTHORITY_ROLES,
  LAUNCH_GATE_BLOCKER_REFS,
  LAUNCH_GATE_DEPENDENCIES,
  LAUNCH_GATE_REQUIRED_EVIDENCE,
  type LaunchGateEvidenceKind,
} from './launch-gate-policy';
import {inspectForSensitiveContent} from './sensitive-content';
import {validateHoldingOnlyLaunchGateManifest} from './launch-gate-transition-lock.js';
import {validateLaunchGateLifecycleManifestV3} from './launch-gate-lifecycle-v3';

type JsonObject = Record<string, unknown>;

type ParsedEvidenceReference = {
  kind: string;
  reference: string;
  sha256: string;
  observedAt: string;
};

export type LaunchGateManifestValidationOptions = {
  nowMs?: number;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const EVIDENCE_REFERENCE_PATTERN =
  /^docs\/evidence\/launch-gates\/[a-z0-9][a-z0-9._-]*\.json$/u;
const PLACEHOLDER_PATTERN =
  /\b(?:pending|tbd|to be determined|unknown|placeholder|authorized reviewer|named owner|test|testing|fixture|sample|example|dummy|n\/?a|none)\b/iu;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: JsonObject,
  allowed: readonly string[],
  field: string,
  errors: string[],
) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${field} contains unknown field ${key}`);
  }
}

export function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function stringArray(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    errors.push(`${field} must be an array of strings`);
    return [];
  }
  if (new Set(value).size !== value.length) errors.push(`${field} must not contain duplicates`);
  return value;
}

function arraysEqual(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function repositoryBlockerReferences(
  value: unknown,
  field: string,
  errors: string[],
): string[] {
  const references = stringArray(value, field, errors);
  for (const reference of references) {
    if (
      reference.startsWith('/') ||
      reference.includes('..') ||
      !/^docs\/[A-Za-z0-9_./-]+\.md$/u.test(reference)
    ) {
      errors.push(`${field} contains unsafe or unsupported reference ${reference}`);
    }
  }
  return references;
}

function parseEvidenceReferences(
  value: unknown,
  field: string,
  errors: string[],
): ParsedEvidenceReference[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const parsed: ParsedEvidenceReference[] = [];
  for (const [index, entry] of value.entries()) {
    const prefix = `${field}[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    rejectUnknownKeys(
      entry,
      ['kind', 'reference', 'sha256', 'observedAt'],
      prefix,
      errors,
    );
    const kind = typeof entry.kind === 'string' ? entry.kind : '';
    const reference = typeof entry.reference === 'string' ? entry.reference : '';
    const sha256 = typeof entry.sha256 === 'string' ? entry.sha256 : '';
    const observedAt = typeof entry.observedAt === 'string' ? entry.observedAt : '';
    if (!kind) errors.push(`${prefix}.kind must be a non-empty string`);
    if (!EVIDENCE_REFERENCE_PATTERN.test(reference)) {
      errors.push(
        `${prefix}.reference must be a file directly under docs/evidence/launch-gates`,
      );
    }
    if (!SHA256_PATTERN.test(sha256)) {
      errors.push(`${prefix}.sha256 must be a lowercase SHA-256`);
    }
    if (!isCanonicalUtcTimestamp(observedAt)) {
      errors.push(`${prefix}.observedAt must be a canonical UTC timestamp`);
    }
    parsed.push({kind, reference, sha256, observedAt});
  }
  const kinds = parsed.map(({kind}) => kind);
  const references = parsed.map(({reference}) => reference);
  if (new Set(kinds).size !== kinds.length) errors.push(`${field} must not repeat a kind`);
  if (new Set(references).size !== references.length) {
    errors.push(`${field} must not repeat a reference`);
  }
  return parsed;
}

function isSubstantiveAuthorityValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.trim().length >= 2 &&
    value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !PLACEHOLDER_PATTERN.test(value)
  );
}

export function validateLaunchGateManifest(
  value: unknown,
  options: LaunchGateManifestValidationOptions = {},
): string[] {
  if (isObject(value) && value.schemaVersion === 3) {
    return validateLaunchGateLifecycleManifestV3(value, options);
  }

  const errors: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  if (!isObject(value)) return ['manifest must be an object'];
  rejectUnknownKeys(value, ['schemaVersion', 'updatedAt', 'gates'], 'manifest', errors);
  if (value.schemaVersion !== 2) errors.push('schemaVersion must be 2');

  const updatedAt = isCanonicalUtcTimestamp(value.updatedAt) ? value.updatedAt : null;
  const updatedAtMs = updatedAt === null ? null : Date.parse(updatedAt);
  if (updatedAt === null) {
    errors.push('updatedAt must be a canonical UTC timestamp with milliseconds');
  } else if ((updatedAtMs as number) > nowMs) {
    errors.push('updatedAt must not be in the future');
  }

  if (!isObject(value.gates)) {
    errors.push('gates must be an object');
    return errors;
  }

  errors.push(...validateHoldingOnlyLaunchGateManifest(value));

  const expectedIds = new Set<string>(LAUNCH_GATE_IDS);
  const actualIds = Object.keys(value.gates);
  for (const id of LAUNCH_GATE_IDS) {
    if (!(id in value.gates)) errors.push(`gates.${id} is missing`);
  }
  for (const id of actualIds) {
    if (!expectedIds.has(id)) errors.push(`gates.${id} is not a recognized launch gate`);
  }

  const statuses = new Map<LaunchGateId, unknown>();
  const approvedAtByGate = new Map<LaunchGateId, number>();
  const evidenceByGate = new Map<LaunchGateId, ParsedEvidenceReference[]>();
  const evidenceReferenceOwners = new Map<string, string>();

  for (const id of LAUNCH_GATE_IDS) {
    const gate = value.gates[id];
    if (!isObject(gate)) {
      errors.push(`gates.${id} must be an object`);
      continue;
    }
    const prefix = `gates.${id}`;
    rejectUnknownKeys(
      gate,
      ['description', 'status', 'dependencies', 'approval', 'evidence', 'blockerRefs'],
      prefix,
      errors,
    );
    if (typeof gate.description !== 'string' || gate.description.trim().length < 20) {
      errors.push(`${prefix}.description must be a substantive string`);
    }
    if (gate.status !== 'holding' && gate.status !== 'approved') {
      errors.push(`${prefix}.status must be holding or approved`);
    }
    statuses.set(id, gate.status);

    const dependencies = stringArray(gate.dependencies, `${prefix}.dependencies`, errors);
    const expectedDependencies = LAUNCH_GATE_DEPENDENCIES[id];
    if (!arraysEqual(dependencies, expectedDependencies)) {
      errors.push(
        `${prefix}.dependencies must exactly equal [${expectedDependencies.join(', ')}]`,
      );
    }

    const evidence = parseEvidenceReferences(gate.evidence, `${prefix}.evidence`, errors);
    evidenceByGate.set(id, evidence);
    const blockerRefs = repositoryBlockerReferences(
      gate.blockerRefs,
      `${prefix}.blockerRefs`,
      errors,
    );

    for (const entry of evidence) {
      const priorOwner = evidenceReferenceOwners.get(entry.reference);
      if (priorOwner) {
        errors.push(
          `${prefix}.evidence reference ${entry.reference} is already used by ${priorOwner}`,
        );
      } else {
        evidenceReferenceOwners.set(entry.reference, `${prefix}.evidence`);
      }
    }

    if (gate.status === 'holding') {
      if (gate.approval !== null) errors.push(`${prefix}.approval must be null while holding`);
      if (evidence.length > 0) errors.push(`${prefix}.evidence must be empty while holding`);
      const expectedBlockers = LAUNCH_GATE_BLOCKER_REFS[id];
      if (!arraysEqual(blockerRefs, expectedBlockers)) {
        errors.push(
          `${prefix}.blockerRefs must exactly equal [${expectedBlockers.join(', ')}] while holding`,
        );
      }
    }

    if (gate.status === 'approved') {
      let approvedAtMs: number | null = null;
      if (!isObject(gate.approval)) {
        errors.push(`${prefix}.approval must identify the approver and approval time`);
      } else {
        rejectUnknownKeys(
          gate.approval,
          ['approvedBy', 'approvedAt'],
          `${prefix}.approval`,
          errors,
        );
        if (!isObject(gate.approval.approvedBy)) {
          errors.push(`${prefix}.approval.approvedBy must be an object`);
        } else {
          rejectUnknownKeys(
            gate.approval.approvedBy,
            ['name', 'authorityRole', 'organization'],
            `${prefix}.approval.approvedBy`,
            errors,
          );
          if (!isSubstantiveAuthorityValue(gate.approval.approvedBy.name)) {
            errors.push(`${prefix}.approval.approvedBy.name must identify a non-placeholder approver`);
          }
          if (gate.approval.approvedBy.authorityRole !== LAUNCH_GATE_AUTHORITY_ROLES[id]) {
            errors.push(
              `${prefix}.approval.approvedBy.authorityRole must be ${LAUNCH_GATE_AUTHORITY_ROLES[id]}`,
            );
          }
          if (!isSubstantiveAuthorityValue(gate.approval.approvedBy.organization)) {
            errors.push(
              `${prefix}.approval.approvedBy.organization must identify a non-placeholder organization`,
            );
          }
        }
        if (!isCanonicalUtcTimestamp(gate.approval.approvedAt)) {
          errors.push(`${prefix}.approval.approvedAt must be a canonical UTC timestamp`);
        } else {
          approvedAtMs = Date.parse(gate.approval.approvedAt);
          approvedAtByGate.set(id, approvedAtMs);
          if (approvedAtMs > nowMs) {
            errors.push(`${prefix}.approval.approvedAt must not be in the future`);
          }
          if (updatedAtMs !== null && approvedAtMs > updatedAtMs) {
            errors.push(`${prefix}.approval.approvedAt must not be later than updatedAt`);
          }
        }
      }

      const expectedKinds = LAUNCH_GATE_REQUIRED_EVIDENCE[id] as readonly LaunchGateEvidenceKind[];
      if (!arraysEqual(evidence.map(({kind}) => kind), expectedKinds)) {
        errors.push(
          `${prefix}.evidence kinds must exactly equal [${expectedKinds.join(', ')}]`,
        );
      }
      if (blockerRefs.length > 0) {
        errors.push(`${prefix}.blockerRefs must be empty when approved`);
      }
      for (const [index, entry] of evidence.entries()) {
        if (!isCanonicalUtcTimestamp(entry.observedAt)) continue;
        const observedAtMs = Date.parse(entry.observedAt);
        if (observedAtMs > nowMs) {
          errors.push(`${prefix}.evidence[${index}].observedAt must not be in the future`);
        }
        if (updatedAtMs !== null && observedAtMs > updatedAtMs) {
          errors.push(`${prefix}.evidence[${index}].observedAt must not be later than updatedAt`);
        }
        if (approvedAtMs !== null && observedAtMs > approvedAtMs) {
          errors.push(
            `${prefix}.evidence[${index}].observedAt must not be later than approvedAt`,
          );
        }
      }
    }
  }

  for (const id of LAUNCH_GATE_IDS) {
    if (statuses.get(id) !== 'approved') continue;
    const approvedAtMs = approvedAtByGate.get(id);
    const evidence = evidenceByGate.get(id) ?? [];
    for (const dependency of LAUNCH_GATE_DEPENDENCIES[id]) {
      if (statuses.get(dependency) !== 'approved') {
        errors.push(`gates.${id} is approved while dependency ${dependency} is not approved`);
        continue;
      }
      const dependencyApprovedAtMs = approvedAtByGate.get(dependency);
      if (
        approvedAtMs !== undefined &&
        dependencyApprovedAtMs !== undefined &&
        dependencyApprovedAtMs > approvedAtMs
      ) {
        errors.push(
          `gates.${id}.approval.approvedAt must not be earlier than dependency ${dependency}`,
        );
      }
      if (dependencyApprovedAtMs !== undefined) {
        for (const [index, entry] of evidence.entries()) {
          if (
            isCanonicalUtcTimestamp(entry.observedAt) &&
            Date.parse(entry.observedAt) < dependencyApprovedAtMs
          ) {
            errors.push(
              `gates.${id}.evidence[${index}].observedAt must not be earlier than dependency ${dependency}`,
            );
          }
        }
      }
    }
    for (let index = 1; index < evidence.length; index += 1) {
      const prior = evidence[index - 1];
      const current = evidence[index];
      if (
        isCanonicalUtcTimestamp(prior.observedAt) &&
        isCanonicalUtcTimestamp(current.observedAt) &&
        Date.parse(current.observedAt) < Date.parse(prior.observedAt)
      ) {
        errors.push(
          `gates.${id}.evidence[${index}].observedAt must not be earlier than the preceding evidence item`,
        );
      }
    }
  }

  inspectForSensitiveContent(value, 'manifest', errors);
  return [...new Set(errors)];
}
