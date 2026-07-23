import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LAUNCH_GATE_IDS } from "../lib/launch-gate-ids";
import {
  migrateLaunchGateManifestV2ToV3,
  validateLaunchGateManifestTransitionV3,
  type LaunchGateLifecycleManifestV3,
} from "../lib/launch-gate-lifecycle-v3";
import { parseCanonicalLaunchGateManifest } from "../lib/launch-gate-transition-lock.js";

const MANIFEST_PATH = "config/launch-gates.json";
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const ZERO_COMMIT = "0".repeat(40);

type JsonObject = Record<string, unknown>;

type GitRunner = (argumentsList: readonly string[], cwd: string) => string;
type ComparisonBase = Readonly<{
  reference: string;
  strategy: "exact" | "merge-base";
}>;

export type LaunchGateTransitionValidationOptions = Readonly<{
  nowMs?: number;
}>;

export type LaunchGateRepositoryTransitionOptions = Readonly<{
  repositoryRoot?: string;
  environment?: NodeJS.ProcessEnv;
  baseRef?: string;
  nowMs?: number;
  runGit?: GitRunner;
}>;

export type LaunchGateRepositoryTransitionResult = Readonly<{
  baseCommit: string | null;
  baseReference: string | null;
  errors: string[];
  nextSchemaVersion: number | null;
  previousSchemaVersion: number | null;
}>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaVersion(value: unknown): number | null {
  return isObject(value) && Number.isInteger(value.schemaVersion)
    ? Number(value.schemaVersion)
    : null;
}

