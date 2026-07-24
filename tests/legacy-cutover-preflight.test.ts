import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canonicalJson,
  computeLegacyAuthorizationValidityRemainingMs,
  computeLegacyCutoverValidUntil,
  evaluateLegacyCutoverPreflight,
  getLegacyCutoverDecisionEvidence,
  getLegacyCutoverEvidenceKeys,
  LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE,
  LEGACY_CUTOVER_EVIDENCE_CHECKS,
  LEGACY_CUTOVER_EVIDENCE_KEYS,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_REF,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW,
  LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH,
  parseCanonicalLegacyJson,
  prepareLegacyCutoverReceiptDirectory,
  readRestrictedExternalFile,
  REQUIRED_LEGACY_PREFLIGHT_COMMANDS,
  type LegacyCutoverPreflightInput,
  type LegacyCutoverEvidenceKey,
  type LegacyCutoverEvidenceReference,
  type LegacyCutoverContactMode,
  type LegacyCutoverProductionQualityEvidenceBundle,
  type LegacyCutoverPlan,
  validateLegacyCutoverPlan,
  verifyLegacyCutoverEvidence,
  writeLegacyCutoverReceipt,
} from "../lib/legacy-cutover-preflight";

const nowMs = Date.parse("2026-07-21T18:00:00.000Z");

function observedAtFor(key: LegacyCutoverEvidenceKey): string {
  return key === "preCutoverDnsObservation" ||
    key === "preCutoverHttpTlsObservation"
    ? "2026-07-21T17:58:00.000Z"
    : "2026-07-21T17:30:00.000Z";
}

function validPlan(
  contactMode: LegacyCutoverContactMode = "enabled",
): LegacyCutoverPlan {
  const evidenceKeys = getLegacyCutoverEvidenceKeys(contactMode);
  const evidence = Object.fromEntries(
    evidenceKeys.map((key, index) => [
      key,
      {
        reference: `/owner-approved/evidence/${key}.json`,
        sha256: String(index + 1).padStart(64, "0"),
        observedAt: observedAtFor(key),
      },
    ]),
  ) as LegacyCutoverPlan["evidence"];
  const decisions = Object.fromEntries(
    Object.entries(getLegacyCutoverDecisionEvidence(contactMode)).map(
      ([key, evidenceKey]) => [
        key,
        {
          status: "approved",
          approvedBy: `${key} owner`,
          approvedAt: "2026-07-21T17:59:00.000Z",
          evidenceKey,
        },
      ],
    ),
  ) as LegacyCutoverPlan["decisions"];

  return {
    schemaVersion: 2,
    cutoverId: "help-math-legacy-2026-07-21",
    topology: "direct-one-hop",
    repositoryCommit: "a".repeat(40),
    vercelDeploymentId: "dpl_Example123",
    contactMode,
    salesDestination: "/resources",
    owners: {
      change: "Change owner",
      rollback: "Rollback owner",
      dns: "DNS administrator",
      mail: "Mail continuity owner",
      searchConsole: "Search Console owner",
    },
    window: {
      startsAt: "2026-07-21T18:05:00.000Z",
      monitorUntil: "2026-07-21T20:00:00.000Z",
      timezone: "Asia/Shanghai",
    },
    ttl: {
      previousSeconds: 900,
      reducedAt: "2026-07-21T17:00:00.000Z",
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

function planEvidence(
  plan: LegacyCutoverPlan,
  key: LegacyCutoverEvidenceKey,
): LegacyCutoverEvidenceReference {
  const evidence = plan.evidence[key];
  assert.ok(evidence, `expected evidence ${key}`);
  return evidence;
}

function productionQualityEvidenceBundle(
  plan: LegacyCutoverPlan,
): LegacyCutoverProductionQualityEvidenceBundle {
  const runId = 29_921_608_812;
  const runAttempt = 1;
  const runUrl =
    "https://github.com/HUDongpin/helpmath-web/actions/runs/29921608812";
  const jobs = [
    {
      name: "verify",
      id: 1001,
      started_at: "2026-07-21T17:05:00Z",
      completed_at: "2026-07-21T17:25:00Z",
      steps: [LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP],
    },
    {
      name: "browser-quality",
      id: 1002,
      started_at: "2026-07-21T17:06:00Z",
      completed_at: "2026-07-21T17:28:00Z",
      steps: ["Enforce Chromium, Firefox, and WebKit browser contracts"],
    },
    {
      name: "lighthouse",
      id: 1003,
      started_at: "2026-07-21T17:07:00Z",
      completed_at: "2026-07-21T17:29:00Z",
      steps: [
        LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS[0],
        "Enforce Lighthouse performance budgets",
        LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS[1],
        LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS[2],
        "Retain Lighthouse reports",
      ],
    },
  ] as const;
  return {
    schemaVersion: 1,
    source: LEGACY_CUTOVER_PRODUCTION_QUALITY_EVIDENCE_SOURCE,
    apiVersion: LEGACY_CUTOVER_PRODUCTION_QUALITY_API_VERSION,
    requests: {
      run: `https://api.github.com/repos/HUDongpin/helpmath-web/actions/runs/${String(runId)}`,
      workflow:
        "https://api.github.com/repos/HUDongpin/helpmath-web/actions/workflows/2001",
      jobs:
        `https://api.github.com/repos/HUDongpin/helpmath-web/actions/runs/${String(runId)}` +
        `/attempts/${String(runAttempt)}/jobs?per_page=100`,
    },
    run: {
      id: runId,
      run_attempt: runAttempt,
      workflow_id: 2001,
      name: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW,
      path: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH,
      event: LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT,
      status: "completed",
      conclusion: "success",
      head_branch: LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH,
      head_sha: plan.repositoryCommit,
      html_url: runUrl,
      repository: {
        full_name: LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY,
      },
      head_repository: {
        full_name: LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY,
      },
      created_at: "2026-07-21T17:00:00Z",
      run_started_at: "2026-07-21T17:05:00Z",
      updated_at: "2026-07-21T17:30:00Z",
    },
    workflow: {
      id: 2001,
      name: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW,
      path: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH,
      state: "active",
      url: "https://api.github.com/repos/HUDongpin/helpmath-web/actions/workflows/2001",
    },
    jobs: {
      total_count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        run_id: runId,
        run_attempt: runAttempt,
        name: job.name,
        head_sha: plan.repositoryCommit,
        status: "completed",
        conclusion: "success",
        started_at: job.started_at,
        completed_at: job.completed_at,
        html_url: `${runUrl}/job/${String(job.id)}`,
        steps: job.steps.map((step, index) => ({
          number: index + 1,
          name: step,
          status: "completed",
          conclusion: "success",
        })),
      })),
    },
  };
}

function setProductionQualityRunAttempt(
  bundle: LegacyCutoverProductionQualityEvidenceBundle,
  runAttempt: number,
): void {
  bundle.run.run_attempt = runAttempt;
  bundle.requests.jobs =
    `https://api.github.com/repos/HUDongpin/helpmath-web/actions/runs/${String(bundle.run.id)}` +
    `/attempts/${String(runAttempt)}/jobs?per_page=100`;
  for (const job of bundle.jobs.jobs) {
    job.run_attempt = runAttempt;
  }
}

