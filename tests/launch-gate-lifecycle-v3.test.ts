import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import launchGateV2 from '../config/launch-gates.json';
import {
  LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES,
  MAX_LAUNCH_GATE_CANDIDATE_TTL_MS,
  migrateLaunchGateManifestV2ToV3,
  resolveLaunchGateCapabilitiesV3,
  validateLaunchGateLifecycleManifestV3,
  validateLaunchGateManifestTransitionV3,
  validateLaunchGateTransitionV3,
  type LaunchGateLifecycleEventV3,
  type LaunchGateResolvedStatusV3,
} from '../lib/launch-gate-lifecycle-v3';
import {LAUNCH_GATE_IDS, type LaunchGateId} from '../lib/launch-gate-ids';

const START_MS = Date.parse(launchGateV2.updatedAt);
const NOW_MS = START_MS + 50 * 60_000;

function atMinute(minute: number): string {
  return new Date(START_MS + minute * 60_000).toISOString();
}

const AUTHORITY = {
  legalPublication: {
    name: 'Alice Rivera',
    authorityRole: 'legal-review-authority',
    organization: 'Rivera Legal Review LLC',
  },
  contactIntake: {
    name: 'Morgan Lee',
    authorityRole: 'contact-release-authority',
    organization: 'Operations Review Group',
  },
  demoPublication: {
    name: 'Jordan Chen',
    authorityRole: 'demo-publication-authority',
    organization: 'Program Rights Office',
  },
  legacyCutover: {
    name: 'Taylor Wilson',
    authorityRole: 'legacy-cutover-authority',
    organization: 'Infrastructure Change Board',
  },
  productionLaunch: {
    name: 'Casey Martinez',
    authorityRole: 'production-release-authority',
    organization: 'Production Release Board',
  },
} as const;

type MutableEvent = {
  -readonly [K in keyof LaunchGateLifecycleEventV3]:
    LaunchGateLifecycleEventV3[K] extends readonly (infer T)[] ? T[] :
    LaunchGateLifecycleEventV3[K];
};

type MutableManifest = {
  schemaVersion: 3;
  updatedAt: string;
  gates: Record<LaunchGateId, {
    description: string;
    dependencies: LaunchGateId[];
    events: MutableEvent[];
  }>;
};

function holdingManifest(): MutableManifest {
  const result = migrateLaunchGateManifestV2ToV3(launchGateV2, {nowMs: NOW_MS});
  assert.deepEqual(result.errors, []);
  assert.ok(result.manifest);
  return structuredClone(result.manifest) as MutableManifest;
}

function latest(manifest: MutableManifest, gateId: LaunchGateId): MutableEvent {
  const event = manifest.gates[gateId].events.at(-1);
  assert.ok(event);
  return event;
}

function evidenceKinds(
  gateId: LaunchGateId,
  outcome: LaunchGateResolvedStatusV3 | 'revoked',
  contactDisabled = false,
): string[] {
  if (outcome === 'revoked') return ['gate-revocation'];
  if (outcome === 'disabled') return ['contact-disabled-disposition'];
  if (outcome === 'private') return ['demo-private-disposition'];
  switch (gateId) {
    case 'legalPublication':
      return ['legal-review'];
    case 'contactIntake':
      return ['contact-readiness'];
    case 'demoPublication':
      return ['demo-rights', 'demo-product-acceptance'];
    case 'legacyCutover':
      return [
        contactDisabled
          ? 'contact-disabled-verification'
          : 'contact-production-verification',
        'legacy-cutover-authorization',
      ];
    case 'productionLaunch':
      return [
        'post-cutover-verification',
        contactDisabled
          ? 'contact-disabled-verification'
          : 'contact-production-verification',
        'production-release',
      ];
  }
}

function makeEvidence(
  kinds: readonly string[],
  slug: string,
  observedAt: string,
  validUntil: string | null,
) {
  return kinds.map((kind, index) => ({
    kind,
    reference: `docs/evidence/launch-gates/${slug}-${index}-${kind}.json`,
    sha256: '123456789abcdef'[(index + slug.length) % 15].repeat(64),
    observedAt,
    validUntil,
  }));
}

