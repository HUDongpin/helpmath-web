import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStableLiveProductionIdentity,
  parseExecutivePreviewJUnit,
  parseLatestGitHubProductionDeployment,
  parseLatestGitHubProductionStatus,
  parseLiveVercelProduction,
  parsePrivateReviewContract,
  runExecutivePreviewOperatorCommand,
  validateExecutivePreviewOperatorInput,
  validateExecutivePreviewSmokeSummary,
  validateRepositoryVerifierProjection,
  type LiveProductionIdentity,
} from "../scripts/executive-preview-operator-check";

const expiry = "2026-07-28T15:59:00.000Z";

function smokeSummary() {
  return {
    baseUrl: "https://www.helpmath.ai",
    canonicalOrigin: "https://www.helpmath.ai",
    launchGateManifestSha256: "a".repeat(64),
    privateDemoRoutes: 4,
    privateDemos: 2,
    publicDemos: 0,
    indexableDemos: 0,
    privateExecutivePreviewAssets: 12,
    executivePreviewRuntimeProbes: 2,
    executivePreviewEntries: 2,
    executivePreviewExpectedState: "login",
    executivePreviewExpectedExpiresAt: expiry,
    executivePreviewState: "login",
    executivePreviewExpiresAt: expiry,
    executivePreviewAuthentication: "validated",
    executivePreviewAuthenticatedDemoRoutes: 4,
    executivePreviewAuthenticatedAssets: 12,
    executivePreviewAuthenticatedRuntimes: 2,
    failures: [],
  };
}

function liveIdentity(): LiveProductionIdentity {
  return {
    repository: "HUDongpin/helpmath-web",
    repositoryCommit: "a".repeat(40),
    vercelDeploymentId: "dpl_Example123",
    vercelBuildId: "bld_Example123",
    githubDeploymentId: 123,
    githubDeploymentStatusId: 456,
    immutableUrl: "https://helpmath-example.vercel.app",
  };
}

function privateReviewActivation() {
  return {
    demos: Object.fromEntries(
      ["conversion-1-2", "conversion-1-4"].map((id, index) => [
        id,
        {
          candidateId: `${id}-candidate`,
          artifactSha256: String(index + 1).repeat(64),
          approvals: {
            privatePreview: { status: "approved" },
            rightsAcceptance: null,
            productAcceptance: null,
          },
          activation: { active: false },
        },
      ]),
    ),
  };
}