function evidenceArtifact(
  plan: LegacyCutoverPlan,
  key: LegacyCutoverEvidenceKey,
  underlying: { reference: string; sha256: string; bytes: number },
) {
  return {
    schemaVersion: 1,
    evidenceKind: key,
    status: "pass",
    cutoverId: plan.cutoverId,
    observedAt: planEvidence(plan, key).observedAt,
    repositoryCommit: plan.repositoryCommit,
    vercelDeploymentId: plan.vercelDeploymentId,
    topology: plan.topology,
    source: `Owner-approved ${key} collector receipt`,
    underlyingEvidence: {
      ...underlying,
      collector: `${key} collector`,
      collectorVersion: "1.0.0",
    },
    checks: Object.fromEntries(
      LEGACY_CUTOVER_EVIDENCE_CHECKS[key].map((check) => [check, true]),
    ),
    qualityRun:
      key === "productionQuality"
        ? {
            repository: LEGACY_CUTOVER_PRODUCTION_QUALITY_REPOSITORY,
            workflow: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW,
            workflowPath: LEGACY_CUTOVER_PRODUCTION_QUALITY_WORKFLOW_PATH,
            event: LEGACY_CUTOVER_PRODUCTION_QUALITY_EVENT,
            ref: LEGACY_CUTOVER_PRODUCTION_QUALITY_REF,
            headBranch: LEGACY_CUTOVER_PRODUCTION_QUALITY_BRANCH,
            headSha: plan.repositoryCommit,
            runId: 29_921_608_812,
            runAttempt: 1,
            runUrl:
              "https://github.com/HUDongpin/helpmath-web/actions/runs/29921608812",
            conclusion: "success" as const,
            launchTransition: {
              job: "verify" as const,
              step: LEGACY_CUTOVER_PRODUCTION_QUALITY_TRANSITION_STEP,
              conclusion: "success" as const,
            },
            jobs: Object.fromEntries(
              LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS.map((job) => [
                job,
                "success",
              ]),
            ),
          }
        : undefined,
  };
}

async function materializeEvidence(plan: LegacyCutoverPlan, directory: string) {
  for (const key of getLegacyCutoverEvidenceKeys(plan.contactMode)) {
    const underlyingPath = path.join(directory, `${key}.underlying.json`);
    const underlyingBytes = Buffer.from(
      canonicalJson(
        key === "productionQuality"
          ? productionQualityEvidenceBundle(plan)
          : { key, retained: true },
      ),
    );
    await writeFile(underlyingPath, underlyingBytes, { mode: 0o600 });
    const artifact = evidenceArtifact(plan, key, {
      reference: underlyingPath,
      sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
      bytes: underlyingBytes.length,
    });
    const filePath = path.join(directory, `${key}.json`);
    const artifactBytes = Buffer.from(canonicalJson(artifact));
    await writeFile(filePath, artifactBytes, { mode: 0o600 });
    const evidence = planEvidence(plan, key);
    evidence.reference = filePath;
    evidence.sha256 = createHash("sha256").update(artifactBytes).digest("hex");
  }
}

async function writeProductionQualityEvidence(
  plan: LegacyCutoverPlan,
  directory: string,
  bundle: LegacyCutoverProductionQualityEvidenceBundle,
  mutateArtifact?: (
    artifact: ReturnType<typeof evidenceArtifact>,
  ) => void,
) {
  const underlyingPath = path.join(
    directory,
    "productionQuality.underlying.json",
  );
  const underlyingBytes = Buffer.from(canonicalJson(bundle));
  await writeFile(underlyingPath, underlyingBytes, { mode: 0o600 });
  const artifact = evidenceArtifact(plan, "productionQuality", {
    reference: underlyingPath,
    sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
    bytes: underlyingBytes.length,
  });
  mutateArtifact?.(artifact);
  const artifactPath = path.join(directory, "productionQuality.json");
  const artifactBytes = Buffer.from(canonicalJson(artifact));
  await writeFile(artifactPath, artifactBytes, { mode: 0o600 });
  const evidence = planEvidence(plan, "productionQuality");
  evidence.reference = artifactPath;
  evidence.sha256 = createHash("sha256").update(artifactBytes).digest("hex");
  return { artifact, artifactPath, underlyingPath };
}

function passingEvidenceEntries(plan: LegacyCutoverPlan) {
  return getLegacyCutoverEvidenceKeys(plan.contactMode).map((key) => ({
    key,
    reference: `/owner-approved/evidence/${key}.json`,
    expectedSha256: "a".repeat(64),
    actualSha256: "a".repeat(64),
    observedAt: observedAtFor(key),
    maxAgeMs: 60_000,
    underlyingEvidence: {
      reference: `/owner-approved/evidence/${key}.raw`,
      expectedSha256: "b".repeat(64),
      actualSha256: "b".repeat(64),
      expectedBytes: 10,
      actualBytes: 10,
      collector: `${key} collector`,
      collectorVersion: "1.0.0",
    },
    pass: true,
    errors: [] as string[],
  }));
}

function goInput(plan: LegacyCutoverPlan): LegacyCutoverPreflightInput {
  return {
    plan,
    planErrors: [] as string[],
    manifestErrors: [] as string[],
    gateStatuses: {
      legalPublication: "approved",
      contactIntake: "approved",
      legacyCutover: "approved",
    },
    gateDependencies: {
      legacyCutover: ["legalPublication", "contactIntake"],
    },
    gateAuthorizations: {
      legalPublication: {
        decisionId: "decision-legal-publication-20260721",
        repositoryCommit: plan.repositoryCommit,
        vercelDeploymentId: null,
        validUntil: "2026-07-21T19:00:00.000Z",
      },
      contactIntake: {
        decisionId: "decision-contact-intake-20260721",
        repositoryCommit: plan.repositoryCommit,
        vercelDeploymentId: plan.vercelDeploymentId,
        validUntil: "2026-07-21T19:00:00.000Z",
      },
      legacyCutover: {
        decisionId: "decision-legacy-cutover-20260721",
        repositoryCommit: plan.repositoryCommit,
        vercelDeploymentId: plan.vercelDeploymentId,
        validUntil: "2026-07-21T19:00:00.000Z",
      },
    },
    decisionTimeMs: nowMs,
    repository: {
      head: plan.repositoryCommit,
      clean: true,
      candidateCommitExists: true,
      candidateIsAncestor: true,
    },
    commandResults: Object.fromEntries(
      REQUIRED_LEGACY_PREFLIGHT_COMMANDS.map((command) => [
        command,
        { ok: true, detail: "status 0; signal none; error none" },
      ]),
    ),
    evidenceVerification: {
      ok: true,
      detail: `${getLegacyCutoverEvidenceKeys(plan.contactMode).length}/${getLegacyCutoverEvidenceKeys(plan.contactMode).length} external evidence artifacts verified`,
      entries: passingEvidenceEntries(plan),
    },
    salesDestinationObserved: "/resources",
    receiptDirectoryReady: true,
  };
}

