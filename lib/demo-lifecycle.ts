import activationManifestJson from '../config/demo-activations.json';
import {
  DEMO_CANDIDATE_IDS,
  demoCandidates,
  isDemoCandidateId,
  type DemoCandidateId,
} from '../demos/candidates';
import {getLaunchGateRuntimeState} from './launch-gates';
import {
  isCanonicalUtcTimestamp,
  validateDemoActivationManifest,
  validateDemoCandidate,
  type DemoActivation,
  type DemoActivationManifest,
  type DemoCandidate,
} from './demo-lifecycle-validation';

export type DemoLifecycleAccess =
  | 'denied'
  | 'private-preview'
  | 'public'
  | 'indexable';

export type DemoLifecycleState = Readonly<{
  id: string;
  candidate: DemoCandidate | null;
  access: DemoLifecycleAccess;
  active: boolean;
  privatePreview: boolean;
  public: boolean;
  indexable: boolean;
  errors: readonly string[];
}>;

export type DeriveDemoLifecycleStateOptions = Readonly<{
  id: string;
  candidate: DemoCandidate | null;
  activation: DemoActivation | null | undefined;
  candidateErrors: readonly string[];
  manifestErrors: readonly string[];
  demoPublicationGateApproved: boolean;
}>;

const activationManifest = activationManifestJson as unknown as DemoActivationManifest;
const candidateErrors = Object.fromEntries(
  DEMO_CANDIDATE_IDS.map((id) => [id, validateDemoCandidate(demoCandidates[id], id)]),
) as Record<DemoCandidateId, string[]>;
// Validate the immutable candidate/activation structure independently from the
// time-varying publication gate. Runtime access is resolved again below for
// every consumer request. This lets an expired or revoked public decision
// close public access without invalidating the separately approved private
// executive-preview path.
const structuralManifestErrors = validateDemoActivationManifest(activationManifest, {
  candidates: demoCandidates,
  demoPublicationGateApproved: true,
});

export const demoLifecycleUpdatedAt = structuralManifestErrors.length === 0
  ? activationManifest.updatedAt
  : null;

export function deriveDemoLifecycleState({
  id,
  candidate,
  activation,
  candidateErrors: localCandidateErrors,
  manifestErrors: localManifestErrors,
  demoPublicationGateApproved: gateApproved,
}: DeriveDemoLifecycleStateOptions): DemoLifecycleState {
  const errors = [...localCandidateErrors, ...localManifestErrors];
  if (!candidate) errors.push('candidate is missing');
  if (!activation) errors.push('activation is missing');
  if (candidate && activation) {
    if (activation.candidateId !== candidate.candidateId) {
      errors.push('activation candidateId does not match candidate');
    }
    if (activation.artifactSha256 !== candidate.artifactSha256) {
      errors.push('activation artifactSha256 does not match candidate');
    }
    if (activation.activation.active) {
      const acceptances = [
        activation.approvals.rightsAcceptance,
        activation.approvals.productAcceptance,
      ];
      if (acceptances.some((acceptance) => acceptance?.status !== 'approved')) {
        errors.push('active demo requires rights and product acceptance');
      }
      if (acceptances.some((acceptance) =>
        acceptance !== null &&
        (
          acceptance.candidateId !== candidate.candidateId ||
          acceptance.artifactSha256 !== candidate.artifactSha256
        )
      )) {
        errors.push('active demo acceptance does not bind the selected candidate artifact');
      }
      if (!isCanonicalUtcTimestamp(activation.activation.activatedAt)) {
        errors.push('active demo requires a canonical activation timestamp');
      }
    }
  }
  if (errors.length > 0 || !candidate || !activation) {
    return Object.freeze({
      id,
      candidate,
      access: 'denied',
      active: false,
      privatePreview: false,
      public: false,
      indexable: false,
      errors: Object.freeze([...new Set(errors)]),
    });
  }

  const privatePreview =
    activation.approvals.privatePreview.status === 'approved' &&
    activation.approvals.privatePreview.audience === 'CEO and Chairman John Ramo' &&
    activation.approvals.privatePreview.purpose === 'internal JavaScript prototype review' &&
    activation.approvals.privatePreview.approvalRef ===
      'Project researcher/software engineer request, 2026-07-21';
  const activated =
    activation.activation.active &&
    activation.approvals.rightsAcceptance?.status === 'approved' &&
    activation.approvals.productAcceptance?.status === 'approved' &&
    gateApproved;
  if (activated) {
    const indexable =
      candidate.maturity === 'strict-complete' &&
      candidate.validationStatus === 'strict-complete';
    return Object.freeze({
      id,
      candidate,
      access: indexable ? 'indexable' : 'public',
      active: true,
      privatePreview,
      public: true,
      indexable,
      errors: Object.freeze([]),
    });
  }
  if (privatePreview) {
    return Object.freeze({
      id,
      candidate,
      access: 'private-preview',
      active: false,
      privatePreview: true,
      public: false,
      indexable: false,
      errors: Object.freeze([]),
    });
  }
  return Object.freeze({
    id,
    candidate,
    access: 'denied',
    active: false,
    privatePreview: false,
    public: false,
    indexable: false,
    errors: Object.freeze(['private preview approval is missing']),
  });
}

