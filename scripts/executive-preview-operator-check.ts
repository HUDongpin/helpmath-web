import { spawn } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectForSensitiveContent } from "../lib/sensitive-content";

type JsonObject = Record<string, unknown>;

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CANONICAL_ORIGIN = "https://www.helpmath.ai";
const EXPECTED_REPOSITORY = "HUDongpin/helpmath-web";
const EXPECTED_VERCEL_PROJECT = "helpmath-web";
const EXPECTED_VERCEL_SCOPE = "peter-dongpin-hu-s-projects";
const EXPECTED_VERCEL_CLI_VERSION = "56.5.0";
const EXPECTED_VERCEL_GITHUB_ACTOR = {
  id: 35613825,
  login: "vercel[bot]",
  type: "Bot",
} as const;
const EXPECTED_DEMO_IDS = ["conversion-1-2", "conversion-1-4"] as const;
const EXECUTIVE_TEST_TITLE =
  "executive preview grants a short-lived private session for both JavaScript demos";
const COMMAND_OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;
const NETWORK_COMMAND_TIMEOUT_MS = 2 * 60 * 1_000;
const SMOKE_COMMAND_TIMEOUT_MS = 5 * 60 * 1_000;
const BROWSER_COMMAND_TIMEOUT_MS = 10 * 60 * 1_000;
const CHILD_TERMINATION_GRACE_MS = 5_000;
const HANDLED_SIGNALS = ["SIGHUP", "SIGINT", "SIGTERM"] as const;

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type LiveProductionIdentity = {
  repository: typeof EXPECTED_REPOSITORY;
  repositoryCommit: string;
  vercelDeploymentId: string;
  vercelBuildId: string;
  githubDeploymentId: number;
  githubDeploymentStatusId: number;
  immutableUrl: string;
};

type VercelProductionIdentity = Pick<
  LiveProductionIdentity,
  "vercelDeploymentId" | "vercelBuildId" | "immutableUrl"
>;

type GitHubProductionIdentity = Pick<
  LiveProductionIdentity,
  | "repository"
  | "repositoryCommit"
  | "githubDeploymentId"
  | "githubDeploymentStatusId"
>;

type BrowserCounts = {
  tests: number;
  failures: number;
  skipped: number;
  errors: number;
};

type VerifierIdentity = {
  repositoryCommit: string;
  remoteMainCommit: string;
};

type ReviewContract = {
  maximumExpiresAt: string;
  candidates: Array<{
    id: (typeof EXPECTED_DEMO_IDS)[number];
    candidateId: string;
    artifactSha256: string;
  }>;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  value: unknown,
  field: string,
  pattern?: RegExp,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) {
    throw new Error(`${field} has an invalid format`);
  }
  return value;
}

function numberField(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value as number;
}

function objectField(value: unknown, field: string): JsonObject {
  if (!isObject(value)) throw new Error(`${field} must be an object`);
  return value;
}

function requireVercelGitHubActor(value: unknown, field: string): void {
  const actor = objectField(value, field);
  if (
    actor.id !== EXPECTED_VERCEL_GITHUB_ACTOR.id ||
    actor.login !== EXPECTED_VERCEL_GITHUB_ACTOR.login ||
    actor.type !== EXPECTED_VERCEL_GITHUB_ACTOR.type
  ) {
    throw new Error(`${field} must be the fixed Vercel GitHub bot identity`);
  }
}

function commandError(message: string, cause?: unknown): Error {
  return cause === undefined
    ? new Error(message)
    : new Error(message, { cause });
}

export function validateExecutivePreviewOperatorInput(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY is required; an empty value cannot be treated as a successful smoke",
    );
  }
  if (
    value.length < 32 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9_-]+$/u.test(value) ||
    new Set(value).size < 12
  ) {
    throw new Error(
      "SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY does not meet the deployed 32-128 character base64url contract",
    );
  }
  return value;
}

