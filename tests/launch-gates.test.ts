import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import launchGateManifest from '../config/launch-gates.json';
import {
  areContactManifestGatesApproved,
  isContactIntakeEnabled,
  isLaunchGateApproved,
  LAUNCH_GATE_IDS,
  resolveLaunchGateRuntimeForManifest,
} from '../lib/launch-gates';
import {validateLaunchGateManifest} from '../lib/launch-gate-validation';
import {migrateLaunchGateManifestV2ToV3} from '../lib/launch-gate-lifecycle-v3';
import {
  HOLDING_ONLY_LAUNCH_GATE_IDS,
  parseCanonicalLaunchGateManifest,
  validateHoldingOnlyLaunchGateManifest,
} from '../lib/launch-gate-transition-lock.js';
import {validateEvidenceDirectoryContract} from '../scripts/evidence-directory-contract';

const NOW_MS = Date.parse('2026-07-21T22:00:00.000Z');

type EvidenceReference = {
  kind: string;
  reference: string;
  sha256: string;
  observedAt: string;
};

type Approval = {
  approvedBy: {
    name: string;
    authorityRole: string;
    organization: string;
  };
  approvedAt: string;
};

type ManifestFixture = {
  schemaVersion: number;
  updatedAt: string;
  gates: Record<string, {
    description: string;
    status: string;
    dependencies: string[];
    approval: null | Approval;
    evidence: EvidenceReference[];
    blockerRefs: string[];
  }>;
};

function fixture(): ManifestFixture {
  return structuredClone(launchGateManifest) as ManifestFixture;
}

function fullyApprovedFixture(): ManifestFixture {
  const manifest = fixture();
  manifest.updatedAt = '2026-07-21T21:40:00.000Z';
  const approvals: Record<string, {approval: Approval; evidence: EvidenceReference[]}> = {
    legalPublication: {
      approval: {
        approvedBy: {
          name: 'Alice Rivera',
          authorityRole: 'legal-review-authority',
          organization: 'Rivera Legal Review LLC',
        },
        approvedAt: '2026-07-21T21:00:00.000Z',
      },
      evidence: [{
        kind: 'legal-review',
        reference: 'docs/evidence/launch-gates/legal-review.json',
        sha256: '1'.repeat(64),
        observedAt: '2026-07-21T20:50:00.000Z',
      }],
    },
    contactIntake: {
      approval: {
        approvedBy: {
          name: 'Morgan Lee',
          authorityRole: 'contact-release-authority',
          organization: 'Operations Review Group',
        },
        approvedAt: '2026-07-21T21:10:00.000Z',
      },
      evidence: [{
        kind: 'contact-readiness',
        reference: 'docs/evidence/launch-gates/contact-readiness.json',
        sha256: '2'.repeat(64),
        observedAt: '2026-07-21T21:05:00.000Z',
      }],
    },
    demoPublication: {
      approval: {
        approvedBy: {
          name: 'Jordan Chen',
          authorityRole: 'demo-publication-authority',
          organization: 'Program Rights Office',
        },
        approvedAt: '2026-07-21T21:05:00.000Z',
      },
      evidence: [
        {
          kind: 'demo-rights',
          reference: 'docs/evidence/launch-gates/demo-rights.json',
          sha256: '3'.repeat(64),
          observedAt: '2026-07-21T20:55:00.000Z',
        },
        {
          kind: 'demo-product-acceptance',
          reference: 'docs/evidence/launch-gates/demo-product-acceptance.json',
          sha256: '4'.repeat(64),
          observedAt: '2026-07-21T21:00:00.000Z',
        },
      ],
    },
    legacyCutover: {
      approval: {
        approvedBy: {
          name: 'Taylor Wilson',
          authorityRole: 'legacy-cutover-authority',
          organization: 'Infrastructure Change Board',
        },
        approvedAt: '2026-07-21T21:20:00.000Z',
      },
      evidence: [
        {
          kind: 'contact-production-verification',
          reference: 'docs/evidence/launch-gates/contact-production-before-cutover.json',
          sha256: '5'.repeat(64),
          observedAt: '2026-07-21T21:12:00.000Z',
        },
        {
          kind: 'legacy-cutover-authorization',
          reference: 'docs/evidence/launch-gates/legacy-cutover-authorization.json',
          sha256: '6'.repeat(64),
          observedAt: '2026-07-21T21:15:00.000Z',
        },
      ],
    },
    productionLaunch: {
      approval: {
        approvedBy: {
          name: 'Casey Martinez',
          authorityRole: 'production-release-authority',
          organization: 'Production Release Board',
        },
        approvedAt: '2026-07-21T21:30:00.000Z',
      },
      evidence: [
        {
          kind: 'post-cutover-verification',
          reference: 'docs/evidence/launch-gates/post-cutover-verification.json',
          sha256: '7'.repeat(64),
          observedAt: '2026-07-21T21:25:00.000Z',
        },
        {
          kind: 'contact-production-verification',
          reference: 'docs/evidence/launch-gates/contact-production-before-release.json',
          sha256: '8'.repeat(64),
          observedAt: '2026-07-21T21:26:00.000Z',
        },
        {
          kind: 'production-release',
          reference: 'docs/evidence/launch-gates/production-release.json',
          sha256: '9'.repeat(64),
          observedAt: '2026-07-21T21:28:00.000Z',
        },
      ],
    },
  };

  for (const id of LAUNCH_GATE_IDS) {
    manifest.gates[id].status = 'approved';
    manifest.gates[id].approval = approvals[id].approval;
    manifest.gates[id].evidence = approvals[id].evidence;
    manifest.gates[id].blockerRefs = [];
  }
  return manifest;
}

