import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import launchGateManifest from '../config/launch-gates.json';
import {
  areContactManifestGatesApproved,
  isContactIntakeEnabled,
  isLaunchGateApproved,
  LAUNCH_GATE_IDS,
} from '../lib/launch-gates';
import {validateLaunchGateManifest} from '../lib/launch-gate-validation';

function fixture() {
  return structuredClone(launchGateManifest) as {
    schemaVersion: number;
    updatedAt: string;
    gates: Record<string, {
      description: string;
      status: string;
      dependencies: string[];
      approval: null | {approver: string; approvedAt: string};
      evidenceRefs: string[];
      blockerRefs: string[];
    }>;
  };
}

describe('launch gate manifest', () => {
  it('is structurally valid and keeps every unresolved gate in holding state', () => {
    assert.deepEqual(validateLaunchGateManifest(launchGateManifest), []);
    assert.deepEqual(Object.keys(launchGateManifest.gates), [...LAUNCH_GATE_IDS]);
    for (const id of LAUNCH_GATE_IDS) {
      assert.equal(isLaunchGateApproved(id), false, id);
      assert.equal(launchGateManifest.gates[id].status, 'holding', id);
    }
  });

  it('rejects an approval without an approver, evidence, and closed blockers', () => {
    const manifest = fixture();
    manifest.gates.legalPublication.status = 'approved';

    const errors = validateLaunchGateManifest(manifest).join('\n');
    assert.match(errors, /approval must identify the approver/);
    assert.match(errors, /evidenceRefs must retain approval evidence/);
    assert.match(errors, /blockerRefs must be empty/);
  });

  it('rejects approval while a declared dependency remains unresolved', () => {
    const manifest = fixture();
    manifest.gates.contactIntake.status = 'approved';
    manifest.gates.contactIntake.approval = {
      approver: 'Authorized reviewer',
      approvedAt: '2026-07-21T14:15:11.000Z',
    };
    manifest.gates.contactIntake.evidenceRefs = ['docs/LAUNCH_DECISIONS.md'];
    manifest.gates.contactIntake.blockerRefs = [];

    assert.match(
      validateLaunchGateManifest(manifest).join('\n'),
      /contactIntake is approved while dependency legalPublication is not approved/,
    );
  });

  it('rejects unknown fields and non-canonical status values', () => {
    const manifest = fixture();
    manifest.gates.contactIntake.status = 'APPROVED';
    (manifest as Record<string, unknown>).unexpected = true;

    const errors = validateLaunchGateManifest(manifest).join('\n');
    assert.match(errors, /manifest contains unknown field unexpected/);
    assert.match(errors, /contactIntake.status must be holding or approved/);
  });
});

describe('contact intake double gate', () => {
  it('requires both repository approval and the deployment environment flag', () => {
    assert.equal(areContactManifestGatesApproved(), false);
    assert.equal(isContactIntakeEnabled('true', false), false);
    assert.equal(isContactIntakeEnabled('false', true), false);
    assert.equal(isContactIntakeEnabled(undefined, true), false);
    assert.equal(isContactIntakeEnabled('true', true), true);
  });
});