describe("executive preview production operator check", () => {
  it("rejects missing, empty, weak, or malformed operator input before any request", () => {
    for (const value of [
      undefined,
      "",
      "short",
      "a".repeat(32),
      `${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p"}!`,
    ]) {
      assert.throws(
        () => validateExecutivePreviewOperatorInput(value),
        /required|does not meet/u,
      );
    }
    assert.equal(
      validateExecutivePreviewOperatorInput(
        "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6",
      ),
      "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6",
    );
  });

  it("does not spawn a credentialed child after the operator signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      runExecutivePreviewOperatorCommand(
        "__helpmath_operator_command_must_not_spawn__",
        [],
        { signal: controller.signal },
      ),
      /was interrupted/u,
    );
  });

  it("requires exact authenticated smoke counts and never accepts not-requested", () => {
    assert.equal(
      validateExecutivePreviewSmokeSummary(smokeSummary(), expiry)
        .executivePreviewAuthentication,
      "validated",
    );

    const skipped = smokeSummary();
    skipped.executivePreviewAuthentication = "not-requested";
    skipped.executivePreviewAuthenticatedDemoRoutes = 0;
    assert.throws(
      () => validateExecutivePreviewSmokeSummary(skipped, expiry),
      /did not prove the private two-demo contract/u,
    );

    const wrongAssets = smokeSummary();
    wrongAssets.executivePreviewAuthenticatedAssets = 11;
    assert.throws(
      () => validateExecutivePreviewSmokeSummary(wrongAssets, expiry),
      /executivePreviewAuthenticatedAssets/u,
    );
  });

  it("requires one passing Chromium case and fails closed on a skipped test", () => {
    const passing =
      '<testsuites tests="1" failures="0" skipped="0" errors="0">' +
      '<testsuite><testcase name="executive preview grants a short-lived private session for both JavaScript demos"/></testsuite>' +
      "</testsuites>";
    assert.deepEqual(parseExecutivePreviewJUnit(passing), {
      tests: 1,
      failures: 0,
      skipped: 0,
      errors: 0,
    });

    const skipped = passing
      .replace('skipped="0"', 'skipped="1"')
      .replace("<testcase ", "<testcase><skipped/></testcase><testcase ");
    assert.throws(
      () => parseExecutivePreviewJUnit(skipped),
      /exactly one non-skipped passing test/u,
    );
  });

  it("derives the current Vercel identity from the fixed Production project and aliases", () => {
    const parsed = parseLiveVercelProduction({
      id: "dpl_Example123",
      name: "helpmath-web",
      url: "helpmath-example.vercel.app",
      target: "production",
      readyState: "READY",
      aliases: ["www.helpmath.ai", "helpmath.ai"],
      builds: [{ id: "bld_Example123", readyState: "READY" }],
    });
    assert.deepEqual(parsed, {
      vercelDeploymentId: "dpl_Example123",
      vercelBuildId: "bld_Example123",
      immutableUrl: "https://helpmath-example.vercel.app",
    });

    assert.throws(
      () =>
        parseLiveVercelProduction({
          id: "dpl_Example123",
          name: "other-project",
          url: "helpmath-example.vercel.app",
          target: "production",
          readyState: "READY",
          aliases: ["www.helpmath.ai", "helpmath.ai"],
          builds: [{ id: "bld_Example123", readyState: "READY" }],
        }),
      /helpmath-web/u,
    );
  });

  it("uses only the latest fixed-repository GitHub deployment and status", () => {
    const deployment = parseLatestGitHubProductionDeployment([
      {
        id: 123,
        sha: "a".repeat(40),
        ref: "a".repeat(40),
        environment: "Production",
        task: "deploy",
        creator: { id: 35613825, login: "vercel[bot]", type: "Bot" },
      },
    ]);
    assert.deepEqual(deployment, {
      repository: "HUDongpin/helpmath-web",
      repositoryCommit: "a".repeat(40),
      githubDeploymentId: 123,
    });
    assert.deepEqual(
      parseLatestGitHubProductionStatus(
        [
          {
            id: 456,
            state: "success",
            environment: "Production",
            environment_url: "https://helpmath-example.vercel.app",
            creator: { id: 35613825, login: "vercel[bot]", type: "Bot" },
          },
        ],
        "https://helpmath-example.vercel.app",
      ),
      { githubDeploymentStatusId: 456 },
    );

    assert.throws(
      () =>
        parseLatestGitHubProductionStatus(
          [
            {
              id: 457,
              state: "failure",
              environment: "Production",
              environment_url: "https://helpmath-example.vercel.app",
              creator: { id: 35613825, login: "vercel[bot]", type: "Bot" },
            },
            {
              id: 456,
              state: "success",
              environment: "Production",
              environment_url: "https://helpmath-example.vercel.app",
              creator: { id: 35613825, login: "vercel[bot]", type: "Bot" },
            },
          ],
          "https://helpmath-example.vercel.app",
        ),
      /exactly the latest/u,
    );

    assert.throws(
      () =>
        parseLatestGitHubProductionDeployment([
          {
            id: 123,
            sha: "a".repeat(40),
            ref: "a".repeat(40),
            environment: "Production",
            task: "deploy",
            creator: { id: 1, login: "other", type: "User" },
          },
        ]),
      /fixed Vercel GitHub bot/u,
    );
  });

  it("fails when the live Production identity changes during playback", () => {
    assert.doesNotThrow(() =>
      assertStableLiveProductionIdentity(liveIdentity(), liveIdentity()),
    );
    const changed = liveIdentity();
    changed.repositoryCommit = "b".repeat(40);
    assert.throws(
      () => assertStableLiveProductionIdentity(liveIdentity(), changed),
      /changed during/u,
    );
  });

  it("requires a clean verifier at the exact current main commit of the fixed repository", () => {
    const valid = validateRepositoryVerifierProjection({
      head: `${"a".repeat(40)}\n`,
      status: "",
      origin: "https://github.com/HUDongpin/helpmath-web.git\n",
      remoteMain: { sha: "a".repeat(40) },
    });
    assert.equal(valid.repositoryCommit, "a".repeat(40));

    assert.throws(
      () =>
        validateRepositoryVerifierProjection({
          head: "b".repeat(40),
          status: "",
          origin: "https://github.com/HUDongpin/helpmath-web.git",
          remoteMain: { sha: "a".repeat(40) },
        }),
      /exact current/u,
    );
    assert.throws(
      () =>
        validateRepositoryVerifierProjection({
          head: "a".repeat(40),
          status: " M scripts/check.ts",
          origin: "https://github.com/HUDongpin/helpmath-web.git",
          remoteMain: { sha: "a".repeat(40) },
        }),
      /clean worktree/u,
    );
    assert.throws(
      () =>
        validateRepositoryVerifierProjection({
          head: "a".repeat(40),
          status: "",
          origin: "https://github.com/attacker/helpmath-web.git",
          remoteMain: { sha: "a".repeat(40) },
        }),
      /fixed private repository/u,
    );
  });

  it("reads exactly two private-only candidate identities from the deployed commit contract", () => {
    const contract = parsePrivateReviewContract(
      JSON.stringify({
        demoIds: ["conversion-1-2", "conversion-1-4"],
        maximumExpiresAt: expiry,
      }),
      JSON.stringify(privateReviewActivation()),
    );
    assert.equal(contract.maximumExpiresAt, expiry);
    assert.deepEqual(
      contract.candidates.map((candidate) => candidate.id),
      ["conversion-1-2", "conversion-1-4"],
    );

    const publicActivation = privateReviewActivation();
    publicActivation.demos["conversion-1-2"].activation.active = true;
    assert.throws(
      () =>
        parsePrivateReviewContract(
          JSON.stringify({
            demoIds: ["conversion-1-2", "conversion-1-4"],
            maximumExpiresAt: expiry,
          }),
          JSON.stringify(publicActivation),
        ),
      /private-only review state/u,
    );
  });
});