describe("legacy-domain cutover plan", () => {
  it("pins the complete contact-delivery evidence contract independently of fixtures", () => {
    assert.deepEqual(LEGACY_CUTOVER_EVIDENCE_CHECKS.contactDelivery, [
      "repositoryGateApproved",
      "productionEnvironmentEnabled",
      "retentionAndInboxOwnersConfirmed",
      "turnstileProductionPassed",
      "endToEndDeliveryPassed",
      "replyToPassed",
      "sameOriginPassed",
      "honeypotPassed",
      "edgeRateLimitPassed",
      "malformedBodyRejected",
      "oversizedBodyRejected",
      "invalidTurnstileRejected",
      "replayedTurnstileRejected",
      "automatedSubmissionHandled",
      "abusiveSubmissionHandled",
      "logRedactionPassed",
      "failureRollbackDispositionRecorded",
    ]);
    assert.deepEqual(LEGACY_CUTOVER_EVIDENCE_CHECKS.contactDisabled, [
      "repositoryGateDisabled",
      "contactPageUnavailable",
      "contactApiFailsClosed",
      "noDeliveryAttempted",
      "alternateSupportRouteVerified",
    ]);
    assert.deepEqual(LEGACY_CUTOVER_CONTACT_DECISION_EVIDENCE, {
      enabled: "contactDelivery",
      disabled: "contactDisabled",
    });
    assert.equal(
      getLegacyCutoverEvidenceKeys("enabled").length,
      LEGACY_CUTOVER_EVIDENCE_KEYS.length - 1,
    );
    assert.equal(
      getLegacyCutoverEvidenceKeys("disabled").length,
      LEGACY_CUTOVER_EVIDENCE_KEYS.length - 1,
    );
  });

  it("accepts only a complete, time-bounded, machine-approved pre-change plan", () => {
    assert.deepEqual(validateLegacyCutoverPlan(validPlan(), { nowMs }), []);
    assert.deepEqual(
      validateLegacyCutoverPlan(validPlan("disabled"), { nowMs }),
      [],
    );
  });

  it("fails closed for a non-finite validation clock and excessive nesting", () => {
    assert.match(
      validateLegacyCutoverPlan(validPlan(), { nowMs: Number.NaN }).join("\n"),
      /nowMs must be a finite timestamp/u,
    );
    const plan = validPlan() as LegacyCutoverPlan & Record<string, unknown>;
    let nested: Record<string, unknown> = {};
    plan.excessiveNesting = nested;
    for (let depth = 0; depth < 150; depth += 1) {
      const child: Record<string, unknown> = {};
      nested.child = child;
      nested = child;
    }
    assert.match(
      validateLegacyCutoverPlan(plan, { nowMs }).join("\n"),
      /exceeds the supported 100-level nesting limit/u,
    );
  });

  it("rejects duplicate-key and noncanonical external JSON bytes", () => {
    const duplicate = Buffer.from(
      '{"repositoryCommit":"b","repositoryCommit":"a"}\n',
    );
    const parsed = parseCanonicalLegacyJson(duplicate, "cutover plan");
    assert.equal(parsed.canonical, false);
    assert.match(
      parsed.errors.join("\n"),
      /canonical sorted JSON with no duplicate object keys/u,
    );
  });

  it("binds the selected contact disposition to its evidence and alternate route", () => {
    const disabled = validPlan("disabled");
    disabled.salesDestination = "/contact";
    disabled.decisions.contactDisposition.evidenceKey = "contactDelivery";
    const errors = validateLegacyCutoverPlan(disabled, { nowMs }).join("\n");
    assert.match(
      errors,
      /salesDestination must be \/resources when contactMode is disabled/u,
    );
    assert.match(
      errors,
      /decisions\.contactDisposition\.evidenceKey must be contactDisabled/u,
    );

    const enabled = validPlan("enabled") as LegacyCutoverPlan & {
      evidence: Record<string, LegacyCutoverEvidenceReference>;
    };
    enabled.evidence.contactDisabled = {
      reference: "/owner-approved/evidence/contactDisabled.json",
      sha256: "f".repeat(64),
      observedAt: "2026-07-21T17:30:00.000Z",
    };
    assert.match(
      validateLegacyCutoverPlan(enabled, { nowMs }).join("\n"),
      /plan\.evidence contains unknown field contactDisabled/u,
    );
  });

  it("binds authorization validity to the later of final decision and planned start", () => {
    const plan = validPlan();
    assert.equal(
      computeLegacyCutoverValidUntil(plan),
      "2026-07-21T18:13:00.000Z",
    );
    assert.equal(
      computeLegacyAuthorizationValidityRemainingMs(plan, nowMs),
      8 * 60 * 1000,
    );
    plan.window.startsAt = "2026-07-21T18:30:00.000Z";
    assert.ok(computeLegacyAuthorizationValidityRemainingMs(plan, nowMs) < 0);
  });

  it("bounds authorization and receipt validity by every required gate decision", () => {
    const plan = validPlan();
    const gateValidUntils = [
      "2026-07-21T18:12:00.000Z",
      "2026-07-21T18:09:00.000Z",
      "2026-07-21T18:11:00.000Z",
    ];
    assert.equal(
      computeLegacyCutoverValidUntil(plan, gateValidUntils),
      "2026-07-21T18:09:00.000Z",
    );
    assert.equal(
      computeLegacyAuthorizationValidityRemainingMs(
        plan,
        nowMs,
        gateValidUntils,
      ),
      4 * 60 * 1000,
    );
  });

  it("rejects evidence and approvals even one millisecond in the future", () => {
    const plan = validPlan();
    plan.decisions.topology.approvedAt = new Date(nowMs + 1).toISOString();
    planEvidence(plan, "dnsZoneBefore").observedAt = new Date(
      nowMs + 1,
    ).toISOString();
    const errors = validateLegacyCutoverPlan(plan, { nowMs }).join("\n");
    assert.match(
      errors,
      /plan\.decisions\.topology\.approvedAt cannot be in the future/u,
    );
    assert.match(
      errors,
      /plan\.evidence\.dnsZoneBefore\.observedAt cannot be in the future/u,
    );
  });

  it("rejects unresolved decisions, secrets, stale evidence, invalid windows, and unsafe thresholds", () => {
    const plan = validPlan() as LegacyCutoverPlan & Record<string, unknown>;
    plan.owners.change = "NAMED_OWNER";
    plan.owners.mail = "Pending";
    plan.ttl.reducedAt = "2026-07-21T17:59:30.000Z";
    plan.window.timezone = "Shanghai time";
    plan.window.startsAt = "2026-07-21T20:00:00.000Z";
    plan.rollbackThresholds.maxFiveXxPercent = 101;
    plan.rollbackThresholds.minimumProbeCount = 1;
    plan.rollbackThresholds.tlsFailureImmediate = false as true;
    plan.decisions.topology.status = "holding" as "approved";
    plan.decisions.sourceRightsAccessibility.approvedAt =
      "2026-07-21T17:00:00.000Z";
    planEvidence(plan, "preCutoverDnsObservation").observedAt =
      "2026-07-21T17:00:00.000Z";
    delete (plan.evidence as Partial<LegacyCutoverPlan["evidence"]>)
      .mailContinuity;
    plan.accessToken = "https://operator:password@example.com/receipt";

    const errors = validateLegacyCutoverPlan(plan, { nowMs }).join("\n");
    assert.match(errors, /unknown field accessToken/u);
    assert.match(errors, /forbidden sensitive field/u);
    assert.match(errors, /credential-shaped material/u);
    assert.match(errors, /owners\.mail must be resolved/u);
    assert.match(errors, /owners\.change must be resolved/u);
    assert.match(errors, /prior TTL has not elapsed/u);
    assert.match(errors, /valid IANA timezone/u);
    assert.match(errors, /startsAt must be within the next hour/u);
    assert.match(
      errors,
      /maxFiveXxPercent must be a number from 0 up to but not including 100/u,
    );
    assert.match(errors, /minimumProbeCount must be an integer from 2 to 100/u);
    assert.match(errors, /tlsFailureImmediate must be true/u);
    assert.match(errors, /decisions\.topology\.status must be approved/u);
    assert.match(
      errors,
      /decisions\.sourceRightsAccessibility\.approvedAt must not precede its evidence observation/u,
    );
    assert.match(
      errors,
      /evidence\.preCutoverDnsObservation\.observedAt is older/u,
    );
    assert.match(errors, /evidence\.mailContinuity is required/u);
  });

  it("rejects a probe schedule that cannot fit inside the monitoring window", () => {
    const plan = validPlan();
    plan.rollbackThresholds.probeIntervalSeconds = 300;
    plan.rollbackThresholds.minimumProbeCount = 100;
    assert.match(
      validateLegacyCutoverPlan(plan, { nowMs }).join("\n"),
      /monitoring window cannot fit the required probe schedule/u,
    );
  });
});

