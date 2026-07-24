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
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_DIRECTORY,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_SYSTEM,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW,
  LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH,
  LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS,
  requiresCurrentLaunchGateEvidenceV3Binding,
  type LaunchGateEvidenceV3Kind,
  type LaunchGateEvidenceV3Outcome,
  type LaunchGateEvidenceV3ProductionQualityRun,
  type LaunchGateEvidenceV3ValidationOptions,
  validateLaunchGateEvidenceV3Envelope,
  verifyLaunchGateEvidenceV3File,
} from "../lib/launch-gate-evidence-v3";
import type { LaunchGateId } from "../lib/launch-gate-ids";

const NOW_MS = Date.parse("2026-07-23T22:00:00.000Z");
const DEPLOYMENT_ID = `dpl_${"A".repeat(24)}`;
const EVIDENCE_REFERENCE =
  "docs/evidence/launch-gates/legal-review-v3-2026-07-23.json";
const PRODUCTION_EVIDENCE_REFERENCE =
  "docs/evidence/launch-gates/production-release-v3-2026-07-23.json";
const QUALITY_RUN_ID = 29_921_608_812;
const QUALITY_RUN_ATTEMPT = 1;

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
  qualityRun?: LaunchGateEvidenceV3ProductionQualityRun;
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
    validUntil: kind === "gate-revocation" ? null : "2026-07-24T19:59:59.000Z",
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
  const qualityRun =
    options.kind === "production-release"
      ? productionQualityRunFor(options)
      : undefined;
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
      system:
        qualityRun === undefined
          ? "Restricted governance registry"
          : LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_SYSTEM,
      reference:
        qualityRun === undefined
          ? "governance-record-2026-07-23-001"
          : productionQualityReceiptReference(qualityRun),
      sha256: "c".repeat(64),
      bytes: 512,
    },
    checks: Object.fromEntries(policy.checks.map((check) => [check, true])),
    ...(qualityRun === undefined ? {} : { qualityRun }),
  };
}

function productionQualityRunFor(
  options: LaunchGateEvidenceV3ValidationOptions,
): LaunchGateEvidenceV3ProductionQualityRun {
  return {
    repository: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY,
    workflow: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW,
    workflowPath: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH,
    event: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT,
    ref: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF,
    headBranch: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH,
    headSha: options.repositoryCommit,
    runId: QUALITY_RUN_ID,
    runAttempt: QUALITY_RUN_ATTEMPT,
    runUrl: `https://github.com/${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(QUALITY_RUN_ID)}`,
    status: "completed",
    conclusion: "success",
    completedAt: "2026-07-23T19:59:30.000Z",
    updatedAt: options.observedAt,
    launchTransition: {
      job: "verify",
      step: LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP,
      conclusion: "success",
    },
    jobs: {
      verify: "success",
      "browser-quality": "success",
      lighthouse: "success",
    },
  };
}

function productionQualityReceiptReference(
  qualityRun: LaunchGateEvidenceV3ProductionQualityRun,
): string {
  return `${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_DIRECTORY}/quality-run-${String(qualityRun.runId)}-attempt-${String(qualityRun.runAttempt)}.json`;
}

