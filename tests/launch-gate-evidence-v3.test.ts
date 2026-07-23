import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  computeLaunchGateEvidenceV3SubjectDigest,
  computeLaunchGateEvidenceV3SubjectDigestAtCommit,
  getLaunchGateEvidenceV3Requirement,
  LAUNCH_GATE_EVIDENCE_V3_POLICY,
  LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS,
  type LaunchGateEvidenceV3Kind,
  type LaunchGateEvidenceV3Outcome,
  type LaunchGateEvidenceV3ValidationOptions,
  validateLaunchGateEvidenceV3Envelope,
  verifyLaunchGateEvidenceV3File,
} from "../lib/launch-gate-evidence-v3";
import type { LaunchGateId } from "../lib/launch-gate-ids";

const NOW_MS = Date.parse("2026-07-23T22:00:00.000Z");
const DEPLOYMENT_ID = `dpl_${"A".repeat(24)}`;
const EVIDENCE_REFERENCE =
  "docs/evidence/launch-gates/legal-review-v3-2026-07-23.json";

type SyntheticEnvelope = {
  schemaVersion: number;
  gateId: string;
  evidenceKind: string;
  outcome: string;
  candidateId: string;
  decisionId: string;
  observedAt: string;
  recordedAt: string;
  validUntil: string | null;
  decision: {
    approvedBy: {
      name: string;
      authorityRole: string;
      organization: string;
    };
    approvedAt: string;
  };
  scope: {
    scopeId: string;
    subjectPaths: string[];
    repositoryContentSha256: string;
  };
  subject: {
    repositoryCommit: string;
    vercelDeploymentId: string | null;
  };
  dependencyDecisionIds: Record<string, string>;
  underlyingEvidence: {
    system: string;
    reference: string;
    sha256: string;
    bytes: number;
  };
  checks: Record<string, boolean>;
  unexpected?: boolean;
};

function optionsFor(
  kind: LaunchGateEvidenceV3Kind = "legal-review",
  gateId: LaunchGateId = "legalPublication",
  outcome: LaunchGateEvidenceV3Outcome = "approved",
  overrides: Partial<LaunchGateEvidenceV3ValidationOptions> = {},
): LaunchGateEvidenceV3ValidationOptions {
  const requiresDeployment =
    LAUNCH_GATE_EVIDENCE_V3_POLICY[kind].requiresDeployment;
  const slug = gateId.replace(
    /[A-Z]/gu,
    (letter) => `-${letter.toLowerCase()}`,
  );
  return {
    gateId,
    kind,
    outcome,
    candidateId: `candidate-${slug}-20260723`,
    decisionId: `decision-${slug}-20260723`,
    observedAt: "2026-07-23T20:00:00.000Z",
    recordedAt: "2026-07-23T20:10:00.000Z",
    validUntil: kind === "gate-revocation" ? null : "2026-07-24T20:20:00.000Z",
    decision: {
      approvedBy: {
        name: "Alice Rivera",
        authorityRole:
          gateId === "legalPublication"
            ? "legal-review-authority"
            : gateId === "contactIntake"
              ? "contact-release-authority"
              : gateId === "demoPublication"
                ? "demo-publication-authority"
                : gateId === "legacyCutover"
                  ? "legacy-cutover-authority"
                  : "production-release-authority",
        organization: "Independent Review Council",
      },
      approvedAt: "2026-07-23T20:20:00.000Z",
    },
    repositoryCommit: "a".repeat(40),
    repositoryContentSha256: "b".repeat(64),
    vercelDeploymentId: requiresDeployment ? DEPLOYMENT_ID : null,
    dependencyDecisionIds: {},
    nowMs: NOW_MS,
    ...overrides,
  };
}

function envelopeFor(
  options: LaunchGateEvidenceV3ValidationOptions,
): SyntheticEnvelope {
  const policy = LAUNCH_GATE_EVIDENCE_V3_POLICY[options.kind];
  return {
    schemaVersion: 2,
    gateId: options.gateId,
    evidenceKind: options.kind,
    outcome: options.outcome,
    candidateId: options.candidateId,
    decisionId: options.decisionId,
    observedAt: options.observedAt,
    recordedAt: options.recordedAt,
    validUntil: options.validUntil,
    decision: structuredClone(options.decision),
    scope: {
      scopeId: policy.scopeId,
      subjectPaths: [...policy.subjectPaths],
      repositoryContentSha256: options.repositoryContentSha256,
    },
    subject: {
      repositoryCommit: options.repositoryCommit,
      vercelDeploymentId: options.vercelDeploymentId,
    },
    dependencyDecisionIds: { ...options.dependencyDecisionIds },
    underlyingEvidence: {
      system: "Restricted governance registry",
      reference: "governance-record-2026-07-23-001",
      sha256: "c".repeat(64),
      bytes: 512,
    },
    checks: Object.fromEntries(policy.checks.map((check) => [check, true])),
  };
}

