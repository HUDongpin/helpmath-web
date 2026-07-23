import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import launchGateManifestV2 from "../config/launch-gates.json";
import {
  computeLaunchGateEvidenceV3SubjectDigestAtCommit,
  LAUNCH_GATE_EVIDENCE_V3_POLICY,
  type LaunchGateEvidenceV3Kind,
} from "../lib/launch-gate-evidence-v3";
import {
  migrateLaunchGateManifestV2ToV3,
  type LaunchGateLifecycleEventV3,
  type LaunchGateLifecycleManifestV3,
} from "../lib/launch-gate-lifecycle-v3";
import { LAUNCH_GATE_BLOCKER_REFS } from "../lib/launch-gate-policy";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

function mutableClone<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}

async function writeV3Repository(
  repositoryRoot: string,
  manifest: LaunchGateLifecycleManifestV3,
) {
  await mkdir(path.join(repositoryRoot, "config"), { recursive: true });
  await writeFile(
    path.join(repositoryRoot, "config/launch-gates.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await mkdir(path.join(repositoryRoot, "docs/evidence/launch-gates"), {
    recursive: true,
  });
  const blockerReferences = new Set(
    Object.values(LAUNCH_GATE_BLOCKER_REFS).flat(),
  );
  for (const reference of blockerReferences) {
    const target = path.join(repositoryRoot, reference);
    await mkdir(path.dirname(target), { recursive: true });
    const status =
      reference === "docs/LEGAL_REVIEW.md" ||
      reference === "docs/CONTACT_DELIVERY.md"
        ? "**Status:** Pending\n"
        : "# Retained launch blocker\n";
    await writeFile(target, status);
  }
}

function runValidator(repositoryRoot: string) {
  const projectRoot = process.cwd();
  return spawnSync(
    path.join(projectRoot, "node_modules/.bin/tsx"),
    [path.join(projectRoot, "scripts/validate-launch-gates.ts")],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_CONTACT_ENABLED: "false",
      },
    },
  );
}

