import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';

import launchGateManifest from '../config/launch-gates.json' with {type: 'json'};
import {
  canonicalJson,
  computeLegacyAuthorizationValidityRemainingMs,
  computeLegacyCutoverValidUntil,
  evaluateLegacyCutoverPreflight,
  type EvidenceVerification,
  MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
  prepareLegacyCutoverReceiptDirectory,
  readRestrictedExternalFile,
  REQUIRED_LEGACY_PREFLIGHT_COMMANDS,
  type LegacyCutoverPlan,
  validateLegacyCutoverPlan,
  verifyLegacyCutoverEvidence,
  writeLegacyCutoverReceipt,
} from '../lib/legacy-cutover-preflight';
import {validateLaunchGateManifest} from '../lib/launch-gate-validation';
import {legacyRedirects} from '../next.config';

type Arguments = {
  planPath: string | null;
  evidenceDirectory: string | null;
};

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = {planPath: null, evidenceDirectory: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--plan' || argument === '--evidence-dir') {
      const value = argv[index + 1]?.trim();
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      if (argument === '--plan') parsed.planPath = value;
      else parsed.evidenceDirectory = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function sha256(contents: string | Buffer): string {
  return createHash('sha256').update(contents).digest('hex');
}

function run(command: string, args: string[]): {ok: boolean; detail: string} {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {...process.env, NO_COLOR: '1'},
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const ok = result.status === 0 && !result.error && !result.signal;
  const status = result.status === null ? 'null' : String(result.status);
  const signal = result.signal ?? 'none';
  const error = result.error?.message ?? 'none';
  return {
    ok,
    detail:
      `status ${status}; signal ${signal}; error ${error}; ` +
      `output SHA-256 ${sha256(output)}`,
  };
}

function gitOutput(args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
  });
  return result.status === 0 && !result.error && !result.signal ? result.stdout.trim() : null;
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
      planErrors: ['--plan is required for a GO_TO_CHANGE decision'],
      bytes: null,
      canonicalPath: null,
    };
  }
  if (!path.isAbsolute(planPath)) {
    return {
      plan: null,
      planErrors: ['--plan must be an absolute external path'],
      bytes: null,
      canonicalPath: null,
    };
  }
  try {
    const externalPlan = await readRestrictedExternalFile(path.resolve(planPath), {
      repositoryRoot,
      maxBytes: 1024 * 1024,
      label: 'cutover plan',
    });
    const value = JSON.parse(externalPlan.bytes.toString('utf8')) as unknown;
    const planErrors = validateLegacyCutoverPlan(value, {nowMs});
    return {
      plan: planErrors.length === 0 ? value as LegacyCutoverPlan : null,
      planErrors,
      bytes: externalPlan.bytes,
      canonicalPath: externalPlan.canonicalPath,
    };
  } catch (error) {
    return {
      plan: null,
      planErrors: [`could not load plan: ${error instanceof Error ? error.message : String(error)}`],
      bytes: null,
      canonicalPath: null,
    };
  }
}