async function seedPolicyScope(
  repositoryRoot: string,
  kind: LaunchGateEvidenceV3Kind,
) {
  for (const subjectPath of LAUNCH_GATE_EVIDENCE_V3_POLICY[kind].subjectPaths) {
    const absolutePath = path.join(repositoryRoot, subjectPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `governed bytes for ${subjectPath}\n`);
  }
}

function git(repositoryRoot: string, argumentsList: readonly string[]): string {
  const result = spawnSync("git", [...argumentsList], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

describe("launch-gate evidence v3 fixed policy", () => {
  it("pins all evidence kinds, scopes, deployment requirements, TTLs, and checks", () => {
    assert.deepEqual(Object.keys(LAUNCH_GATE_EVIDENCE_V3_POLICY), [
      "legal-review",
      "contact-readiness",
      "contact-production-verification",
      "contact-disabled-disposition",
      "contact-disabled-verification",
      "demo-rights",
      "demo-product-acceptance",
      "demo-private-disposition",
      "legacy-cutover-authorization",
      "post-cutover-verification",
      "production-release",
      "gate-revocation",
    ]);

    for (const [kind, policy] of Object.entries(
      LAUNCH_GATE_EVIDENCE_V3_POLICY,
    )) {
      assert.match(policy.scopeId, /^[a-z][a-z0-9-]+-v1$/u, kind);
      assert.ok(policy.subjectPaths.length >= 7, kind);
      if (kind === "gate-revocation") {
        assert.equal(policy.maxTtlMs, null);
      } else {
        assert.ok((policy.maxTtlMs as number) >= 24 * 60 * 60 * 1_000, kind);
        assert.ok(
          (policy.maxTtlMs as number) <= 365 * 24 * 60 * 60 * 1_000,
          kind,
        );
      }
      assert.ok(policy.checks.length >= 5, kind);
      assert.equal(
        new Set(policy.subjectPaths).size,
        policy.subjectPaths.length,
      );
      assert.equal(new Set(policy.checks).size, policy.checks.length);
      for (const governancePath of [
        ".github/workflows/quality.yml",
        "lib/launch-gate-evidence.ts",
        "lib/launch-gate-evidence-v3.ts",
        "lib/launch-gate-ids.ts",
        "lib/launch-gate-lifecycle-v3.ts",
        "lib/launch-gate-policy.ts",
        "lib/launch-gate-transition-lock.js",
        "lib/launch-gate-validation.ts",
        "lib/launch-gates.ts",
        "lib/sensitive-content.ts",
        "package-lock.json",
        "package.json",
        "scripts/evidence-directory-contract.ts",
        "scripts/validate-launch-gates.ts",
        "scripts/validate-launch-gate-transition.ts",
        "tsconfig.json",
      ]) {
        assert.ok(
          (policy.subjectPaths as readonly string[]).includes(governancePath),
          `${kind} must bind shared governance bytes at ${governancePath}`,
        );
      }
    }

    assert.ok(
      LAUNCH_GATE_EVIDENCE_V3_POLICY[
        "legacy-cutover-authorization"
      ].subjectPaths.includes("next.config.ts"),
    );
    assert.ok(
      LAUNCH_GATE_EVIDENCE_V3_POLICY[
        "post-cutover-verification"
      ].subjectPaths.includes("next.config.ts"),
    );
    for (const demoRuntimeDependency of [
      ".github/workflows/executive-preview-lifecycle.yml",
      ".vercelignore",
      "app/globals.css",
      "app/api/canonical-entry",
      "app/robots.ts",
      "app/sitemap.ts",
      "components/animation-player-core.tsx",
      "components",
      "content",
      "lib/executive-preview-rate-limit.ts",
      "lib/sitemap-metadata.ts",
      "scripts/vercel-ignore-build.mjs",
      "tests/vercel-ignore-boundary.test.ts",
      "tests/vercel-ignored-build.test.ts",
      "vercel.json",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["demo-product-acceptance"]
            .subjectPaths as readonly string[]
        ).includes(demoRuntimeDependency),
        `demo acceptance must bind ${demoRuntimeDependency}`,
      );
    }
    for (const legalExposureDependency of [
      "app/robots.ts",
      "app/sitemap.ts",
      "lib/sitemap-metadata.ts",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["legal-review"]
            .subjectPaths as readonly string[]
        ).includes(legalExposureDependency),
        `legal review must bind ${legalExposureDependency}`,
      );
    }
    for (const productionQualityDependency of [
      ".github/workflows/production-deployment-smoke.yml",
      "e2e",
      "eslint.config.mjs",
      "lighthouserc.cjs",
      "playwright.config.ts",
      "playwright.global-setup.ts",
      "playwright.visual.config.ts",
      "tests",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["production-release"]
            .subjectPaths as readonly string[]
        ).includes(productionQualityDependency),
        `production release must bind ${productionQualityDependency}`,
      );
    }
    assert.ok(
      (
        LAUNCH_GATE_EVIDENCE_V3_POLICY["legacy-cutover-authorization"]
          .subjectPaths as readonly string[]
      ).includes(".github/workflows/stable-external-links.yml"),
      "legacy authorization must bind the stable external links workflow",
    );
    for (const legacyPreflightDependency of [
      "docs/CONTENT_SOURCES.md",
      "docs/LAUNCH_DECISIONS.md",
      "docs/evidence/legacy-source-crawl-2026-07-21.csv",
      "docs/evidence/legacy-source-crawl-2026-07-21.json",
      "docs/evidence/legacy-source-crawl-2026-07-21.sha256",
      "scripts/legacy-cutover-preflight-bootstrap.mjs",
      "scripts/legacy-source-custody-lib.mjs",
      "scripts/validate-legacy-source-custody.mjs",
      "tests/apache-legacy-generator.test.ts",
      "tests/legacy-apache.contract.ts",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["legacy-cutover-authorization"]
            .subjectPaths as readonly string[]
        ).includes(legacyPreflightDependency),
        `legacy authorization must bind ${legacyPreflightDependency}`,
      );
    }
    for (const revocationExecutionPath of [
      "app/[locale]/privacy/page.tsx",
      "app/[locale]/terms/page.tsx",
      "app/[locale]/contact/page.tsx",
      "app/api/contact/route.ts",
      "app/[locale]/demos",
      "app/api/executive-preview",
      "lib/demo-lifecycle.ts",
      "lib/legacy-cutover-preflight.ts",
      "scripts/legacy-cutover-preflight.ts",
      "next.config.ts",
      "proxy.ts",
      "app",
      "components",
      "content",
      "public",
      "scripts",
      "scripts/release-smoke.mjs",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["gate-revocation"]
            .subjectPaths as readonly string[]
        ).includes(revocationExecutionPath),
        `gate-revocation must bind ${revocationExecutionPath}`,
      );
    }
    assert.equal(
      LAUNCH_GATE_EVIDENCE_V3_POLICY["contact-disabled-disposition"]
        .requiresDeployment,
      false,
    );
    assert.equal(
      LAUNCH_GATE_EVIDENCE_V3_POLICY["contact-disabled-verification"]
        .requiresDeployment,
      true,
    );
    assert.equal(
      LAUNCH_GATE_EVIDENCE_V3_POLICY["demo-private-disposition"]
        .requiresDeployment,
      true,
    );
    assert.equal(
      LAUNCH_GATE_EVIDENCE_V3_POLICY["gate-revocation"].requiresDeployment,
      false,
    );
  });

  it("exports exact evidence requirements for each outcome and contact path", () => {
    assert.deepEqual(LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS.contactIntake, {
      approved: { default: ["contact-readiness"] },
      disabled: { default: ["contact-disabled-disposition"] },
      revoked: { default: ["gate-revocation"] },
    });
    assert.deepEqual(LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS.demoPublication, {
      approved: { default: ["demo-rights", "demo-product-acceptance"] },
      private: { default: ["demo-private-disposition"] },
      revoked: { default: ["gate-revocation"] },
    });
    assert.deepEqual(
      getLaunchGateEvidenceV3Requirement(
        "legacyCutover",
        "approved",
        "contactEnabled",
      ),
      ["contact-production-verification", "legacy-cutover-authorization"],
    );
    assert.deepEqual(
      getLaunchGateEvidenceV3Requirement(
        "legacyCutover",
        "approved",
        "contactDisabled",
      ),
      ["contact-disabled-verification", "legacy-cutover-authorization"],
    );
    assert.deepEqual(
      getLaunchGateEvidenceV3Requirement(
        "productionLaunch",
        "approved",
        "contactDisabled",
      ),
      [
        "post-cutover-verification",
        "contact-disabled-verification",
        "production-release",
      ],
    );
    assert.equal(
      getLaunchGateEvidenceV3Requirement(
        "demoPublication",
        "disabled",
        "default",
      ),
      null,
    );
  });
});

