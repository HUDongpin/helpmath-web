#!/usr/bin/env node

import {appendFile, readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX = 1000;
export const LIGHTHOUSE_EXPECTED_ROUTES = [
  '/',
  '/es',
  '/research',
  '/resources',
  '/demos',
];
export const LIGHTHOUSE_RUNS_PER_ROUTE = 3;
export const LIGHTHOUSE_MAX_RUN_ATTEMPT = 2;

const lighthouseOrigin = 'http://127.0.0.1:3216';
const qualityJobNames = ['verify', 'browser-quality', 'lighthouse'];
const gitShaPattern = /^[a-f0-9]{40}$/u;

function median(values) {
  if (values.length === 0 || values.length % 2 === 0) {
    throw new Error('Lighthouse policy requires a non-empty odd sample count');
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function parseReportUrl(rawUrl, index, field) {
  if (typeof rawUrl !== 'string') {
    throw new Error(`Lighthouse report ${index} has no ${field}`);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Lighthouse report ${index} has an invalid ${field}`);
  }

  if (
    url.origin !== lighthouseOrigin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `Lighthouse report ${index} ${field} is outside the reviewed local origin`,
    );
  }

  if (!LIGHTHOUSE_EXPECTED_ROUTES.includes(url.pathname)) {
    throw new Error(
      `Lighthouse report ${index} ${field} has unexpected route ${url.pathname}`,
    );
  }

  return url;
}

function reportRoute(report, index) {
  const requestedUrl = parseReportUrl(
    report?.requestedUrl,
    index,
    'requested URL',
  );
  const finalUrl = parseReportUrl(report?.finalUrl, index, 'final URL');
  const displayedUrl = parseReportUrl(
    report?.finalDisplayedUrl,
    index,
    'displayed URL',
  );
  if (
    requestedUrl.href !== finalUrl.href ||
    requestedUrl.href !== displayedUrl.href
  ) {
    throw new Error(
      `Lighthouse report ${index} requested and final URLs must match`,
    );
  }

  return finalUrl.pathname;
}

export function classifyLighthouseReports(reports) {
  if (!Array.isArray(reports)) {
    throw new Error('Lighthouse reports must be an array');
  }

  const benchmarksByRoute = new Map(
    LIGHTHOUSE_EXPECTED_ROUTES.map(route => [route, []]),
  );

  reports.forEach((report, index) => {
    const route = reportRoute(report, index);
    const benchmarkIndex = report?.environment?.benchmarkIndex;
    if (
      typeof benchmarkIndex !== 'number' ||
      !Number.isFinite(benchmarkIndex) ||
      benchmarkIndex <= 0
    ) {
      throw new Error(
        `Lighthouse report ${index} has an invalid benchmark index`,
      );
    }

    benchmarksByRoute.get(route).push(benchmarkIndex);
  });

  const routeBenchmarkMedians = {};
  const lighthouseVersions = new Set();
  for (const route of LIGHTHOUSE_EXPECTED_ROUTES) {
    const benchmarks = benchmarksByRoute.get(route);
    if (benchmarks.length !== LIGHTHOUSE_RUNS_PER_ROUTE) {
      throw new Error(
        `Lighthouse route ${route} has ${benchmarks.length} reports; expected ${LIGHTHOUSE_RUNS_PER_ROUTE}`,
      );
    }
    routeBenchmarkMedians[route] = median(benchmarks);
  }

  for (const [index, report] of reports.entries()) {
    if (
      typeof report.lighthouseVersion !== 'string' ||
      report.lighthouseVersion.length === 0
    ) {
      throw new Error(
        `Lighthouse report ${index} has no Lighthouse version`,
      );
    }
    lighthouseVersions.add(report.lighthouseVersion);
  }
  if (lighthouseVersions.size !== 1) {
    throw new Error('Lighthouse reports contain mixed Lighthouse versions');
  }

  const expectedReportCount =
    LIGHTHOUSE_EXPECTED_ROUTES.length * LIGHTHOUSE_RUNS_PER_ROUTE;
  if (reports.length !== expectedReportCount) {
    throw new Error(
      `Lighthouse dataset has ${reports.length} reports; expected ${expectedReportCount}`,
    );
  }

  const overallBenchmarkMedian = median(
    reports.map(report => report.environment.benchmarkIndex),
  );
  const eligible = Object.values(routeBenchmarkMedians).every(
    benchmarkIndex =>
      benchmarkIndex > LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
  );

  return {
    schemaVersion: 1,
    eligible,
    reportCount: reports.length,
    lighthouseVersion: [...lighthouseVersions][0],
    slowCpuBenchmarkIndex: LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
    overallBenchmarkMedian,
    routeBenchmarkMedians,
  };
}

export function evaluateLighthouseVerdict({eligible, assertionOutcome}) {
  if (eligible !== true) {
    return {
      ok: false,
      failureKind: eligible === false ? 'runner-capacity' : 'missing-evidence',
      reason:
        eligible === false
          ? 'The runner was below Lighthouse’s slow-host capacity boundary.'
          : 'No complete Lighthouse capacity verdict was produced.',
    };
  }

  if (assertionOutcome !== 'success') {
    return {
      ok: false,
      failureKind: 'product-budget',
      reason:
        'The runner was eligible, but one or more Lighthouse assertions failed.',
    };
  }

  return {
    ok: true,
    failureKind: null,
    reason: 'The runner was eligible and all Lighthouse assertions passed.',
  };
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === [...expectedKeys].sort()[index])
  );
}

function positiveIntegerString(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/u.test(value);
}

function readRunContext() {
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    workflow: process.env.GITHUB_WORKFLOW,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    headSha: process.env.GITHUB_SHA,
    runner: {
      name: process.env.RUNNER_NAME,
      os: process.env.RUNNER_OS,
      arch: process.env.RUNNER_ARCH,
    },
  };

  if (
    typeof context.repository !== 'string' ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(context.repository) ||
    context.workflow !== 'Quality' ||
    !positiveIntegerString(context.runId) ||
    !Number.isSafeInteger(context.runAttempt) ||
    context.runAttempt < 1 ||
    typeof context.headSha !== 'string' ||
    !gitShaPattern.test(context.headSha) ||
    !Object.values(context.runner).every(
      value => typeof value === 'string' && value.length > 0 && value.length <= 200,
    )
  ) {
    throw new Error('GitHub Actions run identity is incomplete or invalid');
  }

  return context;
}

function validatePriorCapacityEvidence(evidence, current) {
  const topLevelKeys = [
    'schemaVersion',
    'repository',
    'workflow',
    'runId',
    'runAttempt',
    'headSha',
    'runner',
    'classification',
  ];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schemaVersion !== 2) {
    throw new Error('Attempt-one capacity evidence has an invalid envelope');
  }
  if (
    evidence.repository !== current.repository ||
    evidence.workflow !== current.workflow ||
    evidence.runId !== current.runId ||
    evidence.runAttempt !== 1 ||
    evidence.headSha !== current.headSha
  ) {
    throw new Error('Attempt-one capacity evidence identity does not match');
  }
  if (
    !hasExactKeys(evidence.runner, ['name', 'os', 'arch']) ||
    !Object.values(evidence.runner).every(
      value => typeof value === 'string' && value.length > 0 && value.length <= 200,
    )
  ) {
    throw new Error('Attempt-one capacity evidence has invalid runner identity');
  }

  const classification = evidence.classification;
  if (
    !hasExactKeys(classification, [
      'schemaVersion',
      'eligible',
      'reportCount',
      'lighthouseVersion',
      'slowCpuBenchmarkIndex',
      'overallBenchmarkMedian',
      'routeBenchmarkMedians',
    ]) ||
    classification.schemaVersion !== 1 ||
    classification.eligible !== false ||
    classification.reportCount !==
      LIGHTHOUSE_EXPECTED_ROUTES.length * LIGHTHOUSE_RUNS_PER_ROUTE ||
    typeof classification.lighthouseVersion !== 'string' ||
    classification.lighthouseVersion.length === 0 ||
    classification.slowCpuBenchmarkIndex !==
      LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX ||
    typeof classification.overallBenchmarkMedian !== 'number' ||
    !Number.isFinite(classification.overallBenchmarkMedian) ||
    !hasExactKeys(
      classification.routeBenchmarkMedians,
      LIGHTHOUSE_EXPECTED_ROUTES,
    )
  ) {
    throw new Error('Attempt-one capacity classification is invalid');
  }
  const routeMedians = Object.values(classification.routeBenchmarkMedians);
  if (
    !routeMedians.every(
      value => typeof value === 'number' && Number.isFinite(value) && value > 0,
    ) ||
    routeMedians.every(
      value => value > LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
    )
  ) {
    throw new Error('Attempt-one capacity classification is inconsistent');
  }
}

function validateJobsEnvelope(
  envelope,
  current,
  expectedAttempt,
  expectedConclusions,
  earliestStartMs = null,
) {
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    Array.isArray(envelope) ||
    envelope.total_count !== qualityJobNames.length ||
    !Array.isArray(envelope.jobs) ||
    envelope.jobs.length !== qualityJobNames.length
  ) {
    throw new Error(
      `Quality attempt ${expectedAttempt} must contain exactly three jobs`,
    );
  }

  const jobsByName = new Map();
  for (const job of envelope.jobs) {
    if (
      !job ||
      typeof job !== 'object' ||
      Array.isArray(job) ||
      typeof job.name !== 'string' ||
      !qualityJobNames.includes(job.name) ||
      jobsByName.has(job.name)
    ) {
      throw new Error(
        `Quality attempt ${expectedAttempt} must contain one unique job for each required name`,
      );
    }
    jobsByName.set(job.name, job);
  }

  let latestCompletionMs = 0;
  for (const [index, expectedName] of qualityJobNames.entries()) {
    const job = jobsByName.get(expectedName);
    if (
      !job ||
      job.run_attempt !== expectedAttempt ||
      String(job.run_id) !== current.runId ||
      job.head_sha !== current.headSha
    ) {
      throw new Error(
        `Quality attempt ${expectedAttempt} does not preserve full-workflow job identity`,
      );
    }
    if (
      expectedConclusions &&
      (job.status !== 'completed' ||
        job.conclusion !== expectedConclusions[index])
    ) {
      throw new Error(
        `Quality attempt ${expectedAttempt} has an unexpected ${expectedName} conclusion`,
      );
    }

    const startedAtMs = Date.parse(job.started_at);
    if (!Number.isFinite(startedAtMs)) {
      throw new Error(
        `Quality attempt ${expectedAttempt} ${expectedName} has no start time`,
      );
    }
    if (earliestStartMs !== null && startedAtMs < earliestStartMs) {
      throw new Error(
        `Quality attempt ${expectedAttempt} reused an earlier job instead of rerunning the full workflow`,
      );
    }

    if (expectedConclusions) {
      const completedAtMs = Date.parse(job.completed_at);
      if (!Number.isFinite(completedAtMs) || completedAtMs < startedAtMs) {
        throw new Error(
          `Quality attempt ${expectedAttempt} ${expectedName} has invalid completion time`,
        );
      }
      latestCompletionMs = Math.max(latestCompletionMs, completedAtMs);
    }
  }

  return latestCompletionMs;
}

export function authorizeLighthouseAttempt({
  current,
  priorCapacityEvidence,
  priorJobs,
  currentJobs,
}) {
  if (current.runAttempt === 1) {
    return {
      authorized: true,
      authorizationKind: 'initial',
      reason: 'Initial Quality workflow attempt.',
    };
  }
  if (current.runAttempt !== LIGHTHOUSE_MAX_RUN_ATTEMPT) {
    return {
      authorized: false,
      authorizationKind: null,
      reason: `Quality workflow attempt ${current.runAttempt} exceeds the maximum of ${LIGHTHOUSE_MAX_RUN_ATTEMPT}.`,
    };
  }

  try {
    validatePriorCapacityEvidence(priorCapacityEvidence, current);
    const priorCompletedAtMs = validateJobsEnvelope(
      priorJobs,
      current,
      1,
      ['success', 'success', 'failure'],
    );
    validateJobsEnvelope(currentJobs, current, 2, null, priorCompletedAtMs);
  } catch (error) {
    return {
      authorized: false,
      authorizationKind: null,
      reason: error instanceof Error ? error.message : 'Invalid rerun evidence',
    };
  }

  return {
    authorized: true,
    authorizationKind: 'capacity-replacement',
    reason:
      'Attempt two is a complete workflow rerun authorized by attempt-one slow-runner evidence.',
  };
}

async function loadLighthouseReports(reportDirectory) {
  const entries = await readdir(reportDirectory, {withFileTypes: true});
  const reportNames = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.report.json'))
    .map(entry => entry.name)
    .sort();

  return Promise.all(
    reportNames.map(async reportName => {
      const source = await readFile(
        path.join(reportDirectory, reportName),
        'utf8',
      );
      return JSON.parse(source);
    }),
  );
}

async function appendGitHubOutputs(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT is required for Lighthouse classification');
  }

  const lines = Object.entries(values).map(
    ([key, value]) => `${key}=${String(value)}`,
  );
  await appendFile(outputPath, `${lines.join('\n')}\n`);
}

async function classifyCommand(reportDirectory) {
  if (!reportDirectory) {
    throw new Error('A Lighthouse report directory is required');
  }

  const resolvedReportDirectory = path.resolve(reportDirectory);
  const reports = await loadLighthouseReports(resolvedReportDirectory);
  const result = classifyLighthouseReports(reports);
  const routeMedians = JSON.stringify(result.routeBenchmarkMedians);
  const context = readRunContext();
  const evidence = {
    schemaVersion: 2,
    ...context,
    classification: result,
  };

  await writeFile(
    path.join(resolvedReportDirectory, 'capacity-verdict.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );

  await appendGitHubOutputs({
    eligible: result.eligible,
    report_count: result.reportCount,
    overall_benchmark_median: result.overallBenchmarkMedian,
    route_benchmark_medians: routeMedians,
  });

  if (process.env.GITHUB_STEP_SUMMARY) {
    const status = result.eligible ? 'eligible' : 'ineligible';
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Lighthouse runner capacity',
        '',
        `- Status: ${status}`,
        `- Slow-host boundary: benchmark index must be greater than ${result.slowCpuBenchmarkIndex} for every route median`,
        `- Route medians: \`${routeMedians}\``,
        `- Reports: ${result.reportCount}`,
        '',
      ].join('\n'),
    );
  }

  console.log(JSON.stringify(result, null, 2));
}

function parseEligibility(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

async function verdictCommand(reportDirectory) {
  const context = readRunContext();
  const eligible = parseEligibility(process.env.RUNNER_ELIGIBLE);
  const assertionOutcome = process.env.LIGHTHOUSE_ASSERTION_OUTCOME ?? '';
  const result = evaluateLighthouseVerdict({
    eligible,
    assertionOutcome,
  });
  const evidence = {
    schemaVersion: 2,
    ...context,
    eligible,
    assertionOutcome,
    ...result,
  };

  if (reportDirectory) {
    await writeFile(
      path.join(path.resolve(reportDirectory), 'quality-verdict.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
  }

  console.log(JSON.stringify(evidence, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function readJsonFile(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`Missing ${label}`);
  }
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) {
    throw new Error(`${label} exceeds the one-megabyte limit`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

async function authorizeAttemptCommand(evidenceDirectory, priorCapacityPath) {
  if (!evidenceDirectory) {
    throw new Error('An attempt-authorization evidence directory is required');
  }
  const current = readRunContext();
  const resolvedEvidenceDirectory = path.resolve(evidenceDirectory);
  let priorCapacityEvidence = null;
  let priorJobs = null;
  let currentJobs = null;

  if (current.runAttempt === LIGHTHOUSE_MAX_RUN_ATTEMPT) {
    if (!priorCapacityPath) {
      throw new Error('The attempt-one capacity evidence path is required');
    }
    priorCapacityEvidence = await readJsonFile(
      path.resolve(priorCapacityPath),
      'attempt-one capacity evidence',
    );
    priorJobs = await readJsonFile(
      path.join(resolvedEvidenceDirectory, 'attempt-1-jobs.json'),
      'attempt-one jobs evidence',
    );
    currentJobs = await readJsonFile(
      path.join(resolvedEvidenceDirectory, 'attempt-2-jobs.json'),
      'attempt-two jobs evidence',
    );
  }

  const result = authorizeLighthouseAttempt({
    current,
    priorCapacityEvidence,
    priorJobs,
    currentJobs,
  });
  const evidence = {
    schemaVersion: 1,
    ...current,
    ...result,
  };
  await writeFile(
    path.join(resolvedEvidenceDirectory, 'attempt-authorization.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(JSON.stringify(evidence, null, 2));
  if (!result.authorized) process.exitCode = 1;
}

async function main() {
  const [command, argument, secondArgument] = process.argv.slice(2);
  if (command === 'classify') {
    await classifyCommand(argument);
    return;
  }
  if (command === 'verdict') {
    await verdictCommand(argument);
    return;
  }
  if (command === 'authorize-attempt') {
    await authorizeAttemptCommand(argument, secondArgument);
    return;
  }
  throw new Error(
    'Expected Lighthouse policy command: authorize-attempt, classify, or verdict',
  );
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
