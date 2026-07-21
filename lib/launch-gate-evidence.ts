import {createHash} from 'node:crypto';
import {lstat, readFile, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';

import type {LaunchGateId} from './launch-gate-ids';
import {
  LAUNCH_GATE_EVIDENCE_CHECKS,
  LAUNCH_GATE_EVIDENCE_REQUIRES_DEPLOYMENT,
  LAUNCH_GATE_SUBJECT_PATHS,
  type LaunchGateEvidenceKind,
} from './launch-gate-policy';
import {isCanonicalUtcTimestamp} from './launch-gate-validation';
import {inspectForSensitiveContent} from './sensitive-content';

type JsonObject = Record<string, unknown>;

export type LaunchGateEvidenceReference = {
  kind: LaunchGateEvidenceKind;
  reference: string;
  sha256: string;
  observedAt: string;
};

export type LaunchGateApproval = {
  approvedBy: {
    name: string;
    authorityRole: string;
    organization: string;
  };
  approvedAt: string;
};

type ExpectedEvidence = LaunchGateEvidenceReference & {
  gateId: LaunchGateId;
  approval: LaunchGateApproval;
};

type EvidenceValidationOptions = ExpectedEvidence & {
  nowMs?: number;
};

type EvidenceFileVerificationOptions = ExpectedEvidence & {
  repositoryRoot: string;
  nowMs?: number;
  maxBytes?: number;
  subjectPaths?: readonly string[];
  repositoryContentSha256?: string;
};

export type LaunchGateEvidenceFileVerification = {
  reference: string;
  expectedSha256: string;
  actualSha256: string | null;
  bytes: number | null;
  errors: string[];
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REPOSITORY_COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const VERCEL_DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]{20,}$/u;
const EVIDENCE_REFERENCE_PATTERN =
  /^docs\/evidence\/launch-gates\/[a-z0-9][a-z0-9._-]*\.json$/u;

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

function substantiveString(
  value: unknown,
  field: string,
  errors: string[],
  maxLength = 500,
): value is string {
  if (
    typeof value !== 'string' ||
    value.trim().length < 2 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    errors.push(`${field} must be a substantive bounded string`);
    return false;
  }
  return true;
}

export function isLaunchGateEvidenceReference(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_REFERENCE_PATTERN.test(value);
}

export type LaunchGateSubjectDigest = {
  sha256: string;
  files: number;
  bytes: number;
};

export async function computeLaunchGateSubjectDigest(
  repositoryRootInput: string,
  subjectPaths: readonly string[] = LAUNCH_GATE_SUBJECT_PATHS,
): Promise<LaunchGateSubjectDigest> {
  const repositoryRoot = await realpath(repositoryRootInput);
  const files = new Map<string, string>();

  async function collect(absolutePath: string) {
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error(`launch-gate subject path must not be symbolic: ${absolutePath}`);
    }
    if (metadata.isDirectory()) {
      const entries = await readdir(absolutePath);
      entries.sort((left, right) => left.localeCompare(right, 'en'));
      for (const entry of entries) await collect(path.join(absolutePath, entry));
      return;
    }
    if (!metadata.isFile()) {
      throw new Error(`launch-gate subject path must be a regular file: ${absolutePath}`);
    }
    const canonicalPath = await realpath(absolutePath);
    if (!isInside(repositoryRoot, canonicalPath)) {
      throw new Error(`launch-gate subject path resolves outside the repository: ${absolutePath}`);
    }
    const relativePath = path.relative(repositoryRoot, canonicalPath).split(path.sep).join('/');
    files.set(relativePath, canonicalPath);
  }

  for (const subjectPath of subjectPaths) {
    if (
      subjectPath.startsWith('/') ||
      subjectPath.includes('..') ||
      !/^[A-Za-z0-9_./-]+$/u.test(subjectPath)
    ) {
      throw new Error(`unsafe launch-gate subject path: ${subjectPath}`);
    }
    await collect(path.resolve(repositoryRoot, subjectPath));
  }

  const orderedFiles = [...files.entries()].sort(([left], [right]) =>
    left.localeCompare(right, 'en'),
  );
  if (orderedFiles.length < 1 || orderedFiles.length > 10_000) {
    throw new Error('launch-gate subject file count is outside the supported range');
  }
  const digest = createHash('sha256');
  let totalBytes = 0;
  for (const [relativePath, canonicalPath] of orderedFiles) {
    const bytes = await readFile(canonicalPath);
    totalBytes += bytes.length;
    if (totalBytes > 250 * 1024 * 1024) {
      throw new Error('launch-gate subject bytes exceed the supported maximum');
    }
    digest.update(`${Buffer.byteLength(relativePath)}:${relativePath}:${bytes.length}:`);
    digest.update(bytes);
    digest.update('\n');
  }
  return {sha256: digest.digest('hex'), files: orderedFiles.length, bytes: totalBytes};
}

