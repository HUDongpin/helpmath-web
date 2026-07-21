import launchGateManifest from '../config/launch-gates.json' with {type: 'json'};
import {LAUNCH_GATE_IDS, type LaunchGateId} from './launch-gate-ids';
import {validateLaunchGateManifest} from './launch-gate-validation';

export {LAUNCH_GATE_IDS};
export type {LaunchGateId};

const launchGateManifestIsValid =
  validateLaunchGateManifest(launchGateManifest).length === 0;

export function isLaunchGateApproved(gate: LaunchGateId): boolean {
  return (
    launchGateManifestIsValid &&
    (launchGateManifest.gates[gate].status as string) === 'approved'
  );
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