function deriveKnownDemoLifecycleState(
  id: DemoCandidateId,
  demoPublicationGateApproved: boolean,
): DemoLifecycleState {
  return deriveDemoLifecycleState({
    id,
    candidate: demoCandidates[id],
    activation: activationManifest.demos[id],
    candidateErrors: candidateErrors[id],
    manifestErrors: structuralManifestErrors,
    demoPublicationGateApproved,
  });
}

function isDemoPublicationGateActive(nowMs: number): boolean {
  const gate = getLaunchGateRuntimeState('demoPublication', nowMs);
  return gate.active && gate.effectiveStatus === 'approved';
}

function unknownDemoLifecycleState(id: string): DemoLifecycleState {
  return Object.freeze({
    id,
    candidate: null,
    access: 'denied',
    active: false,
    privatePreview: false,
    public: false,
    indexable: false,
    errors: Object.freeze(['unknown demo candidate']),
  });
}

export function resolveDemoLifecycleStates(
  nowMs = Date.now(),
): Readonly<Record<DemoCandidateId, DemoLifecycleState>> {
  const gateApproved = isDemoPublicationGateActive(nowMs);
  return Object.freeze(Object.fromEntries(
    DEMO_CANDIDATE_IDS.map((id) => [
      id,
      deriveKnownDemoLifecycleState(id, gateApproved),
    ]),
  )) as Readonly<Record<DemoCandidateId, DemoLifecycleState>>;
}

/**
 * Build-time compatibility snapshot. Request-time consumers must call
 * getDemoLifecycleState() or getDemoLifecycleCatalog() instead.
 */
export const demoLifecycleStates = resolveDemoLifecycleStates();

export function getDemoLifecycleState(
  id: string,
  nowMs = Date.now(),
): DemoLifecycleState {
  if (!isDemoCandidateId(id)) return unknownDemoLifecycleState(id);
  return deriveKnownDemoLifecycleState(id, isDemoPublicationGateActive(nowMs));
}

export function getDemoLifecycleCatalog(nowMs = Date.now()) {
  const states = resolveDemoLifecycleStates(nowMs);
  const publicIds = DEMO_CANDIDATE_IDS.filter((id) => states[id].public);
  const indexableIds = DEMO_CANDIDATE_IDS.filter((id) => states[id].indexable);
  const privatePreviewIds = DEMO_CANDIDATE_IDS.filter(
    (id) => states[id].privatePreview,
  );
  return Object.freeze({
    states,
    publicIds: Object.freeze(publicIds),
    indexableIds: Object.freeze(indexableIds),
    privatePreviewIds: Object.freeze(privatePreviewIds),
  });
}

export function isDemoDenied(id: string, nowMs = Date.now()): boolean {
  return getDemoLifecycleState(id, nowMs).access === 'denied';
}

export function isDemoPrivatePreview(id: string, nowMs = Date.now()): boolean {
  return getDemoLifecycleState(id, nowMs).privatePreview;
}

export function isDemoPublic(id: string, nowMs = Date.now()): boolean {
  return getDemoLifecycleState(id, nowMs).public;
}

export function isDemoIndexable(id: string, nowMs = Date.now()): boolean {
  return getDemoLifecycleState(id, nowMs).indexable;
}