function git(repositoryRoot: string, args: readonly string[]): string {
  const result = spawnSync("git", [...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function seedRevocationSubject(repositoryRoot: string) {
  const sourceRoot = process.cwd();
  const subjectPaths = new Set([
    ...LAUNCH_GATE_EVIDENCE_V3_POLICY["legal-review"].subjectPaths,
    ...LAUNCH_GATE_EVIDENCE_V3_POLICY["gate-revocation"].subjectPaths,
  ]);
  for (const subjectPath of subjectPaths) {
    const source = path.join(sourceRoot, subjectPath);
    const target = path.join(repositoryRoot, subjectPath);
    const sourceMetadata = await stat(source);
    if (sourceMetadata.isDirectory()) {
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, "governed-scope-record.txt"),
        `governed directory ${subjectPath}\n`,
      );
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const contents =
      subjectPath === "docs/LEGAL_REVIEW.md" ||
      subjectPath === "docs/CONTACT_DELIVERY.md"
        ? "**Status:** Pending\n"
        : subjectPath === "package.json"
          ? '{"name":"launch-validator-fixture","private":true,"type":"module"}\n'
          : subjectPath === "tsconfig.json"
            ? '{"compilerOptions":{}}\n'
        : `governed file ${subjectPath}\n`;
    await writeFile(target, contents);
  }
}

function evidenceEnvelope({
  kind,
  outcome,
  candidateId,
  decisionId,
  observedAt,
  recordedAt,
  approvedAt,
  validUntil,
  repositoryCommit,
  repositoryContentSha256,
}: {
  kind: LaunchGateEvidenceV3Kind;
  outcome: "approved" | "revoked";
  candidateId: string;
  decisionId: string;
  observedAt: string;
  recordedAt: string;
  approvedAt: string;
  validUntil: string | null;
  repositoryCommit: string;
  repositoryContentSha256: string;
}) {
  const policy = LAUNCH_GATE_EVIDENCE_V3_POLICY[kind];
  return {
    schemaVersion: 2,
    gateId: "legalPublication",
    evidenceKind: kind,
    outcome,
    candidateId,
    decisionId,
    observedAt,
    recordedAt,
    validUntil,
    decision: {
      approvedBy: {
        name: "Alice Rivera",
        authorityRole: "legal-review-authority",
        organization: "Independent Governance Council",
      },
      approvedAt,
    },
    scope: {
      scopeId: policy.scopeId,
      subjectPaths: [...policy.subjectPaths],
      repositoryContentSha256,
    },
    subject: {
      repositoryCommit,
      vercelDeploymentId: null,
    },
    dependencyDecisionIds: {},
    underlyingEvidence: {
      system: "Restricted governance registry",
      reference: `governance-record-${decisionId}`,
      sha256: "c".repeat(64),
      bytes: 512,
    },
    checks: Object.fromEntries(policy.checks.map((check) => [check, true])),
  };
}

async function writeNormalizedJson(target: string, value: unknown) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function revokedRepositoryFixture(repositoryRoot: string) {
  const migration = migrateLaunchGateManifestV2ToV3(launchGateManifestV2, {
    nowMs: Date.now(),
  });
  assert.deepEqual(migration.errors, []);
  assert.ok(migration.manifest);
  await writeV3Repository(repositoryRoot, migration.manifest);
  await seedRevocationSubject(repositoryRoot);

  git(repositoryRoot, ["init", "-q"]);
  git(repositoryRoot, ["config", "user.name", "HELP Math Test"]);
  git(repositoryRoot, ["config", "user.email", "test@helpmath.invalid"]);
  git(repositoryRoot, ["add", "."]);
  git(repositoryRoot, ["commit", "-q", "-m", "candidate subject"]);
  const repositoryCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);

  const nowMs = Date.now();
  const candidateAt = new Date(nowMs - 40 * 60_000).toISOString();
  const legalObservedAt = new Date(nowMs - 35 * 60_000).toISOString();
  const legalRecordedAt = new Date(nowMs - 34 * 60_000).toISOString();
  const legalApprovedAt = new Date(nowMs - 30 * 60_000).toISOString();
  const revocationObservedAt = new Date(nowMs - 15 * 60_000).toISOString();
  const revocationRecordedAt = new Date(nowMs - 14 * 60_000).toISOString();
  const revocationAt = new Date(nowMs - 10 * 60_000).toISOString();
  const validUntil = new Date(nowMs + 12 * 60 * 60_000).toISOString();
  const candidateId = "legal-publication-candidate-20260723";
  const approvalDecisionId = "legal-publication-decision-20260723";
  const revocationDecisionId = "legal-publication-revocation-20260723";
  const authority = {
    name: "Alice Rivera",
    authorityRole: "legal-review-authority",
    organization: "Independent Governance Council",
  } as const;

  const legalDigest = await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
    repositoryRoot,
    "legal-review",
    repositoryCommit,
  );
  const revocationDigest =
    await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
      repositoryRoot,
      "gate-revocation",
      repositoryCommit,
    );
  const legalReference =
    "docs/evidence/launch-gates/legal-approved-20260723.json";
  const revocationReference =
    "docs/evidence/launch-gates/legal-revoked-20260723.json";
  const legalFile = await writeNormalizedJson(
    path.join(repositoryRoot, legalReference),
    evidenceEnvelope({
      kind: "legal-review",
      outcome: "approved",
      candidateId,
      decisionId: approvalDecisionId,
      observedAt: legalObservedAt,
      recordedAt: legalRecordedAt,
      approvedAt: legalApprovedAt,
      validUntil,
      repositoryCommit,
      repositoryContentSha256: legalDigest.sha256,
    }),
  );
  const revocationEnvelope = evidenceEnvelope({
    kind: "gate-revocation",
    outcome: "revoked",
    candidateId,
    decisionId: revocationDecisionId,
    observedAt: revocationObservedAt,
    recordedAt: revocationRecordedAt,
    approvedAt: revocationAt,
    validUntil: null,
    repositoryCommit,
    repositoryContentSha256: revocationDigest.sha256,
  });
  const revocationFile = await writeNormalizedJson(
    path.join(repositoryRoot, revocationReference),
    revocationEnvelope,
  );

  const initial =
    migration.manifest.gates.legalPublication.events[
      migration.manifest.gates.legalPublication.events.length - 1
    ];
  const candidate: LaunchGateLifecycleEventV3 = {
    eventId: candidateId,
    transition: "submit",
    from: "holding",
    to: "candidate",
    targetStatus: "approved",
    candidate: {
      repositoryCommit,
      vercelDeploymentId: null,
    },
    occurredAt: candidateAt,
    validUntil,
    previousEventId: initial.eventId,
    supersedes: null,
    decision: null,
    evidence: [],
  };
  const approved: LaunchGateLifecycleEventV3 = {
    eventId: "legal-publication-approved-20260723",
    transition: "approve",
    from: "candidate",
    to: "approved",
    targetStatus: null,
    candidate: null,
    occurredAt: legalApprovedAt,
    validUntil,
    previousEventId: candidate.eventId,
    supersedes: null,
    decision: {
      decisionId: approvalDecisionId,
      outcome: "approved",
      decidedAt: legalApprovedAt,
      decidedBy: authority,
      candidate: {
        candidateEventId: candidateId,
        repositoryCommit,
        vercelDeploymentId: null,
      },
      supersedesDecisionId: null,
    },
    evidence: [
      {
        kind: "legal-review",
        reference: legalReference,
        sha256: legalFile.sha256,
        observedAt: legalObservedAt,
        validUntil,
      },
    ],
  };
  const revoked: LaunchGateLifecycleEventV3 = {
    eventId: "legal-publication-revoked-20260723",
    transition: "revoke",
    from: "approved",
    to: "revoked",
    targetStatus: null,
    candidate: null,
    occurredAt: revocationAt,
    validUntil: null,
    previousEventId: approved.eventId,
    supersedes: approved.eventId,
    decision: {
      decisionId: revocationDecisionId,
      outcome: "revoked",
      decidedAt: revocationAt,
      decidedBy: authority,
      candidate: {
        candidateEventId: candidateId,
        repositoryCommit,
        vercelDeploymentId: null,
      },
      supersedesDecisionId: approvalDecisionId,
    },
    evidence: [
      {
        kind: "gate-revocation",
        reference: revocationReference,
        sha256: revocationFile.sha256,
        observedAt: revocationObservedAt,
        validUntil: null,
      },
    ],
  };
  const manifest: LaunchGateLifecycleManifestV3 = {
    ...migration.manifest,
    updatedAt: revocationAt,
    gates: {
      ...migration.manifest.gates,
      legalPublication: {
        ...migration.manifest.gates.legalPublication,
        events: [
          ...migration.manifest.gates.legalPublication.events,
          candidate,
          approved,
          revoked,
        ],
      },
    },
  };
  const manifestPath = path.join(repositoryRoot, "config/launch-gates.json");
  await writeNormalizedJson(manifestPath, manifest);
  await writeFile(
    path.join(repositoryRoot, "lib/post-revocation-maintenance.txt"),
    "safe maintenance after revocation\n",
  );

  return {
    manifest,
    manifestPath,
    repositoryCommit,
    revocationEnvelope,
    revocationReference,
    revocationSha256: revocationFile.sha256,
  };
}