describe("legacy-domain external evidence", () => {
  it("verifies artifact and retained underlying bytes, hashes, identity, status, checks, and freshness", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-evidence-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    assert.equal(verification.ok, true);
    assert.equal(
      verification.entries.length,
      getLegacyCutoverEvidenceKeys(plan.contactMode).length,
    );
    assert.equal(
      verification.entries.every((entry) => entry.pass),
      true,
    );
    assert.equal(
      verification.entries.every(
        (entry) =>
          entry.underlyingEvidence.actualSha256 ===
          entry.underlyingEvidence.expectedSha256,
      ),
      true,
    );
  });

  it("verifies the disabled contact path without requiring delivery evidence", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-evidence-"),
    );
    const plan = validPlan("disabled");
    await materializeEvidence(plan, directory);

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const keys = verification.entries.map((entry) => entry.key);
    assert.equal(verification.ok, true);
    assert.equal(keys.includes("contactDisabled"), true);
    assert.equal(keys.includes("contactDelivery"), false);
    assert.equal(
      verification.entries.find((entry) => entry.key === "contactDisabled")
        ?.pass,
      true,
    );
  });

  it("rejects the old aggregate contact receipt and every missing granular security result", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-evidence-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const contactDeliveryEvidence = planEvidence(plan, "contactDelivery");
    const artifactPath = contactDeliveryEvidence.reference;
    const underlyingPath = path.join(
      directory,
      "contactDelivery.underlying.json",
    );
    const underlyingBytes = await readFile(underlyingPath);
    const artifact = evidenceArtifact(plan, "contactDelivery", {
      reference: underlyingPath,
      sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
      bytes: underlyingBytes.length,
    });
    artifact.checks = {
      repositoryGateApproved: true,
      productionEnvironmentEnabled: true,
      verifiedSubmissionDelivered: true,
      retentionAndInboxOwnersConfirmed: true,
    };
    const artifactBytes = Buffer.from(canonicalJson(artifact));
    await writeFile(artifactPath, artifactBytes, { mode: 0o600 });
    contactDeliveryEvidence.sha256 = createHash("sha256")
      .update(artifactBytes)
      .digest("hex");

    const oldContract = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const oldErrors =
      oldContract.entries
        .find((entry) => entry.key === "contactDelivery")
        ?.errors.join("\n") ?? "";
    assert.equal(oldContract.ok, false);
    assert.match(oldErrors, /unknown field verifiedSubmissionDelivered/u);
    for (const required of [
      "replyToPassed",
      "sameOriginPassed",
      "edgeRateLimitPassed",
      "replayedTurnstileRejected",
      "abusiveSubmissionHandled",
      "logRedactionPassed",
    ]) {
      assert.match(
        oldErrors,
        new RegExp(`checks\\.${required} must be true`, "u"),
      );
    }
  });

  it("rejects manual Quality runs and missing, skipped, or failed release checks", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-evidence-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const productionQualityEvidence = planEvidence(plan, "productionQuality");
    const artifactPath = productionQualityEvidence.reference;
    const underlyingPath = path.join(
      directory,
      "productionQuality.underlying.json",
    );
    const underlyingBytes = await readFile(underlyingPath);
    const artifact = evidenceArtifact(plan, "productionQuality", {
      reference: underlyingPath,
      sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
      bytes: underlyingBytes.length,
    });
    assert.ok(artifact.qualityRun);
    const untrustedQualityRun = artifact.qualityRun as unknown as {
      repository: string;
      workflowPath: string;
      event: string;
      ref: string;
      headBranch: string;
      runId: number;
      runAttempt: number;
      runUrl: string;
      launchTransition?: unknown;
      jobs: Partial<
        Record<
          (typeof LEGACY_CUTOVER_PRODUCTION_QUALITY_JOBS)[number],
          string
        >
      >;
    };
    untrustedQualityRun.repository = "attacker/helpmath-web-fork";
    untrustedQualityRun.workflowPath = ".github/workflows/fake-quality.yml";
    untrustedQualityRun.event = "workflow_dispatch";
    untrustedQualityRun.ref = "refs/heads/release";
    untrustedQualityRun.headBranch = "release";
    untrustedQualityRun.runId = 0;
    untrustedQualityRun.runAttempt = 0;
    untrustedQualityRun.runUrl =
      "https://github.com/attacker/helpmath-web-fork/actions/runs/29921608812";
    delete untrustedQualityRun.launchTransition;
    untrustedQualityRun.jobs.verify = "skipped";
    delete untrustedQualityRun.jobs["browser-quality"];
    untrustedQualityRun.jobs.lighthouse = "failure";

    const artifactBytes = Buffer.from(canonicalJson(artifact));
    await writeFile(artifactPath, artifactBytes, { mode: 0o600 });
    productionQualityEvidence.sha256 = createHash("sha256")
      .update(artifactBytes)
      .digest("hex");

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /qualityRun\.repository must be HUDongpin\/helpmath-web/u,
    );
    assert.match(
      errors,
      /qualityRun\.workflowPath must be \.github\/workflows\/quality\.yml/u,
    );
    assert.match(
      errors,
      /qualityRun\.event must be push; workflow_dispatch and pull_request runs are not Production release evidence/u,
    );
    assert.match(errors, /qualityRun\.ref must be refs\/heads\/main/u);
    assert.match(errors, /qualityRun\.headBranch must be main/u);
    assert.match(
      errors,
      /qualityRun\.runId must be a positive safe integer/u,
    );
    assert.match(
      errors,
      /qualityRun\.runAttempt must be 1 or 2/u,
    );
    assert.match(
      errors,
      /qualityRun\.runUrl must identify runId in HUDongpin\/helpmath-web/u,
    );
    assert.match(
      errors,
      /qualityRun\.launchTransition is required/u,
    );
    assert.match(
      errors,
      /qualityRun\.launchTransition must be an object/u,
    );
    assert.match(errors, /qualityRun\.jobs\.verify must be success/u);
    assert.match(
      errors,
      /qualityRun\.jobs\.browser-quality is required/u,
    );
    assert.match(
      errors,
      /qualityRun\.jobs\.browser-quality must be success/u,
    );
    assert.match(errors, /qualityRun\.jobs\.lighthouse must be success/u);
  });

  it("derives the artifact Quality run from the retained GitHub API bundle", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-cross-check-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    await writeProductionQualityEvidence(
      plan,
      directory,
      bundle,
      (artifact) => {
        assert.ok(artifact.qualityRun);
        artifact.qualityRun.runId += 1;
        artifact.qualityRun.runUrl =
          "https://github.com/HUDongpin/helpmath-web/actions/runs/29921608813";
      },
    );

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /qualityRun\.runId does not match the retained GitHub API evidence/u,
    );
    assert.match(
      errors,
      /qualityRun\.runUrl does not match the retained GitHub API evidence/u,
    );
  });

  it("accepts a second-attempt Quality run with matching retained evidence", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-second-attempt-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    setProductionQualityRunAttempt(
      bundle,
      LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT,
    );
    await writeProductionQualityEvidence(
      plan,
      directory,
      bundle,
      (artifact) => {
        assert.ok(artifact.qualityRun);
        artifact.qualityRun.runAttempt =
          LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT;
      },
    );

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    assert.equal(verification.ok, true);
    assert.equal(
      verification.entries.find(
        (entry) => entry.key === "productionQuality",
      )?.pass,
      true,
    );
  });

  it("accepts the three required Quality jobs in arbitrary API order", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-unordered-jobs-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    const [verify, browserQuality, lighthouse] = bundle.jobs.jobs;
    assert.ok(verify);
    assert.ok(browserQuality);
    assert.ok(lighthouse);
    bundle.jobs.jobs = [lighthouse, verify, browserQuality];
    await writeProductionQualityEvidence(plan, directory, bundle);

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    assert.equal(verification.ok, true);
    assert.equal(
      verification.entries.find(
        (entry) => entry.key === "productionQuality",
      )?.pass,
      true,
    );
  });

  it("rejects missing or duplicate required Quality job names", async () => {
    for (const scenario of ["missing", "duplicate"] as const) {
      const directory = await mkdtemp(
        path.join(
          tmpdir(),
          `helpmath-cutover-quality-${scenario}-job-name-`,
        ),
      );
      const plan = validPlan();
      await materializeEvidence(plan, directory);
      const bundle = productionQualityEvidenceBundle(plan);
      if (scenario === "missing") {
        bundle.jobs.jobs = bundle.jobs.jobs.filter(
          (job) => job.name !== "browser-quality",
        );
        bundle.jobs.total_count = bundle.jobs.jobs.length;
      } else {
        const browserQuality = bundle.jobs.jobs.find(
          (job) => job.name === "browser-quality",
        );
        assert.ok(browserQuality);
        browserQuality.name = "verify";
      }
      await writeProductionQualityEvidence(plan, directory, bundle);

      const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
      const errors =
        verification.entries
          .find((entry) => entry.key === "productionQuality")
          ?.errors.join("\n") ?? "";
      assert.equal(verification.ok, false);
      assert.match(
        errors,
        /jobs must include exactly one browser-quality job/u,
      );
      if (scenario === "missing") {
        assert.match(errors, /jobs must contain exactly 3 required jobs/u);
      } else {
        assert.match(errors, /jobs\[1\]\.name must be unique/u);
      }
    }
  });

  it("rejects missing, duplicate, or failed required Lighthouse authorization steps", async () => {
    for (const requiredStep of LEGACY_CUTOVER_PRODUCTION_QUALITY_LIGHTHOUSE_STEPS) {
      for (const scenario of ["missing", "duplicate", "failed"] as const) {
        const directory = await mkdtemp(
          path.join(
            tmpdir(),
            `helpmath-cutover-quality-${scenario}-lighthouse-step-`,
          ),
        );
        const plan = validPlan();
        await materializeEvidence(plan, directory);
        const bundle = productionQualityEvidenceBundle(plan);
        const lighthouse = bundle.jobs.jobs.find(
          (job) => job.name === "lighthouse",
        );
        assert.ok(lighthouse);
        const required = lighthouse.steps.find(
          (step) => step.name === requiredStep,
        );
        assert.ok(required);
        if (scenario === "missing") {
          lighthouse.steps = lighthouse.steps.filter(
            (step) => step.name !== requiredStep,
          );
          lighthouse.steps.forEach((step, index) => {
            step.number = index + 1;
          });
        } else if (scenario === "duplicate") {
          lighthouse.steps.push({
            ...required,
            number: lighthouse.steps.length + 1,
          });
        } else {
          required.conclusion = "failure";
        }
        await writeProductionQualityEvidence(plan, directory, bundle);

        const verification = await verifyLegacyCutoverEvidence(plan, {
          nowMs,
        });
        const errors =
          verification.entries
            .find((entry) => entry.key === "productionQuality")
            ?.errors.join("\n") ?? "";
        assert.equal(verification.ok, false);
        assert.equal(
          errors.includes(
            `lighthouse steps must include exactly one successful ${requiredStep}`,
          ),
          true,
        );
        if (scenario === "failed") {
          assert.match(errors, /\.conclusion must be success/u);
        }
      }
    }
  });

  it("rejects a Quality run after the second attempt in both retained layers", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-late-attempt-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    const rejectedRunAttempt =
      LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT + 1;
    setProductionQualityRunAttempt(bundle, rejectedRunAttempt);
    await writeProductionQualityEvidence(
      plan,
      directory,
      bundle,
      (artifact) => {
        assert.ok(artifact.qualityRun);
        artifact.qualityRun.runAttempt = rejectedRunAttempt;
      },
    );

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(errors, /qualityRun\.runAttempt must be 1 or 2/u);
    assert.match(
      errors,
      /GitHub API evidence\.run\.run_attempt must be 1 or 2/u,
    );
  });

  it("rejects an old Quality run masquerading behind a fresh artifact observation", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-stale-run-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    bundle.run.created_at = "2026-07-19T17:00:00.000Z";
    bundle.run.run_started_at = "2026-07-19T17:05:00.000Z";
    bundle.run.updated_at = "2026-07-19T17:30:00.000Z";
    for (const [index, job] of bundle.jobs.jobs.entries()) {
      job.started_at = `2026-07-19T17:0${String(5 + index)}:00.000Z`;
      job.completed_at = `2026-07-19T17:2${String(5 + index)}:00.000Z`;
    }
    await writeProductionQualityEvidence(plan, directory, bundle);

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /artifact\.productionQuality\.observedAt must represent the same instant as .*run\.updated_at/u,
    );
    assert.match(
      errors,
      /run\.updated_at is older than the permitted evidence age/u,
    );
  });

  it("rejects wrong raw repository or workflow and missing required jobs or steps", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-raw-identity-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    bundle.run.repository.full_name = "attacker/helpmath-web-fork";
    bundle.run.head_repository.full_name = "attacker/helpmath-web-fork";
    bundle.run.name = "Fake Quality";
    bundle.run.path = ".github/workflows/fake-quality.yml";
    bundle.run.event = "workflow_dispatch";
    bundle.run.head_branch = "release";
    bundle.run.head_sha = "b".repeat(40);
    bundle.workflow.name = "Fake Quality";
    bundle.workflow.path = ".github/workflows/fake-quality.yml";
    bundle.workflow.url =
      "https://api.github.com/repos/HUDongpin/helpmath-web/actions/workflows/9999";
    bundle.requests.jobs =
      "https://api.github.com/repos/HUDongpin/helpmath-web/actions/runs/29921608812/jobs?per_page=100";
    const verify = bundle.jobs.jobs.find((job) => job.name === "verify");
    assert.ok(verify);
    verify.run_attempt = 2;
    verify.steps = [];
    bundle.jobs.jobs = bundle.jobs.jobs.filter(
      (job) => job.name !== "lighthouse",
    );
    bundle.jobs.total_count = bundle.jobs.jobs.length;
    await writeProductionQualityEvidence(plan, directory, bundle);

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /run\.repository\.full_name must be HUDongpin\/helpmath-web/u,
    );
    assert.match(errors, /run\.name must be Quality/u);
    assert.match(errors, /run\.event must be push/u);
    assert.match(errors, /run\.head_branch must be main/u);
    assert.match(errors, /run\.head_sha does not match plan/u);
    assert.match(
      errors,
      /workflow\.path must be \.github\/workflows\/quality\.yml/u,
    );
    assert.match(
      errors,
      /requests\.jobs must identify the exact retained GitHub API request/u,
    );
    assert.match(
      errors,
      /jobs\[0\]\.run_attempt must match .*run\.run_attempt/u,
    );
    assert.match(errors, /jobs\[0\]\.steps must be a non-empty array/u);
    assert.match(
      errors,
      /verify steps must include exactly one Enforce launch-gate transition history/u,
    );
    assert.match(
      errors,
      /jobs must include exactly one lighthouse job/u,
    );
  });

  it("requires canonical, secret-free GitHub API evidence bytes", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-quality-canonical-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const bundle = productionQualityEvidenceBundle(plan);
    const written = await writeProductionQualityEvidence(
      plan,
      directory,
      bundle,
    );
    const noncanonicalBytes = Buffer.from(
      JSON.stringify(bundle, null, 2),
      "utf8",
    );
    await writeFile(written.underlyingPath, noncanonicalBytes, { mode: 0o600 });
    written.artifact.underlyingEvidence.sha256 = createHash("sha256")
      .update(noncanonicalBytes)
      .digest("hex");
    written.artifact.underlyingEvidence.bytes = noncanonicalBytes.length;
    const artifactBytes = Buffer.from(canonicalJson(written.artifact));
    await writeFile(written.artifactPath, artifactBytes, { mode: 0o600 });
    planEvidence(plan, "productionQuality").sha256 = createHash("sha256")
      .update(artifactBytes)
      .digest("hex");

    let verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    let errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /underlying productionQuality GitHub API evidence must use canonical sorted JSON/u,
    );

    const bundleWithSecret = productionQualityEvidenceBundle(plan) as
      LegacyCutoverProductionQualityEvidenceBundle & {
        access_token?: string;
      };
    bundleWithSecret.access_token = `ghp_${"a".repeat(24)}`;
    await writeProductionQualityEvidence(plan, directory, bundleWithSecret);
    verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    errors =
      verification.entries
        .find((entry) => entry.key === "productionQuality")
        ?.errors.join("\n") ?? "";
    assert.equal(verification.ok, false);
    assert.match(
      errors,
      /underlying productionQuality GitHub API evidence\.access_token is a forbidden sensitive field/u,
    );
  });

  it("fails closed on artifact tampering, underlying-evidence tampering, and credentials", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-evidence-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    await writeFile(
      planEvidence(plan, "productionSmoke").reference,
      '{"tampered":true}\n',
      "utf8",
    );
    await writeFile(
      path.join(directory, "dnsZoneBefore.underlying.json"),
      '{"tampered":true}\n',
      "utf8",
    );

    const productionAliasEvidence = planEvidence(
      plan,
      "productionAliasAssignment",
    );
    const aliasArtifactPath = productionAliasEvidence.reference;
    const underlyingPath = path.join(
      directory,
      "productionAliasAssignment.underlying.json",
    );
    const underlyingBytes = await readFile(underlyingPath);
    const aliasArtifact = evidenceArtifact(plan, "productionAliasAssignment", {
      reference: underlyingPath,
      sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
      bytes: underlyingBytes.length,
    });
    aliasArtifact.source = "https://operator:password@example.com/receipt";
    const aliasBytes = Buffer.from(canonicalJson(aliasArtifact));
    await writeFile(aliasArtifactPath, aliasBytes);
    productionAliasEvidence.sha256 = createHash("sha256")
      .update(aliasBytes)
      .digest("hex");

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    assert.equal(verification.ok, false);
    assert.match(
      verification.entries
        .find((entry) => entry.key === "productionSmoke")
        ?.errors.join("\n") ?? "",
      /SHA-256 does not match/u,
    );
    assert.match(
      verification.entries
        .find((entry) => entry.key === "dnsZoneBefore")
        ?.errors.join("\n") ?? "",
      /underlying evidence (?:SHA-256|byte length) does not match/u,
    );
    assert.match(
      verification.entries
        .find((entry) => entry.key === "productionAliasAssignment")
        ?.errors.join("\n") ?? "",
      /credential-shaped material/u,
    );
  });

  it("rejects an evidence artifact with duplicate object keys even when the last value passes", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-duplicate-evidence-"),
    );
    const plan = validPlan();
    await materializeEvidence(plan, directory);
    const key: LegacyCutoverEvidenceKey = "dnsZoneBefore";
    const evidence = planEvidence(plan, key);
    const canonicalBytes = await readFile(evidence.reference);
    const duplicateBytes = Buffer.from(
      canonicalBytes.toString("utf8").replace("{", '{"status":"fail",'),
    );
    await writeFile(evidence.reference, duplicateBytes, { mode: 0o600 });
    evidence.sha256 = createHash("sha256").update(duplicateBytes).digest("hex");

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const errors =
      verification.entries.find((entry) => entry.key === key)?.errors ?? [];
    assert.equal(verification.ok, false);
    assert.match(
      errors.join("\n"),
      /canonical sorted JSON with no duplicate object keys/u,
    );
  });

  it("rejects a lexically external path that resolves into the repository through an ancestor link", async () => {
    const fakeRepository = await mkdtemp(
      path.join(tmpdir(), "helpmath-fake-repository-"),
    );
    const outside = await mkdtemp(
      path.join(tmpdir(), "helpmath-external-link-"),
    );
    const insideFile = path.join(fakeRepository, "inside.json");
    await writeFile(insideFile, "{}\n", { mode: 0o600 });
    await symlink(fakeRepository, path.join(outside, "repository-link"), "dir");

    await assert.rejects(
      readRestrictedExternalFile(
        path.join(outside, "repository-link", "inside.json"),
        {
          repositoryRoot: await realpath(fakeRepository),
        },
      ),
      /resolves inside the repository/u,
    );
  });

  it("rejects an external hard link that shares an inode with a repository file", async () => {
    const fakeRepository = await mkdtemp(
      path.join(tmpdir(), "helpmath-hard-link-repository-"),
    );
    const outside = await mkdtemp(
      path.join(tmpdir(), "helpmath-external-hard-link-"),
    );
    const insideFile = path.join(fakeRepository, "inside.json");
    const outsideHardLink = path.join(outside, "hard-link.json");
    await writeFile(insideFile, "{}\n", { mode: 0o600 });
    await link(insideFile, outsideHardLink);

    await assert.rejects(
      readRestrictedExternalFile(outsideHardLink, {
        repositoryRoot: await realpath(fakeRepository),
      }),
      /exactly one hard link/u,
    );
  });

  it("records canonical artifact and underlying paths reached through an external ancestor link", async () => {
    const evidenceDirectory = await mkdtemp(
      path.join(tmpdir(), "helpmath-canonical-evidence-"),
    );
    const aliasDirectory = await mkdtemp(
      path.join(tmpdir(), "helpmath-canonical-alias-"),
    );
    const aliasRoot = path.join(aliasDirectory, "evidence-link");
    const plan = validPlan();
    await materializeEvidence(plan, evidenceDirectory);
    await symlink(evidenceDirectory, aliasRoot, "dir");

    for (const key of getLegacyCutoverEvidenceKeys(plan.contactMode)) {
      planEvidence(plan, key).reference = path.join(aliasRoot, `${key}.json`);
    }

    const key = "dnsZoneBefore";
    const canonicalUnderlyingPath = path.join(
      evidenceDirectory,
      `${key}.underlying.json`,
    );
    const aliasUnderlyingPath = path.join(aliasRoot, `${key}.underlying.json`);
    const underlyingBytes = await readFile(canonicalUnderlyingPath);
    const artifactBytes = Buffer.from(
      canonicalJson(
        evidenceArtifact(plan, key, {
          reference: aliasUnderlyingPath,
          sha256: createHash("sha256").update(underlyingBytes).digest("hex"),
          bytes: underlyingBytes.length,
        }),
      ),
    );
    await writeFile(
      path.join(evidenceDirectory, `${key}.json`),
      artifactBytes,
      { mode: 0o600 },
    );
    planEvidence(plan, key).sha256 = createHash("sha256")
      .update(artifactBytes)
      .digest("hex");

    const verification = await verifyLegacyCutoverEvidence(plan, { nowMs });
    const entry = verification.entries.find(
      (candidate) => candidate.key === key,
    );
    assert.equal(verification.ok, true);
    assert.equal(
      entry?.reference,
      await realpath(path.join(evidenceDirectory, `${key}.json`)),
    );
    assert.equal(
      entry?.underlyingEvidence.reference,
      await realpath(canonicalUnderlyingPath),
    );
  });
});