function appendCandidate(
  manifest: MutableManifest,
  gateId: LaunchGateId,
  targetStatus: LaunchGateResolvedStatusV3,
  minute: number,
) {
  const previous = latest(manifest, gateId);
  const event: MutableEvent = {
    eventId: `${gateId.toLowerCase()}-${minute}-candidate`,
    transition: previous.to === 'revoked' ? 'reopen' : 'submit',
    from: previous.to,
    to: 'candidate',
    targetStatus,
    candidate: {
      repositoryCommit: 'a'.repeat(40),
      vercelDeploymentId: `dpl_${'A'.repeat(20)}`,
    },
    occurredAt: atMinute(minute),
    validUntil: atMinute(minute + 10),
    previousEventId: previous.eventId,
    supersedes: null,
    decision: null,
    evidence: [],
  };
  manifest.gates[gateId].events.push(event);
  manifest.updatedAt = event.occurredAt;
  return event;
}

function appendResolution(
  manifest: MutableManifest,
  gateId: LaunchGateId,
  outcome: LaunchGateResolvedStatusV3,
  minute: number,
  validUntilMinute = 100,
  contactDisabled = false,
) {
  const previous = latest(manifest, gateId);
  const occurredAt = atMinute(minute);
  const validUntil = atMinute(validUntilMinute);
  const transition =
    outcome === 'approved'
      ? 'approve'
      : outcome === 'disabled'
        ? 'disable'
        : 'keep-private';
  const event: MutableEvent = {
    eventId: `${gateId.toLowerCase()}-${minute}-${outcome}`,
    transition,
    from: previous.to,
    to: outcome,
    targetStatus: null,
    candidate: null,
    occurredAt,
    validUntil,
    previousEventId: previous.eventId,
    supersedes: null,
    decision: {
      decisionId: `${gateId.toLowerCase()}-${minute}-${outcome}-decision`,
      outcome,
      decidedAt: occurredAt,
      decidedBy: {...AUTHORITY[gateId]},
      candidate: {
        candidateEventId: previous.eventId,
        repositoryCommit: previous.candidate?.repositoryCommit ?? '',
        vercelDeploymentId: previous.candidate?.vercelDeploymentId ?? null,
      },
      supersedesDecisionId: null,
    },
    evidence: makeEvidence(
      evidenceKinds(gateId, outcome, contactDisabled),
      `${gateId.toLowerCase()}-${minute}-${outcome}`,
      occurredAt,
      validUntil,
    ),
  };
  manifest.gates[gateId].events.push(event);
  manifest.updatedAt = occurredAt;
  return event;
}

function resolveGate(
  manifest: MutableManifest,
  gateId: LaunchGateId,
  outcome: LaunchGateResolvedStatusV3,
  candidateMinute: number,
  decisionMinute: number,
  options: {validUntilMinute?: number; contactDisabled?: boolean} = {},
) {
  appendCandidate(manifest, gateId, outcome, candidateMinute);
  return appendResolution(
    manifest,
    gateId,
    outcome,
    decisionMinute,
    options.validUntilMinute,
    options.contactDisabled,
  );
}

function appendRenewal(
  manifest: MutableManifest,
  gateId: LaunchGateId,
  minute: number,
  validUntilMinute: number,
  contactDisabled = false,
) {
  const previous = latest(manifest, gateId);
  assert.ok(
    previous.to === 'approved' ||
      previous.to === 'disabled' ||
      previous.to === 'private',
  );
  assert.ok(previous.decision);
  const occurredAt = atMinute(minute);
  const validUntil = atMinute(validUntilMinute);
  const event: MutableEvent = {
    eventId: `${gateId.toLowerCase()}-${minute}-renew`,
    transition: 'renew',
    from: previous.to,
    to: previous.to,
    targetStatus: null,
    candidate: null,
    occurredAt,
    validUntil,
    previousEventId: previous.eventId,
    supersedes: previous.eventId,
    decision: {
      decisionId: `${gateId.toLowerCase()}-${minute}-renew-decision`,
      outcome: previous.to,
      decidedAt: occurredAt,
      decidedBy: {...AUTHORITY[gateId]},
      candidate: {...previous.decision.candidate},
      supersedesDecisionId: previous.decision.decisionId,
    },
    evidence: makeEvidence(
      evidenceKinds(gateId, previous.to, contactDisabled),
      `${gateId.toLowerCase()}-${minute}-renew`,
      occurredAt,
      validUntil,
    ),
  };
  manifest.gates[gateId].events.push(event);
  manifest.updatedAt = occurredAt;
  return event;
}