describe("launch-gate v3 repository validator", () => {
  it("derives every decision subject digest from the candidate Git tree", async () => {
    const validator = await readFile(
      path.join(process.cwd(), "scripts/validate-launch-gates.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      validator,
      /metadata\.repositoryContentSha256|event\.to !== "revoked"/u,
    );
    assert.match(
      validator,
      /repositoryContentSha256 = \(\s*await v3CommitSubjectDigest\(\s*entry\.kind,\s*event\.decision\.candidate\.repositoryCommit,\s*\)\s*\)\.sha256;/u,
    );
  });

  it("accepts the exact v2 holding migration without creating approvals", async () => {
    const nowMs = Date.now();
    const migration = migrateLaunchGateManifestV2ToV3(launchGateManifestV2, {
      nowMs,
    });
    assert.deepEqual(migration.errors, []);
    assert.ok(migration.manifest);

    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-validator-v3-"),
    );
    try {
      await writeV3Repository(repositoryRoot, migration.manifest);
      const result = runValidator(repositoryRoot);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = JSON.parse(result.stdout) as {
        schemaVersion: number;
        subject: unknown;
        gates: Record<string, string>;
        errors: string[];
      };
      assert.equal(output.schemaVersion, 3);
      assert.equal(output.subject, null);
      assert.deepEqual(output.errors, []);
      assert.equal(
        Object.values(output.gates).every((status) => status === "holding"),
        true,
      );
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });

  it("verifies historical revocation digests while allowing later maintenance", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-validator-revoked-v3-"),
    );
    try {
      const fixture = await revokedRepositoryFixture(repositoryRoot);
      const accepted = runValidator(repositoryRoot);
      assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
      const acceptedOutput = JSON.parse(accepted.stdout) as {
        gates: Record<string, string>;
        errors: string[];
      };
      assert.deepEqual(acceptedOutput.errors, []);
      assert.equal(acceptedOutput.gates.legalPublication, "revoked");

      const tamperedEnvelope = structuredClone(fixture.revocationEnvelope);
      tamperedEnvelope.scope.repositoryContentSha256 = "f".repeat(64);
      const tamperedFile = await writeNormalizedJson(
        path.join(repositoryRoot, fixture.revocationReference),
        tamperedEnvelope,
      );
      const tamperedManifest = mutableClone(fixture.manifest);
      const tamperedRevocation =
        tamperedManifest.gates.legalPublication.events[
          tamperedManifest.gates.legalPublication.events.length - 1
        ];
      tamperedRevocation.evidence[0].sha256 = tamperedFile.sha256;
      await writeNormalizedJson(fixture.manifestPath, tamperedManifest);
      const rejectedDigest = runValidator(repositoryRoot);
      assert.equal(rejectedDigest.status, 1);
      assert.match(
        rejectedDigest.stdout,
        /repositoryContentSha256 must match the expected subject digest/u,
      );

      const missingCommit = "f".repeat(40);
      const missingManifest = mutableClone(fixture.manifest);
      const legalEvents = missingManifest.gates.legalPublication.events;
      const candidate = legalEvents[legalEvents.length - 3];
      const approved = legalEvents[legalEvents.length - 2];
      const revoked = legalEvents[legalEvents.length - 1];
      assert.ok(candidate.candidate);
      assert.ok(approved.decision);
      assert.ok(revoked.decision);
      candidate.candidate.repositoryCommit = missingCommit;
      approved.decision.candidate.repositoryCommit = missingCommit;
      revoked.decision.candidate.repositoryCommit = missingCommit;
      await writeNormalizedJson(fixture.manifestPath, missingManifest);
      await writeNormalizedJson(
        path.join(repositoryRoot, fixture.revocationReference),
        fixture.revocationEnvelope,
      );
      const rejectedCommit = runValidator(repositoryRoot);
      assert.equal(rejectedCommit.status, 1);
      assert.match(
        rejectedCommit.stdout,
        /candidate commit subject could not be computed/u,
      );
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });

  it("reports malformed schema-v3 manifests without throwing", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-launch-validator-malformed-v3-"),
    );
    try {
      await mkdir(path.join(repositoryRoot, "config"), { recursive: true });
      await mkdir(path.join(repositoryRoot, "docs/evidence/launch-gates"), {
        recursive: true,
      });
      await writeFile(
        path.join(repositoryRoot, "config/launch-gates.json"),
        `${JSON.stringify(
          {
            schemaVersion: 3,
            updatedAt: new Date().toISOString(),
            gates: {},
          },
          null,
          2,
        )}\n`,
      );

      const result = runValidator(repositoryRoot);
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.doesNotMatch(result.stderr, /TypeError|RangeError/u);
      const output = JSON.parse(result.stdout) as { errors: string[] };
      assert.ok(output.errors.length > 0);
      assert.match(output.errors.join("\n"), /gates\./u);
    } finally {
      await rm(repositoryRoot, { force: true, recursive: true });
    }
  });
});
