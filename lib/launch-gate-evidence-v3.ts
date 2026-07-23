import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { LAUNCH_GATE_IDS, type LaunchGateId } from "./launch-gate-ids";
import { inspectForSensitiveContent } from "./sensitive-content";

type JsonObject = Record<string, unknown>;

export type LaunchGateEvidenceV3Outcome =
  "approved" | "disabled" | "private" | "revoked";

export const LAUNCH_GATE_EVIDENCE_V3_AUTHORITY_ROLES = {
  legalPublication: "legal-review-authority",
  contactIntake: "contact-release-authority",
  demoPublication: "demo-publication-authority",
  legacyCutover: "legacy-cutover-authority",
  productionLaunch: "production-release-authority",
} as const satisfies Record<LaunchGateId, string>;

const DAY_MS = 24 * 60 * 60 * 1_000;

export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY =
  "HUDongpin/helpmath-web" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW =
  "Quality" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH =
  ".github/workflows/quality.yml" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT = "push" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF =
  "refs/heads/main" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH =
  "main" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP =
  "Enforce launch-gate transition history" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_JOBS = [
  "verify",
  "browser-quality",
  "lighthouse",
] as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_SYSTEM =
  "GitHub Actions Quality provenance receipt" as const;
export const LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_DIRECTORY =
  "docs/evidence/github-actions" as const;

const SHARED_GOVERNANCE_SUBJECT_PATHS = [
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
] as const;

const LEGAL_SUBJECT_PATHS = [
  ...SHARED_GOVERNANCE_SUBJECT_PATHS,
  "app/robots.ts",
  "app/sitemap.ts",
  "app/[locale]/layout.tsx",
  "app/[locale]/privacy/page.tsx",
  "app/[locale]/terms/page.tsx",
  "app/globals.css",
  "components",
  "content",
  "docs/LEGAL_REVIEW.md",
  "e2e/site.spec.ts",
  "i18n",
  "lib/legal-copy-readiness.ts",
  "lib/legal-publishing.ts",
  "lib/metadata.ts",
  "lib/public-paths.ts",
  "lib/sitemap-metadata.ts",
  "next.config.ts",
  "proxy.ts",
  "scripts/release-smoke.mjs",
  "tests/legal-publishing.test.ts",
] as const;

const CONTACT_SUBJECT_PATHS = [
  ...SHARED_GOVERNANCE_SUBJECT_PATHS,
  ".env.example",
  ".vercelignore",
  "app/[locale]/layout.tsx",
  "app/[locale]/contact/page.tsx",
  "app/api/contact/route.ts",
  "app/globals.css",
  "components",
  "content",
  "docs/CONTACT_DELIVERY.md",
  "e2e/site.spec.ts",
  "i18n",
  "lib/contact-route.ts",
  "lib/contact-route-server.ts",
  "lib/contact-schema.ts",
  "lib/legal-copy-readiness.ts",
  "lib/metadata.ts",
  "next.config.ts",
  "proxy.ts",
  "scripts/release-smoke.mjs",
  "scripts/vercel-ignore-build.mjs",
  "tests/contact-form.test.ts",
  "tests/contact-route.test.ts",
  "tests/contact-schema.test.ts",
  "tests/legal-publishing.test.ts",
  "tests/vercel-ignore-boundary.test.ts",
  "tests/vercel-ignored-build.test.ts",
  "vercel.json",
] as const;

const DEMO_SUBJECT_PATHS = [
  ...SHARED_GOVERNANCE_SUBJECT_PATHS,
  ".github/workflows/executive-preview-lifecycle.yml",
  ".vercelignore",
  "app/[locale]/demos",
  "app/api/canonical-entry",
  "app/api/executive-preview",
  "app/globals.css",
  "app/robots.ts",
  "app/sitemap.ts",
  "components/demo-player.tsx",
  "components/animation-player-core.tsx",
  "components/demos-page.tsx",
  "components/demos-pages.tsx",
  "components/executive-demo-runtime-loader.tsx",
  "components/executive-preview-page.tsx",
  "components",
  "config/demo-activations.json",
  "config/executive-preview-window.json",
  "content",
  "demos",
  "docs/DEMO_PROMOTION.md",
  "docs/EXECUTIVE_PREVIEW_HANDOFF.md",
  "e2e/site.spec.ts",
  "lib/demo-lifecycle-validation.ts",
  "lib/demo-lifecycle.ts",
  "lib/executive-preview-access.ts",
  "lib/executive-preview-rate-limit.ts",
  "lib/executive-preview-resources.ts",
  "lib/executive-preview-server.ts",
  "lib/public-paths.ts",
  "lib/sitemap-metadata.ts",
  "next.config.ts",
  "playwright.config.ts",
  "private-demo-assets",
  "private-demo-runtime",
  "proxy.ts",
  "scripts/build-executive-demo-runtime.mjs",
  "scripts/check-executive-preview-lifecycle.mjs",
  "scripts/check-private-demo-leaks.mjs",
  "scripts/check-public-client-boundaries.mjs",
  "scripts/executive-preview-operator-check.ts",
  "scripts/release-smoke-helpers.mjs",
  "scripts/release-smoke.mjs",
  "scripts/vercel-ignore-build.mjs",
  "scripts/verify-private-demo-traces.mjs",
  "tests/demo-boundary.test.ts",
  "tests/demo-lifecycle-content.test.ts",
  "tests/demo-lifecycle.test.ts",
  "tests/executive-preview-access.test.ts",
  "tests/executive-preview-lifecycle-workflow.test.ts",
  "tests/executive-preview-operator-check.test.ts",
  "tests/executive-preview-rate-limit.test.ts",
  "tests/executive-preview-resources.test.ts",
  "tests/executive-preview-route.test.ts",
  "tests/playwright-ci-artifact-policy.test.ts",
  "tests/private-demo-leaks.test.ts",
  "tests/proxy-executive-preview.test.ts",
  "tests/release-smoke-helpers.test.mjs",
  "tests/vercel-ignore-boundary.test.ts",
  "tests/vercel-ignored-build.test.ts",
  "vercel.json",
] as const;

const LEGACY_SUBJECT_PATHS = [
  ...SHARED_GOVERNANCE_SUBJECT_PATHS,
  ".github/workflows/stable-external-links.yml",
  "app/api/canonical-entry",
  "data/legacy-source-registry.json",
  "data/stable-external-links.json",
  "docs/CONTENT_SOURCES.md",
  "docs/LAUNCH_DECISIONS.md",
  "docs/LEGACY_CUTOVER.md",
  "docs/LEGACY_CUTOVER_PREFLIGHT.md",
  "docs/LEGACY_RESOURCE_MAP.md",
  "docs/ROLLBACK_RUNBOOK.md",
  "docs/evidence/legacy-source-crawl-2026-07-21.csv",
  "docs/evidence/legacy-source-crawl-2026-07-21.json",
  "docs/evidence/legacy-source-crawl-2026-07-21.sha256",
  "lib/legacy-cutover-preflight.ts",
  "next.config.ts",
  "ops/legacy-host",
  "proxy.ts",
  "scripts/generate-apache-legacy-redirects.ts",
  "scripts/legacy-cutover-preflight-bootstrap.mjs",
  "scripts/legacy-source-custody-lib.mjs",
  "scripts/legacy-cutover-preflight.ts",
  "scripts/stable-external-links-lib.mjs",
  "scripts/validate-legacy-source-custody.mjs",
  "tests/apache-legacy-generator.test.ts",
  "tests/legacy-apache.contract.ts",
  "tests/legacy-cutover-preflight.test.ts",
  "vercel.json",
] as const;