async function seedPolicyScope(
  repositoryRoot: string,
  kind: LaunchGateEvidenceV3Kind,
) {
  const subjectPaths = LAUNCH_GATE_EVIDENCE_V3_POLICY[kind].subjectPaths;
  const directoryPaths = new Set(
    subjectPaths.filter((candidate) =>
      subjectPaths.some((entry) => entry.startsWith(`${candidate}/`)),
    ),
  );
  for (const subjectPath of subjectPaths) {
    const absolutePath = path.join(repositoryRoot, subjectPath);
    if (subjectPath === "components") {
      await mkdir(absolutePath, { recursive: true });
      await writeFile(
        path.join(absolutePath, "scope-fixture.tsx"),
        `governed bytes for ${subjectPath}\n`,
      );
      continue;
    }
    if (directoryPaths.has(subjectPath)) {
      await mkdir(absolutePath, { recursive: true });
      continue;
    }
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

function normalizedJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function materializeProductionEvidence(repositoryRoot: string) {
  await seedPolicyScope(repositoryRoot, "production-release");
  const scopeDigest = await computeLaunchGateEvidenceV3SubjectDigest(
    repositoryRoot,
    "production-release",
  );
  const options = optionsFor(
    "production-release",
    "productionLaunch",
    "approved",
    { repositoryContentSha256: scopeDigest.sha256 },
  );
  const envelope = envelopeFor(options);
  assert.ok(envelope.qualityRun);
  const receiptBytes = normalizedJsonBytes(envelope.qualityRun);
  const receiptPath = path.join(
    repositoryRoot,
    envelope.underlyingEvidence.reference,
  );
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, receiptBytes);
  envelope.underlyingEvidence.sha256 = createHash("sha256")
    .update(receiptBytes)
    .digest("hex");
  envelope.underlyingEvidence.bytes = receiptBytes.length;

  const envelopePath = path.join(repositoryRoot, PRODUCTION_EVIDENCE_REFERENCE);
  await mkdir(path.dirname(envelopePath), { recursive: true });
  const envelopeBytes = normalizedJsonBytes(envelope);
  await writeFile(envelopePath, envelopeBytes);
  return {
    options,
    envelope,
    receiptPath,
    verificationOptions: {
      ...options,
      repositoryRoot,
      reference: PRODUCTION_EVIDENCE_REFERENCE,
      sha256: createHash("sha256").update(envelopeBytes).digest("hex"),
    },
  };
}

describe("launch-gate evidence v3 fixed policy", () => {
  it("requires current subject binding only for an unexpired resolved decision", () => {
    const validUntil = "2026-07-24T00:00:00.000Z";
    const beforeExpiry = Date.parse("2026-07-23T23:59:59.999Z");
    assert.equal(
      requiresCurrentLaunchGateEvidenceV3Binding(
        "approved",
        validUntil,
        beforeExpiry,
      ),
      true,
    );
    assert.equal(
      requiresCurrentLaunchGateEvidenceV3Binding(
        "disabled",
        validUntil,
        beforeExpiry,
      ),
      true,
    );
    assert.equal(
      requiresCurrentLaunchGateEvidenceV3Binding(
        "private",
        validUntil,
        Date.parse(validUntil),
      ),
      false,
    );
    assert.equal(
      requiresCurrentLaunchGateEvidenceV3Binding(
        "revoked",
        null,
        Date.parse("2099-01-01T00:00:00.000Z"),
      ),
      false,
    );
  });

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
      "docs/DEMO_PROMOTION.md",
      "docs/EXECUTIVE_PREVIEW_HANDOFF.md",
      "e2e/site.spec.ts",
      "lib/executive-preview-rate-limit.ts",
      "lib/sitemap-metadata.ts",
      "pages",
      "playwright.config.ts",
      "scripts/build-executive-demo-runtime.mjs",
      "scripts/check-executive-preview-lifecycle.mjs",
      "scripts/check-private-demo-leaks.mjs",
      "scripts/executive-preview-operator-check.ts",
      "scripts/release-smoke.mjs",
      "scripts/verify-private-demo-traces.mjs",
      "tests/executive-preview-operator-check.test.ts",
      "tests/playwright-ci-artifact-policy.test.ts",
      "tests/release-smoke-helpers.test.mjs",
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
      "app/[locale]/layout.tsx",
      "app/globals.css",
      "app/robots.ts",
      "app/sitemap.ts",
      "components",
      "docs/LEGAL_REVIEW.md",
      "e2e/site.spec.ts",
      "i18n",
      "lib/metadata.ts",
      "lib/sitemap-metadata.ts",
      "scripts/release-smoke.mjs",
      "tests/legal-publishing.test.ts",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["legal-review"]
            .subjectPaths as readonly string[]
        ).includes(legalExposureDependency),
        `legal review must bind ${legalExposureDependency}`,
      );
    }
    for (const contactExecutionDependency of [
      "app/[locale]/layout.tsx",
      "app/globals.css",
      "components",
      "content",
      "docs/CONTACT_DELIVERY.md",
      "e2e/site.spec.ts",
      "i18n",
      "lib/contact-route.ts",
      "lib/contact-route-server.ts",
      "lib/legal-copy-readiness.ts",
      "lib/metadata.ts",
      "scripts/release-smoke.mjs",
      "tests/contact-form.test.ts",
      "tests/contact-route.test.ts",
      "tests/contact-schema.test.ts",
      "tests/legal-publishing.test.ts",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["contact-readiness"]
            .subjectPaths as readonly string[]
        ).includes(contactExecutionDependency),
        `contact readiness must bind ${contactExecutionDependency}`,
      );
    }
    for (const productionQualityDependency of [
      ".github/workflows/production-deployment-smoke.yml",
      "e2e",
      "eslint.config.mjs",
      "lighthouserc.cjs",
      "pages",
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
    for (const productionQualityCheck of [
      "qualityRunEventWasPush",
      "launchGateTransitionPassed",
      "verifyJobPassed",
      "browserQualityJobPassed",
      "lighthouseJobPassed",
    ]) {
      assert.ok(
        (
          LAUNCH_GATE_EVIDENCE_V3_POLICY["production-release"]
            .checks as readonly string[]
        ).includes(productionQualityCheck),
        `production release must require ${productionQualityCheck}`,
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
      "docs/LEGACY_CUTOVER.md",
      "docs/LEGACY_CUTOVER_PREFLIGHT.md",
      "docs/ROLLBACK_RUNBOOK.md",
      "docs/evidence/legacy-source-crawl-2026-07-21.csv",
      "docs/evidence/legacy-source-crawl-2026-07-21.json",
      "docs/evidence/legacy-source-crawl-2026-07-21.sha256",
      "scripts/legacy-cutover-preflight-bootstrap.mjs",
      "scripts/legacy-source-custody-lib.mjs",
      "scripts/validate-legacy-source-custody.mjs",
      "tests/apache-legacy-generator.test.ts",
      "tests/legacy-apache.contract.ts",
      "tests/legacy-cutover-preflight.test.ts",
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
      "lib/contact-route.ts",
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

  it("rejects production release evidence without trusted push quality results", () => {
    const options = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
    );
    const envelope = envelopeFor(options);
    envelope.checks.qualityRunEventWasPush = false;
    delete envelope.checks.launchGateTransitionPassed;
    envelope.checks.verifyJobPassed = false;
    delete envelope.checks.browserQualityJobPassed;
    envelope.checks.lighthouseJobPassed = false;

    const errors = validateLaunchGateEvidenceV3Envelope(
      envelope,
      options,
    ).join("\n");
    for (const check of [
      "qualityRunEventWasPush",
      "launchGateTransitionPassed",
      "verifyJobPassed",
      "browserQualityJobPassed",
      "lighthouseJobPassed",
    ]) {
      assert.match(
        errors,
        new RegExp(`checks\\.${check} must be true`, "u"),
      );
    }
  });

  it("requires exact typed GitHub Quality provenance for production release", () => {
    const options = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
    );
    const envelope = envelopeFor(options);
    assert.ok(envelope.qualityRun);
    const qualityRun = envelope.qualityRun as unknown as {
      repository: string;
      workflow: string;
      workflowPath: string;
      event: string;
      ref: string;
      headBranch: string;
      headSha: string;
      runId: number;
      runAttempt: number;
      runUrl: string;
      status: string;
      conclusion: string;
      launchTransition: {
        job: string;
        step: string;
        conclusion: string;
      };
      jobs: Record<string, string>;
    };
    qualityRun.repository = "attacker/helpmath-web-fork";
    qualityRun.workflow = "Fake Quality";
    qualityRun.workflowPath = ".github/workflows/fake-quality.yml";
    qualityRun.event = "workflow_dispatch";
    qualityRun.ref = "refs/heads/release";
    qualityRun.headBranch = "release";
    qualityRun.headSha = "f".repeat(40);
    qualityRun.runId = 0;
    qualityRun.runAttempt = 0;
    qualityRun.runUrl =
      "https://github.com/attacker/helpmath-web-fork/actions/runs/29921608812";
    qualityRun.status = "in_progress";
    qualityRun.conclusion = "failure";
    qualityRun.launchTransition.job = "browser-quality";
    qualityRun.launchTransition.step = "Skipped transition";
    qualityRun.launchTransition.conclusion = "skipped";
    qualityRun.jobs.verify = "failure";
    delete qualityRun.jobs["browser-quality"];
    qualityRun.jobs.lighthouse = "cancelled";

    const errors = validateLaunchGateEvidenceV3Envelope(
      envelope,
      options,
    ).join("\n");
    assert.match(
      errors,
      /qualityRun\.repository must be HUDongpin\/helpmath-web/u,
    );
    assert.match(errors, /qualityRun\.workflow must be Quality/u);
    assert.match(
      errors,
      /qualityRun\.workflowPath must be \.github\/workflows\/quality\.yml/u,
    );
    assert.match(errors, /qualityRun\.event must be push/u);
    assert.match(errors, /qualityRun\.ref must be refs\/heads\/main/u);
    assert.match(errors, /qualityRun\.headBranch must be main/u);
    assert.match(errors, /qualityRun\.headSha must match/u);
    assert.match(errors, /qualityRun\.runId must be a positive safe integer/u);
    assert.match(
      errors,
      /qualityRun\.runAttempt must be a positive safe integer/u,
    );
    assert.match(
      errors,
      /qualityRun\.runUrl must identify runId in HUDongpin\/helpmath-web/u,
    );
    assert.match(errors, /qualityRun\.status must be completed/u);
    assert.match(errors, /qualityRun\.conclusion must be success/u);
    assert.match(errors, /qualityRun\.launchTransition\.job must be verify/u);
    assert.match(
      errors,
      /qualityRun\.launchTransition\.step must be Enforce launch-gate transition history/u,
    );
    assert.match(
      errors,
      /qualityRun\.launchTransition\.conclusion must be success/u,
    );
    assert.match(errors, /qualityRun\.jobs\.verify must be success/u);
    assert.match(
      errors,
      /qualityRun\.jobs\.browser-quality must be success/u,
    );
    assert.match(errors, /qualityRun\.jobs\.lighthouse must be success/u);
  });

  it("fails closed on missing or extensible production Quality provenance", () => {
    const options = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
    );
    const missing = envelopeFor(options);
    delete missing.qualityRun;
    assert.match(
      validateLaunchGateEvidenceV3Envelope(missing, options).join("\n"),
      /qualityRun must be an object for production-release/u,
    );

    const extended = envelopeFor(options);
    assert.ok(extended.qualityRun);
    const qualityRun = extended.qualityRun as unknown as Record<
      string,
      unknown
    >;
    qualityRun.untrustedShortcut = true;
    (
      qualityRun.launchTransition as Record<string, unknown>
    ).untrustedShortcut = true;
    (qualityRun.jobs as Record<string, unknown>).untrustedJob = "success";
    const errors = validateLaunchGateEvidenceV3Envelope(
      extended,
      options,
    ).join("\n");
    assert.match(
      errors,
      /qualityRun contains unknown field untrustedShortcut/u,
    );
    assert.match(
      errors,
      /qualityRun\.launchTransition contains unknown field untrustedShortcut/u,
    );
    assert.match(
      errors,
      /qualityRun\.jobs contains unknown field untrustedJob/u,
    );
  });

  it("prevents an old Quality run from masquerading behind a newer observedAt", () => {
    const options = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
    );
    const envelope = envelopeFor(options);
    assert.ok(envelope.qualityRun);
    envelope.qualityRun.completedAt = "2026-07-20T19:59:30.000Z";
    envelope.qualityRun.updatedAt = "2026-07-20T20:00:00.000Z";

    assert.match(
      validateLaunchGateEvidenceV3Envelope(envelope, options).join("\n"),
      /observedAt must exactly equal qualityRun\.updatedAt/u,
    );

    envelope.observedAt = envelope.qualityRun.updatedAt;
    const staleErrors = validateLaunchGateEvidenceV3Envelope(envelope, {
      ...options,
      observedAt: envelope.observedAt,
    }).join("\n");
    assert.match(
      staleErrors,
      /validity from observedAt exceeds the 86400000ms policy maximum/u,
    );

    const inverted = envelopeFor(options);
    assert.ok(inverted.qualityRun);
    inverted.qualityRun.completedAt = "2026-07-23T20:00:00.001Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(inverted, options).join("\n"),
      /qualityRun\.completedAt must not be later than updatedAt/u,
    );
  });

  it("binds production provenance to its exact receipt and rejects qualityRun elsewhere", () => {
    const productionOptions = optionsFor(
      "production-release",
      "productionLaunch",
      "approved",
    );
    const productionEnvelope = envelopeFor(productionOptions);
    productionEnvelope.underlyingEvidence.system =
      "Generic governance registry";
    productionEnvelope.underlyingEvidence.reference =
      "docs/evidence/github-actions/quality-run-7-attempt-9.json";
    productionEnvelope.underlyingEvidence.sha256 = "0".repeat(64);
    const productionErrors = validateLaunchGateEvidenceV3Envelope(
      productionEnvelope,
      productionOptions,
    ).join("\n");
    assert.match(
      productionErrors,
      /underlyingEvidence\.system must be GitHub Actions Quality provenance receipt/u,
    );
    assert.match(
      productionErrors,
      /underlyingEvidence\.reference must identify the exact Quality run and attempt provenance receipt/u,
    );
    assert.match(
      productionErrors,
      /underlyingEvidence\.sha256 must be a nonzero lowercase SHA-256/u,
    );

    const legalOptions = optionsFor();
    const legalEnvelope = envelopeFor(legalOptions);
    legalEnvelope.qualityRun = productionQualityRunFor(productionOptions);
    assert.match(
      validateLaunchGateEvidenceV3Envelope(
        legalEnvelope,
        legalOptions,
      ).join("\n"),
      /evidence v3 envelope contains unknown field qualityRun/u,
    );
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

  it("enforces observed <= recorded <= approved < validUntil, expiry, and observation-anchored validity", () => {
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
    overTtl.validUntil = "2026-07-24T20:00:00.001Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(overTtl, {
        ...options,
        validUntil: overTtl.validUntil,
      }).join("\n"),
      /validity from observedAt exceeds the 86400000ms policy maximum/u,
    );

    const staleObservation = envelopeFor(options);
    staleObservation.observedAt = "2026-07-20T20:00:00.000Z";
    assert.match(
      validateLaunchGateEvidenceV3Envelope(staleObservation, {
        ...options,
        observedAt: staleObservation.observedAt,
      }).join("\n"),
      /validity from observedAt exceeds the 86400000ms policy maximum/u,
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
  it("verifies the production-release envelope and its exact Quality provenance receipt", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-production-quality-v3-"),
    );
    try {
      const materialized = await materializeProductionEvidence(repositoryRoot);
      assert.deepEqual(
        (
          await verifyLaunchGateEvidenceV3File(
            materialized.verificationOptions,
          )
        ).errors,
        [],
      );
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("rejects raw Quality receipt contradictions even when its updated hash is recorded", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-production-quality-conflict-v3-"),
    );
    try {
      const materialized = await materializeProductionEvidence(repositoryRoot);
      assert.ok(materialized.envelope.qualityRun);
      const contradictoryReceipt = structuredClone(
        materialized.envelope.qualityRun,
      ) as unknown as {
        event: string;
        jobs: Record<string, string>;
      };
      contradictoryReceipt.event = "workflow_dispatch";
      contradictoryReceipt.jobs.verify = "failure";
      const receiptBytes = normalizedJsonBytes(contradictoryReceipt);
      await writeFile(materialized.receiptPath, receiptBytes);
      materialized.envelope.underlyingEvidence.sha256 = createHash("sha256")
        .update(receiptBytes)
        .digest("hex");
      materialized.envelope.underlyingEvidence.bytes = receiptBytes.length;

      const envelopeBytes = normalizedJsonBytes(materialized.envelope);
      await writeFile(
        path.join(repositoryRoot, PRODUCTION_EVIDENCE_REFERENCE),
        envelopeBytes,
      );
      const verification = await verifyLaunchGateEvidenceV3File({
        ...materialized.verificationOptions,
        sha256: createHash("sha256").update(envelopeBytes).digest("hex"),
      });
      assert.match(
        verification.errors.join("\n"),
        /Quality provenance receipt must exactly match envelope qualityRun/u,
      );
      assert.doesNotMatch(
        verification.errors.join("\n"),
        /receipt SHA-256 must match/u,
      );
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("rejects a production Quality receipt whose bytes or SHA-256 are not bound", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-production-quality-hash-v3-"),
    );
    try {
      const materialized = await materializeProductionEvidence(repositoryRoot);
      materialized.envelope.underlyingEvidence.sha256 = "d".repeat(64);
      materialized.envelope.underlyingEvidence.bytes += 1;
      const envelopeBytes = normalizedJsonBytes(materialized.envelope);
      await writeFile(
        path.join(repositoryRoot, PRODUCTION_EVIDENCE_REFERENCE),
        envelopeBytes,
      );
      const verification = await verifyLaunchGateEvidenceV3File({
        ...materialized.verificationOptions,
        sha256: createHash("sha256").update(envelopeBytes).digest("hex"),
      });
      const errors = verification.errors.join("\n");
      assert.match(
        errors,
        /receipt SHA-256 must match underlyingEvidence\.sha256/u,
      );
      assert.match(
        errors,
        /receipt bytes must match underlyingEvidence\.bytes/u,
      );
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("normalizes only the mutable contract status line while binding all substantive contract text", async () => {
    for (const [kind, contractPath, resolvedStatus] of [
      ["legal-review", "docs/LEGAL_REVIEW.md", "Satisfied"],
      ["contact-readiness", "docs/CONTACT_DELIVERY.md", "Disabled"],
    ] as const) {
      const repositoryRoot = await mkdtemp(
        path.join(tmpdir(), `helpmath-gate-status-${kind}-`),
      );
      try {
        await seedPolicyScope(repositoryRoot, kind);
        const absoluteContractPath = path.join(repositoryRoot, contractPath);
        await writeFile(
          absoluteContractPath,
          "# Immutable contract\n\n**Status:** Pending\n\nRequired control remains fixed.\n",
        );
        git(repositoryRoot, ["init", "--quiet"]);
        git(repositoryRoot, ["config", "user.name", "Gate Test"]);
        git(repositoryRoot, [
          "config",
          "user.email",
          "gate-test@example.invalid",
        ]);
        git(repositoryRoot, ["add", "."]);
        git(repositoryRoot, [
          "commit",
          "--quiet",
          "-m",
          "candidate contract status",
        ]);
        const candidateCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);
        const pendingDigest =
          await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
            repositoryRoot,
            kind,
            candidateCommit,
          );

        await writeFile(
          absoluteContractPath,
          `# Immutable contract\n\n**Status:** ${resolvedStatus}\n\nRequired control remains fixed.\n`,
        );
        const resolvedDigest =
          await computeLaunchGateEvidenceV3SubjectDigest(repositoryRoot, kind);
        assert.deepEqual(resolvedDigest, pendingDigest);

        await writeFile(
          absoluteContractPath,
          `# Immutable contract\n\n**Status:** ${resolvedStatus}\n\nRequired control was weakened.\n`,
        );
        const changedContractDigest =
          await computeLaunchGateEvidenceV3SubjectDigest(repositoryRoot, kind);
        assert.notEqual(changedContractDigest.sha256, pendingDigest.sha256);
      } finally {
        await rm(repositoryRoot, { recursive: true, force: true });
      }
    }
  });

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

  it("anchors permanent revocation scope to the candidate commit while allowing later maintenance", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(tmpdir(), "helpmath-gate-revocation-commit-v3-"),
    );
    try {
      await seedPolicyScope(repositoryRoot, "gate-revocation");
      git(repositoryRoot, ["init", "--quiet"]);
      git(repositoryRoot, ["config", "user.name", "Gate Test"]);
      git(repositoryRoot, [
        "config",
        "user.email",
        "gate-test@example.invalid",
      ]);
      git(repositoryRoot, ["add", "."]);
      git(repositoryRoot, [
        "commit",
        "--quiet",
        "-m",
        "seed revocation governed scope",
      ]);
      const repositoryCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);
      const historicalDigest =
        await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
          repositoryRoot,
          "gate-revocation",
          repositoryCommit,
        );

      await writeFile(
        path.join(repositoryRoot, "lib/launch-gate-lifecycle-v3.ts"),
        "safe maintenance after permanent revocation\n",
      );
      const maintainedCurrentDigest =
        await computeLaunchGateEvidenceV3SubjectDigest(
          repositoryRoot,
          "gate-revocation",
        );
      const recomputedHistoricalDigest =
        await computeLaunchGateEvidenceV3SubjectDigestAtCommit(
          repositoryRoot,
          "gate-revocation",
          repositoryCommit,
        );

      assert.notEqual(
        maintainedCurrentDigest.sha256,
        recomputedHistoricalDigest.sha256,
      );
      assert.deepEqual(recomputedHistoricalDigest, historicalDigest);
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

      await writeFile(
        path.join(repositoryRoot, "lib/metadata.ts"),
        "changed legal canonical metadata semantics\n",
      );
      const legalMetadataAfter =
        await computeLaunchGateEvidenceV3SubjectDigest(
          repositoryRoot,
          "legal-review",
        );
      assert.notEqual(legalMetadataAfter.sha256, legalAfter.sha256);

      await seedPolicyScope(repositoryRoot, "contact-readiness");
      const contactBefore = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "contact-readiness",
      );
      await writeFile(
        path.join(repositoryRoot, "lib/metadata.ts"),
        "changed contact canonical metadata semantics\n",
      );
      const contactAfter = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        "contact-readiness",
      );
      assert.notEqual(contactAfter.sha256, contactBefore.sha256);

      await writeFile(
        path.join(repositoryRoot, "components/main-content.tsx"),
        "changed shared page rendering semantics\n",
      );
      const contactSharedUiAfter =
        await computeLaunchGateEvidenceV3SubjectDigest(
          repositoryRoot,
          "contact-readiness",
        );
      assert.notEqual(contactSharedUiAfter.sha256, contactAfter.sha256);

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
