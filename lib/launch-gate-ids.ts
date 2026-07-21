export const LAUNCH_GATE_IDS = [
  'legalPublication',
  'contactIntake',
  'demoPublication',
  'legacyCutover',
  'productionLaunch',
] as const;

export type LaunchGateId = (typeof LAUNCH_GATE_IDS)[number];
