import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import {
  canonicalJson,
  computeLegacyAuthorizationValidityRemainingMs,
  computeLegacyCutoverValidUntil,
  evaluateLegacyCutoverPreflight,
  LEGACY_CUTOVER_DECISION_EVIDENCE,
  LEGACY_CUTOVER_EVIDENCE_CHECKS,
  LEGACY_CUTOVER_EVIDENCE_KEYS,
  prepareLegacyCutoverReceiptDirectory,
  readRestrictedExternalFile,
  REQUIRED_LEGACY_PREFLIGHT_COMMANDS,
  type LegacyCutoverEvidenceKey,
  type LegacyCutoverPlan,
  validateLegacyCutoverPlan,
  verifyLegacyCutoverEvidence,
  writeLegacyCutoverReceipt,
} from '../lib/legacy-cutover-preflight';

const nowMs = Date.parse('2026-07-21T18:00:00.000Z');

function observedAtFor(key: LegacyCutoverEvidenceKey): string {
  return key === 'preCutoverDnsObservation' || key === 'preCutoverHttpTlsObservation'
    ? '2026-07-21T17:58:00.000Z'
    : '2026-07-21T17:30:00.000Z';
}

function validPlan(): LegacyCutoverPlan {
  const evidence = Object.fromEntries(
    LEGACY_CUTOVER_EVIDENCE_KEYS.map((key, index) => [
      key,
      {
        reference: `/owner-approved/evidence/${key}.json`,
        sha256: String(index + 1).padStart(64, '0'),
        observedAt: observedAtFor(key),
      },
    ]),
  ) as LegacyCutoverPlan['evidence'];
  const decisions = Object.fromEntries(
    Object.entries(LEGACY_CUTOVER_DECISION_EVIDENCE).map(([key, evidenceKey]) => [
      key,
      {
        status: 'approved',
        approvedBy: `${key} owner`,
        approvedAt: '2026-07-21T17:59:00.000Z',
        evidenceKey,
      },
    ]),
  ) as LegacyCutoverPlan['decisions'];

  return {
    schemaVersion: 1,
    cutoverId: 'help-math-legacy-2026-07-21',
    topology: 'direct-one-hop',
    repositoryCommit: 'a'.repeat(40),
    vercelDeploymentId: 'dpl_Example123',
    salesDestination: '/resources',
    owners: {
      change: 'Change owner',
      rollback: 'Rollback owner',
      dns: 'DNS administrator',
      mail: 'Mail continuity owner',
      searchConsole: 'Search Console owner',
    },
    window: {
      startsAt: '2026-07-21T18:05:00.000Z',
      monitorUntil: '2026-07-21T20:00:00.000Z',
      timezone: 'Asia/Shanghai',
    },
    ttl: {
      previousSeconds: 900,
      reducedAt: '2026-07-21T17:00:00.000Z',
    },
    rollbackThresholds: {
      consecutiveProbeFailures: 2,
      maxFiveXxPercent: 5,
      maxTimeoutPercent: 5,
      probeIntervalSeconds: 30,
      minimumProbeCount: 4,
      tlsFailureImmediate: true,
      mailRecordChangeImmediate: true,
    },
    decisions,
    evidence,
  };
}

function evidenceArtifact(
  plan: LegacyCutoverPlan,
  key: LegacyCutoverEvidenceKey,
  underlying: {reference: string; sha256: string; bytes: number},
) {
  return {
    schemaVersion: 1,
    evidenceKind: key,
    status: 'pass',
    cutoverId: plan.cutoverId,
    observedAt: plan.evidence[key].observedAt,
    repositoryCommit: plan.repositoryCommit,
    vercelDeploymentId: plan.vercelDeploymentId,
    topology: plan.topology,
    source: `Owner-approved ${key} collector receipt`,
    underlyingEvidence: {
      ...underlying,
      collector: `${key} collector`,
      collectorVersion: '1.0.0',
    },
    checks: Object.fromEntries(LEGACY_CUTOVER_EVIDENCE_CHECKS[key].map((check) => [check, true])),
  };
}

