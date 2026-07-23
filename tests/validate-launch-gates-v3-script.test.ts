import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import launchGateManifestV2 from "../config/launch-gates.json";
import {
  migrateLaunchGateManifestV2ToV3,
  type LaunchGateLifecycleManifestV3,
} from "../lib/launch-gate-lifecycle-v3";
import { LAUNCH_GATE_BLOCKER_REFS } from "../lib/launch-gate-policy";

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

describe("launch-gate v3 repository validator", () => {
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
