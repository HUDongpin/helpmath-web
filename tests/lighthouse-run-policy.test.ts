import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';
import {promisify} from 'node:util';
import {
  LIGHTHOUSE_EXPECTED_ROUTES,
  LIGHTHOUSE_MAX_RUN_ATTEMPT,
  LIGHTHOUSE_RUNS_PER_ROUTE,
  LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
  authorizeLighthouseAttempt,
  classifyLighthouseReports,
  evaluateLighthouseVerdict,
} from '../scripts/lighthouse-run-policy.mjs';

const repositoryRoot = process.cwd();
const execFileAsync = promisify(execFile);
const headSha = 'a'.repeat(40);

function reportsWithBenchmarks(
  overrides: Partial<Record<string, number[]>> = {},
) {
  return LIGHTHOUSE_EXPECTED_ROUTES.flatMap(route => {
    const benchmarks = overrides[route] ?? [1300, 1400, 1500];
    return benchmarks.map(benchmarkIndex => ({
      finalDisplayedUrl: `http://127.0.0.1:3216${route}`,
      finalUrl: `http://127.0.0.1:3216${route}`,
      requestedUrl: `http://127.0.0.1:3216${route}`,
      lighthouseVersion: '12.6.1',
      environment: {benchmarkIndex},
    }));
  });
}

function runContext(runAttempt: number) {
  return {
    repository: 'HUDongpin/helpmath-web',
    workflow: 'Quality',
    runId: '30000000000',
    runAttempt,
    headSha,
    runner: {
      name: `runner-${runAttempt}`,
      os: 'macOS',
      arch: 'X64',
    },
  };
}

function jobsEnvelope(
  runAttempt: number,
  conclusions: Array<string | null>,
  startIso: string,
) {
  const startMs = Date.parse(startIso);
  return {
    total_count: 3,
    jobs: ['verify', 'browser-quality', 'lighthouse'].map(
      (name, index) => ({
        name,
        run_id: 30000000000,
        run_attempt: runAttempt,
        head_sha: headSha,
        status: conclusions[index] === null ? 'in_progress' : 'completed',
        conclusion: conclusions[index],
        started_at: new Date(startMs + index * 1_000).toISOString(),
        completed_at:
          conclusions[index] === null
            ? null
            : new Date(startMs + index * 1_000 + 10_000).toISOString(),
      }),
    ),
  };
}

function slowCapacityEvidence() {
  return {
    schemaVersion: 2,
    ...runContext(1),
    classification: classifyLighthouseReports(
      reportsWithBenchmarks({'/': [800, 900, 1500]}),
    ),
  };
}

describe('Lighthouse runner capacity policy', () => {
  it('pins the same slow-host boundary as the installed Lighthouse release', async () => {
    assert.equal(LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX, 1000);

    const lighthouseEnvironment = await readFile(
      path.join(
        repositoryRoot,
        'node_modules/lighthouse/core/gather/driver/environment.js',
      ),
      'utf8',
    );
    assert.match(
      lighthouseEnvironment,
      /const SLOW_CPU_BENCHMARK_INDEX_THRESHOLD = 1000;/u,
    );
  });

  it('accepts exactly three reports per reviewed route above the boundary', () => {
    const result = classifyLighthouseReports(reportsWithBenchmarks());

    assert.equal(result.eligible, true);
    assert.equal(
      result.reportCount,
      LIGHTHOUSE_EXPECTED_ROUTES.length * LIGHTHOUSE_RUNS_PER_ROUTE,
    );
    assert.deepEqual(result.routeBenchmarkMedians, {
      '/': 1400,
      '/es': 1400,
      '/research': 1400,
      '/resources': 1400,
      '/demos': 1400,
    });
  });

  it('allows one slow sample but rejects a slow route median', () => {
    assert.equal(
      classifyLighthouseReports(
        reportsWithBenchmarks({'/research': [900, 1400, 1500]}),
      ).eligible,
      true,
    );
    assert.equal(
      classifyLighthouseReports(
        reportsWithBenchmarks({'/research': [900, 1000, 1500]}),
      ).eligible,
      false,
    );
  });

  it('rejects incomplete, foreign, malformed, and mixed-version report sets', () => {
    const incomplete = reportsWithBenchmarks();
    incomplete.pop();
    assert.throws(
      () => classifyLighthouseReports(incomplete),
      /has 2 reports; expected 3/u,
    );

    const foreign = reportsWithBenchmarks();
    foreign[0].requestedUrl = 'https://example.com/';
    assert.throws(
      () => classifyLighthouseReports(foreign),
      /outside the reviewed local origin/u,
    );

    const malformed = reportsWithBenchmarks();
    malformed[0].environment.benchmarkIndex = Number.NaN;
    assert.throws(
      () => classifyLighthouseReports(malformed),
      /invalid benchmark index/u,
    );

    const mixedVersion = reportsWithBenchmarks();
    mixedVersion[0].lighthouseVersion = '13.0.0';
    assert.throws(
      () => classifyLighthouseReports(mixedVersion),
      /mixed Lighthouse versions/u,
    );

    const redirected = reportsWithBenchmarks();
    redirected[0].finalUrl = 'http://127.0.0.1:3216/es';
    assert.throws(
      () => classifyLighthouseReports(redirected),
      /requested and final URLs must match/u,
    );
  });

  it('writes identity-bound capacity and quality evidence through the CLI', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'helpmath-lighthouse-policy-'),
    );
    const outputPath = path.join(directory, 'github-output.txt');
    try {
      const reports = reportsWithBenchmarks();
      await Promise.all(
        reports.map((report, index) =>
          writeFile(
            path.join(directory, `${String(index)}.report.json`),
            JSON.stringify(report),
          ),
        ),
      );
      const env = {
        ...process.env,
        GITHUB_REPOSITORY: 'HUDongpin/helpmath-web',
        GITHUB_WORKFLOW: 'Quality',
        GITHUB_RUN_ID: '30000000000',
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_SHA: headSha,
        RUNNER_NAME: 'test-runner',
        RUNNER_OS: 'macOS',
        RUNNER_ARCH: 'X64',
        GITHUB_OUTPUT: outputPath,
      };

      await execFileAsync(
        process.execPath,
        [
          'scripts/lighthouse-run-policy.mjs',
          'classify',
          directory,
        ],
        {cwd: repositoryRoot, env},
      );
      await execFileAsync(
        process.execPath,
        [
          'scripts/lighthouse-run-policy.mjs',
          'verdict',
          directory,
        ],
        {
          cwd: repositoryRoot,
          env: {
            ...env,
            RUNNER_ELIGIBLE: 'true',
            LIGHTHOUSE_ASSERTION_OUTCOME: 'success',
          },
        },
      );

      const capacity = JSON.parse(
        await readFile(
          path.join(directory, 'capacity-verdict.json'),
          'utf8',
        ),
      );
      const quality = JSON.parse(
        await readFile(path.join(directory, 'quality-verdict.json'), 'utf8'),
      );
      assert.equal(capacity.schemaVersion, 2);
      assert.equal(capacity.runId, '30000000000');
      assert.equal(capacity.classification.eligible, true);
      assert.equal(quality.schemaVersion, 2);
      assert.equal(quality.ok, true);
      assert.match(
        await readFile(outputPath, 'utf8'),
        /^eligible=true$/mu,
      );
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  });
});

