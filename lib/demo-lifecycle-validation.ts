type JsonObject = Record<string, unknown>;

export type DemoArtifact = Readonly<{
  path: string;
  sha256: string;
}>;

export type DemoCandidate = Readonly<{
  schemaVersion: 1;
  id: string;
  candidateId: string;
  source: Readonly<{flaSha256: string; swfSha256: string}>;
  movie: Readonly<{
    stage: Readonly<{width: number; height: number}>;
    fps: number;
    frameCount: number;
    durationMs: number;
  }>;
  maturity: 'legacy-prototype' | 'strict-complete';
  validationStatus: 'conditional' | 'strict-complete';
  runtime: Readonly<{
    entry: string;
    globalName: string;
    bundleSha256: string;
  }>;
  artifacts: readonly DemoArtifact[];
  artifactSha256: string;
}>;

export type DemoAcceptance = Readonly<{
  status: 'approved';
  candidateId: string;
  artifactSha256: string;
  evidenceRef: string;
  evidenceSha256: string;
  acceptedAt: string;
  acceptedBy: Readonly<{
    name: string;
    authorityRole: string;
    organization: string;
  }>;
}>;

export type DemoActivation = Readonly<{
  candidateId: string;
  artifactSha256: string;
  approvals: Readonly<{
    privatePreview: Readonly<{
      status: 'approved';
      audience: string;
      purpose: string;
      approvalRef: string;
    }>;
    rightsAcceptance: DemoAcceptance | null;
    productAcceptance: DemoAcceptance | null;
  }>;
  activation: Readonly<{
    active: boolean;
    activatedAt: string | null;
  }>;
}>;

export type DemoActivationManifest = Readonly<{
  schemaVersion: 1;
  updatedAt: string;
  demos: Readonly<Record<string, DemoActivation>>;
}>;

export type DemoActivationValidationOptions = Readonly<{
  candidates: Readonly<Record<string, DemoCandidate>>;
  demoPublicationGateApproved: boolean;
  nowMs?: number;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DEMO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_REPOSITORY_PATH_PATTERN =
  /^(?:components|demos|private-demo-assets|private-demo-runtime)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u;
const EVIDENCE_PATH_PATTERN =
  /^docs\/evidence\/demo-publication\/[a-z0-9][a-z0-9._-]*\.json$/u;
const CANDIDATE_ID_PATTERN =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)--(\d{4}-\d{2}-\d{2})--([a-f0-9]{8})$/u;

const PRIVATE_PREVIEW_APPROVAL = Object.freeze({
  status: 'approved',
  audience: 'CEO and Chairman John Ramo',
  purpose: 'internal JavaScript prototype review',
  approvalRef: 'Project researcher/software engineer request, 2026-07-21',
} as const);

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

function requireExactKeys(
  value: JsonObject,
  expected: readonly string[],
  field: string,
  errors: string[],
) {
  rejectUnknownKeys(value, expected, field, errors);
  for (const key of expected) {
    if (!(key in value)) errors.push(`${field}.${key} is missing`);
  }
}

function isSafeRepositoryPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    !value.startsWith('/') &&
    !value.includes('..') &&
    !value.includes('\\') &&
    SAFE_REPOSITORY_PATH_PATTERN.test(value)
  );
}

export function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function parseNormalizedJson(
  text: string,
  label: string,
): {value: unknown; errors: string[]} {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {value: null, errors: [`${label} must contain valid JSON`]};
  }
  const normalized = `${JSON.stringify(value, null, 2)}\n`;
  return {
    value,
    errors: text === normalized
      ? []
      : [`${label} must use normalized two-space JSON with one trailing newline`],
  };
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** A small synchronous SHA-256 implementation so lifecycle checks also fail closed in browser bundles. */
export function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rightRotate(left, 7) ^ rightRotate(left, 18) ^ (left >>> 3);
      const sigma1 = rightRotate(right, 17) ^ rightRotate(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return Array.from(state, (word) => word.toString(16).padStart(8, '0')).join('');
}