async function materializeEvidence(plan: LegacyCutoverPlan, directory: string) {
  for (const key of LEGACY_CUTOVER_EVIDENCE_KEYS) {
    const underlyingPath = path.join(directory, `${key}.underlying.json`);
    const underlyingBytes = Buffer.from(canonicalJson({key, retained: true}));
    await writeFile(underlyingPath, underlyingBytes, {mode: 0o600});
    const artifact = evidenceArtifact(plan, key, {
      reference: underlyingPath,
      sha256: createHash('sha256').update(underlyingBytes).digest('hex'),
      bytes: underlyingBytes.length,
    });
    const filePath = path.join(directory, `${key}.json`);
    const artifactBytes = Buffer.from(canonicalJson(artifact));
    await writeFile(filePath, artifactBytes, {mode: 0o600});
    plan.evidence[key].reference = filePath;
    plan.evidence[key].sha256 = createHash('sha256').update(artifactBytes).digest('hex');
  }
}

function passingEvidenceEntries() {
  return LEGACY_CUTOVER_EVIDENCE_KEYS.map((key) => ({
    key,
    reference: `/owner-approved/evidence/${key}.json`,
    expectedSha256: 'a'.repeat(64),
    actualSha256: 'a'.repeat(64),
    observedAt: observedAtFor(key),
    maxAgeMs: 60_000,
    underlyingEvidence: {
      reference: `/owner-approved/evidence/${key}.raw`,
      expectedSha256: 'b'.repeat(64),
      actualSha256: 'b'.repeat(64),
      expectedBytes: 10,
      actualBytes: 10,
      collector: `${key} collector`,
      collectorVersion: '1.0.0',
    },
    pass: true,
    errors: [] as string[],
  }));
}

function goInput(plan: LegacyCutoverPlan) {
  return {
    plan,
    planErrors: [] as string[],
    manifestErrors: [] as string[],
    gateStatuses: {
      legalPublication: 'approved',
      contactIntake: 'approved',
      legacyCutover: 'approved',
    },
    gateDependencies: {
      legacyCutover: ['legalPublication', 'contactIntake'],
    },
    repository: {head: plan.repositoryCommit, clean: true},
    commandResults: Object.fromEntries(
      REQUIRED_LEGACY_PREFLIGHT_COMMANDS.map((command) => [
        command,
        {ok: true, detail: 'status 0; signal none; error none'},
      ]),
    ),
    evidenceVerification: {
      ok: true,
      detail: `${LEGACY_CUTOVER_EVIDENCE_KEYS.length}/${LEGACY_CUTOVER_EVIDENCE_KEYS.length} external evidence artifacts verified`,
      entries: passingEvidenceEntries(),
    },
    salesDestinationObserved: '/resources',
    receiptDirectoryReady: true,
    authorizationValidityRemainingMs: 10 * 60 * 1000,
  };
}