export function parseExecutivePreviewJUnit(xml: string): BrowserCounts {
  const root = xml.match(/<(?:testsuites|testsuite)\b[^>]*>/u)?.[0];
  if (!root) throw new Error("Playwright JUnit output has no test-suite root");

  const readCount = (name: string) => {
    const raw = root.match(new RegExp(`\\b${name}="(\\d+)"`, "u"))?.[1];
    if (raw === undefined) {
      if (name === "errors") return 0;
      throw new Error(`Playwright JUnit output is missing ${name}`);
    }
    return Number(raw);
  };
  const counts = {
    tests: readCount("tests"),
    failures: readCount("failures"),
    skipped: readCount("skipped"),
    errors: readCount("errors"),
  };
  const testCases = [
    ...xml.matchAll(/<testcase\b[^>]*\bname="([^"]+)"[^>]*>/gu),
  ].map((match) => match[1]);

  if (
    counts.tests !== 1 ||
    counts.failures !== 0 ||
    counts.skipped !== 0 ||
    counts.errors !== 0 ||
    testCases.length !== 1 ||
    testCases[0] !== EXECUTIVE_TEST_TITLE
  ) {
    throw new Error(
      `credentialed browser check must run exactly one non-skipped passing test; observed ` +
        `${counts.tests} tests, ${counts.failures} failures, ${counts.skipped} skipped, ` +
        `${counts.errors} errors`,
    );
  }
  return counts;
}

export function validateExecutivePreviewSmokeSummary(
  value: unknown,
  maximumExpiresAt: string,
): JsonObject {
  const summary = objectField(value, "release smoke summary");
  const expected: Array<[string, unknown]> = [
    ["baseUrl", CANONICAL_ORIGIN],
    ["canonicalOrigin", CANONICAL_ORIGIN],
    ["privateDemoRoutes", 4],
    ["privateDemos", 2],
    ["publicDemos", 0],
    ["indexableDemos", 0],
    ["privateExecutivePreviewAssets", 12],
    ["executivePreviewRuntimeProbes", 2],
    ["executivePreviewEntries", 2],
    ["executivePreviewExpectedState", "login"],
    ["executivePreviewExpectedExpiresAt", maximumExpiresAt],
    ["executivePreviewState", "login"],
    ["executivePreviewExpiresAt", maximumExpiresAt],
    ["executivePreviewAuthentication", "validated"],
    ["executivePreviewAuthenticatedDemoRoutes", 4],
    ["executivePreviewAuthenticatedAssets", 12],
    ["executivePreviewAuthenticatedRuntimes", 2],
  ];
  const errors: string[] = [];
  for (const [field, expectedValue] of expected) {
    if (summary[field] !== expectedValue) {
      errors.push(
        `${field}=${JSON.stringify(summary[field])}, expected ${JSON.stringify(expectedValue)}`,
      );
    }
  }
  if (!Array.isArray(summary.failures) || summary.failures.length !== 0) {
    errors.push("failures must be an empty array");
  }
  if (errors.length > 0) {
    throw new Error(
      `release smoke did not prove the private two-demo contract: ${errors.join("; ")}`,
    );
  }
  return summary;
}

export function parseLiveVercelProduction(
  value: unknown,
): VercelProductionIdentity {
  const deployment = objectField(value, "live Vercel deployment");
  if (
    deployment.name !== EXPECTED_VERCEL_PROJECT ||
    deployment.target !== "production" ||
    deployment.readyState !== "READY"
  ) {
    throw new Error(
      `canonical alias must resolve to READY Production project ${EXPECTED_VERCEL_PROJECT}`,
    );
  }
  const vercelDeploymentId = stringField(
    deployment.id,
    "live Vercel deployment.id",
    /^dpl_[A-Za-z0-9]+$/u,
  );
  const hostname = stringField(
    deployment.url,
    "live Vercel deployment.url",
    /^[A-Za-z0-9.-]+\.vercel\.app$/u,
  );
  if (
    !Array.isArray(deployment.aliases) ||
    !deployment.aliases.includes("www.helpmath.ai") ||
    !deployment.aliases.includes("helpmath.ai")
  ) {
    throw new Error(
      "live Vercel deployment must own both canonical helpmath.ai aliases",
    );
  }
  if (!Array.isArray(deployment.builds)) {
    throw new Error("live Vercel deployment builds must be an array");
  }
  const readyBuilds = deployment.builds.filter(
    (build) => isObject(build) && build.readyState === "READY",
  );
  if (readyBuilds.length !== 1) {
    throw new Error(
      "live Vercel deployment must expose exactly one READY build identity",
    );
  }
  const vercelBuildId = stringField(
    readyBuilds[0].id,
    "live Vercel deployment build.id",
    /^bld_[A-Za-z0-9]+$/u,
  );
  return {
    vercelDeploymentId,
    vercelBuildId,
    immutableUrl: `https://${hostname}`,
  };
}