describe("legacy-domain cutover decision", () => {
  it("returns GO_TO_CHANGE only when the complete approved preflight passes", () => {
    const evaluation = evaluateLegacyCutoverPreflight(goInput(validPlan()));
    assert.equal(evaluation.decision, "GO_TO_CHANGE");
    assert.deepEqual(evaluation.failures, []);
  });

  it("allows cutover with contact intentionally disabled only when the gate matches", () => {
    const plan = validPlan("disabled");
    const input = goInput(plan);
    input.gateStatuses.contactIntake = "disabled";
    input.gateAuthorizations.contactIntake.vercelDeploymentId = null;

    const allowed = evaluateLegacyCutoverPreflight(input);
    assert.equal(allowed.decision, "GO_TO_CHANGE");
    assert.deepEqual(allowed.failures, []);

    input.gateStatuses.contactIntake = "approved";
    const mismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(mismatch.decision, "NO_GO");
    assert.match(
      mismatch.failures.join("\n"),
      /contact-disposition-matches-plan/u,
    );
  });

  it("rejects any gate approved for another subject or a prerequisite expiring inside the buffer", () => {
    const plan = validPlan();
    const input = goInput(plan);
    input.gateAuthorizations.legacyCutover.repositoryCommit = "b".repeat(40);

    const subjectMismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(subjectMismatch.decision, "NO_GO");
    assert.match(
      subjectMismatch.failures.join("\n"),
      /legacy-cutover-subject-bound/u,
    );

    input.gateAuthorizations.legacyCutover.repositoryCommit =
      plan.repositoryCommit;
    input.gateAuthorizations.legalPublication.repositoryCommit = "b".repeat(40);
    const legalSubjectMismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(legalSubjectMismatch.decision, "NO_GO");
    assert.match(
      legalSubjectMismatch.failures.join("\n"),
      /legal-publication-subject-bound/u,
    );

    input.gateAuthorizations.legalPublication.repositoryCommit =
      plan.repositoryCommit;
    input.gateAuthorizations.legalPublication.vercelDeploymentId =
      plan.vercelDeploymentId;
    const legalDeploymentMismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(legalDeploymentMismatch.decision, "NO_GO");
    assert.match(
      legalDeploymentMismatch.failures.join("\n"),
      /legal-publication-subject-bound/u,
    );

    input.gateAuthorizations.legalPublication.vercelDeploymentId = null;
    input.gateAuthorizations.contactIntake.repositoryCommit = "b".repeat(40);
    const contactSubjectMismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(contactSubjectMismatch.decision, "NO_GO");
    assert.match(
      contactSubjectMismatch.failures.join("\n"),
      /contact-intake-subject-bound/u,
    );

    input.gateAuthorizations.contactIntake.repositoryCommit =
      plan.repositoryCommit;
    input.gateAuthorizations.contactIntake.vercelDeploymentId =
      "dpl_OtherDeployment";
    const contactDeploymentMismatch = evaluateLegacyCutoverPreflight(input);
    assert.equal(contactDeploymentMismatch.decision, "NO_GO");
    assert.match(
      contactDeploymentMismatch.failures.join("\n"),
      /contact-intake-subject-bound/u,
    );

    input.gateAuthorizations.contactIntake.vercelDeploymentId =
      plan.vercelDeploymentId;
    input.gateAuthorizations.legalPublication.validUntil =
      "2026-07-21T18:09:00.000Z";
    const expiringDependency = evaluateLegacyCutoverPreflight(input);
    assert.equal(expiringDependency.decision, "NO_GO");
    assert.match(
      expiringDependency.failures.join("\n"),
      /authorization-validity-buffer/u,
    );
  });

  it("binds a deliberately disabled contact gate to the candidate commit without a deployment", () => {
    const plan = validPlan("disabled");
    const input = goInput(plan);
    input.gateStatuses.contactIntake = "disabled";
    input.gateAuthorizations.contactIntake.vercelDeploymentId = null;

    const allowed = evaluateLegacyCutoverPreflight(input);
    assert.equal(allowed.decision, "GO_TO_CHANGE");
    assert.deepEqual(allowed.failures, []);

    input.gateAuthorizations.contactIntake.vercelDeploymentId =
      plan.vercelDeploymentId;
    const mismatched = evaluateLegacyCutoverPreflight(input);
    assert.equal(mismatched.decision, "NO_GO");
    assert.match(
      mismatched.failures.join("\n"),
      /contact-intake-subject-bound/u,
    );

    input.gateAuthorizations.contactIntake.vercelDeploymentId = null;
    input.gateAuthorizations.contactIntake.repositoryCommit = "b".repeat(40);
    const commitMismatched = evaluateLegacyCutoverPreflight(input);
    assert.equal(commitMismatched.decision, "NO_GO");
    assert.match(
      commitMismatched.failures.join("\n"),
      /contact-intake-subject-bound/u,
    );
  });

  it("permits an append-only governance HEAD after the candidate but rejects a missing or unrelated candidate", () => {
    const plan = validPlan();
    const input = goInput(plan);
    input.repository.head = "f".repeat(40);

    const descendant = evaluateLegacyCutoverPreflight(input);
    assert.equal(descendant.decision, "GO_TO_CHANGE");

    input.repository.candidateIsAncestor = false;
    const unrelated = evaluateLegacyCutoverPreflight(input);
    assert.equal(unrelated.decision, "NO_GO");
    assert.match(unrelated.failures.join("\n"), /candidate-commit-lineage/u);

    input.repository.candidateIsAncestor = true;
    input.repository.candidateCommitExists = false;
    const missing = evaluateLegacyCutoverPreflight(input);
    assert.equal(missing.decision, "NO_GO");
    assert.match(missing.failures.join("\n"), /candidate-commit-lineage/u);
  });

  it("fails closed for holding gates, a dirty tree, incomplete evidence, missing commands, and no receipt store", () => {
    const plan = validPlan();
    const input = goInput(plan);
    input.gateStatuses.legalPublication = "holding";
    input.gateStatuses.contactIntake = "holding";
    input.gateStatuses.legacyCutover = "holding";
    input.repository.clean = false;
    delete input.commandResults["test:legacy-apache"];
    input.evidenceVerification.entries.pop();
    input.receiptDirectoryReady = false;
    input.gateAuthorizations.legacyCutover.validUntil =
      "2026-07-21T18:05:00.001Z";

    const evaluation = evaluateLegacyCutoverPreflight(input);
    assert.equal(evaluation.decision, "NO_GO");
    assert.match(evaluation.failures.join("\n"), /legal-approved/u);
    assert.match(
      evaluation.failures.join("\n"),
      /contact-disposition-matches-plan/u,
    );
    assert.match(evaluation.failures.join("\n"), /legacy-cutover-approved/u);
    assert.match(evaluation.failures.join("\n"), /repository-clean/u);
    assert.match(evaluation.failures.join("\n"), /command:test:legacy-apache/u);
    assert.match(evaluation.failures.join("\n"), /external-evidence-verified/u);
    assert.match(evaluation.failures.join("\n"), /receipt-directory-ready/u);
    assert.match(
      evaluation.failures.join("\n"),
      /authorization-validity-buffer/u,
    );
  });
});