describe('legacy-domain cutover plan', () => {
  it('accepts only a complete, time-bounded, machine-approved pre-change plan', () => {
    assert.deepEqual(validateLegacyCutoverPlan(validPlan(), {nowMs}), []);
  });

  it('binds authorization validity to the later of final decision and planned start', () => {
    const plan = validPlan();
    assert.equal(computeLegacyCutoverValidUntil(plan), '2026-07-21T18:13:00.000Z');
    assert.equal(
      computeLegacyAuthorizationValidityRemainingMs(plan, nowMs),
      8 * 60 * 1000,
    );
    plan.window.startsAt = '2026-07-21T18:30:00.000Z';
    assert.ok(computeLegacyAuthorizationValidityRemainingMs(plan, nowMs) < 0);
  });

  it('rejects unresolved decisions, secrets, stale evidence, invalid windows, and unsafe thresholds', () => {
    const plan = validPlan() as LegacyCutoverPlan & Record<string, unknown>;
    plan.owners.change = 'NAMED_OWNER';
    plan.owners.mail = 'Pending';
    plan.ttl.reducedAt = '2026-07-21T17:59:30.000Z';
    plan.window.timezone = 'Shanghai time';
    plan.window.startsAt = '2026-07-21T20:00:00.000Z';
    plan.rollbackThresholds.maxFiveXxPercent = 101;
    plan.rollbackThresholds.minimumProbeCount = 1;
    plan.rollbackThresholds.tlsFailureImmediate = false as true;
    plan.decisions.topology.status = 'holding' as 'approved';
    plan.decisions.sourceRightsAccessibility.approvedAt = '2026-07-21T17:00:00.000Z';
    plan.evidence.preCutoverDnsObservation.observedAt = '2026-07-21T17:00:00.000Z';
    delete (plan.evidence as Partial<LegacyCutoverPlan['evidence']>).mailContinuity;
    plan.accessToken = 'https://operator:password@example.com/receipt';

    const errors = validateLegacyCutoverPlan(plan, {nowMs}).join('\n');
    assert.match(errors, /unknown field accessToken/u);
    assert.match(errors, /forbidden sensitive field/u);
    assert.match(errors, /credential-shaped material/u);
    assert.match(errors, /owners\.mail must be resolved/u);
    assert.match(errors, /owners\.change must be resolved/u);
    assert.match(errors, /prior TTL has not elapsed/u);
    assert.match(errors, /valid IANA timezone/u);
    assert.match(errors, /startsAt must be within the next hour/u);
    assert.match(errors, /maxFiveXxPercent must be a number from 0 up to but not including 100/u);
    assert.match(errors, /minimumProbeCount must be an integer from 2 to 100/u);
    assert.match(errors, /tlsFailureImmediate must be true/u);
    assert.match(errors, /decisions\.topology\.status must be approved/u);
    assert.match(
      errors,
      /decisions\.sourceRightsAccessibility\.approvedAt must not precede its evidence observation/u,
    );
    assert.match(errors, /evidence\.preCutoverDnsObservation\.observedAt is older/u);
    assert.match(errors, /evidence\.mailContinuity is required/u);
  });

  it('rejects a probe schedule that cannot fit inside the monitoring window', () => {
    const plan = validPlan();
    plan.rollbackThresholds.probeIntervalSeconds = 300;
    plan.rollbackThresholds.minimumProbeCount = 100;
    assert.match(
      validateLegacyCutoverPlan(plan, {nowMs}).join('\n'),
      /monitoring window cannot fit the required probe schedule/u,
    );
  });
});