export function validateLaunchGateEvidenceEnvelope(
  value: unknown,
  options: EvidenceValidationOptions,
): string[] {
  const errors: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  if (!isObject(value)) return ['evidence envelope must be an object'];
  if (!Object.hasOwn(LAUNCH_GATE_EVIDENCE_CHECKS, options.kind)) {
    return [`unsupported launch-gate evidence kind ${String(options.kind)}`];
  }
  rejectUnknownKeys(
    value,
    [
      'schemaVersion',
      'gateId',
      'evidenceKind',
      'status',
      'observedAt',
      'approval',
      'subject',
      'underlyingEvidence',
      'checks',
    ],
    'evidence envelope',
    errors,
  );
  if (value.schemaVersion !== 1) errors.push('evidence envelope schemaVersion must be 1');
  if (value.gateId !== options.gateId) {
    errors.push(`evidence envelope gateId must be ${options.gateId}`);
  }
  if (value.evidenceKind !== options.kind) {
    errors.push(`evidence envelope evidenceKind must be ${options.kind}`);
  }
  if (value.status !== 'pass') errors.push('evidence envelope status must be pass');
  if (!isCanonicalUtcTimestamp(value.observedAt)) {
    errors.push('evidence envelope observedAt must be a canonical UTC timestamp');
  } else {
    if (value.observedAt !== options.observedAt) {
      errors.push('evidence envelope observedAt must match the manifest reference');
    }
    if (Date.parse(value.observedAt) > nowMs) {
      errors.push('evidence envelope observedAt must not be in the future');
    }
  }

  if (!isObject(value.approval)) {
    errors.push('evidence envelope approval must be an object');
  } else {
    rejectUnknownKeys(
      value.approval,
      ['approvedBy', 'approvedAt'],
      'evidence envelope approval',
      errors,
    );
    if (!isObject(value.approval.approvedBy)) {
      errors.push('evidence envelope approval.approvedBy must be an object');
    } else {
      rejectUnknownKeys(
        value.approval.approvedBy,
        ['name', 'authorityRole', 'organization'],
        'evidence envelope approval.approvedBy',
        errors,
      );
      if (value.approval.approvedBy.name !== options.approval.approvedBy.name) {
        errors.push('evidence envelope approval.approvedBy.name must match the manifest');
      }
      if (
        value.approval.approvedBy.authorityRole !==
        options.approval.approvedBy.authorityRole
      ) {
        errors.push('evidence envelope approval.approvedBy.authorityRole must match the manifest');
      }
      if (
        value.approval.approvedBy.organization !==
        options.approval.approvedBy.organization
      ) {
        errors.push('evidence envelope approval.approvedBy.organization must match the manifest');
      }
    }
    if (value.approval.approvedAt !== options.approval.approvedAt) {
      errors.push('evidence envelope approval.approvedAt must match the manifest');
    }
  }

  if (!isObject(value.subject)) {
    errors.push('evidence envelope subject must be an object');
  } else {
    rejectUnknownKeys(
      value.subject,
      ['repositoryCommit', 'repositoryContentSha256', 'vercelDeploymentId'],
      'evidence envelope subject',
      errors,
    );
    if (
      typeof value.subject.repositoryCommit !== 'string' ||
      !REPOSITORY_COMMIT_PATTERN.test(value.subject.repositoryCommit) ||
      value.subject.repositoryCommit === '0'.repeat(40)
    ) {
      errors.push('evidence envelope subject.repositoryCommit must be a nonzero lowercase 40-character Git SHA');
    }
    if (
      typeof value.subject.repositoryContentSha256 !== 'string' ||
      !SHA256_PATTERN.test(value.subject.repositoryContentSha256)
    ) {
      errors.push('evidence envelope subject.repositoryContentSha256 must be a lowercase SHA-256');
    }
    const deploymentId = value.subject.vercelDeploymentId;
    if (LAUNCH_GATE_EVIDENCE_REQUIRES_DEPLOYMENT[options.kind]) {
      if (typeof deploymentId !== 'string' || !VERCEL_DEPLOYMENT_PATTERN.test(deploymentId)) {
        errors.push('evidence envelope subject.vercelDeploymentId must identify a Vercel deployment');
      }
    } else if (
      deploymentId !== null &&
      (typeof deploymentId !== 'string' || !VERCEL_DEPLOYMENT_PATTERN.test(deploymentId))
    ) {
      errors.push('evidence envelope subject.vercelDeploymentId must be null or a Vercel deployment ID');
    }
  }

  if (!isObject(value.underlyingEvidence)) {
    errors.push('evidence envelope underlyingEvidence must be an object');
  } else {
    rejectUnknownKeys(
      value.underlyingEvidence,
      ['system', 'reference', 'sha256', 'bytes'],
      'evidence envelope underlyingEvidence',
      errors,
    );
    substantiveString(
      value.underlyingEvidence.system,
      'evidence envelope underlyingEvidence.system',
      errors,
      100,
    );
    substantiveString(
      value.underlyingEvidence.reference,
      'evidence envelope underlyingEvidence.reference',
      errors,
    );
    if (
      typeof value.underlyingEvidence.sha256 !== 'string' ||
      !SHA256_PATTERN.test(value.underlyingEvidence.sha256)
    ) {
      errors.push('evidence envelope underlyingEvidence.sha256 must be a lowercase SHA-256');
    }
    if (
      !Number.isSafeInteger(value.underlyingEvidence.bytes) ||
      (value.underlyingEvidence.bytes as number) < 1
    ) {
      errors.push('evidence envelope underlyingEvidence.bytes must be a positive safe integer');
    }
  }

  if (!isObject(value.checks)) {
    errors.push('evidence envelope checks must be an object');
  } else {
    const expectedChecks = LAUNCH_GATE_EVIDENCE_CHECKS[options.kind];
    rejectUnknownKeys(value.checks, expectedChecks, 'evidence envelope checks', errors);
    for (const check of expectedChecks) {
      if (value.checks[check] !== true) {
        errors.push(`evidence envelope checks.${check} must be true`);
      }
    }
  }

  inspectForSensitiveContent(value, 'evidence envelope', errors);
  return [...new Set(errors)];
}