const PRODUCTION_SUBJECT_PATHS = [
  ...SHARED_GOVERNANCE_SUBJECT_PATHS,
  ".github/workflows/production-deployment-smoke.yml",
  ".env.example",
  ".nvmrc",
  ".vercelignore",
  "app",
  "components",
  "config/demo-activations.json",
  "config/executive-preview-window.json",
  "content",
  "data",
  "demos",
  "e2e",
  "eslint.config.mjs",
  "i18n",
  "lib",
  "next.config.ts",
  "lighthouserc.cjs",
  "ops",
  "postcss.config.mjs",
  "playwright.config.ts",
  "playwright.global-setup.ts",
  "playwright.visual.config.ts",
  "private-demo-assets",
  "private-demo-runtime",
  "proxy.ts",
  "public",
  "scripts",
  "tests",
  "vercel.json",
] as const;

const REVOCATION_SUBJECT_PATHS = Object.freeze([
  ...new Set([
    ...LEGAL_SUBJECT_PATHS,
    ...CONTACT_SUBJECT_PATHS,
    ...DEMO_SUBJECT_PATHS,
    ...LEGACY_SUBJECT_PATHS,
    ...PRODUCTION_SUBJECT_PATHS,
    "app/robots.ts",
    "app/sitemap.ts",
    "scripts/check-public-client-boundaries.mjs",
    "scripts/release-smoke.mjs",
  ]),
]);

export const LAUNCH_GATE_EVIDENCE_V3_POLICY = {
  "legal-review": {
    scopeId: "legal-publication-v1",
    subjectPaths: LEGAL_SUBJECT_PATHS,
    requiresDeployment: false,
    maxTtlMs: 365 * DAY_MS,
    gateIds: ["legalPublication"],
    outcomes: ["approved"],
    checks: [
      "operatingEntityConfirmed",
      "brandAuthorityConfirmed",
      "englishLegalCopyApproved",
      "spanishLegalCopyApproved",
      "dataPracticesApproved",
      "effectiveDateApproved",
    ],
  },
  "contact-readiness": {
    scopeId: "contact-intake-v1",
    subjectPaths: CONTACT_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: 7 * DAY_MS,
    gateIds: ["contactIntake"],
    outcomes: ["approved"],
    checks: [
      "productionConfigurationReviewed",
      "turnstileConfigurationReviewed",
      "edgeRateLimitConfigured",
      "senderDomainVerified",
      "monitoredInboxConfirmed",
      "retentionAndInboxOwnersConfirmed",
      "postActivationTestPlanApproved",
    ],
  },
  "contact-production-verification": {
    scopeId: "contact-intake-v1",
    subjectPaths: CONTACT_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: DAY_MS,
    gateIds: ["legacyCutover", "productionLaunch"],
    outcomes: ["approved"],
    checks: [
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
    ],
  },
  "contact-disabled-disposition": {
    scopeId: "contact-intake-v1",
    subjectPaths: CONTACT_SUBJECT_PATHS,
    requiresDeployment: false,
    maxTtlMs: 365 * DAY_MS,
    gateIds: ["contactIntake"],
    outcomes: ["disabled"],
    checks: [
      "publicIntakeNotAuthorized",
      "alternateSupportChannelConfirmed",
      "privacyImpactReviewed",
      "operationalOwnerConfirmed",
      "reenableRequiresNewDecision",
    ],
  },
  "contact-disabled-verification": {
    scopeId: "contact-intake-v1",
    subjectPaths: CONTACT_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: DAY_MS,
    gateIds: ["legacyCutover", "productionLaunch"],
    outcomes: ["approved"],
    checks: [
      "contactPageUnavailableStateVerified",
      "contactApiFailsClosed",
      "providerConfigurationNotExposed",
      "messageDeliveryNotAttempted",
      "alternateSupportChannelVerified",
      "productionDeploymentVerified",
    ],
  },
  "demo-rights": {
    scopeId: "demo-publication-v1",
    subjectPaths: DEMO_SUBJECT_PATHS,
    requiresDeployment: false,
    maxTtlMs: 365 * DAY_MS,
    gateIds: ["demoPublication"],
    outcomes: ["approved"],
    checks: [
      "originalMaterialsLicensed",
      "javascriptAdaptationLicensed",
      "spanishLocalizationLicensed",
      "derivedImagesLicensed",
      "publicCdnDistributionLicensed",
      "territoryAndTermRecorded",
      "takedownProcessRecorded",
    ],
  },
  "demo-product-acceptance": {
    scopeId: "demo-publication-v1",
    subjectPaths: DEMO_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: 30 * DAY_MS,
    gateIds: ["demoPublication"],
    outcomes: ["approved"],
    checks: [
      "strictMigrationValidationPassed",
      "behaviorValidationPassed",
      "visualValidationPassed",
      "accessibilityValidationPassed",
      "audioDispositionAccepted",
      "knownExceptionsAccepted",
    ],
  },
  "demo-private-disposition": {
    scopeId: "demo-publication-v1",
    subjectPaths: DEMO_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: 30 * DAY_MS,
    gateIds: ["demoPublication"],
    outcomes: ["private"],
    checks: [
      "publicDistributionNotAuthorized",
      "privatePreviewPurposeConfirmed",
      "recipientScopeConfirmed",
      "accessWindowBounded",
      "anonymousRoutesFailClosed",
      "privateAssetsFailClosed",
      "publicActivationRequiresNewDecision",
    ],
  },
  "legacy-cutover-authorization": {
    scopeId: "legacy-cutover-v1",
    subjectPaths: LEGACY_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: DAY_MS,
    gateIds: ["legacyCutover"],
    outcomes: ["approved"],
    checks: [
      "cutoverPlanApproved",
      "dnsOwnerConfirmed",
      "mailOwnerConfirmed",
      "rollbackPlanApproved",
      "searchConsoleOwnerConfirmed",
      "sourcePreservationConfirmed",
    ],
  },
  "post-cutover-verification": {
    scopeId: "legacy-cutover-v1",
    subjectPaths: LEGACY_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: DAY_MS,
    gateIds: ["productionLaunch"],
    outcomes: ["approved"],
    checks: [
      "apexAndWwwVerified",
      "httpHttpsRedirectMatrixPassed",
      "tlsVerified",
      "mailContinuityPassed",
      "searchConsoleChangeVerified",
      "monitoringWindowPassed",
      "rollbackDecisionRecorded",
    ],
  },
  "production-release": {
    scopeId: "production-launch-v1",
    subjectPaths: PRODUCTION_SUBJECT_PATHS,
    requiresDeployment: true,
    maxTtlMs: DAY_MS,
    gateIds: ["productionLaunch"],
    outcomes: ["approved"],
    checks: [
      "candidateIdentityMatched",
      "qualityPassed",
      "qualityRunEventWasPush",
      "launchGateTransitionPassed",
      "verifyJobPassed",
      "browserQualityJobPassed",
      "lighthouseJobPassed",
      "productionSmokePassed",
      "canonicalAliasesVerified",
      "releaseOwnerConfirmed",
      "rollbackOwnerConfirmed",
      "finalLaunchApproved",
    ],
  },
  "gate-revocation": {
    scopeId: "gate-revocation-v1",
    subjectPaths: REVOCATION_SUBJECT_PATHS,
    requiresDeployment: false,
    maxTtlMs: null,
    gateIds: LAUNCH_GATE_IDS,
    outcomes: ["revoked"],
    checks: [
      "revocationAuthorityConfirmed",
      "targetDecisionIdentified",
      "affectedCapabilityDisabled",
      "rollbackOrContainmentRecorded",
      "renewalRequiresNewDecision",
    ],
  },
} as const;