describe("launch-gate evidence v3 envelope validation", () => {
  it("accepts synthetic envelopes for every fixed evidence kind and new outcome", () => {
    const cases: Array<
      [LaunchGateEvidenceV3Kind, LaunchGateId, LaunchGateEvidenceV3Outcome]
    > = [
      ["legal-review", "legalPublication", "approved"],
      ["contact-readiness", "contactIntake", "approved"],
      ["contact-production-verification", "legacyCutover", "approved"],
      ["contact-disabled-disposition", "contactIntake", "disabled"],
      ["contact-disabled-verification", "productionLaunch", "approved"],
      ["demo-rights", "demoPublication", "approved"],
      ["demo-product-acceptance", "demoPublication", "approved"],
      ["demo-private-disposition", "demoPublication", "private"],
      ["legacy-cutover-authorization", "legacyCutover", "approved"],
      ["post-cutover-verification", "productionLaunch", "approved"],
      ["production-release", "productionLaunch", "approved"],
      ["gate-revocation", "legalPublication", "revoked"],
    ];

    for (const [kind, gateId, outcome] of cases) {
      const options = optionsFor(kind, gateId, outcome);
      assert.deepEqual(
        validateLaunchGateEvidenceV3Envelope(envelopeFor(options), options),
        [],
        kind,
      );
    }
  });

  it("rejects unknown fields at every schema layer and requires exact checks", () => {
    const options = optionsFor();
    const envelope = envelopeFor(options);
    envelope.unexpected = true;
    (
      envelope.decision as typeof envelope.decision & { unexpected?: boolean }
    ).unexpected = true;
    (
      envelope.decision.approvedBy as typeof envelope.decision.approvedBy & {
        unexpected?: boolean;
      }
    ).unexpected = true;
    (
      envelope.scope as typeof envelope.scope & { unexpected?: boolean }
    ).unexpected = true;
    (
      envelope.subject as typeof envelope.subject & { unexpected?: boolean }
    ).unexpected = true;
    (
      envelope.underlyingEvidence as typeof envelope.underlyingEvidence & {
        unexpected?: boolean;
      }
    ).unexpected = true;
    envelope.checks.unreviewedShortcut = true;
    envelope.checks.englishLegalCopyApproved = false;
    delete envelope.checks.spanishLegalCopyApproved;

    const errors = validateLaunchGateEvidenceV3Envelope(envelope, options).join(
      "\n",
    );
    assert.match(errors, /envelope contains unknown field unexpected/u);
    assert.match(errors, /decision contains unknown field unexpected/u);
    assert.match(errors, /approvedBy contains unknown field unexpected/u);
    assert.match(errors, /scope contains unknown field unexpected/u);
    assert.match(errors, /subject contains unknown field unexpected/u);
    assert.match(
      errors,
      /underlyingEvidence contains unknown field unexpected/u,
    );
    assert.match(errors, /checks contains unknown field unreviewedShortcut/u);
    assert.match(errors, /checks\.englishLegalCopyApproved must be true/u);
    assert.match(errors, /checks\.spanishLegalCopyApproved must be true/u);
  });

  it("hash-binds candidate, decision, outcome, approver, commit, and deployment", () => {
    const options = optionsFor(
      "contact-readiness",
      "contactIntake",
      "approved",
    );
    const envelope = envelopeFor(options);
    envelope.candidateId = "candidate-contact-intake-replayed";
    envelope.decisionId = "decision-contact-intake-replayed";
    envelope.outcome = "disabled";
    envelope.decision.approvedBy.name = "Morgan Lee";
    envelope.subject.repositoryCommit = "d".repeat(40);
    envelope.subject.vercelDeploymentId = `dpl_${"B".repeat(24)}`;

    const errors = validateLaunchGateEvidenceV3Envelope(envelope, options).join(
      "\n",
    );
    assert.match(errors, /candidateId must match/u);
    assert.match(errors, /decisionId must match/u);
    assert.match(errors, /outcome must be approved/u);
    assert.match(errors, /approvedBy\.name must match/u);
    assert.match(errors, /repositoryCommit must match/u);
    assert.match(errors, /vercelDeploymentId must match/u);
  });

  it("requires the fixed scope ID, ordered paths, and current digest binding", () => {
    const options = optionsFor();
    const envelope = envelopeFor(options);
    envelope.scope.scopeId = "weakened-scope-v1";
    envelope.scope.subjectPaths.reverse();
    envelope.scope.repositoryContentSha256 = "d".repeat(64);

    const errors = validateLaunchGateEvidenceV3Envelope(envelope, options).join(
      "\n",
    );
    assert.match(errors, /scope\.scopeId must be legal-publication-v1/u);
    assert.match(errors, /scope\.subjectPaths must exactly match/u);
    assert.match(errors, /repositoryContentSha256 must match/u);
  });

  it("fails closed when the validation clock is non-finite", () => {
    const options = optionsFor("legal-review", "legalPublication", "approved", {
      nowMs: Number.NaN,
    });
    assert.match(
      validateLaunchGateEvidenceV3Envelope(envelopeFor(options), options).join(
        "\n",
      ),
      /nowMs must be a finite timestamp/u,
    );
  });

  it("rejects all-zero placeholder hashes for governed and underlying evidence", () => {
    const options = optionsFor("legal-review", "legalPublication", "approved", {
      repositoryContentSha256: "0".repeat(64),
    });
    const envelope = envelopeFor(options);
    envelope.underlyingEvidence.sha256 = "0".repeat(64);
    const errors = validateLaunchGateEvidenceV3Envelope(envelope, options).join(
      "\n",
    );
    assert.match(
      errors,
      /scope\.repositoryContentSha256 must be a nonzero lowercase SHA-256/u,
    );
    assert.match(
      errors,
      /underlyingEvidence\.sha256 must be a nonzero lowercase SHA-256/u,
    );
    assert.match(
      errors,
      /expected repositoryContentSha256 must be a nonzero lowercase SHA-256/u,
    );
  });

  it("requires exact dependency decision IDs and rejects current or unknown gates", () => {
    const options = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
      {
        dependencyDecisionIds: {
          legalPublication: "decision-legal-publication-20260723",
          contactIntake: "decision-contact-intake-20260723",
          demoPublication: "decision-demo-publication-20260723",
          legacyCutover: "decision-legacy-cutover-20260723",
        },
      },
    );
    const envelope = envelopeFor(options);
    envelope.dependencyDecisionIds.contactIntake =
      "decision-contact-intake-replayed";
    delete envelope.dependencyDecisionIds.demoPublication;
    envelope.dependencyDecisionIds.unrecognizedGate =
      "decision-unrecognized-gate-20260723";

    const errors = validateLaunchGateEvidenceV3Envelope(envelope, options).join(
      "\n",
    );
    assert.match(errors, /keys must exactly match/u);
    assert.match(errors, /contactIntake must match/u);
    assert.match(errors, /demoPublication must match/u);

    const invalidOptions = {
      ...options,
      dependencyDecisionIds: {
        productionLaunch: "decision-production-launch-20260722",
        foreignGate: "decision-foreign-gate-20260722",
      },
    };
    const invalidErrors = validateLaunchGateEvidenceV3Envelope(
      envelopeFor(invalidOptions),
      invalidOptions,
    ).join("\n");
    assert.match(invalidErrors, /must not contain the current gate/u);
    assert.match(invalidErrors, /contains unknown gate foreignGate/u);
  });

  it("enforces observed <= recorded <= approved < validUntil, expiry, and max TTL", () => {
    const options = optionsFor(
      "contact-production-verification",
      "legacyCutover",
      "approved",
    );

    const observedLate = envelopeFor(options);
    observedLate.observedAt = "2026-07-23T20:11:00.000Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(observedLate, {
        ...options,
        observedAt: observedLate.observedAt,
      }).join("\n"),
      /observedAt must not be later than recordedAt/u,
    );

    const recordedLate = envelopeFor(options);
    recordedLate.recordedAt = "2026-07-23T20:21:00.000Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(recordedLate, {
        ...options,
        recordedAt: recordedLate.recordedAt,
      }).join("\n"),
      /recordedAt must not be later than decision\.approvedAt/u,
    );

    const noValidityWindow = envelopeFor(options);
    noValidityWindow.validUntil = options.decision.approvedAt;
    assert.match(
      validateLaunchGateEvidenceV3Envelope(noValidityWindow, {
        ...options,
        validUntil: noValidityWindow.validUntil,
      }).join("\n"),
      /decision\.approvedAt must be earlier than validUntil/u,
    );

    const expired = envelopeFor(options);
    assert.notEqual(options.validUntil, null);
    assert.match(
      validateLaunchGateEvidenceV3Envelope(expired, {
        ...options,
        nowMs: Date.parse(options.validUntil as string),
      }).join("\n"),
      /envelope is expired/u,
    );
    assert.deepEqual(
      validateLaunchGateEvidenceV3Envelope(expired, {
        ...options,
        nowMs: Date.parse(options.validUntil as string),
        requireCurrentlyValid: false,
      }),
      [],
    );

    const overTtl = envelopeFor(options);
    overTtl.validUntil = "2026-07-24T20:20:00.001Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(overTtl, {
        ...options,
        validUntil: overTtl.validUntil,
      }).join("\n"),
      /TTL exceeds the 86400000ms policy maximum/u,
    );
  });

  it("treats revocation as permanent fail-closed evidence with no expiry", () => {
    const options = optionsFor("gate-revocation", "demoPublication", "revoked");
    const envelope = envelopeFor(options);
    assert.equal(envelope.validUntil, null);
    assert.deepEqual(
      validateLaunchGateEvidenceV3Envelope(envelope, {
        ...options,
        nowMs: Date.parse("2099-01-01T00:00:00.000Z"),
      }),
      [],
    );

    envelope.validUntil = "2026-07-24T20:20:00.000Z";
    const errors = validateLaunchGateEvidenceV3Envelope(envelope, {
      ...options,
      validUntil: envelope.validUntil,
    }).join("\n");
    assert.match(errors, /gate-revocation envelope validUntil must be null/u);
    assert.match(errors, /expected gate-revocation validUntil must be null/u);
  });

  it("rejects a deployment-free operational envelope and a deployment-bound legal envelope", () => {
    const operationalOptions = optionsFor(
      "contact-disabled-verification",
      "legacyCutover",
      "approved",
      { vercelDeploymentId: null },
    );
    assert.match(
      validateLaunchGateEvidenceV3Envelope(
        envelopeFor(operationalOptions),
        operationalOptions,
      ).join("\n"),
      /must identify a Vercel deployment/u,
    );

    const legalOptions = optionsFor(
      "legal-review",
      "legalPublication",
      "approved",
      {
        vercelDeploymentId: DEPLOYMENT_ID,
      },
    );
    assert.match(
      validateLaunchGateEvidenceV3Envelope(
        envelopeFor(legalOptions),
        legalOptions,
      ).join("\n"),
      /must be null for this evidence kind/u,
    );
  });
});