export function demoArtifactDigestPayload(candidate: DemoCandidate): string {
  return JSON.stringify({
    schemaVersion: candidate.schemaVersion,
    id: candidate.id,
    candidateId: candidate.candidateId,
    source: candidate.source,
    movie: candidate.movie,
    maturity: candidate.maturity,
    validationStatus: candidate.validationStatus,
    runtime: candidate.runtime,
    artifacts: candidate.artifacts.map(({path, sha256}) => ({path, sha256})),
  });
}

export function computeDemoArtifactSha256(candidate: DemoCandidate): string {
  return sha256Hex(demoArtifactDigestPayload(candidate));
}

function validateDigest(value: unknown, field: string, errors: string[]) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    errors.push(`${field} must be a lowercase SHA-256`);
  }
}

function validatePositiveInteger(value: unknown, field: string, errors: string[]) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    errors.push(`${field} must be a positive safe integer`);
  }
}

export function validateDemoCandidate(value: unknown, expectedId?: string): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ['candidate must be an object'];
  requireExactKeys(
    value,
    [
      'schemaVersion', 'id', 'candidateId', 'source', 'movie', 'maturity',
      'validationStatus', 'runtime', 'artifacts', 'artifactSha256',
    ],
    'candidate',
    errors,
  );
  if (value.schemaVersion !== 1) errors.push('candidate.schemaVersion must be 1');
  const id = typeof value.id === 'string' ? value.id : '';
  if (!DEMO_ID_PATTERN.test(id)) errors.push('candidate.id must be a normalized demo id');
  if (expectedId !== undefined && id !== expectedId) {
    errors.push(`candidate.id must equal ${expectedId}`);
  }

  const candidateId = typeof value.candidateId === 'string' ? value.candidateId : '';
  const candidateMatch = CANDIDATE_ID_PATTERN.exec(candidateId);
  if (!candidateMatch || candidateMatch[1] !== id) {
    errors.push('candidate.candidateId must bind the demo id, date, and bundle digest prefix');
  }

  if (!isObject(value.source)) {
    errors.push('candidate.source must be an object');
  } else {
    requireExactKeys(value.source, ['flaSha256', 'swfSha256'], 'candidate.source', errors);
    validateDigest(value.source.flaSha256, 'candidate.source.flaSha256', errors);
    validateDigest(value.source.swfSha256, 'candidate.source.swfSha256', errors);
  }

  if (!isObject(value.movie)) {
    errors.push('candidate.movie must be an object');
  } else {
    requireExactKeys(
      value.movie,
      ['stage', 'fps', 'frameCount', 'durationMs'],
      'candidate.movie',
      errors,
    );
    if (!isObject(value.movie.stage)) {
      errors.push('candidate.movie.stage must be an object');
    } else {
      requireExactKeys(value.movie.stage, ['width', 'height'], 'candidate.movie.stage', errors);
      validatePositiveInteger(value.movie.stage.width, 'candidate.movie.stage.width', errors);
      validatePositiveInteger(value.movie.stage.height, 'candidate.movie.stage.height', errors);
    }
    validatePositiveInteger(value.movie.fps, 'candidate.movie.fps', errors);
    validatePositiveInteger(value.movie.frameCount, 'candidate.movie.frameCount', errors);
    validatePositiveInteger(value.movie.durationMs, 'candidate.movie.durationMs', errors);
    if (
      Number.isSafeInteger(value.movie.fps) &&
      Number.isSafeInteger(value.movie.frameCount) &&
      Number.isSafeInteger(value.movie.durationMs)
    ) {
      const expectedDuration = Math.round((value.movie.frameCount as number) * 1000 / (value.movie.fps as number));
      if (Math.abs((value.movie.durationMs as number) - expectedDuration) > 1) {
        errors.push('candidate.movie.durationMs must match frameCount / fps within one millisecond');
      }
    }
  }

  if (value.maturity !== 'legacy-prototype' && value.maturity !== 'strict-complete') {
    errors.push('candidate.maturity must be legacy-prototype or strict-complete');
  }
  if (value.validationStatus !== 'conditional' && value.validationStatus !== 'strict-complete') {
    errors.push('candidate.validationStatus must be conditional or strict-complete');
  }
  if (
    (value.maturity === 'strict-complete') !==
    (value.validationStatus === 'strict-complete')
  ) {
    errors.push('candidate maturity and validationStatus must agree on strict completion');
  }

  let runtimeBundleSha256 = '';
  if (!isObject(value.runtime)) {
    errors.push('candidate.runtime must be an object');
  } else {
    requireExactKeys(
      value.runtime,
      ['entry', 'globalName', 'bundleSha256'],
      'candidate.runtime',
      errors,
    );
    if (value.runtime.entry !== `private-demo-runtime/${id}.ts`) {
      errors.push('candidate.runtime.entry must be the demo-specific private runtime entry');
    }
    if (
      typeof value.runtime.globalName !== 'string' ||
      !/^HelpMathExecutiveRuntime[A-Za-z0-9]+$/u.test(value.runtime.globalName)
    ) {
      errors.push('candidate.runtime.globalName must be a normalized executive runtime global');
    }
    runtimeBundleSha256 = typeof value.runtime.bundleSha256 === 'string'
      ? value.runtime.bundleSha256
      : '';
    validateDigest(runtimeBundleSha256, 'candidate.runtime.bundleSha256', errors);
    if (candidateMatch && candidateMatch[3] !== runtimeBundleSha256.slice(0, 8)) {
      errors.push('candidate.candidateId digest prefix must match runtime.bundleSha256');
    }
  }

  const artifacts: DemoArtifact[] = [];
  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0) {
    errors.push('candidate.artifacts must be a non-empty array');
  } else {
    for (const [index, artifact] of value.artifacts.entries()) {
      const field = `candidate.artifacts[${index}]`;
      if (!isObject(artifact)) {
        errors.push(`${field} must be an object`);
        continue;
      }
      requireExactKeys(artifact, ['path', 'sha256'], field, errors);
      const artifactPath = typeof artifact.path === 'string' ? artifact.path : '';
      const sha256 = typeof artifact.sha256 === 'string' ? artifact.sha256 : '';
      if (!isSafeRepositoryPath(artifactPath)) {
        errors.push(`${field}.path must be a normalized in-repository artifact path`);
      }
      validateDigest(sha256, `${field}.sha256`, errors);
      artifacts.push({path: artifactPath, sha256});
    }
    const paths = artifacts.map(({path}) => path);
    if (new Set(paths).size !== paths.length) errors.push('candidate.artifacts paths must be unique');
    const sortedPaths = [...paths].sort();
    if (paths.some((artifactPath, index) => artifactPath !== sortedPaths[index])) {
      errors.push('candidate.artifacts must be sorted by path');
    }
    if (!paths.includes(`private-demo-runtime/${id}.ts`)) {
      errors.push('candidate.artifacts must include the demo-specific runtime entry');
    }
    if (!paths.includes(`demos/modules/${id}.tsx`)) {
      errors.push('candidate.artifacts must include the demo-specific module');
    }
  }

  validateDigest(value.artifactSha256, 'candidate.artifactSha256', errors);
  if (
    typeof value.artifactSha256 === 'string' &&
    SHA256_PATTERN.test(value.artifactSha256) &&
    id && candidateId && runtimeBundleSha256 && artifacts.length > 0
  ) {
    const computed = computeDemoArtifactSha256(value as unknown as DemoCandidate);
    if (computed !== value.artifactSha256) {
      errors.push('candidate.artifactSha256 does not match the canonical artifact digest');
    }
  }
  return [...new Set(errors)];
}

