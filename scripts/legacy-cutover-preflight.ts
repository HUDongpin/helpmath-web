import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  canonicalJson,
  computeLegacyCutoverValidUntil,
  evaluateLegacyCutoverPreflight,
  type EvidenceVerification,
  MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
  parseCanonicalLegacyJson,
  prepareLegacyCutoverReceiptDirectory,
  readRestrictedExternalFile,
  REQUIRED_LEGACY_PREFLIGHT_COMMANDS,
  type LegacyCutoverPlan,
  validateLegacyCutoverPlan,
  verifyLegacyCutoverEvidence,
  writeLegacyCutoverReceipt,
} from "../lib/legacy-cutover-preflight";
import { resolveLaunchGateRuntimeForManifest } from "../lib/launch-gates";
import { validateLaunchGateManifest } from "../lib/launch-gate-validation";
import { parseCanonicalLaunchGateManifest } from "../lib/launch-gate-transition-lock.js";
import { legacyRedirects } from "../next.config";

type Arguments = {
  planPath: string | null;
  evidenceDirectory: string | null;
};

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { planPath: null, evidenceDirectory: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan" || argument === "--evidence-dir") {
      const value = argv[index + 1]?.trim();
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a value`);
      if (argument === "--plan") parsed.planPath = value;
      else parsed.evidenceDirectory = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function run(command: string, args: string[]): { ok: boolean; detail: string } {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const ok = result.status === 0 && !result.error && !result.signal;
  const status = result.status === null ? "null" : String(result.status);
  const signal = result.signal ?? "none";
  const error = result.error?.message ?? "none";
  return {
    ok,
    detail:
      `status ${status}; signal ${signal}; error ${error}; ` +
      `output SHA-256 ${sha256(output)}`,
  };
}

function gitOutput(args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
  });
  return result.status === 0 && !result.error && !result.signal
    ? result.stdout.trim()
    : null;
}

function gitSucceeds(args: string[]): boolean {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
  });
  return result.status === 0 && !result.error && !result.signal;
}

function repositoryState(
  plan: LegacyCutoverPlan | null,
  head: string | null,
  clean: boolean,
) {
  const candidateCommitExists = Boolean(
    plan &&
    gitSucceeds(["cat-file", "-e", `${plan.repositoryCommit}^{commit}`]),
  );
  const candidateIsAncestor = Boolean(
    plan &&
    head &&
    candidateCommitExists &&
    gitSucceeds(["merge-base", "--is-ancestor", plan.repositoryCommit, head]),
  );
  return { head, clean, candidateCommitExists, candidateIsAncestor };
}

function repositoryStateAtFixedHead(
  plan: LegacyCutoverPlan | null,
  fixedHead: string | null,
  initiallyClean: boolean,
) {
  const observedHead = gitOutput(["rev-parse", "HEAD"]);
  const observedWorkingTreeStatus = gitOutput(["status", "--porcelain"]);
  return repositoryState(
    plan,
    fixedHead,
    Boolean(
      fixedHead &&
      initiallyClean &&
      observedHead === fixedHead &&
      observedWorkingTreeStatus === "",
    ),
  );
}

async function loadPlan(
  planPath: string | null,
  repositoryRoot: string,
  nowMs: number,
): Promise<{
  plan: LegacyCutoverPlan | null;
  planErrors: string[];
  bytes: Buffer | null;
  canonicalPath: string | null;
}> {
  if (!planPath) {
    return {
      plan: null,
      planErrors: ["--plan is required for a GO_TO_CHANGE decision"],
      bytes: null,
      canonicalPath: null,
    };
  }
  if (!path.isAbsolute(planPath)) {
    return {
      plan: null,
      planErrors: ["--plan must be an absolute external path"],
      bytes: null,
      canonicalPath: null,
    };
  }
  try {
    const externalPlan = await readRestrictedExternalFile(
      path.resolve(planPath),
      {
        repositoryRoot,
        maxBytes: 1024 * 1024,
        label: "cutover plan",
      },
    );
    const parsedPlan = parseCanonicalLegacyJson(
      externalPlan.bytes,
      "cutover plan",
    );
    if (!parsedPlan.canonical || parsedPlan.value === null) {
      return {
        plan: null,
        planErrors: parsedPlan.errors,
        bytes: externalPlan.bytes,
        canonicalPath: externalPlan.canonicalPath,
      };
    }
    const value = parsedPlan.value;
    const planErrors = validateLegacyCutoverPlan(value, { nowMs });
    return {
      plan: planErrors.length === 0 ? (value as LegacyCutoverPlan) : null,
      planErrors,
      bytes: externalPlan.bytes,
      canonicalPath: externalPlan.canonicalPath,
    };
  } catch (error) {
    return {
      plan: null,
      planErrors: [
        `could not load plan: ${error instanceof Error ? error.message : String(error)}`,
      ],
      bytes: null,
      canonicalPath: null,
    };
  }
}

function unavailableEvidence(detail: string): EvidenceVerification {
  return { ok: false, detail, entries: [] };
}

const REQUIRED_CUTOVER_GATE_IDS = [
  "legalPublication",
  "contactIntake",
  "legacyCutover",
] as const;

type RequiredCutoverGateId = (typeof REQUIRED_CUTOVER_GATE_IDS)[number];

type GateAuthorization = {
  decisionId: string | null;
  repositoryCommit: string | null;
  vercelDeploymentId: string | null;
  validUntil: string | null;
};

function resolveCutoverGateInputs(
  nowMs: number,
  manifest: unknown,
): {
  gateStatuses: Record<string, string>;
  gateAuthorizations: Record<RequiredCutoverGateId, GateAuthorization>;
} {
  const runtime = resolveLaunchGateRuntimeForManifest(manifest, nowMs);
  return {
    gateStatuses: Object.fromEntries(
      Object.entries(runtime.gates).map(([id, gate]) => [
        id,
        (gate.effectiveStatus === "approved" ||
          gate.effectiveStatus === "disabled" ||
          gate.effectiveStatus === "private") &&
        !gate.satisfied
          ? "dependency-closed"
          : gate.effectiveStatus,
      ]),
    ),
    gateAuthorizations: Object.fromEntries(
      REQUIRED_CUTOVER_GATE_IDS.map((gateId) => {
        const gate = runtime.gates[gateId];
        return [
          gateId,
          {
            decisionId: gate.decisionId,
            repositoryCommit: gate.subject?.repositoryCommit ?? null,
            vercelDeploymentId: gate.subject?.vercelDeploymentId ?? null,
            validUntil: gate.validUntil,
          },
        ];
      }),
    ) as Record<RequiredCutoverGateId, GateAuthorization>,
  };
}

function gateDependenciesForManifest(
  manifest: unknown,
): Record<string, string[]> {
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    !("gates" in manifest) ||
    typeof manifest.gates !== "object" ||
    manifest.gates === null ||
    Array.isArray(manifest.gates)
  ) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(manifest.gates).map(([id, gate]) => [
      id,
      typeof gate === "object" &&
      gate !== null &&
      !Array.isArray(gate) &&
      "dependencies" in gate &&
      Array.isArray(gate.dependencies)
        ? gate.dependencies.filter(
            (entry: unknown): entry is string => typeof entry === "string",
          )
        : [],
    ]),
  );
}

function gateValidUntils(
  authorizations: Record<RequiredCutoverGateId, GateAuthorization>,
): string[] {
  return Object.values(authorizations)
    .map((authorization) => authorization.validUntil)
    .filter((value): value is string => value !== null);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const repositoryRoot = await realpath(process.cwd());
  const head = gitOutput(["rev-parse", "HEAD"]);
  const initiallyClean = gitOutput(["status", "--porcelain"]) === "";
  const pinnedHead = process.env.HELP_MATH_LEGACY_PREFLIGHT_PINNED_HEAD ?? null;
  if (
    !head ||
    !pinnedHead ||
    !/^[a-f0-9]{40}$/u.test(pinnedHead) ||
    head !== pinnedHead ||
    !initiallyClean
  ) {
    throw new Error(
      "trusted bootstrap did not pin this exact clean repository HEAD before module loading",
    );
  }
  const [bootstrapBytes, scriptBytes, libraryBytes] = await Promise.all([
    readFile(
      new URL("./legacy-cutover-preflight-bootstrap.mjs", import.meta.url),
    ),
    readFile(new URL(import.meta.url)),
    readFile(new URL("../lib/legacy-cutover-preflight.ts", import.meta.url)),
  ]);
  if (
    sha256(scriptBytes) !==
      process.env.HELP_MATH_LEGACY_PREFLIGHT_ENTRY_SHA256 ||
    sha256(libraryBytes) !==
      process.env.HELP_MATH_LEGACY_PREFLIGHT_LIBRARY_SHA256
  ) {
    throw new Error(
      "preflight entry or library bytes changed after trusted bootstrap pinning",
    );
  }
  const startedAt = new Date().toISOString();
  const initialNowMs = Date.parse(startedAt);
  const loadedPlan = await loadPlan(
    args.planPath,
    repositoryRoot,
    initialNowMs,
  );
  const manifestText = await readFile(
    new URL("../config/launch-gates.json", import.meta.url),
    "utf8",
  );
  const parsedInitialManifest = parseCanonicalLaunchGateManifest(manifestText);
  const initialManifest = parsedInitialManifest.manifest;

  let receiptDirectoryReady = false;
  let receiptDirectoryError: string | null = null;
  if (args.evidenceDirectory) {
    try {
      await prepareLegacyCutoverReceiptDirectory(args.evidenceDirectory, {
        repositoryRoot,
      });
      receiptDirectoryReady = true;
    } catch (error) {
      receiptDirectoryError =
        error instanceof Error ? error.message : String(error);
    }
  }

  const redirects = await legacyRedirects();
  const salesDestinationObserved =
    redirects.find((redirect) => redirect.source === "/Sales.htm")
      ?.destination ?? null;
  const commandResults = Object.fromEntries(
    REQUIRED_LEGACY_PREFLIGHT_COMMANDS.map((name) => [
      name,
      run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", name]),
    ]),
  );

  const verificationNowMs = Date.now();
  const evidenceVerification = loadedPlan.plan
    ? await verifyLegacyCutoverEvidence(loadedPlan.plan, {
        nowMs: verificationNowMs,
        repositoryRoot,
      })
    : unavailableEvidence(
        "external evidence was not evaluated because the plan is missing or invalid",
      );
  let decisionNowMs = Date.now();
  let finalPlanErrors = loadedPlan.plan
    ? [
        ...new Set([
          ...loadedPlan.planErrors,
          ...validateLegacyCutoverPlan(loadedPlan.plan, {
            nowMs: decisionNowMs,
          }),
        ]),
      ]
    : loadedPlan.planErrors;
  let gateInputs = resolveCutoverGateInputs(decisionNowMs, initialManifest);
  let finalEvidenceVerification = evidenceVerification;
  const manifestErrors = [
    ...parsedInitialManifest.errors,
    ...validateLaunchGateManifest(initialManifest),
  ];
  const gateDependencies = gateDependenciesForManifest(initialManifest);
  const evaluationBase = {
    plan: loadedPlan.plan,
    manifestErrors,
    gateDependencies,
    commandResults,
    salesDestinationObserved,
    receiptDirectoryReady,
  };
  let evaluation = evaluateLegacyCutoverPreflight({
    ...evaluationBase,
    planErrors: finalPlanErrors,
    gateStatuses: gateInputs.gateStatuses,
    gateAuthorizations: gateInputs.gateAuthorizations,
    decisionTimeMs: decisionNowMs,
    repository: repositoryStateAtFixedHead(
      loadedPlan.plan,
      head,
      initiallyClean,
    ),
    evidenceVerification: finalEvidenceVerification,
  });

  if (evaluation.decision === "GO_TO_CHANGE" && loadedPlan.plan) {
    finalEvidenceVerification = await verifyLegacyCutoverEvidence(
      loadedPlan.plan,
      { nowMs: Date.now(), repositoryRoot },
    );
    decisionNowMs = Date.now();
    finalPlanErrors = [
      ...new Set([
        ...loadedPlan.planErrors,
        ...validateLegacyCutoverPlan(loadedPlan.plan, { nowMs: decisionNowMs }),
      ]),
    ];
    gateInputs = resolveCutoverGateInputs(decisionNowMs, initialManifest);
    evaluation = evaluateLegacyCutoverPreflight({
      ...evaluationBase,
      planErrors: finalPlanErrors,
      gateStatuses: gateInputs.gateStatuses,
      gateAuthorizations: gateInputs.gateAuthorizations,
      decisionTimeMs: decisionNowMs,
      repository: repositoryStateAtFixedHead(
        loadedPlan.plan,
        head,
        initiallyClean,
      ),
      evidenceVerification: finalEvidenceVerification,
    });
  }

  const validUntil = loadedPlan.plan
    ? computeLegacyCutoverValidUntil(
        loadedPlan.plan,
        gateValidUntils(gateInputs.gateAuthorizations),
      )
    : null;
  const receipt = {
    schemaVersion: 3,
    evidenceKind: "help-math-legacy-cutover-preflight",
    phase: "pre-change-authorization",
    startedAt,
    decisionAt: new Date(decisionNowMs).toISOString(),
    validUntil,
    cutoverId: loadedPlan.plan?.cutoverId ?? null,
    topology: loadedPlan.plan?.topology ?? null,
    decision: evaluation.decision,
    repository: repositoryStateAtFixedHead(
      loadedPlan.plan,
      head,
      initiallyClean,
    ),
    tool: {
      bootstrapSha256: sha256(bootstrapBytes),
      scriptSha256: sha256(scriptBytes),
      librarySha256: sha256(libraryBytes),
    },
    inputs: {
      plan: loadedPlan.canonicalPath
        ? {
            reference: loadedPlan.canonicalPath,
            sha256: loadedPlan.bytes ? sha256(loadedPlan.bytes) : null,
          }
        : null,
      launchGateManifest: {
        reference: "config/launch-gates.json",
        sha256: sha256(manifestText),
      },
      gateAuthorizations: gateInputs.gateAuthorizations,
      externalEvidence: finalEvidenceVerification.entries,
      receiptDirectoryError,
    },
    checks: evaluation.checks,
    failures: evaluation.failures,
  };

  let retainedEvidence = null;
  if (receiptDirectoryReady && args.evidenceDirectory) {
    try {
      const beforePublish =
        evaluation.decision === "GO_TO_CHANGE"
          ? async () => {
              if (
                !loadedPlan.plan ||
                !loadedPlan.bytes ||
                !loadedPlan.canonicalPath
              ) {
                throw new Error(
                  "validated cutover plan disappeared before receipt publication",
                );
              }

              const nowMs = Date.now();
              const [
                currentManifestText,
                currentPlan,
                currentBootstrapBytes,
                currentScriptBytes,
                currentLibraryBytes,
              ] = await Promise.all([
                readFile(
                  new URL("../config/launch-gates.json", import.meta.url),
                  "utf8",
                ),
                loadPlan(loadedPlan.canonicalPath, repositoryRoot, nowMs),
                readFile(
                  new URL(
                    "./legacy-cutover-preflight-bootstrap.mjs",
                    import.meta.url,
                  ),
                ),
                readFile(new URL(import.meta.url)),
                readFile(
                  new URL(
                    "../lib/legacy-cutover-preflight.ts",
                    import.meta.url,
                  ),
                ),
              ]);
              if (sha256(currentManifestText) !== sha256(manifestText)) {
                throw new Error(
                  "launch-gate manifest changed before receipt publication",
                );
              }
              if (
                !currentPlan.plan ||
                !currentPlan.bytes ||
                currentPlan.canonicalPath !== loadedPlan.canonicalPath ||
                sha256(currentPlan.bytes) !== sha256(loadedPlan.bytes)
              ) {
                throw new Error(
                  "cutover plan changed or became invalid before receipt publication",
                );
              }

              const parsedManifest =
                parseCanonicalLaunchGateManifest(currentManifestText);
              const currentManifestErrors = [
                ...parsedManifest.errors,
                ...validateLaunchGateManifest(parsedManifest.manifest, {
                  nowMs,
                }),
              ];
              const currentGateInputs = resolveCutoverGateInputs(
                nowMs,
                parsedManifest.manifest,
              );
              const currentEvidenceVerification =
                await verifyLegacyCutoverEvidence(currentPlan.plan, {
                  nowMs,
                  repositoryRoot,
                });
              const currentHead = gitOutput(["rev-parse", "HEAD"]);
              const currentWorkingTreeStatus = gitOutput([
                "status",
                "--porcelain",
              ]);
              if (currentHead !== head) {
                throw new Error(
                  "repository HEAD changed before receipt publication",
                );
              }
              if (
                sha256(currentBootstrapBytes) !==
                  receipt.tool.bootstrapSha256 ||
                sha256(currentScriptBytes) !== receipt.tool.scriptSha256 ||
                sha256(currentLibraryBytes) !== receipt.tool.librarySha256
              ) {
                throw new Error(
                  "preflight tool bytes changed before receipt publication",
                );
              }
              if (
                canonicalJson(currentGateInputs.gateAuthorizations) !==
                canonicalJson(receipt.inputs.gateAuthorizations)
              ) {
                throw new Error(
                  "launch-gate authorization snapshot changed before receipt publication",
                );
              }
              if (
                canonicalJson(currentEvidenceVerification.entries) !==
                canonicalJson(receipt.inputs.externalEvidence)
              ) {
                throw new Error(
                  "external evidence snapshot changed before receipt publication",
                );
              }
              const currentValidUntil = computeLegacyCutoverValidUntil(
                currentPlan.plan,
                gateValidUntils(currentGateInputs.gateAuthorizations),
              );
              if (currentValidUntil !== receipt.validUntil) {
                throw new Error(
                  "authorization validity changed before receipt publication",
                );
              }
              const currentEvaluation = evaluateLegacyCutoverPreflight({
                ...evaluationBase,
                plan: currentPlan.plan,
                planErrors: currentPlan.planErrors,
                manifestErrors: currentManifestErrors,
                gateDependencies: gateDependenciesForManifest(
                  parsedManifest.manifest,
                ),
                gateStatuses: currentGateInputs.gateStatuses,
                gateAuthorizations: currentGateInputs.gateAuthorizations,
                decisionTimeMs: nowMs,
                repository: repositoryState(
                  currentPlan.plan,
                  currentHead,
                  currentWorkingTreeStatus === "",
                ),
                evidenceVerification: currentEvidenceVerification,
              });
              if (currentEvaluation.decision !== "GO_TO_CHANGE") {
                throw new Error(
                  `pre-publication recheck failed: ${currentEvaluation.failures.join("; ")}`,
                );
              }
            }
          : undefined;
      retainedEvidence = await writeLegacyCutoverReceipt(
        args.evidenceDirectory,
        receipt,
        {
          repositoryRoot,
          ...(evaluation.decision === "GO_TO_CHANGE" && validUntil
            ? {
                notAfter: validUntil,
                minimumRemainingMs: MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
                beforePublish,
              }
            : {}),
        },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        canonicalJson({
          ...receipt,
          failedAt: new Date().toISOString(),
          decision: "NO_GO",
          failures: [...evaluation.failures, `receipt-write: ${detail}`],
          retainedEvidence: null,
        }),
      );
      process.exitCode = 2;
      return;
    }
  }
  process.stdout.write(canonicalJson({ ...receipt, retainedEvidence }));
  if (evaluation.decision !== "GO_TO_CHANGE") process.exitCode = 2;
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    canonicalJson({
      schemaVersion: 3,
      evidenceKind: "help-math-legacy-cutover-preflight",
      phase: "pre-change-authorization",
      failedAt: new Date().toISOString(),
      decision: "NO_GO",
      failures: [`fatal: ${detail}`],
      retainedEvidence: null,
    }),
  );
  process.exitCode = 2;
});