function isInside(root: string, candidate: string): boolean {
  return candidate.startsWith(`${root}${path.sep}`);
}

export async function verifyLaunchGateEvidenceFile(
  options: EvidenceFileVerificationOptions,
): Promise<LaunchGateEvidenceFileVerification> {
  const errors: string[] = [];
  const result: LaunchGateEvidenceFileVerification = {
    reference: options.reference,
    expectedSha256: options.sha256,
    actualSha256: null,
    bytes: null,
    errors,
  };
  if (!isLaunchGateEvidenceReference(options.reference)) {
    errors.push(`unsupported launch-gate evidence reference ${options.reference}`);
    return result;
  }

  const repositoryRoot = await realpath(options.repositoryRoot);
  const resolved = path.resolve(repositoryRoot, options.reference);
  if (!isInside(repositoryRoot, resolved)) {
    errors.push(`launch-gate evidence reference escapes the repository: ${options.reference}`);
    return result;
  }

  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch {
    errors.push(`launch-gate evidence file does not exist: ${options.reference}`);
    return result;
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    errors.push(`launch-gate evidence must be a regular non-symbolic file: ${options.reference}`);
    return result;
  }
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  if (metadata.size < 1 || metadata.size > maxBytes) {
    errors.push(`launch-gate evidence size must be between 1 and ${maxBytes} bytes: ${options.reference}`);
    return result;
  }

  const canonicalPath = await realpath(resolved);
  if (!isInside(repositoryRoot, canonicalPath)) {
    errors.push(`launch-gate evidence resolves outside the repository: ${options.reference}`);
    return result;
  }

  const bytes = await readFile(canonicalPath);
  result.bytes = bytes.length;
  if (bytes.length < 1 || bytes.length > maxBytes) {
    errors.push(`launch-gate evidence changed to an invalid size while reading: ${options.reference}`);
    return result;
  }
  result.actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (result.actualSha256 !== options.sha256) {
    errors.push(`launch-gate evidence SHA-256 mismatch: ${options.reference}`);
  }

  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    errors.push(`launch-gate evidence is not valid JSON: ${options.reference}`);
    return result;
  }
  const normalizedBytes = `${JSON.stringify(value, null, 2)}\n`;
  if (!bytes.equals(Buffer.from(normalizedBytes))) {
    errors.push(`launch-gate evidence must use normalized two-space JSON: ${options.reference}`);
  }
  errors.push(...validateLaunchGateEvidenceEnvelope(value, options));
  if (isObject(value) && isObject(value.subject)) {
    const recordedDigest = value.subject.repositoryContentSha256;
    if (typeof recordedDigest === 'string' && SHA256_PATTERN.test(recordedDigest)) {
      try {
        const currentDigest = options.repositoryContentSha256 ?? (
          await computeLaunchGateSubjectDigest(options.repositoryRoot, options.subjectPaths)
        ).sha256;
        if (recordedDigest !== currentDigest) {
          errors.push(`launch-gate evidence subject digest does not match the current repository content: ${options.reference}`);
        }
      } catch (error) {
        errors.push(
          `launch-gate evidence subject could not be computed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  result.errors = [...new Set(errors)];
  return result;
}