function substantiveIdentity(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !/\b(?:pending|tbd|to be determined|unknown|placeholder|authorized reviewer|named owner|test|testing|fixture|sample|example|dummy|n\/?a|none)\b/iu.test(value)
  );
}

function validateAcceptance(
  value: unknown,
  field: string,
  expectedRole: string,
  candidate: DemoCandidate,
  updatedAtMs: number | null,
  nowMs: number,
  errors: string[],
): number | null {
  if (!isObject(value)) {
    errors.push(`${field} must be null or an acceptance object`);
    return null;
  }
  requireExactKeys(
    value,
    [
      'status', 'candidateId', 'artifactSha256', 'evidenceRef',
      'evidenceSha256', 'acceptedAt', 'acceptedBy',
    ],
    field,
    errors,
  );
  if (value.status !== 'approved') errors.push(`${field}.status must be approved`);
  if (value.candidateId !== candidate.candidateId) {
    errors.push(`${field}.candidateId must bind the selected candidate`);
  }
  if (value.artifactSha256 !== candidate.artifactSha256) {
    errors.push(`${field}.artifactSha256 must bind the selected candidate artifact`);
  }
  if (typeof value.evidenceRef !== 'string' || !EVIDENCE_PATH_PATTERN.test(value.evidenceRef)) {
    errors.push(`${field}.evidenceRef must identify a demo-publication evidence JSON file`);
  }
  validateDigest(value.evidenceSha256, `${field}.evidenceSha256`, errors);
  let acceptedAtMs: number | null = null;
  if (!isCanonicalUtcTimestamp(value.acceptedAt)) {
    errors.push(`${field}.acceptedAt must be a canonical UTC timestamp`);
  } else {
    acceptedAtMs = Date.parse(value.acceptedAt);
    if (acceptedAtMs > nowMs) errors.push(`${field}.acceptedAt must not be in the future`);
    if (updatedAtMs !== null && acceptedAtMs > updatedAtMs) {
      errors.push(`${field}.acceptedAt must not be later than manifest.updatedAt`);
    }
  }
  if (!isObject(value.acceptedBy)) {
    errors.push(`${field}.acceptedBy must be an object`);
  } else {
    requireExactKeys(
      value.acceptedBy,
      ['name', 'authorityRole', 'organization'],
      `${field}.acceptedBy`,
      errors,
    );
    if (!substantiveIdentity(value.acceptedBy.name)) {
      errors.push(`${field}.acceptedBy.name must identify a non-placeholder approver`);
    }
    if (value.acceptedBy.authorityRole !== expectedRole) {
      errors.push(`${field}.acceptedBy.authorityRole must be ${expectedRole}`);
    }
    if (!substantiveIdentity(value.acceptedBy.organization)) {
      errors.push(`${field}.acceptedBy.organization must identify a non-placeholder organization`);
    }
  }
  return acceptedAtMs;
}

