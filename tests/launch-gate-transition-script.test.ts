import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  migrateLaunchGateManifestV2ToV3,
  type LaunchGateLifecycleEventV3,
} from "../lib/launch-gate-lifecycle-v3";
import { type LaunchGateId } from "../lib/launch-gate-ids";
import {
  validateLaunchGateManifestVersionTransition,
  validateLaunchGateTransitionFromRepository,
} from "../scripts/validate-launch-gate-transition";

const UPDATED_AT = "2026-07-21T21:45:13.000Z";
const NOW_MS = Date.parse("2026-07-22T12:00:00.000Z");

type MutableManifestV3 = {
  schemaVersion: 3;
  updatedAt: string;
  gates: Record<
    LaunchGateId,
    {
      description: string;
      dependencies: LaunchGateId[];
      events: LaunchGateLifecycleEventV3[];
    }
  >;
};

function strictV2Manifest() {
  return {
    schemaVersion: 2,
    updatedAt: UPDATED_AT,
    gates: {
      legalPublication: {
        description:
          "Publish the English and Spanish Privacy and Terms pages as approved legal notices.",
        status: "holding",
        dependencies: [],
        approval: null,
        evidence: [],
        blockerRefs: ["docs/LEGAL_REVIEW.md"],
      },
      contactIntake: {
        description: "Accept and deliver public contact-form submissions.",
        status: "holding",
        dependencies: ["legalPublication"],
        approval: null,
        evidence: [],
        blockerRefs: ["docs/CONTACT_DELIVERY.md"],
      },
      demoPublication: {
        description:
          "Make reviewed JavaScript demo routes and assets publicly accessible or indexable.",
        status: "holding",
        dependencies: [],
        approval: null,
        evidence: [],
        blockerRefs: ["docs/DEMO_PROMOTION.md", "docs/LAUNCH_DECISIONS.md"],
      },
      legacyCutover: {
        description:
          "Authorize the controlled legacy-domain redirect change under the reviewed cutover and rollback plan.",
        status: "holding",
        dependencies: ["legalPublication", "contactIntake"],
        approval: null,
        evidence: [],
        blockerRefs: ["docs/LEGACY_CUTOVER.md"],
      },
      productionLaunch: {
        description:
          "Declare the website migration fully launched after post-cutover verification and final release approval.",
        status: "holding",
        dependencies: [
          "legalPublication",
          "contactIntake",
          "demoPublication",
          "legacyCutover",
        ],
        approval: null,
        evidence: [],
        blockerRefs: ["docs/LAUNCH_DECISIONS.md"],
      },
    },
  };
}

