export const HOLDING_ONLY_LAUNCH_GATE_IDS = Object.freeze([
  'legalPublication',
  'contactIntake',
  'demoPublication',
  'legacyCutover',
  'productionLaunch',
]);

export function parseCanonicalLaunchGateManifest(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    return {
      manifest: null,
      errors: ['config/launch-gates.json must contain valid JSON'],
    };
  }

  const normalized = `${JSON.stringify(manifest, null, 2)}\n`;
  const errors = text === normalized
    ? []
    : [
      'config/launch-gates.json must use normalized two-space JSON with one trailing newline',
    ];
  return {manifest, errors};
}

export function validateHoldingOnlyLaunchGateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['launch-gate transition lock requires a manifest object'];
  }
  const gates = manifest.gates;
  if (!gates || typeof gates !== 'object' || Array.isArray(gates)) {
    return ['launch-gate transition lock requires a gates object'];
  }

  const errors = [];
  for (const gateId of HOLDING_ONLY_LAUNCH_GATE_IDS) {
    const status = gates[gateId]?.status;
    if (status !== 'holding') {
      errors.push(
        `gates.${gateId}.status is blocked by the holding-only transition lock; expected holding`,
      );
    }
  }
  return errors;
}
