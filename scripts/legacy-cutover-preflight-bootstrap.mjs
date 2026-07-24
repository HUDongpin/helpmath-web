#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function git(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
  });
  return result.status === 0 && !result.error && !result.signal
    ? result.stdout.trim()
    : null;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(detail) {
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 3,
      evidenceKind: "help-math-legacy-cutover-preflight",
      phase: "pre-change-authorization",
      failedAt: new Date().toISOString(),
      decision: "NO_GO",
      failures: [`bootstrap: ${detail}`],
      retainedEvidence: null,
    })}\n`,
  );
  process.exitCode = 2;
}

const pinnedHead = git(["rev-parse", "HEAD"]);
const workingTreeStatus = git(["status", "--porcelain"]);
if (!pinnedHead || !/^[a-f0-9]{40}$/u.test(pinnedHead)) {
  fail("could not pin a valid repository HEAD");
} else if (workingTreeStatus !== "") {
  fail("repository must be clean before local preflight modules are loaded");
} else {
  try {
    const [entryBytes, libraryBytes] = await Promise.all([
      readFile(new URL("./legacy-cutover-preflight.ts", import.meta.url)),
      readFile(new URL("../lib/legacy-cutover-preflight.ts", import.meta.url)),
    ]);
    process.env.HELP_MATH_LEGACY_PREFLIGHT_PINNED_HEAD = pinnedHead;
    process.env.HELP_MATH_LEGACY_PREFLIGHT_ENTRY_SHA256 = sha256(entryBytes);
    process.env.HELP_MATH_LEGACY_PREFLIGHT_LIBRARY_SHA256 =
      sha256(libraryBytes);
    await import("./legacy-cutover-preflight.ts");
  } catch (error) {
    fail(
      `module loading failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