export type LaunchGateEvidenceV3Kind =
  keyof typeof LAUNCH_GATE_EVIDENCE_V3_POLICY;

export const LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS = {
  legalPublication: {
    approved: { default: ["legal-review"] },
    revoked: { default: ["gate-revocation"] },
  },
  contactIntake: {
    approved: { default: ["contact-readiness"] },
    disabled: { default: ["contact-disabled-disposition"] },
    revoked: { default: ["gate-revocation"] },
  },
  demoPublication: {
    approved: { default: ["demo-rights", "demo-product-acceptance"] },
    private: { default: ["demo-private-disposition"] },
    revoked: { default: ["gate-revocation"] },
  },
  legacyCutover: {
    approved: {
      contactEnabled: [
        "contact-production-verification",
        "legacy-cutover-authorization",
      ],
      contactDisabled: [
        "contact-disabled-verification",
        "legacy-cutover-authorization",
      ],
    },
    revoked: { default: ["gate-revocation"] },
  },
  productionLaunch: {
    approved: {
      contactEnabled: [
        "post-cutover-verification",
        "contact-production-verification",
        "production-release",
      ],
      contactDisabled: [
        "post-cutover-verification",
        "contact-disabled-verification",
        "production-release",
      ],
    },
    revoked: { default: ["gate-revocation"] },
  },
} as const;

export type LaunchGateEvidenceV3RequirementPath =
  "default" | "contactEnabled" | "contactDisabled";

export function getLaunchGateEvidenceV3Requirement(
  gateId: LaunchGateId,
  outcome: LaunchGateEvidenceV3Outcome,
  pathId: LaunchGateEvidenceV3RequirementPath = "default",
): readonly LaunchGateEvidenceV3Kind[] | null {
  const gateRequirements = LAUNCH_GATE_EVIDENCE_V3_REQUIREMENTS[
    gateId
  ] as Record<
    string,
    Record<string, readonly LaunchGateEvidenceV3Kind[]> | undefined
  >;
  return gateRequirements[outcome]?.[pathId] ?? null;
}

export type LaunchGateEvidenceV3Decision = {
  approvedBy: {
    name: string;
    authorityRole: string;
    organization: string;
  };
  approvedAt: string;
};

export type LaunchGateEvidenceV3ProductionQualityRun = {
  repository: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY;
  workflow: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW;
  workflowPath: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH;
  event: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT;
  ref: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF;
  headBranch: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH;
  headSha: string;
  runId: number;
  runAttempt: number;
  runUrl: string;
  status: "completed";
  conclusion: "success";
  completedAt: string;
  updatedAt: string;
  launchTransition: {
    job: "verify";
    step: typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP;
    conclusion: "success";
  };
  jobs: Record<
    (typeof LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_JOBS)[number],
    "success"
  >;
};

export type LaunchGateEvidenceV3ValidationOptions = {
  gateId: LaunchGateId;
  kind: LaunchGateEvidenceV3Kind;
  outcome: LaunchGateEvidenceV3Outcome;
  candidateId: string;
  decisionId: string;
  observedAt: string;
  recordedAt: string;
  validUntil: string | null;
  decision: LaunchGateEvidenceV3Decision;
  repositoryCommit: string;
  repositoryContentSha256: string;
  vercelDeploymentId: string | null;
  dependencyDecisionIds: Readonly<Record<string, string>>;
  nowMs?: number;
  requireCurrentlyValid?: boolean;
  requireCurrentSubject?: boolean;
};

export type LaunchGateEvidenceV3FileVerificationOptions =
  LaunchGateEvidenceV3ValidationOptions & {
    repositoryRoot: string;
    reference: string;
    sha256: string;
    maxBytes?: number;
  };

export type LaunchGateEvidenceV3FileVerification = {
  reference: string;
  expectedSha256: string;
  actualSha256: string | null;
  bytes: number | null;
  errors: string[];
};

export type LaunchGateEvidenceV3SubjectDigest = {
  scopeId: string;
  sha256: string;
  files: number;
  bytes: number;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REPOSITORY_COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const VERCEL_DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]{20,}$/u;
const EVIDENCE_REFERENCE_PATTERN =
  /^docs\/evidence\/launch-gates\/[a-z0-9][a-z0-9._-]*\.json$/u;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{6,126}[a-z0-9]$/u;
const PLACEHOLDER_PATTERN =
  /\b(?:pending|tbd|unknown|placeholder|test|testing|fixture|sample|example|dummy|none)\b/iu;
const MUTABLE_CONTRACT_STATUS_PATHS = new Set([
  "docs/CONTACT_DELIVERY.md",
  "docs/LEGAL_REVIEW.md",
]);
const CONTRACT_STATUS_PATTERN =
  /^\*\*Status:\*\* (?:Pending|Satisfied|Disabled)$/gmu;
const NORMALIZED_CONTRACT_STATUS = "**Status:** <lifecycle-status>";
const MAX_PRODUCTION_QUALITY_RECEIPT_BYTES = 1024 * 1024;

function isNonzeroSha256(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SHA256_PATTERN.test(value) &&
    value !== "0".repeat(64)
  );
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function rejectUnknownKeys(
  value: JsonObject,
  allowed: readonly string[],
  field: string,
  errors: string[],
) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key))
      errors.push(`${field} contains unknown field ${key}`);
  }
}

function arraysEqual(
  actual: readonly unknown[],
  expected: readonly unknown[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function substantiveString(
  value: unknown,
  field: string,
  errors: string[],
  maxLength = 200,
): value is string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length < 2 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    PLACEHOLDER_PATTERN.test(value)
  ) {
    errors.push(`${field} must be a substantive non-placeholder string`);
    return false;
  }
  return true;
}

function identifier(
  value: unknown,
  field: string,
  errors: string[],
): value is string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    errors.push(`${field} must be a bounded lowercase identifier`);
    return false;
  }
  return true;
}

function isInside(root: string, candidate: string): boolean {
  return candidate.startsWith(`${root}${path.sep}`);
}

