import {LAUNCH_GATE_IDS, type LaunchGateId} from './launch-gate-ids';

type JsonObject = Record<string, unknown>;

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

function isCanonicalUtcTimestamp(value: unknown): value is string {
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

function repositoryReferences(value: unknown, field: string, errors: string[]): string[] {
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

export function validateLaunchGateManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ['manifest must be an object'];
  rejectUnknownKeys(value, ['schemaVersion', 'updatedAt', 'gates'], 'manifest', errors);
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!isCanonicalUtcTimestamp(value.updatedAt)) {
    errors.push('updatedAt must be a canonical UTC timestamp with milliseconds');
  }
  if (!isObject(value.gates)) {
    errors.push('gates must be an object');
    return errors;
  }

  const expectedIds = new Set<string>(LAUNCH_GATE_IDS);
  const actualIds = Object.keys(value.gates);
  for (const id of LAUNCH_GATE_IDS) {
    if (!(id in value.gates)) errors.push(`gates.${id} is missing`);
  }
  for (const id of actualIds) {
    if (!expectedIds.has(id)) errors.push(`gates.${id} is not a recognized launch gate`);
  }

  const dependenciesByGate = new Map<LaunchGateId, string[]>();
  const statuses = new Map<LaunchGateId, unknown>();

  for (const id of LAUNCH_GATE_IDS) {
    const gate = value.gates[id];
    if (!isObject(gate)) {
      errors.push(`gates.${id} must be an object`);
      continue;
    }
    const prefix = `gates.${id}`;
    rejectUnknownKeys(
      gate,
      [
        'description',
        'status',
        'dependencies',
        'approval',
        'evidenceRefs',
        'blockerRefs',
      ],
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
    dependenciesByGate.set(id, dependencies);
    for (const dependency of dependencies) {
      if (!expectedIds.has(dependency)) {
        errors.push(`${prefix}.dependencies contains unknown gate ${dependency}`);
      }
      if (dependency === id) errors.push(`${prefix} cannot depend on itself`);
    }

    const evidenceRefs = repositoryReferences(gate.evidenceRefs, `${prefix}.evidenceRefs`, errors);
    const blockerRefs = repositoryReferences(gate.blockerRefs, `${prefix}.blockerRefs`, errors);

    if (gate.status === 'holding') {
      if (gate.approval !== null) errors.push(`${prefix}.approval must be null while holding`);
      if (blockerRefs.length === 0) errors.push(`${prefix}.blockerRefs must identify an open decision`);
    }

    if (gate.status === 'approved') {
      if (!isObject(gate.approval)) {
        errors.push(`${prefix}.approval must identify the approver and approval time`);
      } else {
        rejectUnknownKeys(
          gate.approval,
          ['approver', 'approvedAt'],
          `${prefix}.approval`,
          errors,
        );
        if (typeof gate.approval.approver !== 'string' || !gate.approval.approver.trim()) {
          errors.push(`${prefix}.approval.approver must be a non-empty string`);
        }
        if (!isCanonicalUtcTimestamp(gate.approval.approvedAt)) {
          errors.push(`${prefix}.approval.approvedAt must be a canonical UTC timestamp`);
        }
      }
      if (evidenceRefs.length === 0) errors.push(`${prefix}.evidenceRefs must retain approval evidence`);
      if (blockerRefs.length > 0) errors.push(`${prefix}.blockerRefs must be empty when approved`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: LaunchGateId) {
    if (visiting.has(id)) {
      errors.push(`launch gate dependency cycle includes ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependenciesByGate.get(id) ?? []) {
      if (expectedIds.has(dependency)) visit(dependency as LaunchGateId);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of LAUNCH_GATE_IDS) visit(id);

  for (const id of LAUNCH_GATE_IDS) {
    if (statuses.get(id) !== 'approved') continue;
    for (const dependency of dependenciesByGate.get(id) ?? []) {
      if (statuses.get(dependency as LaunchGateId) !== 'approved') {
        errors.push(`gates.${id} is approved while dependency ${dependency} is not approved`);
      }
    }
  }

  return [...new Set(errors)];
}