function migratedHoldingManifest(): MutableManifestV3 {
  const result = migrateLaunchGateManifestV2ToV3(strictV2Manifest(), {
    nowMs: NOW_MS,
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.manifest);
  return structuredClone(result.manifest) as MutableManifestV3;
}

function candidateManifest(): MutableManifestV3 {
  const manifest = migratedHoldingManifest();
  const gate = manifest.gates.legalPublication;
  const previous = gate.events.at(-1);
  assert.ok(previous);
  const occurredAt = "2026-07-21T21:50:00.000Z";
  gate.events.push({
    eventId: "legalpublication-owner-review-candidate",
    transition: "submit",
    from: "holding",
    to: "candidate",
    targetStatus: "approved",
    candidate: {
      repositoryCommit: "a".repeat(40),
      vercelDeploymentId: `dpl_${"A".repeat(20)}`,
    },
    occurredAt,
    validUntil: "2026-07-28T21:49:59.999Z",
    previousEventId: previous.eventId,
    supersedes: null,
    decision: null,
    evidence: [],
  });
  manifest.updatedAt = occurredAt;
  return manifest;
}

function appendLegalApproval(manifest: MutableManifestV3) {
  const gate = manifest.gates.legalPublication;
  const candidate = gate.events.at(-1);
  assert.ok(candidate?.candidate);
  const occurredAt = "2026-07-21T21:51:00.000Z";
  const validUntil = "2026-07-28T21:51:00.000Z";
  gate.events.push({
    eventId: "legalpublication-owner-review-approved",
    transition: "approve",
    from: "candidate",
    to: "approved",
    targetStatus: null,
    candidate: null,
    occurredAt,
    validUntil,
    previousEventId: candidate.eventId,
    supersedes: null,
    decision: {
      decisionId: "legalpublication-owner-review-decision",
      outcome: "approved",
      decidedAt: occurredAt,
      decidedBy: {
        name: "Alice Rivera",
        authorityRole: "legal-review-authority",
        organization: "Rivera Legal Review LLC",
      },
      candidate: {
        candidateEventId: candidate.eventId,
        repositoryCommit: candidate.candidate.repositoryCommit,
        vercelDeploymentId: candidate.candidate.vercelDeploymentId,
      },
      supersedesDecisionId: null,
    },
    evidence: [
      {
        kind: "legal-review",
        reference:
          "docs/evidence/launch-gates/legalpublication-owner-review.json",
        sha256: "1".repeat(64),
        observedAt: occurredAt,
        validUntil,
      },
    ],
  });
  manifest.updatedAt = occurredAt;
}

function appendLegalRenewal(manifest: MutableManifestV3) {
  const gate = manifest.gates.legalPublication;
  const approval = gate.events.at(-1);
  assert.ok(approval?.decision);
  const occurredAt = "2026-07-22T00:00:00.000Z";
  const validUntil = "2026-08-04T00:00:00.000Z";
  gate.events.push({
    eventId: "legalpublication-owner-review-renewed",
    transition: "renew",
    from: "approved",
    to: "approved",
    targetStatus: null,
    candidate: null,
    occurredAt,
    validUntil,
    previousEventId: approval.eventId,
    supersedes: approval.eventId,
    decision: {
      decisionId: "legalpublication-owner-review-renewal-decision",
      outcome: "approved",
      decidedAt: occurredAt,
      decidedBy: {
        name: "Alice Rivera",
        authorityRole: "legal-review-authority",
        organization: "Rivera Legal Review LLC",
      },
      candidate: { ...approval.decision.candidate },
      supersedesDecisionId: approval.decision.decisionId,
    },
    evidence: [
      {
        kind: "legal-review",
        reference:
          "docs/evidence/launch-gates/legalpublication-owner-renewal.json",
        sha256: "2".repeat(64),
        observedAt: occurredAt,
        validUntil,
      },
    ],
  });
  manifest.updatedAt = occurredAt;
}

function git(cwd: string, argumentsList: string[]): string {
  const result = spawnSync("git", argumentsList, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function writeManifest(repositoryRoot: string, value: unknown) {
  const target = path.join(repositoryRoot, "config/launch-gates.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

function githubEnvironment(
  overrides: Partial<
    Record<
      | "GITHUB_BASE_REF"
      | "GITHUB_EVENT_BEFORE"
      | "GITHUB_EVENT_NAME"
      | "GITHUB_EVENT_PATH",
      string
    >
  >,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GITHUB_BASE_REF: undefined,
    GITHUB_EVENT_BEFORE: undefined,
    GITHUB_EVENT_NAME: undefined,
    GITHUB_EVENT_PATH: undefined,
    ...overrides,
  };
}

describe("launch-gate manifest transition script", () => {
  it("allows only a strict v2 holding migration with optional valid candidates", () => {
    const previous = strictV2Manifest();
    const migrated = migratedHoldingManifest();
    const candidate = candidateManifest();

    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(previous, migrated, {
        nowMs: NOW_MS,
      }),
      [],
    );
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(previous, candidate, {
        nowMs: NOW_MS,
      }),
      [],
    );

    const invalidPrevious = structuredClone(previous);
    invalidPrevious.gates.legalPublication.status = "approved";
    assert.match(
      validateLaunchGateManifestVersionTransition(invalidPrevious, candidate, {
        nowMs: NOW_MS,
      }).join("\n"),
      /strict holding migration baseline/u,
    );

    const invalidCandidate = candidateManifest();
    const candidateEvents = invalidCandidate.gates.legalPublication.events;
    const candidateIndex = candidateEvents.length - 1;
    const candidateEvent = candidateEvents[candidateIndex];
    assert.ok(candidateEvent?.candidate);
    candidateEvents[candidateIndex] = {
      ...candidateEvent,
      candidate: {
        ...candidateEvent.candidate,
        repositoryCommit: "0".repeat(40),
      },
    };
    assert.match(
      validateLaunchGateManifestVersionTransition(previous, invalidCandidate, {
        nowMs: NOW_MS,
      }).join("\n"),
      /nonzero lowercase Git SHA/u,
    );
  });

  it("rejects decisions bundled into the v2 to v3 migration change", () => {
    const previous = strictV2Manifest();
    const next = candidateManifest();
    const candidate = next.gates.legalPublication.events.at(-1);
    assert.ok(candidate);
    next.gates.legalPublication.events.push({
      ...candidate,
      eventId: "legalpublication-forbidden-inline-decision",
      transition: "approve",
      from: "candidate",
      to: "approved",
      targetStatus: null,
      candidate: null,
      occurredAt: "2026-07-21T21:51:00.000Z",
      validUntil: "2026-07-28T21:49:59.999Z",
      previousEventId: candidate.eventId,
    });
    next.updatedAt = "2026-07-21T21:51:00.000Z";

    const errors = validateLaunchGateManifestVersionTransition(previous, next, {
      nowMs: NOW_MS,
    }).join("\n");
    assert.match(errors, /may append at most one candidate event/u);
    assert.match(errors, /may only append valid candidate events/u);
  });

  it("delegates v3 append-only checks and rejects a v3 downgrade", () => {
    const previous = migratedHoldingManifest();
    const next = candidateManifest();
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(previous, next, {
        nowMs: NOW_MS,
      }),
      [],
    );

    const rewritten = candidateManifest();
    rewritten.gates.legalPublication.description =
      "A rewritten policy description that is long enough but still forbidden.";
    assert.match(
      validateLaunchGateManifestVersionTransition(previous, rewritten, {
        nowMs: NOW_MS,
      }).join("\n"),
      /must exactly preserve the previous policy text/u,
    );
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(
        previous,
        strictV2Manifest(),
        { nowMs: NOW_MS },
      ),
      ["launch-gate manifest schema downgrade from v3 to v2 is forbidden"],
    );
  });

  it("allows one event per gate but rejects bundled event chains in a v3 comparison", () => {
    const previous = migratedHoldingManifest();
    const oneEventInTwoGates = candidateManifest();
    const demoGate = oneEventInTwoGates.gates.demoPublication;
    const demoPrevious = demoGate.events.at(-1);
    assert.ok(demoPrevious);
    const demoOccurredAt = "2026-07-21T21:51:00.000Z";
    demoGate.events.push({
      eventId: "demopublication-owner-review-candidate",
      transition: "submit",
      from: "holding",
      to: "candidate",
      targetStatus: "approved",
      candidate: {
        repositoryCommit: "b".repeat(40),
        vercelDeploymentId: `dpl_${"B".repeat(20)}`,
      },
      occurredAt: demoOccurredAt,
      validUntil: "2026-07-28T21:50:59.999Z",
      previousEventId: demoPrevious.eventId,
      supersedes: null,
      decision: null,
      evidence: [],
    });
    oneEventInTwoGates.updatedAt = demoOccurredAt;
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(
        previous,
        oneEventInTwoGates,
        { nowMs: NOW_MS },
      ),
      [],
    );

    const bundledCandidateAndDecision = candidateManifest();
    appendLegalApproval(bundledCandidateAndDecision);
    const errors = validateLaunchGateManifestVersionTransition(
      previous,
      bundledCandidateAndDecision,
      { nowMs: NOW_MS },
    ).join("\n");
    assert.match(
      errors,
      /v3 -> v3 may append at most one lifecycle event per gate in a comparison interval; gates\.legalPublication appends 2/u,
    );
  });

  it("rejects backfilled approval after expiry and events inserted into an older timeline", () => {
    const previous = candidateManifest();
    const approved = structuredClone(previous);
    appendLegalApproval(approved);
    const candidate = previous.gates.legalPublication.events.at(-1);
    assert.ok(candidate?.validUntil);
    const candidateExpiryMs = Date.parse(candidate.validUntil);
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(previous, approved, {
        nowMs: candidateExpiryMs - 1,
      }),
      [],
    );
    assert.match(
      validateLaunchGateManifestVersionTransition(previous, approved, {
        nowMs: candidateExpiryMs + 1,
      }).join("\n"),
      /approve requires CI nowMs to be strictly earlier than the prior event validUntil/u,
    );

    const laterSnapshot = candidateManifest();
    laterSnapshot.updatedAt = "2026-07-21T21:51:00.000Z";
    const insertedApproval = structuredClone(laterSnapshot);
    appendLegalApproval(insertedApproval);
    insertedApproval.updatedAt = "2026-07-21T21:52:00.000Z";
    assert.match(
      validateLaunchGateManifestVersionTransition(
        laterSnapshot,
        insertedApproval,
        { nowMs: NOW_MS },
      ).join("\n"),
      /occurredAt must be strictly later than previous manifest updatedAt/u,
    );
  });

  it("rejects a backfilled renewal at the prior decision expiry instant", () => {
    const previous = candidateManifest();
    appendLegalApproval(previous);
    const priorDecision = previous.gates.legalPublication.events.at(-1);
    assert.ok(priorDecision?.validUntil);
    const renewed = structuredClone(previous);
    appendLegalRenewal(renewed);
    const priorDecisionExpiryMs = Date.parse(priorDecision.validUntil);
    assert.deepEqual(
      validateLaunchGateManifestVersionTransition(previous, renewed, {
        nowMs: priorDecisionExpiryMs - 1,
      }),
      [],
    );
    assert.match(
      validateLaunchGateManifestVersionTransition(previous, renewed, {
        nowMs: priorDecisionExpiryMs,
      }).join("\n"),
      /renew requires CI nowMs to be strictly earlier than the prior event validUntil/u,
    );
  });

  it("uses the pull-request base ref merge-base rather than the base tip", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-transition-"),
    );
    try {
      git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
      git(repositoryRoot, ["config", "user.name", "HELP Math Test"]);
      git(repositoryRoot, ["config", "user.email", "test@helpmath.invalid"]);
      await writeManifest(repositoryRoot, strictV2Manifest());
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "Add v2 baseline"]);
      const sharedBase = git(repositoryRoot, ["rev-parse", "HEAD"]);

      git(repositoryRoot, ["checkout", "--quiet", "-b", "feature"]);
      await writeManifest(repositoryRoot, candidateManifest());
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, [
        "commit",
        "--quiet",
        "-m",
        "Migrate to v3 candidate",
      ]);

      git(repositoryRoot, ["checkout", "--quiet", "main"]);
      await writeFile(
        path.join(repositoryRoot, "README.md"),
        "Base branch advanced without changing the launch gates.\n",
      );
      git(repositoryRoot, ["add", "--", "README.md"]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "Advance base branch"]);
      const baseTip = git(repositoryRoot, ["rev-parse", "HEAD"]);
      assert.notEqual(baseTip, sharedBase);
      git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", baseTip]);
      git(repositoryRoot, ["checkout", "--quiet", "feature"]);

      const result = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({
          GITHUB_BASE_REF: "main",
          GITHUB_EVENT_NAME: "pull_request",
        }),
        nowMs: NOW_MS,
      });
      assert.deepEqual(result.errors, []);
      assert.equal(result.baseReference, "refs/remotes/origin/main");
      assert.equal(result.baseCommit, sharedBase);
      assert.equal(result.previousSchemaVersion, 2);
      assert.equal(result.nextSchemaVersion, 3);
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });

  it("checks the push before SHA across every commit in a multi-commit push", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-push-transition-"),
    );
    try {
      git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
      git(repositoryRoot, ["config", "user.name", "HELP Math Test"]);
      git(repositoryRoot, ["config", "user.email", "test@helpmath.invalid"]);

      await writeManifest(repositoryRoot, migratedHoldingManifest());
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, [
        "commit",
        "--quiet",
        "-m",
        "Add v3 holding baseline",
      ]);
      const pushBefore = git(repositoryRoot, ["rev-parse", "HEAD"]);

      await writeManifest(repositoryRoot, candidateManifest());
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "Submit candidate"]);

      const approved = candidateManifest();
      appendLegalApproval(approved);
      await writeManifest(repositoryRoot, approved);
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "Approve candidate"]);
      const pushAfter = git(repositoryRoot, ["rev-parse", "HEAD"]);

      const eventPath = path.join(repositoryRoot, "push-event.json");
      await writeFile(
        eventPath,
        JSON.stringify({
          after: pushAfter,
          before: pushBefore,
          created: false,
        }),
      );
      const result = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({
          GITHUB_EVENT_NAME: "push",
          GITHUB_EVENT_PATH: eventPath,
        }),
        nowMs: NOW_MS,
      });
      assert.equal(result.baseReference, pushBefore);
      assert.equal(result.baseCommit, pushBefore);
      assert.match(
        result.errors.join("\n"),
        /gates\.legalPublication appends 2/u,
      );

      const explicitEnvironmentResult =
        validateLaunchGateTransitionFromRepository({
          repositoryRoot,
          environment: githubEnvironment({
            GITHUB_EVENT_BEFORE: pushBefore,
            GITHUB_EVENT_NAME: "push",
          }),
          nowMs: NOW_MS,
        });
      assert.equal(explicitEnvironmentResult.baseCommit, pushBefore);
      assert.match(
        explicitEnvironmentResult.errors.join("\n"),
        /gates\.legalPublication appends 2/u,
      );
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });

  it("fails closed when a non-initial push has no trustworthy before commit", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-invalid-push-"),
    );
    try {
      git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
      git(repositoryRoot, ["config", "user.name", "HELP Math Test"]);
      git(repositoryRoot, ["config", "user.email", "test@helpmath.invalid"]);
      await writeManifest(repositoryRoot, strictV2Manifest());
      git(repositoryRoot, ["add", "--", "config/launch-gates.json"]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "Add v2 baseline"]);

      const missing = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({ GITHUB_EVENT_NAME: "push" }),
        nowMs: NOW_MS,
      });
      assert.match(
        missing.errors.join("\n"),
        /requires GITHUB_EVENT_BEFORE or GITHUB_EVENT_PATH/u,
      );

      const eventPath = path.join(repositoryRoot, "push-event.json");
      await writeFile(
        eventPath,
        JSON.stringify({ before: "0".repeat(40), created: false }),
      );
      const allZero = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({
          GITHUB_EVENT_NAME: "push",
          GITHUB_EVENT_PATH: eventPath,
        }),
        nowMs: NOW_MS,
      });
      assert.match(
        allZero.errors.join("\n"),
        /non-initial push requires a nonzero before SHA/u,
      );

      const malformed = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({
          GITHUB_EVENT_BEFORE: "not-a-commit",
          GITHUB_EVENT_NAME: "push",
        }),
        nowMs: NOW_MS,
      });
      assert.match(
        malformed.errors.join("\n"),
        /must be a full lowercase 40-character Git commit SHA/u,
      );

      const unavailable = validateLaunchGateTransitionFromRepository({
        repositoryRoot,
        environment: githubEnvironment({
          GITHUB_EVENT_BEFORE: "f".repeat(40),
          GITHUB_EVENT_NAME: "push",
        }),
        nowMs: NOW_MS,
      });
      assert.match(
        unavailable.errors.join("\n"),
        /did not resolve to an available Git commit/u,
      );
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });

  it("runs history validation for PR and push while manual verification continues", async () => {
    const [workflow, packageSource] = await Promise.all([
      readFile(
        path.join(process.cwd(), ".github/workflows/quality.yml"),
        "utf8",
      ),
      readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ]);
    const verifyJob = workflow.match(
      /^  verify:\n(?<job>[\s\S]*?)(?=^  browser-quality:)/mu,
    )?.groups?.job;
    assert.ok(verifyJob);
    assert.match(verifyJob, /fetch-depth:\s*0/u);
    assert.match(
      verifyJob,
      /- name: Enforce launch-gate transition history\n\s+if: github\.event_name == 'pull_request' \|\| github\.event_name == 'push'\n\s+run: npm run check:launch-gate-transition\n\s+- run: npm run check:generated/u,
    );
    assert.match(workflow, /^  workflow_dispatch:\s*$/mu);

    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, string>;
    };
    assert.equal(
      packageJson.scripts?.["check:launch-gate-transition"],
      "tsx scripts/validate-launch-gate-transition.ts",
    );
  });
});