describe("launch-gate evidence v3 file verification", () => {
  it("binds governed bytes to an existing candidate commit tree", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-gate-commit-v3-"),
    );
    try {
      await seedPolicyScope(repositoryRoot, "legal-review");
      git(repositoryRoot, ["init", "--quiet"]);
      git(repositoryRoot, ["config", "user.name", "Gate Test"]);
      git(repositoryRoot, [
        "config",
        "user.email",
        "gate-test@example.invalid",
      ]);
      git(repositoryRoot, ["add", "."]);
      git(repositoryRoot, ["commit", "--quiet", "-m", "seed governed scope"]);
      const repositoryCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);

      const currentDigest = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legal-review",
      );
      const commitDigest =
        await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
          repositoryRoot,
          "legal-review",
          repositoryCommit,
        );
      assert.deepEqual(commitDigest, currentDigest);

      await writeFile(
        path.join(repositoryRoot, "lib/launch-gate-lifecycle-v3.ts"),
        "renewed bytes that are not in the candidate commit\n",
      );
      const changedCurrentDigest =
        await computeLaunchGateEvidenceV3SubjectDigest(
          repositoryRoot,
          "legal-review",
        );
      const unchangedCommitDigest =
        await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
          repositoryRoot,
          "legal-review",
          repositoryCommit,
        );
      assert.notEqual(
        changedCurrentDigest.sha256,
        unchangedCommitDigest.sha256,
      );

      await assert.rejects(
        computeLaunchGateEvidenceV3SubjectDigestAtCommit(
          repositoryRoot,
          "legal-review",
          "f".repeat(40),
        ),
        /git rev-parse failed/u,
      );
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("invalidates governed subjects when lifecycle semantics or legacy redirects change", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-gate-governance-v3-"),
    );
    try {
      await seedPolicyScope(repositoryRoot, "legal-review");
      const legalBefore = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legal-review",
      );
      await writeFile(
        path.join(repositoryRoot, "lib/launch-gate-lifecycle-v3.ts"),
        "changed lifecycle expiry semantics\n",
      );
      const legalAfter = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legal-review",
      );
      assert.notEqual(legalAfter.sha256, legalBefore.sha256);

      await seedPolicyScope(repositoryRoot, "legacy-cutover-authorization");
      const legacyBefore = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legacy-cutover-authorization",
      );
      await writeFile(
        path.join(repositoryRoot, "next.config.ts"),
        "changed legacy redirect authority\n",
      );
      const legacyAfter = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legacy-cutover-authorization",
      );
      assert.notEqual(legacyAfter.sha256, legacyBefore.sha256);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("ignores unrelated changes but invalidates related scope changes and replay", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-gate-evidence-v3-"),
    );
    try {
      await seedPolicyScope(repositoryRoot, "legal-review");
      const scopeDigest = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "legal-review",
      );
      const options = optionsFor(
        "legal-review",
        "legalPublication",
        "approved",
        {
          repositoryContentSha256: scopeDigest.sha256,
        },
      );
      const envelope = envelopeFor(options);
      const evidenceBytes = Buffer.from(
        `${JSON.stringify(envelope, null, 2)}\n`,
      );
      const evidencePath = path.join(repositoryRoot, EVIDENCE_REFERENCE);
      await mkdir(path.dirname(evidencePath), { recursive: true });
      await writeFile(evidencePath, evidenceBytes);
      const evidenceSha256 = createHash("sha256")
        .update(evidenceBytes)
        .digest("hex");
      const verificationOptions = {
        ...options,
        repositoryRoot,
        reference: EVIDENCE_REFERENCE,
        sha256: evidenceSha256,
      };

      assert.deepEqual(
        (await verifyLaunchGateEvidenceV3File(verificationOptions)).errors,
        [],
      );

      await mkdir(path.join(repositoryRoot, "demos"), { recursive: true });
      await writeFile(
        path.join(repositoryRoot, "demos/unrelated-change.ts"),
        "unrelated demo bytes\n",
      );
      assert.deepEqual(
        (await verifyLaunchGateEvidenceV3File(verificationOptions)).errors,
        [],
      );

      await writeFile(
        path.join(repositoryRoot, "content"),
        "changed governed legal content\n",
      );
      assert.match(
        (await verifyLaunchGateEvidenceV3File(verificationOptions)).errors.join(
          "\n",
        ),
        /subject digest does not match the current policy scope/u,
      );
      assert.deepEqual(
        (
          await verifyLaunchGateEvidenceV3File({
            ...verificationOptions,
            requireCurrentSubject: false,
          })
        ).errors,
        [],
      );
      await writeFile(
        path.join(repositoryRoot, "content"),
        "governed bytes for content\n",
      );

      const replayed = await verifyLaunchGateEvidenceV3File({
        ...verificationOptions,
        candidateId: "candidate-legal-publication-replayed",
      });
      assert.match(replayed.errors.join("\n"), /candidateId must match/u);

      const expired = await verifyLaunchGateEvidenceV3File({
        ...verificationOptions,
        nowMs: Date.parse(options.validUntil as string),
      });
      assert.match(expired.errors.join("\n"), /envelope is expired/u);
      const historical = await verifyLaunchGateEvidenceV3File({
        ...verificationOptions,
        nowMs: Date.parse(options.validUntil as string),
        requireCurrentlyValid: false,
      });
      assert.deepEqual(historical.errors, []);

      const mismatchedHash = await verifyLaunchGateEvidenceV3File({
        ...verificationOptions,
        sha256: "0".repeat(64),
      });
      assert.match(mismatchedHash.errors.join("\n"), /SHA-256 mismatch/u);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