function appendRevocation(
  manifest: MutableManifest,
  gateId: LaunchGateId,
  minute: number,
) {
  const previous = latest(manifest, gateId);
  assert.ok(
    previous.to === 'approved' ||
      previous.to === 'disabled' ||
      previous.to === 'private',
  );
  assert.ok(previous.decision);
  const occurredAt = atMinute(minute);
  const event: MutableEvent = {
    eventId: `${gateId.toLowerCase()}-${minute}-revoked`,
    transition: 'revoke',
    from: previous.to,
    to: 'revoked',
    targetStatus: null,
    candidate: null,
    occurredAt,
    validUntil: null,
    previousEventId: previous.eventId,
    supersedes: previous.eventId,
    decision: {
      decisionId: `${gateId.toLowerCase()}-${minute}-revocation-decision`,
      outcome: 'revoked',
      decidedAt: occurredAt,
      decidedBy: {...AUTHORITY[gateId]},
      candidate: {...previous.decision.candidate},
      supersedesDecisionId: previous.decision.decisionId,
    },
    evidence: makeEvidence(
      evidenceKinds(gateId, 'revoked'),
      `${gateId.toLowerCase()}-${minute}-revoked`,
      occurredAt,
      null,
    ),
  };
  manifest.gates[gateId].events.push(event);
  manifest.updatedAt = occurredAt;
  return event;
}

function resolvedManifest(options: {
  contact?: 'approved' | 'disabled';
  demo?: 'approved' | 'private';
  legalValidUntilMinute?: number;
} = {}): MutableManifest {
  const contact = options.contact ?? 'approved';
  const demo = options.demo ?? 'approved';
  const manifest = holdingManifest();
  resolveGate(manifest, 'legalPublication', 'approved', 1, 2, {
    validUntilMinute: options.legalValidUntilMinute ?? 100,
  });
  resolveGate(manifest, 'demoPublication', demo, 1, 3);
  resolveGate(manifest, 'contactIntake', contact, 3, 4);
  resolveGate(manifest, 'legacyCutover', 'approved', 5, 6, {
    contactDisabled: contact === 'disabled',
  });
  resolveGate(manifest, 'productionLaunch', 'approved', 7, 8, {
    contactDisabled: contact === 'disabled',
  });
  return manifest;
}