export function parseLatestGitHubProductionDeployment(
  value: unknown,
): Omit<GitHubProductionIdentity, "githubDeploymentStatusId"> {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error(
      "GitHub must return exactly the latest Production deployment",
    );
  }
  const deployment = objectField(
    value[0],
    "latest GitHub Production deployment",
  );
  const repositoryCommit = stringField(
    deployment.sha,
    "latest GitHub Production deployment.sha",
    /^[0-9a-f]{40}$/u,
  );
  if (
    deployment.ref !== repositoryCommit ||
    deployment.environment !== "Production" ||
    deployment.task !== "deploy"
  ) {
    throw new Error(
      "latest GitHub Production deployment must be bound to one immutable commit",
    );
  }
  requireVercelGitHubActor(
    deployment.creator,
    "latest GitHub Production deployment.creator",
  );
  return {
    repository: EXPECTED_REPOSITORY,
    repositoryCommit,
    githubDeploymentId: numberField(
      deployment.id,
      "latest GitHub Production deployment.id",
    ),
  };
}

export function parseLatestGitHubProductionStatus(
  value: unknown,
  immutableUrl: string,
): Pick<GitHubProductionIdentity, "githubDeploymentStatusId"> {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error(
      "GitHub must return exactly the latest Production deployment status",
    );
  }
  const status = objectField(
    value[0],
    "latest GitHub Production deployment status",
  );
  if (
    status.state !== "success" ||
    status.environment !== "Production" ||
    status.environment_url !== immutableUrl
  ) {
    throw new Error(
      "latest GitHub Production deployment status must be successful and point to the live Vercel deployment",
    );
  }
  requireVercelGitHubActor(
    status.creator,
    "latest GitHub Production deployment status.creator",
  );
  return {
    githubDeploymentStatusId: numberField(
      status.id,
      "latest GitHub Production deployment status.id",
    ),
  };
}

export function assertStableLiveProductionIdentity(
  before: LiveProductionIdentity,
  after: LiveProductionIdentity,
): void {
  for (const field of [
    "repository",
    "repositoryCommit",
    "vercelDeploymentId",
    "vercelBuildId",
    "githubDeploymentId",
    "githubDeploymentStatusId",
    "immutableUrl",
  ] as const) {
    if (before[field] !== after[field]) {
      throw new Error(
        `Production identity changed during the credentialed check (${field})`,
      );
    }
  }
}

export function validateRepositoryVerifierProjection(value: {
  head: string;
  status: string;
  origin: string;
  remoteMain: unknown;
}): VerifierIdentity {
  const head = stringField(
    value.head.trim(),
    "verifier HEAD",
    /^[0-9a-f]{40}$/u,
  );
  if (value.status.trim() !== "") {
    throw new Error("the operator check must run from a clean worktree");
  }
  if (
    !/^https:\/\/github\.com\/HUDongpin\/helpmath-web(?:\.git)?$/u.test(
      value.origin.trim(),
    ) &&
    !/^git@github\.com:HUDongpin\/helpmath-web(?:\.git)?$/u.test(
      value.origin.trim(),
    )
  ) {
    throw new Error(
      `origin must be the fixed private repository ${EXPECTED_REPOSITORY}`,
    );
  }
  const commitRecord = objectField(
    value.remoteMain,
    "fixed repository main commit",
  );
  const remoteMainCommit = stringField(
    commitRecord.sha,
    "fixed repository main commit.sha",
    /^[0-9a-f]{40}$/u,
  );
  if (head !== remoteMainCommit) {
    throw new Error(
      "the operator check must run from the exact current fixed-repository main commit",
    );
  }
  return { repositoryCommit: head, remoteMainCommit };
}