export function validateDemoActivationManifest(
  value: unknown,
  options: DemoActivationValidationOptions,
): string[] {
  const errors: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  if (!isObject(value)) return ['activation manifest must be an object'];
  requireExactKeys(value, ['schemaVersion', 'updatedAt', 'demos'], 'manifest', errors);
  if (value.schemaVersion !== 1) errors.push('manifest.schemaVersion must be 1');
  let updatedAtMs: number | null = null;
  if (!isCanonicalUtcTimestamp(value.updatedAt)) {
    errors.push('manifest.updatedAt must be a canonical UTC timestamp');
  } else {
    updatedAtMs = Date.parse(value.updatedAt);
    if (updatedAtMs > nowMs) errors.push('manifest.updatedAt must not be in the future');
  }
  if (!isObject(value.demos)) {
    errors.push('manifest.demos must be an object');
    return [...new Set(errors)];
  }
  const expectedIds = Object.keys(options.candidates).sort();
  const actualIds = Object.keys(value.demos).sort();
  for (const id of expectedIds) {
    if (!(id in value.demos)) errors.push(`manifest.demos.${id} is missing`);
  }
  for (const id of actualIds) {
    if (!(id in options.candidates)) errors.push(`manifest.demos.${id} has no candidate`);
  }

  for (const id of expectedIds) {
    const candidate = options.candidates[id];
    const activation = value.demos[id];
    const field = `manifest.demos.${id}`;
    if (!isObject(activation)) {
      errors.push(`${field} must be an object`);
      continue;
    }
    requireExactKeys(
      activation,
      ['candidateId', 'artifactSha256', 'approvals', 'activation'],
      field,
      errors,
    );
    if (activation.candidateId !== candidate.candidateId) {
      errors.push(`${field}.candidateId must match the candidate manifest`);
    }
    if (activation.artifactSha256 !== candidate.artifactSha256) {
      errors.push(`${field}.artifactSha256 must match the candidate manifest`);
    }

    let rightsAcceptedAt: number | null = null;
    let productAcceptedAt: number | null = null;
    let rightsApproved = false;
    let productApproved = false;
    if (!isObject(activation.approvals)) {
      errors.push(`${field}.approvals must be an object`);
    } else {
      requireExactKeys(
        activation.approvals,
        ['privatePreview', 'rightsAcceptance', 'productAcceptance'],
        `${field}.approvals`,
        errors,
      );
      if (!isObject(activation.approvals.privatePreview)) {
        errors.push(`${field}.approvals.privatePreview must be an object`);
      } else {
        const privatePreview = activation.approvals.privatePreview;
        requireExactKeys(
          privatePreview,
          ['status', 'audience', 'purpose', 'approvalRef'],
          `${field}.approvals.privatePreview`,
          errors,
        );
        for (const [key, expected] of Object.entries(PRIVATE_PREVIEW_APPROVAL)) {
          if (privatePreview[key] !== expected) {
            errors.push(`${field}.approvals.privatePreview.${key} must equal ${expected}`);
          }
        }
      }
      if (activation.approvals.rightsAcceptance !== null) {
        rightsApproved = true;
        rightsAcceptedAt = validateAcceptance(
          activation.approvals.rightsAcceptance,
          `${field}.approvals.rightsAcceptance`,
          'publication-rights-authority',
          candidate,
          updatedAtMs,
          nowMs,
          errors,
        );
      }
      if (activation.approvals.productAcceptance !== null) {
        productApproved = true;
        productAcceptedAt = validateAcceptance(
          activation.approvals.productAcceptance,
          `${field}.approvals.productAcceptance`,
          'product-acceptance-authority',
          candidate,
          updatedAtMs,
          nowMs,
          errors,
        );
      }
    }

    if (!isObject(activation.activation)) {
      errors.push(`${field}.activation must be an object`);
      continue;
    }
    requireExactKeys(
      activation.activation,
      ['active', 'activatedAt'],
      `${field}.activation`,
      errors,
    );
    if (typeof activation.activation.active !== 'boolean') {
      errors.push(`${field}.activation.active must be boolean`);
    }
    if (activation.activation.active === false && activation.activation.activatedAt !== null) {
      errors.push(`${field}.activation.activatedAt must be null while inactive`);
    }
    if (activation.activation.active === true) {
      if (!rightsApproved || !productApproved) {
        errors.push(`${field}.activation.active requires rights and product acceptance`);
      }
      if (!options.demoPublicationGateApproved) {
        errors.push(`${field}.activation.active requires the demoPublication launch gate`);
      }
      if (!isCanonicalUtcTimestamp(activation.activation.activatedAt)) {
        errors.push(`${field}.activation.activatedAt must be a canonical UTC timestamp while active`);
      } else {
        const activatedAtMs = Date.parse(activation.activation.activatedAt);
        if (activatedAtMs > nowMs) errors.push(`${field}.activation.activatedAt must not be in the future`);
        if (updatedAtMs !== null && activatedAtMs > updatedAtMs) {
          errors.push(`${field}.activation.activatedAt must not be later than manifest.updatedAt`);
        }
        if (rightsAcceptedAt !== null && activatedAtMs < rightsAcceptedAt) {
          errors.push(`${field}.activation.activatedAt must not precede rights acceptance`);
        }
        if (productAcceptedAt !== null && activatedAtMs < productAcceptedAt) {
          errors.push(`${field}.activation.activatedAt must not precede product acceptance`);
        }
      }
    }
  }
  return [...new Set(errors)];
}
