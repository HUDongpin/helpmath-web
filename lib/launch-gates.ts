import launchGateManifest from '../config/launch-gates.json' with {type: 'json'};
import {LAUNCH_GATE_IDS, type LaunchGateId} from './launch-gate-ids';
import {
  resolveLaunchGateCapabilitiesV3,
  type LaunchGateLifecycleStatusV3,
} from './launch-gate-lifecycle-v3';
import {validateLaunchGateManifest} from './launch-gate-validation';

export {LAUNCH_GATE_IDS};
export type {LaunchGateId};

type LaunchGateRuntimeState = Readonly<{
  gateId: LaunchGateId;
  schemaVersion: 2 | 3 | null;
  declaredStatus: LaunchGateLifecycleStatusV3 | null;
  effectiveStatus: LaunchGateLifecycleStatusV3;
  decisionId: string | null;
  subject: Readonly<{
    repositoryCommit: string;
    vercelDeploymentId: string | null;
  }> | null;
  validUntil: string | null;
  expired: boolean;
  satisfied: boolean;
  active: boolean;
  errors: readonly string[];
}>;

export type LaunchGateRuntimeSnapshot = Readonly<{
  valid: boolean;
  schemaVersion: 2 | 3 | null;
  gates: Readonly<Record<LaunchGateId, LaunchGateRuntimeState>>;
  errors: readonly string[];
}>;

function closedRuntimeState(
  gateId: LaunchGateId,
  schemaVersion: 2 | 3 | null,
  declaredStatus: LaunchGateLifecycleStatusV3 | null,
  errors: readonly string[],
): LaunchGateRuntimeState {
  return {
    gateId,
    schemaVersion,
    declaredStatus,
    effectiveStatus: declaredStatus === 'holding' ? 'holding' : 'revoked',
    decisionId: null,
    subject: null,
    validUntil: null,
    expired: false,
    satisfied: false,
    active: false,
    errors,
  };
}

export function resolveLaunchGateRuntime(
  nowMs = Date.now(),
): LaunchGateRuntimeSnapshot {
  return resolveLaunchGateRuntimeForManifest(launchGateManifest as unknown, nowMs);
}

export function resolveLaunchGateRuntimeForManifest(
  manifest: unknown,
  nowMs = Date.now(),
): LaunchGateRuntimeSnapshot {
  const errors = validateLaunchGateManifest(manifest, {nowMs});
  const schemaVersion =
    typeof manifest === 'object' &&
    manifest !== null &&
    !Array.isArray(manifest) &&
    ((manifest as {schemaVersion?: unknown}).schemaVersion === 2 ||
      (manifest as {schemaVersion?: unknown}).schemaVersion === 3)
      ? (manifest as {schemaVersion: 2 | 3}).schemaVersion
      : null;

  if (errors.length > 0) {
    return {
      valid: false,
      schemaVersion,
      gates: Object.fromEntries(
        LAUNCH_GATE_IDS.map((gateId) => [
          gateId,
          closedRuntimeState(gateId, schemaVersion, null, errors),
        ]),
      ) as Record<LaunchGateId, LaunchGateRuntimeState>,
      errors,
    };
  }

  if (schemaVersion === 3) {
    const resolution = resolveLaunchGateCapabilitiesV3(manifest, {nowMs});
    if (!resolution.valid) {
      return {
        valid: false,
        schemaVersion,
        gates: Object.fromEntries(
          LAUNCH_GATE_IDS.map((gateId) => [
            gateId,
            closedRuntimeState(gateId, schemaVersion, null, resolution.errors),
          ]),
        ) as Record<LaunchGateId, LaunchGateRuntimeState>,
        errors: resolution.errors,
      };
    }
    return {
      valid: true,
      schemaVersion,
      gates: Object.fromEntries(
        LAUNCH_GATE_IDS.map((gateId) => {
          const gate = resolution.gates[gateId];
          return [
            gateId,
            {
              gateId,
              schemaVersion,
              declaredStatus: gate.declaredStatus,
              effectiveStatus: gate.effectiveStatus,
              decisionId: gate.decision?.decisionId ?? null,
              subject: gate.candidate,
              validUntil: gate.validUntil,
              expired: gate.expired,
              satisfied: gate.satisfied,
              active: gate.active,
              errors: gate.failureReasons,
            } satisfies LaunchGateRuntimeState,
          ];
        }),
      ) as Record<LaunchGateId, LaunchGateRuntimeState>,
      errors: [],
    };
  }

  const v2Manifest = manifest as {
    gates: Record<LaunchGateId, {status: string}>;
  };
  return {
    valid: true,
    schemaVersion: 2,
    gates: Object.fromEntries(
      LAUNCH_GATE_IDS.map((gateId) => [
        gateId,
        closedRuntimeState(
          gateId,
          2,
          v2Manifest.gates[gateId].status === 'holding' ? 'holding' : null,
          [],
        ),
      ]),
    ) as Record<LaunchGateId, LaunchGateRuntimeState>,
    errors: [],
  };
}

export function isLaunchGateApproved(gate: LaunchGateId): boolean {
  const state = resolveLaunchGateRuntime().gates[gate];
  return state.active && state.effectiveStatus === 'approved';
}

export function isLaunchGateDependencySatisfied(gate: LaunchGateId): boolean {
  return resolveLaunchGateRuntime().gates[gate].satisfied;
}

export function getLaunchGateRuntimeState(
  gate: LaunchGateId,
  nowMs = Date.now(),
): LaunchGateRuntimeState {
  return resolveLaunchGateRuntime(nowMs).gates[gate];
}

export function areContactManifestGatesApproved(): boolean {
  return (
    isLaunchGateApproved('legalPublication') &&
    isLaunchGateApproved('contactIntake')
  );
}

export function isContactIntakeEnabled(
  environmentValue: string | undefined,
  repositoryGateApproved: boolean,
): boolean {
  return repositoryGateApproved && environmentValue === 'true';
}