describe('launch gate manifest', () => {
  it('is valid only with the canonical holding graph and blocker contracts', () => {
    assert.deepEqual(HOLDING_ONLY_LAUNCH_GATE_IDS, [...LAUNCH_GATE_IDS]);
    assert.deepEqual(validateLaunchGateManifest(launchGateManifest, {nowMs: NOW_MS}), []);
    assert.deepEqual(Object.keys(launchGateManifest.gates), [...LAUNCH_GATE_IDS]);
    for (const id of LAUNCH_GATE_IDS) {
      assert.equal(isLaunchGateApproved(id), false, id);
      assert.equal(launchGateManifest.gates[id].status, 'holding', id);
      assert.deepEqual(launchGateManifest.gates[id].evidence, [], id);
    }
    assert.deepEqual(launchGateManifest.gates.legalPublication.dependencies, []);
    assert.deepEqual(launchGateManifest.gates.contactIntake.dependencies, ['legalPublication']);
    assert.deepEqual(launchGateManifest.gates.demoPublication.dependencies, []);
    assert.deepEqual(launchGateManifest.gates.legacyCutover.dependencies, [
      'legalPublication',
      'contactIntake',
    ]);
    assert.deepEqual(launchGateManifest.gates.productionLaunch.dependencies, [
      'legalPublication',
      'contactIntake',
      'demoPublication',
      'legacyCutover',
    ]);
    assert.deepEqual(launchGateManifest.gates.legalPublication.blockerRefs, [
      'docs/LEGAL_REVIEW.md',
    ]);
    assert.deepEqual(launchGateManifest.gates.contactIntake.blockerRefs, [
      'docs/CONTACT_DELIVERY.md',
    ]);
    assert.deepEqual(launchGateManifest.gates.demoPublication.blockerRefs, [
      'docs/DEMO_PROMOTION.md',
      'docs/LAUNCH_DECISIONS.md',
    ]);
    assert.deepEqual(launchGateManifest.gates.legacyCutover.blockerRefs, [
      'docs/LEGACY_CUTOVER.md',
    ]);
    assert.deepEqual(launchGateManifest.gates.productionLaunch.blockerRefs, [
      'docs/LAUNCH_DECISIONS.md',
    ]);
    assert.match(readFileSync('docs/LEGAL_REVIEW.md', 'utf8'), /^\*\*Status:\*\* Pending\s*$/mu);
    assert.match(
      readFileSync('docs/CONTACT_DELIVERY.md', 'utf8'),
      /^\*\*Status:\*\* Pending\s*$/mu,
    );
  });

  it('dispatches schema v3 through the time-aware fail-closed runtime', () => {
    const migration = migrateLaunchGateManifestV2ToV3(launchGateManifest, {
      nowMs: NOW_MS,
    });
    assert.deepEqual(migration.errors, []);
    assert.ok(migration.manifest);
    assert.deepEqual(
      validateLaunchGateManifest(migration.manifest, {nowMs: NOW_MS}),
      [],
    );

    const holding = resolveLaunchGateRuntimeForManifest(
      migration.manifest,
      NOW_MS,
    );
    assert.equal(holding.valid, true);
    assert.equal(holding.schemaVersion, 3);
    assert.equal(
      Object.values(holding.gates).every(
        (gate) => gate.effectiveStatus === 'holding' && !gate.active,
      ),
      true,
    );

    const candidate = structuredClone(migration.manifest) as unknown as {
      updatedAt: string;
      gates: Record<string, {
        events: Array<Record<string, unknown>>;
      }>;
    };
    const events = candidate.gates.demoPublication.events;
    const previous = events.at(-1);
    assert.ok(previous);
    const occurredAt = '2026-07-21T21:50:00.000Z';
    events.push({
      eventId: 'demopublication-public-review-candidate',
      transition: 'submit',
      from: 'holding',
      to: 'candidate',
      targetStatus: 'approved',
      candidate: {
        repositoryCommit: 'a'.repeat(40),
        vercelDeploymentId: `dpl_${'A'.repeat(20)}`,
      },
      occurredAt,
      validUntil: '2026-07-28T21:49:59.999Z',
      previousEventId: previous.eventId,
      supersedes: null,
      decision: null,
      evidence: [],
    });
    candidate.updatedAt = occurredAt;

    const pending = resolveLaunchGateRuntimeForManifest(candidate, NOW_MS);
    assert.equal(pending.gates.demoPublication.effectiveStatus, 'candidate');
    assert.equal(pending.gates.demoPublication.active, false);
    assert.deepEqual(pending.gates.demoPublication.subject, {
      repositoryCommit: 'a'.repeat(40),
      vercelDeploymentId: `dpl_${'A'.repeat(20)}`,
    });
    assert.equal(
      pending.gates.demoPublication.validUntil,
      '2026-07-28T21:49:59.999Z',
    );

    const expired = resolveLaunchGateRuntimeForManifest(
      candidate,
      Date.parse('2026-07-28T21:49:59.999Z'),
    );
    assert.equal(expired.gates.demoPublication.effectiveStatus, 'revoked');
    assert.equal(expired.gates.demoPublication.expired, true);
    assert.equal(expired.gates.demoPublication.active, false);
  });

  it('rejects a structurally complete synthetic approval chain while transitions are locked', () => {
    const manifest = fullyApprovedFixture();
    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS});
    const expectedLockErrors = LAUNCH_GATE_IDS.map(
      (id) => `gates.${id}.status is blocked by the holding-only transition lock; expected holding`,
    );
    assert.deepEqual(errors, expectedLockErrors);
    assert.deepEqual(validateHoldingOnlyLaunchGateManifest(manifest), expectedLockErrors);
  });

  it('locks each gate independently even before other approval requirements are considered', () => {
    for (const id of LAUNCH_GATE_IDS) {
      const manifest = fixture();
      manifest.gates[id].status = 'approved';
      assert.match(
        validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n'),
        new RegExp(`gates\\.${id}\\.status is blocked by the holding-only transition lock`, 'u'),
      );
    }
  });

  it('requires canonical manifest bytes and rejects duplicate-key ambiguity', () => {
    const canonical = readFileSync('config/launch-gates.json', 'utf8');
    assert.deepEqual(parseCanonicalLaunchGateManifest(canonical).errors, []);

    const nonCanonical = canonical.replace('  "schemaVersion"', '    "schemaVersion"');
    assert.match(
      parseCanonicalLaunchGateManifest(nonCanonical).errors.join('\n'),
      /normalized two-space JSON/,
    );

    const duplicateStatus = canonical.replace(
      '      "status": "holding",',
      '      "status": "holding",\n      "status": "approved",',
    );
    const duplicateResult = parseCanonicalLaunchGateManifest(duplicateStatus);
    assert.match(duplicateResult.errors.join('\n'), /normalized two-space JSON/);
    assert.equal(duplicateResult.manifest.gates.legalPublication.status, 'approved');
  });

  it('rejects deleted, reordered, added, or substituted dependencies', () => {
    const cases = [
      {gate: 'productionLaunch', dependencies: []},
      {
        gate: 'productionLaunch',
        dependencies: [
          'contactIntake',
          'legalPublication',
          'demoPublication',
          'legacyCutover',
        ],
      },
      {gate: 'demoPublication', dependencies: ['legalPublication']},
      {gate: 'legacyCutover', dependencies: ['legalPublication', 'demoPublication']},
    ];
    for (const testCase of cases) {
      const manifest = fixture();
      manifest.gates[testCase.gate].dependencies = testCase.dependencies;
      assert.match(
        validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n'),
        new RegExp(`${testCase.gate}\\.dependencies must exactly equal`, 'u'),
      );
    }
  });

  it('rejects an approval without authority, typed evidence, and closed blockers', () => {
    const manifest = fixture();
    manifest.gates.legalPublication.status = 'approved';

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /approval must identify the approver/);
    assert.match(errors, /evidence kinds must exactly equal \[legal-review\]/);
    assert.match(errors, /blockerRefs must be empty/);
  });

  it('rejects approval while a canonical dependency remains unresolved', () => {
    const manifest = fullyApprovedFixture();
    manifest.gates.legalPublication.status = 'holding';
    manifest.gates.legalPublication.approval = null;
    manifest.gates.legalPublication.evidence = [];
    manifest.gates.legalPublication.blockerRefs = ['docs/LEGAL_REVIEW.md'];

    assert.match(
      validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n'),
      /contactIntake is approved while dependency legalPublication is not approved/,
    );
  });

  it('rejects future and internally inconsistent timestamps', () => {
    const futureManifest = fixture();
    futureManifest.updatedAt = '2099-01-01T00:00:00.000Z';
    assert.match(
      validateLaunchGateManifest(futureManifest, {nowMs: NOW_MS}).join('\n'),
      /updatedAt must not be in the future/,
    );

    const manifest = fullyApprovedFixture();
    manifest.gates.demoPublication.approval!.approvedAt = '2099-01-01T00:00:00.000Z';
    manifest.gates.productionLaunch.approval!.approvedAt = '2026-07-21T21:04:00.000Z';
    manifest.gates.contactIntake.evidence[0].observedAt = '2099-01-01T00:00:00.000Z';

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /demoPublication\.approval\.approvedAt must not be in the future/);
    assert.match(errors, /demoPublication\.approval\.approvedAt must not be later than updatedAt/);
    assert.match(errors, /contactIntake\.evidence\[0\]\.observedAt must not be in the future/);
    assert.match(errors, /contactIntake\.evidence\[0\]\.observedAt must not be later than approvedAt/);
    assert.match(
      errors,
      /productionLaunch\.approval\.approvedAt must not be earlier than dependency legacyCutover/,
    );
  });

  it('rejects placeholder approvers, wrong authority roles, and placeholder organizations', () => {
    const manifest = fullyApprovedFixture();
    manifest.gates.legalPublication.approval!.approvedBy.name = 'Pending reviewer';
    manifest.gates.contactIntake.approval!.approvedBy.authorityRole =
      'legal-review-authority';
    manifest.gates.demoPublication.approval!.approvedBy.organization = 'Unknown';
    manifest.gates.productionLaunch.approval!.approvedBy.name =
      'ghp_abcdefghijklmnopqrstuvwxyz123456';

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /legalPublication\.approval\.approvedBy\.name/);
    assert.match(errors, /contactIntake\.approval\.approvedBy\.authorityRole/);
    assert.match(errors, /demoPublication\.approval\.approvedBy\.organization/);
    assert.match(errors, /manifest\.gates\.productionLaunch.*credential-shaped content/);
  });

  it('rejects post-change and release evidence observed before their prerequisites', () => {
    const manifest = fullyApprovedFixture();
    manifest.gates.productionLaunch.evidence[0].observedAt =
      '2026-07-21T20:00:00.000Z';
    manifest.gates.productionLaunch.evidence[1].observedAt =
      '2026-07-21T19:59:00.000Z';

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(
      errors,
      /productionLaunch\.evidence\[0\]\.observedAt must not be earlier than dependency legacyCutover/,
    );
    assert.match(
      errors,
      /productionLaunch\.evidence\[1\]\.observedAt must not be earlier than the preceding evidence item/,
    );
  });

  it('rejects arbitrary Markdown, wrong evidence order, unsafe hashes, and duplicate references', () => {
    const manifest = fullyApprovedFixture();
    manifest.gates.legalPublication.evidence[0].reference = 'docs/LAUNCH_DECISIONS.md';
    manifest.gates.contactIntake.evidence[0].sha256 = 'A'.repeat(64);
    manifest.gates.demoPublication.evidence.reverse();
    manifest.gates.productionLaunch.evidence[1].reference =
      manifest.gates.productionLaunch.evidence[0].reference;

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /file directly under docs\/evidence\/launch-gates/);
    assert.match(errors, /sha256 must be a lowercase SHA-256/);
    assert.match(
      errors,
      /demoPublication\.evidence kinds must exactly equal \[demo-rights, demo-product-acceptance\]/,
    );
    assert.match(errors, /productionLaunch\.evidence must not repeat a reference/);
  });

  it('rejects evidence on a holding gate and changes to canonical blocker contracts', () => {
    const manifest = fixture();
    manifest.gates.legalPublication.evidence = [{
      kind: 'legal-review',
      reference: 'docs/evidence/launch-gates/legal-review.json',
      sha256: '1'.repeat(64),
      observedAt: '2026-07-21T20:50:00.000Z',
    }];
    manifest.gates.contactIntake.blockerRefs = ['docs/LAUNCH_DECISIONS.md'];

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /legalPublication\.evidence must be empty while holding/);
    assert.match(
      errors,
      /contactIntake\.blockerRefs must exactly equal \[docs\/CONTACT_DELIVERY\.md\]/,
    );
  });

  it('rejects schema v1, unknown fields, and non-canonical status values', () => {
    const manifest = fixture();
    manifest.schemaVersion = 1;
    manifest.gates.contactIntake.status = 'APPROVED';
    (manifest as unknown as Record<string, unknown>).unexpected = true;

    const errors = validateLaunchGateManifest(manifest, {nowMs: NOW_MS}).join('\n');
    assert.match(errors, /schemaVersion must be 2/);
    assert.match(errors, /manifest contains unknown field unexpected/);
    assert.match(errors, /contactIntake.status must be holding or approved/);
  });

  it('retains blocker contracts and only direct launch-gate or demo-publication JSON evidence', () => {
    const vercelIgnore = readFileSync('.vercelignore', 'utf8');
    const retainedPaths = new Set(vercelIgnore.split(/\r?\n/));
    const blockers = Object.values(launchGateManifest.gates).flatMap(
      (gate) => gate.blockerRefs,
    );

    assert.doesNotMatch(vercelIgnore, /^docs\/$/m);
    for (const reference of blockers) {
      assert.equal(retainedPaths.has(`!${reference}`), true, reference);
    }
    assert.equal(retainedPaths.has('!docs/evidence/'), true);
    assert.equal(retainedPaths.has('docs/evidence/*'), true);
    assert.equal(retainedPaths.has('!docs/evidence/launch-gates/'), true);
    assert.equal(retainedPaths.has('!docs/evidence/launch-gates/*.json'), true);
    assert.equal(retainedPaths.has('docs/evidence/launch-gates/.*'), true);
    assert.equal(retainedPaths.has('docs/evidence/launch-gates/*/'), true);
    assert.equal(retainedPaths.has('!docs/evidence/demo-publication/'), true);
    assert.equal(retainedPaths.has('!docs/evidence/demo-publication/*.json'), true);
    assert.equal(retainedPaths.has('docs/evidence/demo-publication/.*'), true);
    assert.equal(retainedPaths.has('docs/evidence/demo-publication/*/'), true);
  });

  it('requires the complete launch-gate evidence directory to match references and hashes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'helpmath-launch-evidence-'));
    const relativeDirectory = 'docs/evidence/launch-gates';
    const directory = path.join(root, relativeDirectory);
    const evidencePath = path.join(directory, 'legal-review.json');
    const evidenceBytes = Buffer.from('{"status":"pass"}\n');
    const sha256 = createHash('sha256').update(evidenceBytes).digest('hex');
    const references = [{
      reference: `${relativeDirectory}/legal-review.json`,
      sha256,
    }];

    try {
      assert.deepEqual(await validateEvidenceDirectoryContract({
        repositoryRoot: root,
        relativeDirectory,
        references: [],
      }), []);
      assert.match(
        (await validateEvidenceDirectoryContract({
          repositoryRoot: root,
          relativeDirectory,
          references,
        })).join('\n'),
        /is missing but evidence references require/u,
      );

      await mkdir(directory, {recursive: true});
      await writeFile(evidencePath, evidenceBytes);
      assert.deepEqual(await validateEvidenceDirectoryContract({
        repositoryRoot: root,
        relativeDirectory,
        references,
      }), []);

      await writeFile(evidencePath, '{"status":"changed"}\n');
      assert.match(
        (await validateEvidenceDirectoryContract({
          repositoryRoot: root,
          relativeDirectory,
          references,
        })).join('\n'),
        /SHA-256 does not match its evidence reference/u,
      );
      await writeFile(evidencePath, evidenceBytes);

      await writeFile(path.join(directory, '.hidden.json'), evidenceBytes);
      await writeFile(path.join(directory, 'notes.txt'), evidenceBytes);
      await mkdir(path.join(directory, 'nested'));
      await writeFile(path.join(directory, 'nested/receipt.json'), evidenceBytes);
      const unexpectedEntryErrors = (await validateEvidenceDirectoryContract({
        repositoryRoot: root,
        relativeDirectory,
        references,
      })).join('\n');
      assert.match(unexpectedEntryErrors, /complete entry set must exactly equal/u);
      assert.match(unexpectedEntryErrors, /\.hidden\.json has no evidence reference/u);
      assert.match(unexpectedEntryErrors, /notes\.txt has no evidence reference/u);
      assert.match(unexpectedEntryErrors, /nested must be a regular non-symlink file/u);

      await rm(path.join(directory, '.hidden.json'));
      await rm(path.join(directory, 'notes.txt'));
      await rm(path.join(directory, 'nested'), {recursive: true});
      await rm(evidencePath);
      await writeFile(path.join(root, 'symlink-target.json'), evidenceBytes);
      await symlink('../../../symlink-target.json', evidencePath);
      assert.match(
        (await validateEvidenceDirectoryContract({
          repositoryRoot: root,
          relativeDirectory,
          references,
        })).join('\n'),
        /legal-review\.json must be a regular non-symlink file/u,
      );
    } finally {
      await rm(root, {recursive: true, force: true});
    }
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