describe('legacy-domain external evidence', () => {
  it('verifies artifact and retained underlying bytes, hashes, identity, status, checks, and freshness', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-evidence-'));
    const plan = validPlan();
    await materializeEvidence(plan, directory);

    const verification = await verifyLegacyCutoverEvidence(plan, {nowMs});
    assert.equal(verification.ok, true);
    assert.equal(verification.entries.length, LEGACY_CUTOVER_EVIDENCE_KEYS.length);
    assert.equal(verification.entries.every((entry) => entry.pass), true);
    assert.equal(
      verification.entries.every(
        (entry) => entry.underlyingEvidence.actualSha256 === entry.underlyingEvidence.expectedSha256,
      ),
      true,
    );
  });

  it('fails closed on artifact tampering, underlying-evidence tampering, and credentials', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-evidence-'));
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    await writeFile(plan.evidence.productionSmoke.reference, '{"tampered":true}\n', 'utf8');
    await writeFile(
      path.join(directory, 'dnsZoneBefore.underlying.json'),
      '{"tampered":true}\n',
      'utf8',
    );

    const aliasArtifactPath = plan.evidence.productionAliasAssignment.reference;
    const underlyingPath = path.join(directory, 'productionAliasAssignment.underlying.json');
    const underlyingBytes = await readFile(underlyingPath);
    const aliasArtifact = evidenceArtifact(plan, 'productionAliasAssignment', {
      reference: underlyingPath,
      sha256: createHash('sha256').update(underlyingBytes).digest('hex'),
      bytes: underlyingBytes.length,
    });
    aliasArtifact.source = 'https://operator:password@example.com/receipt';
    const aliasBytes = Buffer.from(canonicalJson(aliasArtifact));
    await writeFile(aliasArtifactPath, aliasBytes);
    plan.evidence.productionAliasAssignment.sha256 = createHash('sha256')
      .update(aliasBytes)
      .digest('hex');

    const verification = await verifyLegacyCutoverEvidence(plan, {nowMs});
    assert.equal(verification.ok, false);
    assert.match(
      verification.entries.find((entry) => entry.key === 'productionSmoke')?.errors.join('\n') ?? '',
      /SHA-256 does not match/u,
    );
    assert.match(
      verification.entries.find((entry) => entry.key === 'dnsZoneBefore')?.errors.join('\n') ?? '',
      /underlying evidence (?:SHA-256|byte length) does not match/u,
    );
    assert.match(
      verification.entries
        .find((entry) => entry.key === 'productionAliasAssignment')
        ?.errors.join('\n') ?? '',
      /credential-shaped material/u,
    );
  });

  it('rejects a lexically external path that resolves into the repository through an ancestor link', async () => {
    const fakeRepository = await mkdtemp(path.join(tmpdir(), 'helpmath-fake-repository-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'helpmath-external-link-'));
    const insideFile = path.join(fakeRepository, 'inside.json');
    await writeFile(insideFile, '{}\n', {mode: 0o600});
    await symlink(fakeRepository, path.join(outside, 'repository-link'), 'dir');

    await assert.rejects(
      readRestrictedExternalFile(path.join(outside, 'repository-link', 'inside.json'), {
        repositoryRoot: await realpath(fakeRepository),
      }),
      /resolves inside the repository/u,
    );
  });

  it('rejects an external hard link that shares an inode with a repository file', async () => {
    const fakeRepository = await mkdtemp(path.join(tmpdir(), 'helpmath-hard-link-repository-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'helpmath-external-hard-link-'));
    const insideFile = path.join(fakeRepository, 'inside.json');
    const outsideHardLink = path.join(outside, 'hard-link.json');
    await writeFile(insideFile, '{}\n', {mode: 0o600});
    await link(insideFile, outsideHardLink);

    await assert.rejects(
      readRestrictedExternalFile(outsideHardLink, {
        repositoryRoot: await realpath(fakeRepository),
      }),
      /exactly one hard link/u,
    );
  });

  it('records canonical artifact and underlying paths reached through an external ancestor link', async () => {
    const evidenceDirectory = await mkdtemp(path.join(tmpdir(), 'helpmath-canonical-evidence-'));
    const aliasDirectory = await mkdtemp(path.join(tmpdir(), 'helpmath-canonical-alias-'));
    const aliasRoot = path.join(aliasDirectory, 'evidence-link');
    const plan = validPlan();
    await materializeEvidence(plan, evidenceDirectory);
    await symlink(evidenceDirectory, aliasRoot, 'dir');

    for (const key of LEGACY_CUTOVER_EVIDENCE_KEYS) {
      plan.evidence[key].reference = path.join(aliasRoot, `${key}.json`);
    }

    const key = 'dnsZoneBefore';
    const canonicalUnderlyingPath = path.join(evidenceDirectory, `${key}.underlying.json`);
    const aliasUnderlyingPath = path.join(aliasRoot, `${key}.underlying.json`);
    const underlyingBytes = await readFile(canonicalUnderlyingPath);
    const artifactBytes = Buffer.from(canonicalJson(evidenceArtifact(plan, key, {
      reference: aliasUnderlyingPath,
      sha256: createHash('sha256').update(underlyingBytes).digest('hex'),
      bytes: underlyingBytes.length,
    })));
    await writeFile(path.join(evidenceDirectory, `${key}.json`), artifactBytes, {mode: 0o600});
    plan.evidence[key].sha256 = createHash('sha256').update(artifactBytes).digest('hex');

    const verification = await verifyLegacyCutoverEvidence(plan, {nowMs});
    const entry = verification.entries.find((candidate) => candidate.key === key);
    assert.equal(verification.ok, true);
    assert.equal(entry?.reference, await realpath(path.join(evidenceDirectory, `${key}.json`)));
    assert.equal(entry?.underlyingEvidence.reference, await realpath(canonicalUnderlyingPath));
  });
});

describe('legacy-domain cutover decision', () => {
  it('keeps the cutover at NO_GO while the holding-only transition lock is active', () => {
    const evaluation = evaluateLegacyCutoverPreflight(goInput(validPlan()));
    assert.equal(evaluation.decision, 'NO_GO');
    assert.deepEqual(evaluation.failures, [
      'holding-only-transition-lock: launch-gate transitions are locked; legacy cutover cannot be authorized',
    ]);
  });

  it('fails closed for holding gates, a dirty tree, incomplete evidence, missing commands, and no receipt store', () => {
    const plan = validPlan();
    const input = goInput(plan);
    input.gateStatuses.legalPublication = 'holding';
    input.gateStatuses.contactIntake = 'holding';
    input.gateStatuses.legacyCutover = 'holding';
    input.repository.clean = false;
    delete input.commandResults['test:legacy-apache'];
    input.evidenceVerification.entries.pop();
    input.receiptDirectoryReady = false;
    input.authorizationValidityRemainingMs = 1;

    const evaluation = evaluateLegacyCutoverPreflight(input);
    assert.equal(evaluation.decision, 'NO_GO');
    assert.match(evaluation.failures.join('\n'), /legal-approved/u);
    assert.match(evaluation.failures.join('\n'), /contact-approved/u);
    assert.match(evaluation.failures.join('\n'), /legacy-cutover-approved/u);
    assert.match(evaluation.failures.join('\n'), /repository-clean/u);
    assert.match(evaluation.failures.join('\n'), /command:test:legacy-apache/u);
    assert.match(evaluation.failures.join('\n'), /external-evidence-verified/u);
    assert.match(evaluation.failures.join('\n'), /receipt-directory-ready/u);
    assert.match(evaluation.failures.join('\n'), /authorization-validity-buffer/u);
  });
});

describe('legacy-domain cutover receipt', () => {
  it('uses canonical JSON and writes a private content-addressed receipt and companion hash', async () => {
    assert.equal(canonicalJson({z: 1, a: {z: 2, a: 3}}), '{"a":{"a":3,"z":2},"z":1}\n');
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-receipt-'));
    await chmod(directory, 0o700);
    const receipt = {schemaVersion: 3, decision: 'NO_GO', failures: ['owner gate pending']};
    const written = await writeLegacyCutoverReceipt(directory, receipt);
    const [jsonBytes, hashContents, jsonStat, hashStat] = await Promise.all([
      readFile(written.jsonPath),
      readFile(written.sha256Path, 'utf8'),
      stat(written.jsonPath),
      stat(written.sha256Path),
    ]);

    assert.equal(jsonBytes.toString('utf8'), canonicalJson(receipt));
    assert.equal(hashContents, `${written.sha256}  ${path.basename(written.jsonPath)}\n`);
    assert.equal(jsonStat.mode & 0o777, 0o600);
    assert.equal(hashStat.mode & 0o777, 0o600);
  });

  it('rejects permissive directories and ancestor links that resolve into the repository', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-receipt-'));
    await chmod(directory, 0o755);
    await assert.rejects(
      prepareLegacyCutoverReceiptDirectory(directory),
      /must not grant group or other permissions/u,
    );

    const fakeRepository = await mkdtemp(path.join(tmpdir(), 'helpmath-fake-repository-'));
    const receipts = path.join(fakeRepository, 'receipts');
    await mkdir(receipts, {mode: 0o700});
    const outside = await mkdtemp(path.join(tmpdir(), 'helpmath-external-link-'));
    await symlink(fakeRepository, path.join(outside, 'repository-link'), 'dir');
    await assert.rejects(
      prepareLegacyCutoverReceiptDirectory(
        path.join(outside, 'repository-link', 'receipts'),
        {repositoryRoot: await realpath(fakeRepository)},
      ),
      /resolves inside the repository/u,
    );
  });

  it('does not publish a GO receipt after its minimum validity buffer expires', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-receipt-'));
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        {schemaVersion: 3, decision: 'GO_TO_CHANGE'},
        {notAfter: '2000-01-01T00:00:00.000Z', minimumRemainingMs: 300_000},
      ),
      /validity buffer expired/u,
    );
    assert.deepEqual(await readdir(directory), []);
  });

  it('never deletes an existing append-only receipt when a filename collides', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpmath-cutover-receipt-'));
    const receipt = {schemaVersion: 3, decision: 'NO_GO', failures: ['retained']};
    const options = {fileTimestamp: '2026-07-21T18:30:00.000Z'};
    const first = await writeLegacyCutoverReceipt(directory, receipt, options);
    const original = await Promise.all([
      readFile(first.jsonPath),
      readFile(first.sha256Path),
    ]);

    await assert.rejects(
      writeLegacyCutoverReceipt(directory, receipt, options),
      /EEXIST/u,
    );
    assert.deepEqual(
      await Promise.all([readFile(first.jsonPath), readFile(first.sha256Path)]),
      original,
    );
  });
});