function normalizedSubjectBytes(
  relativePath: string,
  bytes: Buffer,
): Buffer {
  if (!MUTABLE_CONTRACT_STATUS_PATHS.has(relativePath)) return bytes;
  const contents = bytes.toString("utf8");
  const statusLines = [...contents.matchAll(CONTRACT_STATUS_PATTERN)];
  if (statusLines.length !== 1) return bytes;
  return Buffer.from(
    contents.replace(CONTRACT_STATUS_PATTERN, NORMALIZED_CONTRACT_STATUS),
  );
}

function productionQualityReceiptReference(
  runId: unknown,
  runAttempt: unknown,
): string | null {
  if (
    !Number.isSafeInteger(runId) ||
    Number(runId) < 1 ||
    !Number.isSafeInteger(runAttempt) ||
    Number(runAttempt) < 1
  ) {
    return null;
  }
  return `${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_DIRECTORY}/quality-run-${String(runId)}-attempt-${String(runAttempt)}.json`;
}

export function isLaunchGateEvidenceV3Kind(
  value: unknown,
): value is LaunchGateEvidenceV3Kind {
  return (
    typeof value === "string" &&
    Object.hasOwn(LAUNCH_GATE_EVIDENCE_V3_POLICY, value)
  );
}

export function isLaunchGateEvidenceV3Reference(
  value: unknown,
): value is string {
  return typeof value === "string" && EVIDENCE_REFERENCE_PATTERN.test(value);
}

export function requiresCurrentLaunchGateEvidenceV3Binding(
  outcome: LaunchGateEvidenceV3Outcome,
  validUntil: string | null,
  nowMs: number,
): boolean {
  return (
    (outcome === "approved" ||
      outcome === "disabled" ||
      outcome === "private") &&
    typeof validUntil === "string" &&
    Number.isFinite(nowMs) &&
    Number.isFinite(Date.parse(validUntil)) &&
    nowMs < Date.parse(validUntil)
  );
}

export async function computeLaunchGateEvidenceV3SubjectDigest(
  repositoryRootInput: string,
  kind: LaunchGateEvidenceV3Kind,
): Promise<LaunchGateEvidenceV3SubjectDigest> {
  if (!isLaunchGateEvidenceV3Kind(kind)) {
    throw new Error(`unsupported launch-gate evidence v3 kind ${String(kind)}`);
  }
  const policy = LAUNCH_GATE_EVIDENCE_V3_POLICY[kind];
  const repositoryRoot = await realpath(repositoryRootInput);
  const files = new Map<string, string>();

  async function collect(absolutePath: string) {
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error(
        `launch-gate v3 subject path must not be symbolic: ${absolutePath}`,
      );
    }
    if (metadata.isDirectory()) {
      const entries = await readdir(absolutePath);
      entries.sort((left, right) => left.localeCompare(right, "en"));
      for (const entry of entries)
        await collect(path.join(absolutePath, entry));
      return;
    }
    if (!metadata.isFile()) {
      throw new Error(
        `launch-gate v3 subject path must be a regular file: ${absolutePath}`,
      );
    }
    const canonicalPath = await realpath(absolutePath);
    if (!isInside(repositoryRoot, canonicalPath)) {
      throw new Error(
        `launch-gate v3 subject path resolves outside the repository: ${absolutePath}`,
      );
    }
    const relativePath = path
      .relative(repositoryRoot, canonicalPath)
      .split(path.sep)
      .join("/");
    files.set(relativePath, canonicalPath);
  }

  for (const subjectPath of policy.subjectPaths) {
    if (
      subjectPath.startsWith("/") ||
      subjectPath.includes("..") ||
      !/^[A-Za-z0-9_./[\]-]+$/u.test(subjectPath)
    ) {
      throw new Error(`unsafe launch-gate v3 subject path: ${subjectPath}`);
    }
    await collect(path.resolve(repositoryRoot, subjectPath));
  }

  const orderedFiles = [...files.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  );
  if (orderedFiles.length < 1 || orderedFiles.length > 10_000) {
    throw new Error(
      "launch-gate v3 subject file count is outside the supported range",
    );
  }
  const digest = createHash("sha256");
  let totalBytes = 0;
  for (const [relativePath, canonicalPath] of orderedFiles) {
    const bytes = normalizedSubjectBytes(
      relativePath,
      await readFile(canonicalPath),
    );
    totalBytes += bytes.length;
    if (totalBytes > 250 * 1024 * 1024) {
      throw new Error(
        "launch-gate v3 subject bytes exceed the supported maximum",
      );
    }
    digest.update(
      `${Buffer.byteLength(relativePath)}:${relativePath}:${bytes.length}:`,
    );
    digest.update(bytes);
    digest.update("\n");
  }
  return {
    scopeId: policy.scopeId,
    sha256: digest.digest("hex"),
    files: orderedFiles.length,
    bytes: totalBytes,
  };
}