describe('Lighthouse capacity-aware verdict', () => {
  it('accepts an eligible runner only when its assertions pass', () => {
    assert.deepEqual(
      evaluateLighthouseVerdict({
        eligible: true,
        assertionOutcome: 'success',
      }),
      {
        ok: true,
        failureKind: null,
        reason: 'The runner was eligible and all Lighthouse assertions passed.',
      },
    );
  });

  it('classifies an eligible assertion failure as a product failure', () => {
    const result = evaluateLighthouseVerdict({
      eligible: true,
      assertionOutcome: 'failure',
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureKind, 'product-budget');
  });

  it('fails closed and distinguishes slow from missing capacity evidence', () => {
    assert.equal(
      evaluateLighthouseVerdict({
        eligible: false,
        assertionOutcome: 'failure',
      }).failureKind,
      'runner-capacity',
    );
    assert.equal(
      evaluateLighthouseVerdict({
        eligible: null,
        assertionOutcome: '',
      }).failureKind,
      'missing-evidence',
    );
  });
});

describe('Lighthouse workflow-attempt authorization', () => {
  it('allows the initial attempt without prior evidence', () => {
    assert.equal(
      authorizeLighthouseAttempt({
        current: runContext(1),
        priorCapacityEvidence: null,
        priorJobs: null,
        currentJobs: null,
      }).authorizationKind,
      'initial',
    );
  });

  it('allows exactly one complete rerun after an ineligible first attempt', () => {
    const priorJobs = jobsEnvelope(
      1,
      ['success', 'success', 'failure'],
      '2026-07-24T00:00:00.000Z',
    );
    const currentJobs = jobsEnvelope(
      2,
      [null, null, null],
      '2026-07-24T00:01:00.000Z',
    );
    priorJobs.jobs.reverse();
    currentJobs.jobs.splice(
      0,
      currentJobs.jobs.length,
      currentJobs.jobs[1],
      currentJobs.jobs[2],
      currentJobs.jobs[0],
    );
    const result = authorizeLighthouseAttempt({
      current: runContext(2),
      priorCapacityEvidence: slowCapacityEvidence(),
      priorJobs,
      currentJobs,
    });

    assert.equal(result.authorized, true);
    assert.equal(result.authorizationKind, 'capacity-replacement');
  });

  it('rejects an eligible first attempt and a focused job rerun', () => {
    const eligibleEvidence = {
      schemaVersion: 2,
      ...runContext(1),
      classification: classifyLighthouseReports(reportsWithBenchmarks()),
    };
    assert.equal(
      authorizeLighthouseAttempt({
        current: runContext(2),
        priorCapacityEvidence: eligibleEvidence,
        priorJobs: jobsEnvelope(
          1,
          ['success', 'success', 'failure'],
          '2026-07-24T00:00:00.000Z',
        ),
        currentJobs: jobsEnvelope(
          2,
          [null, null, null],
          '2026-07-24T00:01:00.000Z',
        ),
      }).authorized,
      false,
    );

    const focusedJobs = jobsEnvelope(
      2,
      [null, 'success', 'success'],
      '2026-07-24T00:00:00.000Z',
    );
    [focusedJobs.jobs[0], focusedJobs.jobs[2]] = [
      focusedJobs.jobs[2],
      focusedJobs.jobs[0],
    ];
    assert.equal(
      authorizeLighthouseAttempt({
        current: runContext(2),
        priorCapacityEvidence: slowCapacityEvidence(),
        priorJobs: jobsEnvelope(
          1,
          ['success', 'success', 'failure'],
          '2026-07-24T00:00:00.000Z',
        ),
        currentJobs: focusedJobs,
      }).authorized,
      false,
    );
  });

  it('rejects every attempt after the one allowed replacement', () => {
    const result = authorizeLighthouseAttempt({
      current: runContext(LIGHTHOUSE_MAX_RUN_ATTEMPT + 1),
      priorCapacityEvidence: slowCapacityEvidence(),
      priorJobs: null,
      currentJobs: null,
    });

    assert.equal(result.authorized, false);
    assert.match(result.reason, /exceeds the maximum/u);
  });
});