export function parsePrivateReviewContract(
  windowText: string,
  activationText: string,
): ReviewContract {
  const windowConfig = objectField(
    JSON.parse(windowText),
    "executive preview window",
  );
  const activationConfig = objectField(
    JSON.parse(activationText),
    "demo activations",
  );
  if (
    JSON.stringify(windowConfig.demoIds) !==
    JSON.stringify(EXPECTED_DEMO_IDS)
  ) {
    throw new Error(
      "executive preview window must contain exactly conversion-1-2 and conversion-1-4",
    );
  }
  const maximumExpiresAt = stringField(
    windowConfig.maximumExpiresAt,
    "executive preview window maximumExpiresAt",
  );
  const demos = objectField(activationConfig.demos, "demo activations demos");
  if (
    JSON.stringify(Object.keys(demos).sort()) !==
    JSON.stringify([...EXPECTED_DEMO_IDS].sort())
  ) {
    throw new Error(
      "demo activations must contain exactly the two reviewed prototypes",
    );
  }

  const candidates = EXPECTED_DEMO_IDS.map((id) => {
    const demo = objectField(demos[id], `demo activations ${id}`);
    const approvals = objectField(
      demo.approvals,
      `demo activations ${id}.approvals`,
    );
    const privatePreview = objectField(
      approvals.privatePreview,
      `demo activations ${id}.approvals.privatePreview`,
    );
    const activation = objectField(
      demo.activation,
      `demo activations ${id}.activation`,
    );
    if (
      privatePreview.status !== "approved" ||
      activation.active !== false ||
      approvals.rightsAcceptance !== null ||
      approvals.productAcceptance !== null
    ) {
      throw new Error(`${id} is not in the approved private-only review state`);
    }
    return {
      id,
      candidateId: stringField(
        demo.candidateId,
        `demo activations ${id}.candidateId`,
      ),
      artifactSha256: stringField(
        demo.artifactSha256,
        `demo activations ${id}.artifactSha256`,
        /^[0-9a-f]{64}$/u,
      ),
    };
  });

  return { maximumExpiresAt, candidates };
}

function killChildProcessGroup(
  childPid: number | undefined,
  signal: NodeJS.Signals,
): void {
  if (!childPid) return;
  try {
    if (process.platform === "win32") {
      process.kill(childPid, signal);
    } else {
      process.kill(-childPid, signal);
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (error as NodeJS.ErrnoException).code !== "ESRCH"
    ) {
      throw error;
    }
  }
}

export async function runExecutivePreviewOperatorCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(commandError(`command ${command} was interrupted`));
      return;
    }
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPOSITORY_ROOT,
      env: options.env ?? process.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let totalBytes = 0;
    let terminalError: Error | null = null;
    let spawnError: Error | null = null;
    let forceKillTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const terminate = (error: Error) => {
      if (terminalError) return;
      terminalError = error;
      try {
        killChildProcessGroup(child.pid, "SIGTERM");
      } catch (killError) {
        terminalError = commandError(error.message, killError);
      }
      forceKillTimer = setTimeout(() => {
        try {
          killChildProcessGroup(child.pid, "SIGKILL");
        } catch {
          // The close/error event remains authoritative.
        }
      }, CHILD_TERMINATION_GRACE_MS);
      forceKillTimer.unref();
    };
    const onAbort = () => {
      terminate(commandError(`command ${command} was interrupted`));
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      if (terminalError) return;
      totalBytes += chunk.length;
      if (totalBytes > COMMAND_OUTPUT_LIMIT_BYTES) {
        terminate(
          new Error("child output exceeded the 8 MiB safety limit"),
        );
        return;
      }
      target.push(chunk);
    };
    const cleanup = () => {
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      options.signal?.removeEventListener("abort", onAbort);
    };

    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.timeoutMs) {
      timeoutTimer = setTimeout(() => {
        terminate(
          new Error(
            `command ${command} exceeded its ${options.timeoutMs} ms deadline`,
          ),
        );
      }, options.timeoutMs);
      timeoutTimer.unref();
    }

    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code) => {
      try {
        killChildProcessGroup(child.pid, "SIGKILL");
      } catch (error) {
        terminalError ??= commandError(
          `could not terminate the process group for ${command}`,
          error,
        );
      }
      cleanup();
      if (terminalError) {
        reject(terminalError);
        return;
      }
      if (spawnError) {
        reject(commandError(`could not run command ${command}`, spawnError));
        return;
      }
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function parseJsonOutput(result: CommandResult, phase: string): unknown {
  if (result.code !== 0) {
    throw new Error(`${phase} failed with exit code ${result.code}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${phase} did not return one JSON document`);
  }
}

async function readPrivateReviewContractAtCommit(
  repositoryCommit: string,
  signal: AbortSignal,
): Promise<ReviewContract> {
  const [windowResult, activationResult] = await Promise.all([
    runExecutivePreviewOperatorCommand(
      "git",
      [
        "show",
        `${repositoryCommit}:config/executive-preview-window.json`,
      ],
      { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
    ),
    runExecutivePreviewOperatorCommand(
      "git",
      ["show", `${repositoryCommit}:config/demo-activations.json`],
      { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
    ),
  ]);
  if (windowResult.code !== 0 || activationResult.code !== 0) {
    throw new Error(
      "could not read the private-review contract from the Production commit",
    );
  }
  return parsePrivateReviewContract(
    windowResult.stdout,
    activationResult.stdout,
  );
}

async function inspectLiveProduction(
  signal: AbortSignal,
): Promise<LiveProductionIdentity> {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const vercelResult = await runExecutivePreviewOperatorCommand(
    npx,
    [
      "--yes",
      `vercel@${EXPECTED_VERCEL_CLI_VERSION}`,
      "inspect",
      CANONICAL_ORIGIN,
      "--scope",
      EXPECTED_VERCEL_SCOPE,
      "--json",
    ],
    { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
  );
  const vercelIdentity = parseLiveVercelProduction(
    parseJsonOutput(
      vercelResult,
      "authenticated Vercel Production inspection",
    ),
  );

  const deploymentResult = await runExecutivePreviewOperatorCommand(
    "gh",
    [
      "api",
      `repos/${EXPECTED_REPOSITORY}/deployments?environment=Production&per_page=1`,
    ],
    { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
  );
  const githubDeployment = parseLatestGitHubProductionDeployment(
    parseJsonOutput(
      deploymentResult,
      "authenticated fixed-repository Production deployment inspection",
    ),
  );
  const statusesResult = await runExecutivePreviewOperatorCommand(
    "gh",
    [
      "api",
      `repos/${EXPECTED_REPOSITORY}/deployments/${githubDeployment.githubDeploymentId}/statuses?per_page=1`,
    ],
    { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
  );
  const githubStatus = parseLatestGitHubProductionStatus(
    parseJsonOutput(
      statusesResult,
      "authenticated latest Production deployment-status inspection",
    ),
    vercelIdentity.immutableUrl,
  );

  return {
    ...vercelIdentity,
    ...githubDeployment,
    ...githubStatus,
  };
}

async function inspectRepositoryVerifier(
  signal: AbortSignal,
): Promise<VerifierIdentity> {
  const [headResult, statusResult, originResult, remoteMainResult] =
    await Promise.all([
      runExecutivePreviewOperatorCommand("git", ["rev-parse", "HEAD"], {
        signal,
        timeoutMs: NETWORK_COMMAND_TIMEOUT_MS,
      }),
      runExecutivePreviewOperatorCommand("git", ["status", "--porcelain"], {
        signal,
        timeoutMs: NETWORK_COMMAND_TIMEOUT_MS,
      }),
      runExecutivePreviewOperatorCommand("git", ["remote", "get-url", "origin"], {
        signal,
        timeoutMs: NETWORK_COMMAND_TIMEOUT_MS,
      }),
      runExecutivePreviewOperatorCommand(
        "gh",
        ["api", `repos/${EXPECTED_REPOSITORY}/commits/main`],
        { signal, timeoutMs: NETWORK_COMMAND_TIMEOUT_MS },
      ),
    ]);
  for (const [phase, result] of [
    ["HEAD", headResult],
    ["worktree", statusResult],
    ["origin", originResult],
    ["fixed repository main", remoteMainResult],
  ] as const) {
    if (result.code !== 0) {
      throw new Error(`could not inspect verifier ${phase}`);
    }
  }
  return validateRepositoryVerifierProjection({
    head: headResult.stdout,
    status: statusResult.stdout,
    origin: originResult.stdout,
    remoteMain: parseJsonOutput(
      remoteMainResult,
      "fixed repository main inspection",
    ),
  });
}

function installInterruptionHandlers(controller: AbortController): () => void {
  const handlers = HANDLED_SIGNALS.map((signal) => {
    const handler = () => {
      controller.abort(commandError(`operator check received ${signal}`));
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  return () => {
    for (const { signal, handler } of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

export async function runExecutivePreviewOperatorCheck() {
  const startedAt = new Date();
  const accessKey = validateExecutivePreviewOperatorInput(
    process.env.SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY,
  );
  delete process.env.SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY;
  delete process.env.PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY;

  const controller = new AbortController();
  const removeInterruptionHandlers = installInterruptionHandlers(controller);
  let temporaryDirectory: string | null = null;
  let retainedResult: JsonObject | null = null;

  try {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "helpmath-executive-preview-"),
    );
    await chmod(temporaryDirectory, 0o700);

    const [beforeIdentity, beforeVerifier] = await Promise.all([
      inspectLiveProduction(controller.signal),
      inspectRepositoryVerifier(controller.signal),
    ]);
    const contract = await readPrivateReviewContractAtCommit(
      beforeIdentity.repositoryCommit,
      controller.signal,
    );
    const privateTempEnvironment = {
      ...process.env,
      TMPDIR: temporaryDirectory,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
    };

    const smokeResult = await runExecutivePreviewOperatorCommand(
      process.execPath,
      ["scripts/release-smoke.mjs"],
      {
        signal: controller.signal,
        timeoutMs: SMOKE_COMMAND_TIMEOUT_MS,
        env: {
          ...privateTempEnvironment,
          EXPECT_EXECUTIVE_PREVIEW_STATE: "login",
          EXPECT_EXECUTIVE_PREVIEW_EXPIRES_AT: contract.maximumExpiresAt,
          SMOKE_BASE_URL: CANONICAL_ORIGIN,
          SMOKE_CANONICAL_ORIGIN: CANONICAL_ORIGIN,
          SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY: accessKey,
        },
      },
    );
    const smokeSummary = validateExecutivePreviewSmokeSummary(
      parseJsonOutput(smokeResult, "credentialed release smoke"),
      contract.maximumExpiresAt,
    );

    const junitPath = path.join(temporaryDirectory, "result.xml");
    const playwrightOutput = path.join(temporaryDirectory, "playwright");
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const browserResult = await runExecutivePreviewOperatorCommand(
      npx,
      [
        "playwright",
        "test",
        "e2e/site.spec.ts",
        "--project=chromium",
        `--output=${playwrightOutput}`,
        "--grep",
        EXECUTIVE_TEST_TITLE,
        "--reporter=junit",
        "--workers=1",
        "--retries=0",
      ],
      {
        signal: controller.signal,
        timeoutMs: BROWSER_COMMAND_TIMEOUT_MS,
        env: {
          ...privateTempEnvironment,
          CI: "true",
          PLAYWRIGHT_BASE_URL: CANONICAL_ORIGIN,
          PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY: accessKey,
          PLAYWRIGHT_JUNIT_OUTPUT_FILE: junitPath,
        },
      },
    );
    if (browserResult.code !== 0) {
      throw new Error(
        `credentialed Chromium check failed with exit code ${browserResult.code}`,
      );
    }
    const browserCounts = parseExecutivePreviewJUnit(
      await readFile(junitPath, "utf8"),
    );
    controller.signal.throwIfAborted();

    const [afterIdentity, afterVerifier] = await Promise.all([
      inspectLiveProduction(controller.signal),
      inspectRepositoryVerifier(controller.signal),
    ]);
    assertStableLiveProductionIdentity(beforeIdentity, afterIdentity);
    if (
      beforeVerifier.repositoryCommit !== afterVerifier.repositoryCommit ||
      beforeVerifier.remoteMainCommit !== afterVerifier.remoteMainCommit
    ) {
      throw new Error(
        "fixed-repository main changed during the credentialed check",
      );
    }

    retainedResult = {
      schemaVersion: 2,
      evidenceKind: "executive-preview-production-check",
      status: "pass",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      canonicalOrigin: CANONICAL_ORIGIN,
      targetDeployment: {
        repository: beforeIdentity.repository,
        repositoryCommit: beforeIdentity.repositoryCommit,
        vercelProject: EXPECTED_VERCEL_PROJECT,
        vercelScope: EXPECTED_VERCEL_SCOPE,
        vercelCliVersion: EXPECTED_VERCEL_CLI_VERSION,
        vercelDeploymentId: beforeIdentity.vercelDeploymentId,
        vercelBuildId: beforeIdentity.vercelBuildId,
        githubDeploymentId: beforeIdentity.githubDeploymentId,
        githubDeploymentStatusId:
          beforeIdentity.githubDeploymentStatusId,
        immutableUrl: beforeIdentity.immutableUrl,
        liveIdentityCheckedBeforeAndAfter: true,
      },
      verifier: {
        repository: EXPECTED_REPOSITORY,
        repositoryCommit: beforeVerifier.repositoryCommit,
        exactRemoteMain: true,
        cleanWorktree: true,
      },
      review: {
        sourceRepositoryCommit: beforeIdentity.repositoryCommit,
        maximumExpiresAt: contract.maximumExpiresAt,
        candidates: contract.candidates,
      },
      smoke: {
        launchGateManifestSha256:
          smokeSummary.launchGateManifestSha256,
        state: smokeSummary.executivePreviewState,
        authentication: smokeSummary.executivePreviewAuthentication,
        demoRoutes:
          smokeSummary.executivePreviewAuthenticatedDemoRoutes,
        imageResources:
          smokeSummary.executivePreviewAuthenticatedAssets,
        runtimeResources:
          smokeSummary.executivePreviewAuthenticatedRuntimes,
      },
      browser: {
        engine: "chromium",
        testTitle: EXECUTIVE_TEST_TITLE,
        ...browserCounts,
      },
      retention: {
        operatorInput: "not-retained",
        temporaryArtifacts: "deleted-before-result",
        rawChildOutput: "not-retained",
      },
      failures: [],
    };
  } catch (error) {
    controller.abort(commandError("operator check failed", error));
    throw error;
  } finally {
    try {
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    } finally {
      removeInterruptionHandlers();
    }
  }

  if (!retainedResult) {
    throw new Error("operator check did not produce a result");
  }
  controller.signal.throwIfAborted();
  const sensitiveErrors: string[] = [];
  inspectForSensitiveContent(
    retainedResult,
    "operator result",
    sensitiveErrors,
  );
  if (sensitiveErrors.length > 0) {
    throw new Error(
      `sanitized operator result failed its retention scan: ${sensitiveErrors.join("; ")}`,
    );
  }
  process.stdout.write(`${JSON.stringify(retainedResult, null, 2)}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runExecutivePreviewOperatorCheck().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Executive preview operator check failed closed: ${message}\n`,
    );
    process.exitCode = 1;
  });
}