function gitBytes(
  repositoryRoot: string,
  argumentsList: readonly string[],
  maxBuffer = 260 * 1024 * 1024,
): Buffer {
  const result = spawnSync("git", [...argumentsList], {
    cwd: repositoryRoot,
    encoding: null,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || result.error || result.signal) {
    const detail =
      result.error?.message ??
      result.stderr?.toString("utf8").trim() ??
      `status ${String(result.status)}`;
    throw new Error(`git ${argumentsList[0] ?? "command"} failed: ${detail}`);
  }
  return result.stdout ?? Buffer.alloc(0);
}

export async function computeLaunchGateEvidenceV3SubjectDigestAtCommit(
  repositoryRootInput: string,
  kind: LaunchGateEvidenceV3Kind,
  repositoryCommit: string,
): Promise<LaunchGateEvidenceV3SubjectDigest> {
  if (!isLaunchGateEvidenceV3Kind(kind)) {
    throw new Error(`unsupported launch-gate evidence v3 kind ${String(kind)}`);
  }
  if (
    !REPOSITORY_COMMIT_PATTERN.test(repositoryCommit) ||
    /^0+$/u.test(repositoryCommit)
  ) {
    throw new Error(
      "candidate repository commit must be a nonzero full Git SHA",
    );
  }
  const repositoryRoot = await realpath(repositoryRootInput);
  const resolvedCommit = gitBytes(repositoryRoot, [
    "rev-parse",
    "--verify",
    `${repositoryCommit}^{commit}`,
  ])
    .toString("utf8")
    .trim();
  if (resolvedCommit !== repositoryCommit) {
    throw new Error(
      `candidate repository commit resolved to ${resolvedCommit || "no commit"}`,
    );
  }

  const files = new Map<string, string>();
  for (const subjectPath of LAUNCH_GATE_EVIDENCE_V3_POLICY[kind].subjectPaths) {
    const listing = gitBytes(repositoryRoot, [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      repositoryCommit,
      "--",
      `:(literal)${subjectPath}`,
    ]);
    const records = listing.toString("utf8").split("\0").filter(Boolean);
    if (records.length === 0) {
      throw new Error(
        `candidate commit does not contain launch-gate v3 subject path ${subjectPath}`,
      );
    }
    for (const record of records) {
      const separator = record.indexOf("\t");
      if (separator < 0) {
        throw new Error(
          "candidate commit subject tree contains an invalid entry",
        );
      }
      const [mode, type, objectId] = record.slice(0, separator).split(" ");
      const relativePath = record.slice(separator + 1);
      if (
        type !== "blob" ||
        mode === "120000" ||
        !/^[a-f0-9]{40,64}$/u.test(objectId ?? "") ||
        relativePath.length === 0 ||
        /[\u0000-\u001f\u007f]/u.test(relativePath)
      ) {
        throw new Error(
          `candidate commit subject entry is unsupported: ${relativePath || record}`,
        );
      }
      files.set(relativePath, objectId);
    }
  }

  const orderedFiles = [...files.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  );
  if (orderedFiles.length < 1 || orderedFiles.length > 10_000) {
    throw new Error(
      "candidate commit launch-gate v3 subject file count is outside the supported range",
    );
  }
  const digest = createHash("sha256");
  let totalBytes = 0;
  for (const [relativePath, objectId] of orderedFiles) {
    const bytes = normalizedSubjectBytes(
      relativePath,
      gitBytes(repositoryRoot, ["cat-file", "blob", objectId]),
    );
    totalBytes += bytes.length;
    if (totalBytes > 250 * 1024 * 1024) {
      throw new Error(
        "candidate commit launch-gate v3 subject bytes exceed the supported maximum",
      );
    }
    digest.update(
      `${Buffer.byteLength(relativePath)}:${relativePath}:${bytes.length}:`,
    );
    digest.update(bytes);
    digest.update("\n");
  }
  return {
    scopeId: LAUNCH_GATE_EVIDENCE_V3_POLICY[kind].scopeId,
    sha256: digest.digest("hex"),
    files: orderedFiles.length,
    bytes: totalBytes,
  };
}

function validateProductionQualityRun(
  value: unknown,
  envelope: JsonObject,
  options: LaunchGateEvidenceV3ValidationOptions,
  nowMs: number,
  errors: string[],
): void {
  const location = "evidence v3 envelope qualityRun";
  if (!isObject(value)) {
    errors.push(`${location} must be an object for production-release`);
    return;
  }
  rejectUnknownKeys(
    value,
    [
      "repository",
      "workflow",
      "workflowPath",
      "event",
      "ref",
      "headBranch",
      "headSha",
      "runId",
      "runAttempt",
      "runUrl",
      "status",
      "conclusion",
      "completedAt",
      "updatedAt",
      "launchTransition",
      "jobs",
    ],
    location,
    errors,
  );
  if (
    value.repository !==
    LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY
  ) {
    errors.push(
      `${location}.repository must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY}`,
    );
  }
  if (
    value.workflow !== LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW
  ) {
    errors.push(
      `${location}.workflow must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW}`,
    );
  }
  if (
    value.workflowPath !==
    LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH
  ) {
    errors.push(
      `${location}.workflowPath must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_WORKFLOW_PATH}`,
    );
  }
  if (value.event !== LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT) {
    errors.push(
      `${location}.event must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_EVENT}`,
    );
  }
  if (value.ref !== LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF) {
    errors.push(
      `${location}.ref must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REF}`,
    );
  }
  if (
    value.headBranch !== LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH
  ) {
    errors.push(
      `${location}.headBranch must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_BRANCH}`,
    );
  }
  if (value.headSha !== options.repositoryCommit) {
    errors.push(
      `${location}.headSha must match the expected candidate commit`,
    );
  }
  if (!Number.isSafeInteger(value.runId) || Number(value.runId) < 1) {
    errors.push(`${location}.runId must be a positive safe integer`);
  }
  if (
    !Number.isSafeInteger(value.runAttempt) ||
    Number(value.runAttempt) < 1
  ) {
    errors.push(`${location}.runAttempt must be a positive safe integer`);
  }
  const expectedRunUrl =
    Number.isSafeInteger(value.runId) && Number(value.runId) >= 1
      ? `https://github.com/${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY}/actions/runs/${String(value.runId)}`
      : null;
  if (expectedRunUrl === null || value.runUrl !== expectedRunUrl) {
    errors.push(
      `${location}.runUrl must identify runId in ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_REPOSITORY}`,
    );
  }
  if (value.status !== "completed") {
    errors.push(`${location}.status must be completed`);
  }
  if (value.conclusion !== "success") {
    errors.push(`${location}.conclusion must be success`);
  }

  for (const field of ["completedAt", "updatedAt"] as const) {
    if (!isCanonicalUtcTimestamp(value[field])) {
      errors.push(`${location}.${field} must be a canonical UTC timestamp`);
    } else if (Date.parse(value[field]) > nowMs) {
      errors.push(`${location}.${field} must not be in the future`);
    }
  }
  if (
    isCanonicalUtcTimestamp(value.completedAt) &&
    isCanonicalUtcTimestamp(value.updatedAt) &&
    Date.parse(value.completedAt) > Date.parse(value.updatedAt)
  ) {
    errors.push(`${location}.completedAt must not be later than updatedAt`);
  }
  if (envelope.observedAt !== value.updatedAt) {
    errors.push(
      "evidence v3 envelope observedAt must exactly equal qualityRun.updatedAt",
    );
  }

  if (!isObject(value.launchTransition)) {
    errors.push(`${location}.launchTransition must be an object`);
  } else {
    rejectUnknownKeys(
      value.launchTransition,
      ["job", "step", "conclusion"],
      `${location}.launchTransition`,
      errors,
    );
    if (value.launchTransition.job !== "verify") {
      errors.push(`${location}.launchTransition.job must be verify`);
    }
    if (
      value.launchTransition.step !==
      LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP
    ) {
      errors.push(
        `${location}.launchTransition.step must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_TRANSITION_STEP}`,
      );
    }
    if (value.launchTransition.conclusion !== "success") {
      errors.push(
        `${location}.launchTransition.conclusion must be success`,
      );
    }
  }

  if (!isObject(value.jobs)) {
    errors.push(`${location}.jobs must be an object`);
  } else {
    rejectUnknownKeys(
      value.jobs,
      LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_JOBS,
      `${location}.jobs`,
      errors,
    );
    for (const job of LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_JOBS) {
      if (value.jobs[job] !== "success") {
        errors.push(`${location}.jobs.${job} must be success`);
      }
    }
  }

  if (!isObject(envelope.underlyingEvidence)) return;
  if (
    envelope.underlyingEvidence.system !==
    LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_SYSTEM
  ) {
    errors.push(
      `evidence v3 envelope underlyingEvidence.system must be ${LAUNCH_GATE_EVIDENCE_V3_PRODUCTION_QUALITY_RECEIPT_SYSTEM} for production-release`,
    );
  }
  const expectedReceiptReference = productionQualityReceiptReference(
    value.runId,
    value.runAttempt,
  );
  if (
    expectedReceiptReference === null ||
    envelope.underlyingEvidence.reference !== expectedReceiptReference
  ) {
    errors.push(
      "evidence v3 envelope underlyingEvidence.reference must identify the exact Quality run and attempt provenance receipt",
    );
  }
}

export function validateLaunchGateEvidenceV3Envelope(
  value: unknown,
  options: LaunchGateEvidenceV3ValidationOptions,
): string[] {
  const errors: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs)) {
    return ["launch-gate evidence v3 nowMs must be a finite timestamp"];
  }
  const requireCurrentlyValid = options.requireCurrentlyValid ?? true;
  if (!isObject(value)) return ["evidence v3 envelope must be an object"];
  if (!isLaunchGateEvidenceV3Kind(options.kind)) {
    return [`unsupported launch-gate evidence v3 kind ${String(options.kind)}`];
  }
  const policy = LAUNCH_GATE_EVIDENCE_V3_POLICY[options.kind];

  rejectUnknownKeys(
    value,
    [
      "schemaVersion",
      "gateId",
      "evidenceKind",
      "outcome",
      "candidateId",
      "decisionId",
      "observedAt",
      "recordedAt",
      "validUntil",
      "decision",
      "scope",
      "subject",
      "dependencyDecisionIds",
      "underlyingEvidence",
      "checks",
      ...(options.kind === "production-release" ? ["qualityRun"] : []),
    ],
    "evidence v3 envelope",
    errors,
  );
  if (value.schemaVersion !== 2) {
    errors.push("evidence v3 envelope schemaVersion must be 2");
  }
  if (value.gateId !== options.gateId) {
    errors.push(`evidence v3 envelope gateId must be ${options.gateId}`);
  }
  if (!(policy.gateIds as readonly string[]).includes(options.gateId)) {
    errors.push(
      `evidence kind ${options.kind} is not permitted for gate ${options.gateId}`,
    );
  }
  if (value.evidenceKind !== options.kind) {
    errors.push(`evidence v3 envelope evidenceKind must be ${options.kind}`);
  }
  if (value.outcome !== options.outcome) {
    errors.push(`evidence v3 envelope outcome must be ${options.outcome}`);
  }
  if (!(policy.outcomes as readonly string[]).includes(options.outcome)) {
    errors.push(
      `evidence kind ${options.kind} is not permitted for outcome ${options.outcome}`,
    );
  }

  identifier(value.candidateId, "evidence v3 envelope candidateId", errors);
  if (value.candidateId !== options.candidateId) {
    errors.push(
      "evidence v3 envelope candidateId must match the expected candidate",
    );
  }
  identifier(value.decisionId, "evidence v3 envelope decisionId", errors);
  if (value.decisionId !== options.decisionId) {
    errors.push(
      "evidence v3 envelope decisionId must match the expected decision",
    );
  }
  if (options.candidateId === options.decisionId) {
    errors.push("candidateId and decisionId must be distinct");
  }

  const times = {
    observedAt: value.observedAt,
    recordedAt: value.recordedAt,
    approvedAt: isObject(value.decision) ? value.decision.approvedAt : null,
    validUntil: value.validUntil,
  };
  for (const [field, timestamp] of Object.entries({
    observedAt: times.observedAt,
    recordedAt: times.recordedAt,
    approvedAt: times.approvedAt,
  })) {
    if (!isCanonicalUtcTimestamp(timestamp)) {
      errors.push(
        `evidence v3 envelope ${field} must be a canonical UTC timestamp`,
      );
    }
  }
  if (options.kind === "gate-revocation") {
    if (value.validUntil !== null) {
      errors.push(
        "evidence v3 gate-revocation envelope validUntil must be null and permanent",
      );
    }
    if (options.validUntil !== null) {
      errors.push(
        "expected gate-revocation validUntil must be null and permanent",
      );
    }
  } else if (!isCanonicalUtcTimestamp(times.validUntil)) {
    errors.push(
      "evidence v3 envelope validUntil must be a canonical UTC timestamp",
    );
  }
  if (value.observedAt !== options.observedAt) {
    errors.push(
      "evidence v3 envelope observedAt must match the expected evidence",
    );
  }
  if (value.recordedAt !== options.recordedAt) {
    errors.push(
      "evidence v3 envelope recordedAt must match the expected evidence",
    );
  }
  if (value.validUntil !== options.validUntil) {
    errors.push(
      "evidence v3 envelope validUntil must match the expected evidence",
    );
  }

  if (
    isCanonicalUtcTimestamp(times.observedAt) &&
    isCanonicalUtcTimestamp(times.recordedAt) &&
    isCanonicalUtcTimestamp(times.approvedAt)
  ) {
    const observedAtMs = Date.parse(times.observedAt);
    const recordedAtMs = Date.parse(times.recordedAt);
    const approvedAtMs = Date.parse(times.approvedAt);
    if (observedAtMs > recordedAtMs) {
      errors.push(
        "evidence v3 envelope observedAt must not be later than recordedAt",
      );
    }
    if (recordedAtMs > approvedAtMs) {
      errors.push(
        "evidence v3 envelope recordedAt must not be later than decision.approvedAt",
      );
    }
    if (approvedAtMs > nowMs) {
      errors.push(
        "evidence v3 envelope decision.approvedAt must not be in the future",
      );
    }
    if (
      options.kind !== "gate-revocation" &&
      isCanonicalUtcTimestamp(times.validUntil)
    ) {
      const validUntilMs = Date.parse(times.validUntil);
      if (approvedAtMs >= validUntilMs) {
        errors.push(
          "evidence v3 envelope decision.approvedAt must be earlier than validUntil",
        );
      }
      if (requireCurrentlyValid && nowMs >= validUntilMs) {
        errors.push("evidence v3 envelope is expired");
      }
      if (
        policy.maxTtlMs !== null &&
        validUntilMs - observedAtMs > policy.maxTtlMs
      ) {
        errors.push(
          `evidence v3 envelope validity from observedAt exceeds the ${policy.maxTtlMs}ms policy maximum`,
        );
      }
    }
  }

  if (!isObject(value.decision)) {
    errors.push("evidence v3 envelope decision must be an object");
  } else {
    rejectUnknownKeys(
      value.decision,
      ["approvedBy", "approvedAt"],
      "evidence v3 envelope decision",
      errors,
    );
    if (!isObject(value.decision.approvedBy)) {
      errors.push("evidence v3 envelope decision.approvedBy must be an object");
    } else {
      rejectUnknownKeys(
        value.decision.approvedBy,
        ["name", "authorityRole", "organization"],
        "evidence v3 envelope decision.approvedBy",
        errors,
      );
      substantiveString(
        value.decision.approvedBy.name,
        "evidence v3 envelope decision.approvedBy.name",
        errors,
      );
      substantiveString(
        value.decision.approvedBy.organization,
        "evidence v3 envelope decision.approvedBy.organization",
        errors,
      );
      if (
        value.decision.approvedBy.authorityRole !==
        LAUNCH_GATE_EVIDENCE_V3_AUTHORITY_ROLES[options.gateId]
      ) {
        errors.push(
          `evidence v3 envelope decision.approvedBy.authorityRole must be ${LAUNCH_GATE_EVIDENCE_V3_AUTHORITY_ROLES[options.gateId]}`,
        );
      }
      for (const field of ["name", "authorityRole", "organization"] as const) {
        if (
          value.decision.approvedBy[field] !==
          options.decision.approvedBy[field]
        ) {
          errors.push(
            `evidence v3 envelope decision.approvedBy.${field} must match the expected decision`,
          );
        }
      }
    }
    if (value.decision.approvedAt !== options.decision.approvedAt) {
      errors.push(
        "evidence v3 envelope decision.approvedAt must match the expected decision",
      );
    }
  }

  if (!isObject(value.scope)) {
    errors.push("evidence v3 envelope scope must be an object");
  } else {
    rejectUnknownKeys(
      value.scope,
      ["scopeId", "subjectPaths", "repositoryContentSha256"],
      "evidence v3 envelope scope",
      errors,
    );
    if (value.scope.scopeId !== policy.scopeId) {
      errors.push(
        `evidence v3 envelope scope.scopeId must be ${policy.scopeId}`,
      );
    }
    if (
      !Array.isArray(value.scope.subjectPaths) ||
      !arraysEqual(value.scope.subjectPaths, policy.subjectPaths)
    ) {
      errors.push(
        "evidence v3 envelope scope.subjectPaths must exactly match the fixed evidence-kind policy",
      );
    }
    if (!isNonzeroSha256(value.scope.repositoryContentSha256)) {
      errors.push(
        "evidence v3 envelope scope.repositoryContentSha256 must be a nonzero lowercase SHA-256",
      );
    }
    if (
      value.scope.repositoryContentSha256 !== options.repositoryContentSha256
    ) {
      errors.push(
        "evidence v3 envelope scope.repositoryContentSha256 must match the expected subject digest",
      );
    }
  }
  if (!isNonzeroSha256(options.repositoryContentSha256)) {
    errors.push(
      "expected repositoryContentSha256 must be a nonzero lowercase SHA-256",
    );
  }

  if (!isObject(value.subject)) {
    errors.push("evidence v3 envelope subject must be an object");
  } else {
    rejectUnknownKeys(
      value.subject,
      ["repositoryCommit", "vercelDeploymentId"],
      "evidence v3 envelope subject",
      errors,
    );
    if (
      typeof value.subject.repositoryCommit !== "string" ||
      !REPOSITORY_COMMIT_PATTERN.test(value.subject.repositoryCommit) ||
      value.subject.repositoryCommit === "0".repeat(40)
    ) {
      errors.push(
        "evidence v3 envelope subject.repositoryCommit must be a nonzero lowercase 40-character Git SHA",
      );
    }
    if (value.subject.repositoryCommit !== options.repositoryCommit) {
      errors.push(
        "evidence v3 envelope subject.repositoryCommit must match the expected candidate commit",
      );
    }
    const deploymentId = value.subject.vercelDeploymentId;
    if (policy.requiresDeployment) {
      if (
        typeof deploymentId !== "string" ||
        !VERCEL_DEPLOYMENT_PATTERN.test(deploymentId)
      ) {
        errors.push(
          "evidence v3 envelope subject.vercelDeploymentId must identify a Vercel deployment",
        );
      }
      if (
        typeof options.vercelDeploymentId !== "string" ||
        !VERCEL_DEPLOYMENT_PATTERN.test(options.vercelDeploymentId)
      ) {
        errors.push(
          "expected vercelDeploymentId must identify a Vercel deployment for this evidence kind",
        );
      }
    } else {
      if (deploymentId !== null) {
        errors.push(
          "evidence v3 envelope subject.vercelDeploymentId must be null for this evidence kind",
        );
      }
      if (options.vercelDeploymentId !== null) {
        errors.push(
          "expected vercelDeploymentId must be null for this evidence kind",
        );
      }
    }
    if (deploymentId !== options.vercelDeploymentId) {
      errors.push(
        "evidence v3 envelope subject.vercelDeploymentId must match the expected deployment",
      );
    }
  }
  if (
    !REPOSITORY_COMMIT_PATTERN.test(options.repositoryCommit) ||
    options.repositoryCommit === "0".repeat(40)
  ) {
    errors.push(
      "expected repositoryCommit must be a nonzero lowercase Git SHA",
    );
  }

  if (!isObject(value.dependencyDecisionIds)) {
    errors.push("evidence v3 envelope dependencyDecisionIds must be an object");
  } else {
    const expectedKeys = Object.keys(options.dependencyDecisionIds);
    const actualKeys = Object.keys(value.dependencyDecisionIds);
    if (!arraysEqual(actualKeys, expectedKeys)) {
      errors.push(
        "evidence v3 envelope dependencyDecisionIds keys must exactly match the expected dependency decisions",
      );
    }
    for (const [dependencyGateId, expectedDecisionId] of Object.entries(
      options.dependencyDecisionIds,
    )) {
      if (!(LAUNCH_GATE_IDS as readonly string[]).includes(dependencyGateId)) {
        errors.push(
          `expected dependencyDecisionIds contains unknown gate ${dependencyGateId}`,
        );
      }
      if (dependencyGateId === options.gateId) {
        errors.push("dependencyDecisionIds must not contain the current gate");
      }
      identifier(
        expectedDecisionId,
        `expected dependencyDecisionIds.${dependencyGateId}`,
        errors,
      );
      if (
        value.dependencyDecisionIds[dependencyGateId] !== expectedDecisionId
      ) {
        errors.push(
          `evidence v3 envelope dependencyDecisionIds.${dependencyGateId} must match the expected dependency decision`,
        );
      }
    }
    for (const [dependencyGateId, actualDecisionId] of Object.entries(
      value.dependencyDecisionIds,
    )) {
      identifier(
        actualDecisionId,
        `evidence v3 envelope dependencyDecisionIds.${dependencyGateId}`,
        errors,
      );
    }
  }

  if (!isObject(value.underlyingEvidence)) {
    errors.push("evidence v3 envelope underlyingEvidence must be an object");
  } else {
    rejectUnknownKeys(
      value.underlyingEvidence,
      ["system", "reference", "sha256", "bytes"],
      "evidence v3 envelope underlyingEvidence",
      errors,
    );
    substantiveString(
      value.underlyingEvidence.system,
      "evidence v3 envelope underlyingEvidence.system",
      errors,
      100,
    );
    substantiveString(
      value.underlyingEvidence.reference,
      "evidence v3 envelope underlyingEvidence.reference",
      errors,
      500,
    );
    if (!isNonzeroSha256(value.underlyingEvidence.sha256)) {
      errors.push(
        "evidence v3 envelope underlyingEvidence.sha256 must be a nonzero lowercase SHA-256",
      );
    }
    if (
      !Number.isSafeInteger(value.underlyingEvidence.bytes) ||
      (value.underlyingEvidence.bytes as number) < 1
    ) {
      errors.push(
        "evidence v3 envelope underlyingEvidence.bytes must be a positive safe integer",
      );
    }
  }

  if (!isObject(value.checks)) {
    errors.push("evidence v3 envelope checks must be an object");
  } else {
    rejectUnknownKeys(
      value.checks,
      policy.checks,
      "evidence v3 envelope checks",
      errors,
    );
    for (const check of policy.checks) {
      if (value.checks[check] !== true) {
        errors.push(`evidence v3 envelope checks.${check} must be true`);
      }
    }
  }

  if (options.kind === "production-release") {
    validateProductionQualityRun(
      value.qualityRun,
      value,
      options,
      nowMs,
      errors,
    );
  }

  inspectForSensitiveContent(value, "evidence v3 envelope", errors);
  return [...new Set(errors)];
}