describe("legacy-domain cutover receipt", () => {
  it("uses canonical JSON and writes a private content-addressed receipt and companion hash", async () => {
    assert.equal(
      canonicalJson({ z: 1, a: { z: 2, a: 3 } }),
      '{"a":{"a":3,"z":2},"z":1}\n',
    );
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    await chmod(directory, 0o700);
    const receipt = {
      schemaVersion: 3,
      decision: "NO_GO",
      failures: ["owner gate pending"],
    };
    const written = await writeLegacyCutoverReceipt(directory, receipt);
    const [jsonBytes, hashContents, jsonStat, hashStat] = await Promise.all([
      readFile(written.jsonPath),
      readFile(written.sha256Path, "utf8"),
      stat(written.jsonPath),
      stat(written.sha256Path),
    ]);

    assert.equal(jsonBytes.toString("utf8"), canonicalJson(receipt));
    assert.equal(
      hashContents,
      `${written.sha256}  ${path.basename(written.jsonPath)}\n`,
    );
    assert.equal(jsonStat.mode & 0o777, 0o600);
    assert.equal(hashStat.mode & 0o777, 0o600);
  });

  it("rejects permissive directories and ancestor links that resolve into the repository", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    await chmod(directory, 0o755);
    await assert.rejects(
      prepareLegacyCutoverReceiptDirectory(directory),
      /must not grant group or other permissions/u,
    );

    const fakeRepository = await mkdtemp(
      path.join(tmpdir(), "helpmath-fake-repository-"),
    );
    const receipts = path.join(fakeRepository, "receipts");
    await mkdir(receipts, { mode: 0o700 });
    const outside = await mkdtemp(
      path.join(tmpdir(), "helpmath-external-link-"),
    );
    await symlink(fakeRepository, path.join(outside, "repository-link"), "dir");
    await assert.rejects(
      prepareLegacyCutoverReceiptDirectory(
        path.join(outside, "repository-link", "receipts"),
        { repositoryRoot: await realpath(fakeRepository) },
      ),
      /resolves inside the repository/u,
    );
  });

  it("does not publish a GO receipt after its minimum validity buffer expires", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        { schemaVersion: 3, decision: "GO_TO_CHANGE" },
        { notAfter: "2000-01-01T00:00:00.000Z", minimumRemainingMs: 300_000 },
      ),
      /validity buffer expired/u,
    );
    assert.deepEqual(await readdir(directory), []);
  });

  it("removes staged receipt files when the final pre-publication recheck fails", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        { schemaVersion: 3, decision: "GO_TO_CHANGE" },
        {
          notAfter: "2099-01-01T00:00:00.000Z",
          minimumRemainingMs: 300_000,
          beforePublish() {
            throw new Error("launch gate revoked during final recheck");
          },
        },
      ),
      /launch gate revoked during final recheck/u,
    );
    assert.deepEqual(await readdir(directory), []);
  });

  it("rejects invalid receipt time, buffer, and filename controls before creating files", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        { schemaVersion: 3, decision: "GO_TO_CHANGE" },
        {
          notAfter: "not-a-time",
          minimumRemainingMs: Number.NaN,
          fileTimestamp: "../escape",
        },
      ),
      /minimumRemainingMs must be a nonnegative safe integer/u,
    );
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        { schemaVersion: 3, decision: "GO_TO_CHANGE" },
        {
          notAfter: "not-a-time",
          minimumRemainingMs: 300_000,
        },
      ),
      /notAfter must be a canonical UTC timestamp/u,
    );
    await assert.rejects(
      writeLegacyCutoverReceipt(
        directory,
        { schemaVersion: 3, decision: "NO_GO" },
        { fileTimestamp: "../escape" },
      ),
      /fileTimestamp must be a canonical UTC timestamp/u,
    );
    assert.deepEqual(await readdir(directory), []);
  });

  it("never deletes an existing append-only receipt when a filename collides", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "helpmath-cutover-receipt-"),
    );
    const receipt = {
      schemaVersion: 3,
      decision: "NO_GO",
      failures: ["retained"],
    };
    const options = { fileTimestamp: "2026-07-21T18:30:00.000Z" };
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