function unavailableEvidence(detail: string): EvidenceVerification {
  return {ok: false, detail, entries: []};
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const repositoryRoot = await realpath(process.cwd());
  const startedAt = new Date().toISOString();
  const initialNowMs = Date.parse(startedAt);
  const loadedPlan = await loadPlan(args.planPath, repositoryRoot, initialNowMs);
  const manifestText = await readFile(
    new URL('../config/launch-gates.json', import.meta.url),
    'utf8',
  );

  let receiptDirectoryReady = false;
  let receiptDirectoryError: string | null = null;
  if (args.evidenceDirectory) {
    try {
      await prepareLegacyCutoverReceiptDirectory(args.evidenceDirectory, {repositoryRoot});
      receiptDirectoryReady = true;
    } catch (error) {
      receiptDirectoryError = error instanceof Error ? error.message : String(error);
    }
  }

  const redirects = await legacyRedirects();
  const salesDestinationObserved = redirects.find((redirect) => redirect.source === '/Sales.htm')
    ?.destination ?? null;
  const commandResults = Object.fromEntries(
    REQUIRED_LEGACY_PREFLIGHT_COMMANDS.map((name) => [
      name,
      run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name]),
    ]),
  );

  const verificationNowMs = Date.now();
  const evidenceVerification = loadedPlan.plan
    ? await verifyLegacyCutoverEvidence(loadedPlan.plan, {
        nowMs: verificationNowMs,
        repositoryRoot,
      })
    : unavailableEvidence('external evidence was not evaluated because the plan is missing or invalid');
  const finalDecisionNowMs = Date.now();
  const finalPlanErrors = loadedPlan.plan
    ? [...new Set([
        ...loadedPlan.planErrors,
        ...validateLegacyCutoverPlan(loadedPlan.plan, {nowMs: finalDecisionNowMs}),
      ])]
    : loadedPlan.planErrors;
  const head = gitOutput(['rev-parse', 'HEAD']);
  const workingTreeStatus = gitOutput(['status', '--porcelain']);
  const validUntil = loadedPlan.plan
    ? computeLegacyCutoverValidUntil(loadedPlan.plan)
    : null;
  const authorizationValidityRemainingMs = loadedPlan.plan
    ? computeLegacyAuthorizationValidityRemainingMs(loadedPlan.plan, finalDecisionNowMs)
    : -1;

  const evaluation = evaluateLegacyCutoverPreflight({
    plan: loadedPlan.plan,
    planErrors: finalPlanErrors,
    manifestErrors: validateLaunchGateManifest(launchGateManifest),
    gateStatuses: Object.fromEntries(
      Object.entries(launchGateManifest.gates).map(([id, gate]) => [id, gate.status]),
    ),
    gateDependencies: Object.fromEntries(
      Object.entries(launchGateManifest.gates).map(([id, gate]) => [id, [...gate.dependencies]]),
    ),
    repository: {head, clean: workingTreeStatus === ''},
    commandResults,
    evidenceVerification,
    salesDestinationObserved,
    receiptDirectoryReady,
    authorizationValidityRemainingMs,
  });

  const [scriptBytes, libraryBytes] = await Promise.all([
    readFile(new URL(import.meta.url)),
    readFile(new URL('../lib/legacy-cutover-preflight.ts', import.meta.url)),
  ]);
  const receipt = {
    schemaVersion: 3,
    evidenceKind: 'help-math-legacy-cutover-preflight',
    phase: 'pre-change-authorization',
    startedAt,
    decisionAt: new Date().toISOString(),
    validUntil,
    cutoverId: loadedPlan.plan?.cutoverId ?? null,
    topology: loadedPlan.plan?.topology ?? null,
    decision: evaluation.decision,
    repository: {
      head,
      clean: workingTreeStatus === '',
    },
    tool: {
      scriptSha256: sha256(scriptBytes),
      librarySha256: sha256(libraryBytes),
    },
    inputs: {
      plan: loadedPlan.canonicalPath
        ? {reference: loadedPlan.canonicalPath, sha256: loadedPlan.bytes ? sha256(loadedPlan.bytes) : null}
        : null,
      launchGateManifest: {
        reference: 'config/launch-gates.json',
        sha256: sha256(manifestText),
      },
      externalEvidence: evidenceVerification.entries,
      receiptDirectoryError,
    },
    checks: evaluation.checks,
    failures: evaluation.failures,
  };

  let retainedEvidence = null;
  if (receiptDirectoryReady && args.evidenceDirectory) {
    try {
      retainedEvidence = await writeLegacyCutoverReceipt(args.evidenceDirectory, receipt, {
        repositoryRoot,
        ...(evaluation.decision === 'GO_TO_CHANGE' && validUntil
          ? {
              notAfter: validUntil,
              minimumRemainingMs: MIN_LEGACY_AUTHORIZATION_VALIDITY_MS,
            }
          : {}),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      process.stdout.write(canonicalJson({
        ...receipt,
        failedAt: new Date().toISOString(),
        decision: 'NO_GO',
        failures: [...evaluation.failures, `receipt-write: ${detail}`],
        retainedEvidence: null,
      }));
      process.exitCode = 2;
      return;
    }
  }
  process.stdout.write(canonicalJson({...receipt, retainedEvidence}));
  if (evaluation.decision !== 'GO_TO_CHANGE') process.exitCode = 2;
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stdout.write(canonicalJson({
    schemaVersion: 3,
    evidenceKind: 'help-math-legacy-cutover-preflight',
    phase: 'pre-change-authorization',
    failedAt: new Date().toISOString(),
    decision: 'NO_GO',
    failures: [`fatal: ${detail}`],
    retainedEvidence: null,
  }));
  process.exitCode = 2;
});