async function verifyProductionQualityReceipt(
  repositoryRoot: string,
  envelope: JsonObject,
  errors: string[],
): Promise<void> {
  if (
    !isObject(envelope.qualityRun) ||
    !isObject(envelope.underlyingEvidence)
  ) {
    return;
  }
  const receiptReference = productionQualityReceiptReference(
    envelope.qualityRun.runId,
    envelope.qualityRun.runAttempt,
  );
  if (
    receiptReference === null ||
    envelope.underlyingEvidence.reference !== receiptReference
  ) {
    return;
  }

  const receiptPath = path.resolve(repositoryRoot, receiptReference);
  if (!isInside(repositoryRoot, receiptPath)) {
    errors.push(
      `production-release Quality provenance receipt escapes the repository: ${receiptReference}`,
    );
    return;
  }
  let metadata;
  try {
    metadata = await lstat(receiptPath);
  } catch {
    errors.push(
      `production-release Quality provenance receipt does not exist: ${receiptReference}`,
    );
    return;
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    errors.push(
      `production-release Quality provenance receipt must be a regular non-symbolic file: ${receiptReference}`,
    );
    return;
  }
  if (
    metadata.size < 1 ||
    metadata.size > MAX_PRODUCTION_QUALITY_RECEIPT_BYTES
  ) {
    errors.push(
      `production-release Quality provenance receipt size must be between 1 and ${MAX_PRODUCTION_QUALITY_RECEIPT_BYTES} bytes: ${receiptReference}`,
    );
    return;
  }
  if (
    !Number.isSafeInteger(envelope.underlyingEvidence.bytes) ||
    Number(envelope.underlyingEvidence.bytes) !== metadata.size
  ) {
    errors.push(
      "production-release Quality provenance receipt bytes must match underlyingEvidence.bytes",
    );
  }

  const canonicalPath = await realpath(receiptPath);
  if (
    !isInside(repositoryRoot, canonicalPath) ||
    canonicalPath !== receiptPath
  ) {
    errors.push(
      `production-release Quality provenance receipt resolves through an unsafe path: ${receiptReference}`,
    );
    return;
  }
  const bytes = await readFile(canonicalPath);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== envelope.underlyingEvidence.sha256) {
    errors.push(
      "production-release Quality provenance receipt SHA-256 must match underlyingEvidence.sha256",
    );
  }

  let receipt: unknown;
  try {
    receipt = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    errors.push(
      `production-release Quality provenance receipt is not valid JSON: ${receiptReference}`,
    );
    return;
  }
  let normalizedBytes: Buffer;
  try {
    normalizedBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch {
    errors.push(
      `production-release Quality provenance receipt nesting exceeds the supported maximum: ${receiptReference}`,
    );
    return;
  }
  if (!bytes.equals(normalizedBytes)) {
    errors.push(
      `production-release Quality provenance receipt must use normalized two-space JSON: ${receiptReference}`,
    );
  }
  if (!isDeepStrictEqual(receipt, envelope.qualityRun)) {
    errors.push(
      "production-release Quality provenance receipt must exactly match envelope qualityRun",
    );
  }
  inspectForSensitiveContent(
    receipt,
    "production-release Quality provenance receipt",
    errors,
  );
}

