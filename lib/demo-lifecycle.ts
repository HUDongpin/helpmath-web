import activationManifestJson from '../config/demo-activations.json';
import {
  DEMO_CANDIDATE_IDS,
  demoCandidates,
  isDemoCandidateId,
  type DemoCandidateId,
} from '../demos/candidates';
import {isLaunchGateApproved} from './launch-gates';
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
const demoPublicationGateApproved = isLaunchGateApproved('demoPublication');
const candidateErrors = Object.fromEntries(
  DEMO_CANDIDATE_IDS.map((id) => [id, validateDemoCandidate(demoCandidates[id], id)]),
) as Record<DemoCandidateId, string[]>;
const manifestErrors = validateDemoActivationManifest(activationManifest, {
  candidates: demoCandidates,
  demoPublicationGateApproved,
});

export const demoLifecycleUpdatedAt = manifestErrors.length === 0
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
      if (!gateApproved) errors.push('active demo requires the demoPublication launch gate');
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

function deriveKnownDemoLifecycleState(id: DemoCandidateId): DemoLifecycleState {
  return deriveDemoLifecycleState({
    id,
    candidate: demoCandidates[id],
    activation: activationManifest.demos[id],
    candidateErrors: candidateErrors[id],
    manifestErrors,
    demoPublicationGateApproved,
  });
}

export const demoLifecycleStates = Object.freeze(Object.fromEntries(
  DEMO_CANDIDATE_IDS.map((id) => [id, deriveKnownDemoLifecycleState(id)]),
)) as Readonly<Record<DemoCandidateId, DemoLifecycleState>>;

export function getDemoLifecycleState(id: string): DemoLifecycleState {
  if (!isDemoCandidateId(id)) {
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
  return demoLifecycleStates[id];
}

export function isDemoDenied(id: string): boolean {
  return getDemoLifecycleState(id).access === 'denied';
}

export function isDemoPrivatePreview(id: string): boolean {
  return getDemoLifecycleState(id).access === 'private-preview';
}

export function isDemoPublic(id: string): boolean {
  return getDemoLifecycleState(id).public;
}

export function isDemoIndexable(id: string): boolean {
  return getDemoLifecycleState(id).indexable;
}