function defaultRunGit(argumentsList: readonly string[], cwd: string): string {
  return execFileSync("git", [...argumentsList], {
    cwd,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function prefixed(prefix: string, errors: readonly string[]): string[] {
  return errors.map((error) => `${prefix}: ${error}`);
}

function validateV2UpgradeAdditions(
  migrated: LaunchGateLifecycleManifestV3,
  nextValue: unknown,
): string[] {
  if (!isObject(nextValue) || !isObject(nextValue.gates)) return [];
  const errors: string[] = [];
  for (const gateId of LAUNCH_GATE_IDS) {
    const nextGate = nextValue.gates[gateId];
    if (!isObject(nextGate) || !Array.isArray(nextGate.events)) continue;
    const migratedEventCount = migrated.gates[gateId].events.length;
    const additions = nextGate.events.slice(migratedEventCount);
    if (additions.length > 1) {
      errors.push(
        `v2 -> v3 may append at most one candidate event for gates.${gateId}`,
      );
    }
    for (const [offset, event] of additions.entries()) {
      if (
        !isObject(event) ||
        event.transition !== "submit" ||
        event.from !== "holding" ||
        event.to !== "candidate"
      ) {
        errors.push(
          `v2 -> v3 may only append valid candidate events; gates.${gateId}.events[${
            migratedEventCount + offset
          }] is not a holding -> candidate submission`,
        );
      }
    }
  }
  return errors;
}

function validateV3TransitionAdditions(
  previousValue: unknown,
  nextValue: unknown,
  nowMs: number,
): string[] {
  if (
    !isObject(previousValue) ||
    !isObject(previousValue.gates) ||
    !isObject(nextValue) ||
    !isObject(nextValue.gates)
  ) {
    return [];
  }
  const errors: string[] = [];
  const previousUpdatedAtMs =
    typeof previousValue.updatedAt === "string"
      ? Date.parse(previousValue.updatedAt)
      : Number.NaN;
  for (const gateId of LAUNCH_GATE_IDS) {
    const previousGate = previousValue.gates[gateId];
    const nextGate = nextValue.gates[gateId];
    if (
      !isObject(previousGate) ||
      !Array.isArray(previousGate.events) ||
      !isObject(nextGate) ||
      !Array.isArray(nextGate.events)
    ) {
      continue;
    }
    const additions = nextGate.events.length - previousGate.events.length;
    if (additions > 1) {
      errors.push(
        `v3 -> v3 may append at most one lifecycle event per gate in a comparison interval; gates.${gateId} appends ${additions}`,
      );
    }
    for (
      let eventIndex = previousGate.events.length;
      eventIndex < nextGate.events.length;
      eventIndex += 1
    ) {
      const event = nextGate.events[eventIndex];
      if (!isObject(event)) continue;
      const occurredAtMs =
        typeof event.occurredAt === "string"
          ? Date.parse(event.occurredAt)
          : Number.NaN;
      if (
        Number.isFinite(previousUpdatedAtMs) &&
        Number.isFinite(occurredAtMs) &&
        occurredAtMs <= previousUpdatedAtMs
      ) {
        errors.push(
          `v3 -> v3 gates.${gateId}.events[${eventIndex}].occurredAt must be strictly later than previous manifest updatedAt`,
        );
      }

      if (
        event.transition !== "approve" &&
        event.transition !== "disable" &&
        event.transition !== "keep-private" &&
        event.transition !== "renew"
      ) {
        continue;
      }
      const priorEvent = nextGate.events[eventIndex - 1];
      if (!isObject(priorEvent) || typeof priorEvent.validUntil !== "string") {
        continue;
      }
      const priorValidUntilMs = Date.parse(priorEvent.validUntil);
      if (
        Number.isFinite(nowMs) &&
        Number.isFinite(priorValidUntilMs) &&
        nowMs >= priorValidUntilMs
      ) {
        errors.push(
          `v3 -> v3 gates.${gateId}.events[${eventIndex}] ${event.transition} requires CI nowMs to be strictly earlier than the prior event validUntil`,
        );
      }
    }
  }
  return errors;
}

export function validateLaunchGateManifestVersionTransition(
  previousValue: unknown,
  nextValue: unknown,
  options: LaunchGateTransitionValidationOptions = {},
): string[] {
  const previousVersion = schemaVersion(previousValue);
  const nextVersion = schemaVersion(nextValue);
  const nowMs = options.nowMs ?? Date.now();

  if (previousVersion === 3 && nextVersion === 2) {
    return ["launch-gate manifest schema downgrade from v3 to v2 is forbidden"];
  }

  if (previousVersion === 3 && nextVersion === 3) {
    return [
      ...validateLaunchGateManifestTransitionV3(previousValue, nextValue, {
        nowMs,
      }),
      ...validateV3TransitionAdditions(previousValue, nextValue, nowMs),
    ];
  }

  if (previousVersion === 2) {
    const previousMigration = migrateLaunchGateManifestV2ToV3(previousValue, {
      nowMs,
    });
    if (previousMigration.manifest === null) {
      return prefixed(
        "previous v2 manifest is not a strict holding migration baseline",
        previousMigration.errors,
      );
    }

    if (nextVersion === 2) {
      const nextMigration = migrateLaunchGateManifestV2ToV3(nextValue, {
        nowMs,
      });
      if (nextMigration.manifest === null) {
        return prefixed(
          "next v2 manifest must remain a strict holding manifest",
          nextMigration.errors,
        );
      }
      return validateLaunchGateManifestTransitionV3(
        previousMigration.manifest,
        nextMigration.manifest,
        { nowMs },
      );
    }

    if (nextVersion === 3) {
      return [
        ...validateLaunchGateManifestTransitionV3(
          previousMigration.manifest,
          nextValue,
          { nowMs },
        ),
        ...validateV2UpgradeAdditions(previousMigration.manifest, nextValue),
      ];
    }
  }

  return [
    `unsupported launch-gate manifest schema transition ${
      previousVersion ?? "unknown"
    } -> ${nextVersion ?? "unknown"}`,
  ];
}

function validateBranchName(
  branch: string,
  repositoryRoot: string,
  runGit: GitRunner,
): void {
  if (
    branch.trim() !== branch ||
    branch.length === 0 ||
    branch.includes("\0")
  ) {
    throw new Error("GITHUB_BASE_REF is not a valid branch name");
  }
  runGit(["check-ref-format", "--branch", branch], repositoryRoot);
}

function validatePushBeforeReference(
  value: unknown,
  source: string,
  created: boolean | null,
): string {
  if (typeof value !== "string" || !COMMIT_PATTERN.test(value)) {
    throw new Error(
      `${source} must be a full lowercase 40-character Git commit SHA`,
    );
  }
  if (value === ZERO_COMMIT) {
    if (created === true) {
      throw new Error(
        "initial push has no trusted prior launch-gate baseline; an explicit baseRef is required",
      );
    }
    throw new Error(
      `non-initial push requires a nonzero before SHA; ${source} is all zeros`,
    );
  }
  return value;
}

function pushBeforeReference(environment: NodeJS.ProcessEnv): string {
  if (environment.GITHUB_EVENT_BEFORE !== undefined) {
    return validatePushBeforeReference(
      environment.GITHUB_EVENT_BEFORE,
      "GITHUB_EVENT_BEFORE",
      null,
    );
  }

  const eventPath = environment.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    throw new Error(
      "push transition validation requires GITHUB_EVENT_BEFORE or GITHUB_EVENT_PATH",
    );
  }
  if (
    eventPath.trim() !== eventPath ||
    eventPath.includes("\0") ||
    !path.isAbsolute(eventPath)
  ) {
    throw new Error("GITHUB_EVENT_PATH must be a valid absolute path");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(eventPath, "utf8")) as unknown;
  } catch {
    throw new Error(
      "GITHUB_EVENT_PATH must point to a readable, valid JSON event payload",
    );
  }
  if (!isObject(payload)) {
    throw new Error("GITHUB_EVENT_PATH push payload must be a JSON object");
  }
  const created =
    payload.created === undefined
      ? null
      : typeof payload.created === "boolean"
        ? payload.created
        : undefined;
  if (created === undefined) {
    throw new Error("GITHUB_EVENT_PATH push payload created field is invalid");
  }
  return validatePushBeforeReference(
    payload.before,
    "GITHUB_EVENT_PATH push payload before",
    created,
  );
}

function comparisonBase(
  options: LaunchGateRepositoryTransitionOptions,
  repositoryRoot: string,
  runGit: GitRunner,
): ComparisonBase {
  if (options.baseRef !== undefined) {
    if (
      options.baseRef.trim() !== options.baseRef ||
      options.baseRef.length === 0 ||
      options.baseRef.startsWith("-") ||
      options.baseRef.includes("\0")
    ) {
      throw new Error("explicit launch-gate base ref is invalid");
    }
    return { reference: options.baseRef, strategy: "merge-base" };
  }

  const environment = options.environment ?? process.env;
  const eventName = environment.GITHUB_EVENT_NAME;
  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const baseBranch = environment.GITHUB_BASE_REF;
    if (typeof baseBranch !== "string" || baseBranch.length === 0) {
      throw new Error(
        "pull-request transition validation requires GITHUB_BASE_REF",
      );
    }
    validateBranchName(baseBranch, repositoryRoot, runGit);
    return {
      reference: `refs/remotes/origin/${baseBranch}`,
      strategy: "merge-base",
    };
  }
  if (eventName === "push") {
    return {
      reference: pushBeforeReference(environment),
      strategy: "exact",
    };
  }
  throw new Error(
    "transition validation outside pull-request or push events requires an explicit baseRef",
  );
}