describe('launch-gate lifecycle v3', () => {
  it('migrates only the strict all-holding v2 state without manufacturing approvals', () => {
    const result = migrateLaunchGateManifestV2ToV3(launchGateV2, {nowMs: NOW_MS});
    assert.deepEqual(result.errors, []);
    assert.ok(result.manifest);
    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(result.manifest, {nowMs: NOW_MS}),
      [],
    );
    for (const gateId of LAUNCH_GATE_IDS) {
      assert.deepEqual(result.manifest.gates[gateId].dependencies, [
        ...LAUNCH_GATE_LIFECYCLE_V3_DEPENDENCIES[gateId],
      ]);
      assert.equal(result.manifest.gates[gateId].events.length, 1);
      assert.equal(result.manifest.gates[gateId].events[0].to, 'holding');
      assert.equal(result.manifest.gates[gateId].events[0].decision, null);
      assert.deepEqual(result.manifest.gates[gateId].events[0].evidence, []);
    }
    assert.deepEqual(resolveLaunchGateCapabilitiesV3(result.manifest, {
      nowMs: NOW_MS,
    }).capabilities, {
      publishLegal: false,
      enableContactIntake: false,
      publishDemos: false,
      executeLegacyCutover: false,
      declareProductionLaunch: false,
    });
  });

  it('rejects a v2 resolved state because v2 has no auditable transition chain', () => {
    const fixture = structuredClone(launchGateV2);
    fixture.gates.legalPublication.status = 'approved';
    const result = migrateLaunchGateManifestV2ToV3(fixture, {nowMs: NOW_MS});
    assert.equal(result.manifest, null);
    assert.match(result.errors.join('\n'), /cannot be migrated without audited history/);
  });

  it('resolves a complete approved dependency graph and enables all capabilities', () => {
    const manifest = resolvedManifest();
    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}),
      [],
    );
    const result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.valid, true);
    assert.deepEqual(result.capabilities, {
      publishLegal: true,
      enableContactIntake: true,
      publishDemos: true,
      executeLegacyCutover: true,
      declareProductionLaunch: true,
    });
    for (const gateId of LAUNCH_GATE_IDS) {
      assert.equal(result.gates[gateId].satisfied, true, gateId);
      assert.equal(result.gates[gateId].active, true, gateId);
      assert.ok(result.gates[gateId].decision, gateId);
      assert.ok(result.gates[gateId].evidence.length > 0, gateId);
    }
  });

  it('allows contact disabled and demo private to satisfy dependencies without exposing them', () => {
    const manifest = resolvedManifest({contact: 'disabled', demo: 'private'});
    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}),
      [],
    );
    const result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.contactIntake.satisfied, true);
    assert.equal(result.gates.contactIntake.active, false);
    assert.equal(result.gates.demoPublication.satisfied, true);
    assert.equal(result.gates.demoPublication.active, false);
    assert.equal(result.gates.legacyCutover.satisfied, true);
    assert.equal(result.gates.productionLaunch.satisfied, true);
    assert.deepEqual(result.capabilities, {
      publishLegal: true,
      enableContactIntake: false,
      publishDemos: false,
      executeLegacyCutover: true,
      declareProductionLaunch: true,
    });
  });

  it('requires the downstream evidence path to match approved or disabled contact', () => {
    const manifest = resolvedManifest({contact: 'disabled'});
    latest(manifest, 'legacyCutover').evidence[0] = {
      ...latest(manifest, 'legacyCutover').evidence[0],
      kind: 'contact-production-verification',
    };
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /evidence kinds do not match the resolved path/,
    );
  });

  it('expires a decision at the exact validUntil instant and recursively closes descendants', () => {
    const manifest = resolvedManifest({legalValidUntilMinute: 10});
    const result = resolveLaunchGateCapabilitiesV3(manifest, {
      nowMs: START_MS + 10 * 60_000,
    });
    assert.equal(result.valid, true);
    assert.equal(result.gates.legalPublication.expired, true);
    assert.equal(result.gates.legalPublication.effectiveStatus, 'revoked');
    assert.equal(result.gates.contactIntake.active, false);
    assert.equal(result.gates.legacyCutover.active, false);
    assert.equal(result.gates.productionLaunch.active, false);
    assert.equal(result.gates.demoPublication.active, true);
    assert.equal(result.capabilities.declareProductionLaunch, false);
  });

  it('preserves explicit revocation linkage and recursively closes descendants', () => {
    const manifest = resolvedManifest();
    const previous = latest(manifest, 'legalPublication');
    const revocation = appendRevocation(manifest, 'legalPublication', 10);
    assert.equal(revocation.supersedes, previous.eventId);
    assert.equal(
      revocation.decision?.supersedesDecisionId,
      previous.decision?.decisionId,
    );
    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}),
      [],
    );
    const result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.legalPublication.explicitlyRevoked, true);
    assert.equal(result.gates.contactIntake.satisfied, false);
    assert.equal(result.gates.legacyCutover.satisfied, false);
    assert.equal(result.gates.productionLaunch.satisfied, false);
    assert.equal(result.gates.demoPublication.satisfied, true);
  });

  it('does not silently reactivate descendants after an upstream revoke and reopen', () => {
    const manifest = resolvedManifest();
    appendRevocation(manifest, 'legalPublication', 10);
    resolveGate(manifest, 'legalPublication', 'approved', 11, 12);

    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}),
      [],
    );
    let result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.legalPublication.active, true);
    assert.equal(result.gates.contactIntake.active, false);
    assert.equal(result.gates.legacyCutover.active, false);
    assert.equal(result.gates.productionLaunch.active, false);
    assert.equal(result.gates.demoPublication.active, true);

    appendRenewal(manifest, 'contactIntake', 13, 120);
    result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.contactIntake.active, true);
    assert.equal(result.gates.legacyCutover.active, false);
    assert.equal(result.gates.productionLaunch.active, false);

    appendRenewal(manifest, 'legacyCutover', 14, 120);
    result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.legacyCutover.active, true);
    assert.equal(result.gates.productionLaunch.active, false);

    appendRenewal(manifest, 'productionLaunch', 15, 120);
    result = resolveLaunchGateCapabilitiesV3(manifest, {nowMs: NOW_MS});
    assert.equal(result.gates.productionLaunch.active, true);
  });

  it('accepts a fresh renewal only when it supersedes and extends the current decision', () => {
    const manifest = holdingManifest();
    resolveGate(manifest, 'legalPublication', 'approved', 1, 2, {
      validUntilMinute: 20,
    });
    const prior = latest(manifest, 'legalPublication');
    const renewal = appendRenewal(manifest, 'legalPublication', 10, 40);
    assert.equal(renewal.supersedes, prior.eventId);
    assert.deepEqual(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}),
      [],
    );

    const badLink = structuredClone(manifest);
    latest(badLink, 'legalPublication').supersedes = 'different-event';
    assert.match(
      validateLaunchGateLifecycleManifestV3(badLink, {nowMs: NOW_MS}).join('\n'),
      /supersedes must equal/,
    );

    const noExtension = structuredClone(manifest);
    latest(noExtension, 'legalPublication').validUntil = atMinute(20);
    assert.match(
      validateLaunchGateLifecycleManifestV3(noExtension, {nowMs: NOW_MS}).join('\n'),
      /must extend the superseded decision/,
    );
  });

  it('rejects renewal after expiry even if the new record has a later date', () => {
    const manifest = holdingManifest();
    resolveGate(manifest, 'legalPublication', 'approved', 1, 2, {
      validUntilMinute: 5,
    });
    appendRenewal(manifest, 'legalPublication', 6, 40);
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /cannot renew an already expired decision/,
    );
  });

  it('enforces gate-specific candidate targets and exact candidate resolution', () => {
    const invalidTarget = holdingManifest();
    appendCandidate(invalidTarget, 'legalPublication', 'disabled', 1);
    assert.match(
      validateLaunchGateLifecycleManifestV3(invalidTarget, {nowMs: NOW_MS}).join('\n'),
      /targetStatus is not allowed for legalPublication/,
    );

    const mismatch = holdingManifest();
    appendCandidate(mismatch, 'contactIntake', 'disabled', 1);
    appendResolution(mismatch, 'contactIntake', 'approved', 2);
    assert.match(
      validateLaunchGateLifecycleManifestV3(mismatch, {nowMs: NOW_MS}).join('\n'),
      /to must equal the candidate targetStatus disabled/,
    );
  });

  it('strictly separates holding and candidate records from decisions and evidence', () => {
    const manifest = holdingManifest();
    const candidate = appendCandidate(manifest, 'legalPublication', 'approved', 1);
    candidate.decision = {
      decisionId: 'illegal-candidate-decision',
      outcome: 'approved',
      decidedAt: candidate.occurredAt,
      decidedBy: {...AUTHORITY.legalPublication},
      candidate: {
        candidateEventId: candidate.eventId,
        repositoryCommit: candidate.candidate?.repositoryCommit ?? '',
        vercelDeploymentId: candidate.candidate?.vercelDeploymentId ?? null,
      },
      supersedesDecisionId: null,
    };
    candidate.evidence = makeEvidence(
      ['legal-review'],
      'illegal-candidate',
      candidate.occurredAt,
      null,
    );
    const errors = validateLaunchGateLifecycleManifestV3(manifest, {
      nowMs: NOW_MS,
    }).join('\n');
    assert.match(errors, /decision must be null for candidate/);
    assert.match(errors, /evidence must be empty for candidate/);
  });

  it('rejects revocation without the exact event and decision links', () => {
    const manifest = holdingManifest();
    resolveGate(manifest, 'legalPublication', 'approved', 1, 2);
    appendRevocation(manifest, 'legalPublication', 3);
    const revocation = latest(manifest, 'legalPublication');
    assert.ok(revocation.decision);
    revocation.decision = {
      ...revocation.decision,
      supersedesDecisionId: null,
    };
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /decision must link the superseded decision/,
    );
  });

  it('validates individual previous-to-next transitions with the same fail-closed graph', () => {
    const manifest = holdingManifest();
    const initial = latest(manifest, 'legalPublication');
    const candidate = appendCandidate(manifest, 'legalPublication', 'approved', 1);
    const approved = appendResolution(manifest, 'legalPublication', 'approved', 2);
    assert.deepEqual(
      validateLaunchGateTransitionV3('legalPublication', initial, candidate, {
        nowMs: NOW_MS,
      }),
      [],
    );
    assert.deepEqual(
      validateLaunchGateTransitionV3('legalPublication', candidate, approved, {
        nowMs: NOW_MS,
      }),
      [],
    );

    const direct = structuredClone(approved);
    direct.from = 'holding';
    direct.previousEventId = initial.eventId;
    assert.match(
      validateLaunchGateTransitionV3('legalPublication', initial, direct, {
        nowMs: NOW_MS,
      }).join('\n'),
      /not a legal holding -> approved transition/,
    );
  });

  it('accepts candidate resolution 1 ms before expiry and rejects it at expiry', () => {
    const manifest = holdingManifest();
    const candidate = appendCandidate(
      manifest,
      'legalPublication',
      'approved',
      1,
    );
    const approved = appendResolution(
      manifest,
      'legalPublication',
      'approved',
      2,
    );
    const beforeExpiry = new Date(
      Date.parse(candidate.validUntil as string) - 1,
    ).toISOString();
    approved.occurredAt = beforeExpiry;
    approved.decision = {
      ...approved.decision!,
      decidedAt: beforeExpiry,
    };
    approved.evidence = approved.evidence.map((entry) => ({
      ...entry,
      observedAt: beforeExpiry,
    }));
    assert.deepEqual(
      validateLaunchGateTransitionV3(
        'legalPublication',
        candidate,
        approved,
        {nowMs: NOW_MS},
      ),
      [],
    );

    const atExpiry = structuredClone(approved);
    atExpiry.occurredAt = candidate.validUntil as string;
    atExpiry.decision = {
      ...atExpiry.decision!,
      decidedAt: atExpiry.occurredAt,
    };
    atExpiry.evidence = atExpiry.evidence.map((entry) => ({
      ...entry,
      observedAt: atExpiry.occurredAt,
    }));
    assert.match(
      validateLaunchGateTransitionV3(
        'legalPublication',
        candidate,
        atExpiry,
        {nowMs: NOW_MS},
      ).join('\n'),
      /cannot transition an expired candidate/,
    );

    const candidateOnly = holdingManifest();
    appendCandidate(candidateOnly, 'legalPublication', 'approved', 1);
    const expired = resolveLaunchGateCapabilitiesV3(candidateOnly, {
      nowMs: START_MS + 11 * 60_000,
    });
    assert.equal(expired.gates.legalPublication.declaredStatus, 'candidate');
    assert.equal(expired.gates.legalPublication.effectiveStatus, 'revoked');
    assert.equal(expired.gates.legalPublication.expired, true);
  });

  it('rejects a candidate window longer than the fixed seven-day maximum', () => {
    const manifest = holdingManifest();
    const candidate = appendCandidate(
      manifest,
      'legalPublication',
      'approved',
      1,
    );
    candidate.validUntil = new Date(
      Date.parse(candidate.occurredAt) +
        MAX_LAUNCH_GATE_CANDIDATE_TTL_MS +
        1,
    ).toISOString();
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /candidate window must not exceed 7 days/,
    );
  });

  it('binds resolution, renewal, and revocation to the exact candidate subject', () => {
    const manifest = holdingManifest();
    resolveGate(manifest, 'legalPublication', 'approved', 1, 2);
    const mismatch = structuredClone(manifest);
    const decision = latest(mismatch, 'legalPublication').decision;
    assert.ok(decision);
    latest(mismatch, 'legalPublication').decision = {
      ...decision,
      candidate: {
        ...decision.candidate,
        repositoryCommit: 'b'.repeat(40),
      },
    };
    assert.match(
      validateLaunchGateLifecycleManifestV3(mismatch, {nowMs: NOW_MS}).join('\n'),
      /must exactly bind the candidate event/,
    );

    appendRenewal(manifest, 'legalPublication', 10, 120);
    const renewal = latest(manifest, 'legalPublication');
    assert.ok(renewal.decision);
    renewal.decision = {
      ...renewal.decision,
      candidate: {
        ...renewal.decision.candidate,
        vercelDeploymentId: `dpl_${'B'.repeat(20)}`,
      },
    };
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /must preserve the superseded subject/,
    );
  });

  it('enforces append-only transition between manifest snapshots', () => {
    const previous = holdingManifest();
    const next = structuredClone(previous);
    appendCandidate(next, 'legalPublication', 'approved', 1);
    assert.deepEqual(
      validateLaunchGateManifestTransitionV3(previous, next, {nowMs: NOW_MS}),
      [],
    );

    const rewritten = structuredClone(next);
    rewritten.gates.legalPublication.events[0].occurredAt = new Date(
      START_MS - 1,
    ).toISOString();
    assert.match(
      validateLaunchGateManifestTransitionV3(previous, rewritten, {
        nowMs: NOW_MS,
      }).join('\n'),
      /must exactly preserve the previous event/,
    );

    const timestampRollback = structuredClone(next);
    timestampRollback.updatedAt = previous.updatedAt;
    assert.match(
      validateLaunchGateManifestTransitionV3(previous, timestampRollback, {
        nowMs: NOW_MS,
      }).join('\n'),
      /updatedAt must advance/,
    );

    const deleted = structuredClone(next);
    deleted.gates.legalPublication.events.shift();
    assert.ok(
      validateLaunchGateManifestTransitionV3(next, deleted, {
        nowMs: NOW_MS,
      }).length > 0,
    );
  });

  it('rejects approval while a dependency was unresolved at decision time', () => {
    const manifest = holdingManifest();
    resolveGate(manifest, 'contactIntake', 'approved', 1, 2);
    assert.match(
      validateLaunchGateLifecycleManifestV3(manifest, {nowMs: NOW_MS}).join('\n'),
      /resolves while dependency legalPublication is not satisfied/,
    );
  });

  it('fails closed for unknown, missing, corrupt, future, or duplicate input', () => {
    const cases: unknown[] = [
      null,
      [],
      {schemaVersion: 3, updatedAt: atMinute(0), gates: {}, surprise: true},
      {...holdingManifest(), schemaVersion: 4},
    ];
    for (const value of cases) {
      const result = resolveLaunchGateCapabilitiesV3(value, {nowMs: NOW_MS});
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.deepEqual(result.capabilities, {
        publishLegal: false,
        enableContactIntake: false,
        publishDemos: false,
        executeLegacyCutover: false,
        declareProductionLaunch: false,
      });
    }

    const corrupt = holdingManifest();
    const event = latest(corrupt, 'legalPublication') as MutableEvent & {
      unreviewed?: boolean;
    };
    event.unreviewed = true;
    assert.equal(
      resolveLaunchGateCapabilitiesV3(corrupt, {nowMs: NOW_MS}).valid,
      false,
    );

    const duplicate = resolvedManifest();
    latest(duplicate, 'demoPublication').eventId =
      latest(duplicate, 'legalPublication').eventId;
    assert.match(
      validateLaunchGateLifecycleManifestV3(duplicate, {nowMs: NOW_MS}).join('\n'),
      /eventId must be globally unique/,
    );

    const credentialCarrier = holdingManifest();
    credentialCarrier.gates.legalPublication.description =
      `Bearer ${'a'.repeat(24)} must never enter lifecycle data`;
    assert.match(
      validateLaunchGateLifecycleManifestV3(credentialCarrier, {
        nowMs: NOW_MS,
      }).join('\n'),
      /contains credential-shaped content/,
    );
  });

  it('does not mutate v2 input or v3 manifests during migration and resolution', () => {
    const source = structuredClone(launchGateV2);
    const before = JSON.stringify(source);
    const migrated = migrateLaunchGateManifestV2ToV3(source, {nowMs: NOW_MS});
    assert.equal(JSON.stringify(source), before);
    assert.ok(migrated.manifest);
    const v3Before = JSON.stringify(migrated.manifest);
    resolveLaunchGateCapabilitiesV3(migrated.manifest, {nowMs: NOW_MS});
    assert.equal(JSON.stringify(migrated.manifest), v3Before);
  });
});