export async function verifyLaunchGateEvidenceV3File(
  options: LaunchGateEvidenceV3FileVerificationOptions,
): Promise<LaunchGateEvidenceV3FileVerification> {
  const errors: string[] = [];
  const result: LaunchGateEvidenceV3FileVerification = {
    reference: options.reference,
    expectedSha256: options.sha256,
    actualSha256: null,
    bytes: null,
    errors,
  };
  if (!isLaunchGateEvidenceV3Reference(options.reference)) {
    errors.push(
      `unsupported launch-gate evidence v3 reference ${options.reference}`,
    );
    return result;
  }
  if (!isNonzeroSha256(options.sha256)) {
    errors.push(
      "expected evidence v3 SHA-256 must be nonzero lowercase hexadecimal",
    );
  }

  const repositoryRoot = await realpath(options.repositoryRoot);
  const resolved = path.resolve(repositoryRoot, options.reference);
  if (!isInside(repositoryRoot, resolved)) {
    errors.push(
      `launch-gate evidence v3 reference escapes the repository: ${options.reference}`,
    );
    return result;
  }

  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch {
    errors.push(
      `launch-gate evidence v3 file does not exist: ${options.reference}`,
    );
    return result;
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    errors.push(
      `launch-gate evidence v3 must be a regular non-symbolic file: ${options.reference}`,
    );
    return result;
  }
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    errors.push(
      `launch-gate evidence v3 maxBytes must be a positive safe integer: ${options.reference}`,
    );
    return result;
  }
  if (metadata.size < 1 || metadata.size > maxBytes) {
    errors.push(
      `launch-gate evidence v3 size must be between 1 and ${maxBytes} bytes: ${options.reference}`,
    );
    return result;
  }

  const canonicalPath = await realpath(resolved);
  if (!isInside(repositoryRoot, canonicalPath)) {
    errors.push(
      `launch-gate evidence v3 resolves outside the repository: ${options.reference}`,
    );
    return result;
  }
  const bytes = await readFile(canonicalPath);
  result.bytes = bytes.length;
  result.actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (result.actualSha256 !== options.sha256) {
    errors.push(
      `launch-gate evidence v3 SHA-256 mismatch: ${options.reference}`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    errors.push(
      `launch-gate evidence v3 is not valid JSON: ${options.reference}`,
    );
    return result;
  }
  let normalizedBytes: string;
  try {
    normalizedBytes = `${JSON.stringify(value, null, 2)}\n`;
  } catch {
    errors.push(
      `launch-gate evidence v3 JSON nesting exceeds the supported maximum: ${options.reference}`,
    );
    return result;
  }
  if (!bytes.equals(Buffer.from(normalizedBytes))) {
    errors.push(
      `launch-gate evidence v3 must use normalized two-space JSON: ${options.reference}`,
    );
  }
  errors.push(...validateLaunchGateEvidenceV3Envelope(value, options));
  if (
    options.kind === "production-release" &&
    isObject(value)
  ) {
    await verifyProductionQualityReceipt(repositoryRoot, value, errors);
  }

  if (options.requireCurrentSubject ?? true) {
    try {
      const currentDigest = await computeLaunchGateEvidenceV3SubjectDigest(
        repositoryRoot,
        options.kind,
      );
      if (
        currentDigest.scopeId !==
        LAUNCH_GATE_EVIDENCE_V3_POLICY[options.kind].scopeId
      ) {
        errors.push(
          `launch-gate evidence v3 scope ID does not match policy: ${options.reference}`,
        );
      }
      if (currentDigest.sha256 !== options.repositoryContentSha256) {
        errors.push(
          `launch-gate evidence v3 subject digest does not match the current policy scope: ${options.reference}`,
        );
      }
    } catch (error) {
      errors.push(
        `launch-gate evidence v3 subject digest could not be computed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  result.errors = [...new Set(errors)];
  return result;
}