function parseManifestText(
  label: string,
  text: string,
): {
  errors: string[];
  manifest: unknown;
} {
  const parsed = parseCanonicalLaunchGateManifest(text);
  return {
    errors: prefixed(label, parsed.errors),
    manifest: parsed.manifest,
  };
}

export function validateLaunchGateTransitionFromRepository(
  options: LaunchGateRepositoryTransitionOptions = {},
): LaunchGateRepositoryTransitionResult {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const runGit = options.runGit ?? defaultRunGit;
  let baseCommit: string | null = null;
  let baseReference: string | null = null;

  try {
    const headCommit = runGit(
      ["rev-parse", "--verify", "HEAD^{commit}"],
      repositoryRoot,
    ).trim();
    if (!COMMIT_PATTERN.test(headCommit)) {
      throw new Error("HEAD did not resolve to a full lowercase Git commit");
    }
    const base = comparisonBase(options, repositoryRoot, runGit);
    baseReference = base.reference;
    let resolvedBase: string;
    try {
      resolvedBase = runGit(
        ["rev-parse", "--verify", `${baseReference}^{commit}`],
        repositoryRoot,
      ).trim();
    } catch {
      throw new Error(
        `comparison base ${baseReference} did not resolve to an available Git commit`,
      );
    }
    if (!COMMIT_PATTERN.test(resolvedBase)) {
      throw new Error(`${baseReference} did not resolve to a full Git commit`);
    }
    baseCommit =
      base.strategy === "exact"
        ? resolvedBase
        : runGit(
            ["merge-base", headCommit, resolvedBase],
            repositoryRoot,
          ).trim();
    if (!COMMIT_PATTERN.test(baseCommit)) {
      throw new Error("git merge-base did not return a full lowercase commit");
    }

    const previousText = runGit(
      ["show", `${baseCommit}:${MANIFEST_PATH}`],
      repositoryRoot,
    );
    const nextText = readFileSync(
      path.join(repositoryRoot, MANIFEST_PATH),
      "utf8",
    );
    const previous = parseManifestText("base manifest", previousText);
    const next = parseManifestText("current manifest", nextText);
    const parsingErrors = [...previous.errors, ...next.errors];
    const previousSchemaVersion = schemaVersion(previous.manifest);
    const nextSchemaVersion = schemaVersion(next.manifest);
    if (
      parsingErrors.length > 0 ||
      previous.manifest === null ||
      next.manifest === null
    ) {
      return {
        baseCommit,
        baseReference,
        errors: parsingErrors,
        previousSchemaVersion,
        nextSchemaVersion,
      };
    }
    return {
      baseCommit,
      baseReference,
      errors: validateLaunchGateManifestVersionTransition(
        previous.manifest,
        next.manifest,
        { nowMs: options.nowMs },
      ),
      previousSchemaVersion,
      nextSchemaVersion,
    };
  } catch (error) {
    return {
      baseCommit,
      baseReference,
      errors: [
        `launch-gate transition comparison failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      previousSchemaVersion: null,
      nextSchemaVersion: null,
    };
  }
}

export function runLaunchGateTransitionValidation(
  options: LaunchGateRepositoryTransitionOptions = {},
): number {
  const result = validateLaunchGateTransitionFromRepository(options);
  if (result.errors.length > 0) {
    process.stderr.write(
      "Launch-gate manifest transition validation failed:\n",
    );
    for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    return 1;
  }
  process.stdout.write(
    `Launch-gate manifest transition ${
      result.previousSchemaVersion
    } -> ${result.nextSchemaVersion} is valid against comparison base ${
      result.baseCommit
    }.\n`,
  );
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runLaunchGateTransitionValidation();
}
