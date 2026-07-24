#!/usr/bin/env node

import {createHash} from 'node:crypto';
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
export const LIGHTHOUSE_RUNS_PER_ROUTE = 5;
export const LIGHTHOUSE_MAX_ROUTE_OUTLIERS = 1;
export const LIGHTHOUSE_TBT_MAX_NUMERIC_VALUE = 200;
export const LIGHTHOUSE_MAX_RUN_ATTEMPT = 2;
export const LIGHTHOUSE_CAPACITY_LOG_MARKER =
  'HELP_MATH_LIGHTHOUSE_CAPACITY_V1=';

const lighthouseOrigin = 'http://127.0.0.1:3216';
const qualityJobNames = ['verify', 'browser-quality', 'lighthouse'];
const gitShaPattern = /^[a-f0-9]{40}$/u;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/u;
const maxEvidenceBytes = 1024 * 1024;
const maxJobLogBytes = 10 * 1024 * 1024;

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
  const routeSlowSampleCounts = {};
  const lighthouseVersions = new Set();
  for (const route of LIGHTHOUSE_EXPECTED_ROUTES) {
    const benchmarks = benchmarksByRoute.get(route);
    if (benchmarks.length !== LIGHTHOUSE_RUNS_PER_ROUTE) {
      throw new Error(
        `Lighthouse route ${route} has ${benchmarks.length} reports; expected ${LIGHTHOUSE_RUNS_PER_ROUTE}`,
      );
    }
    routeBenchmarkMedians[route] = median(benchmarks);
    routeSlowSampleCounts[route] = benchmarks.filter(
      benchmarkIndex => benchmarkIndex <= LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
    ).length;
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
  const eligible =
    Object.values(routeBenchmarkMedians).every(
      benchmarkIndex =>
        benchmarkIndex > LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
    ) &&
    Object.values(routeSlowSampleCounts).every(
      count => count <= LIGHTHOUSE_MAX_ROUTE_OUTLIERS,
    );

  return {
    schemaVersion: 2,
    eligible,
    reportCount: reports.length,
    lighthouseVersion: [...lighthouseVersions][0],
    slowCpuBenchmarkIndex: LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
    maxSlowSamplesPerRoute: LIGHTHOUSE_MAX_ROUTE_OUTLIERS,
    overallBenchmarkMedian,
    routeBenchmarkMedians,
    routeSlowSampleCounts,
  };
}

export function classifyLighthouseTbtDistribution(reports) {
  if (!Array.isArray(reports)) {
    throw new Error('Lighthouse reports must be an array');
  }

  const tbtValuesByRoute = new Map(
    LIGHTHOUSE_EXPECTED_ROUTES.map(route => [route, []]),
  );
  reports.forEach((report, index) => {
    const route = reportRoute(report, index);
    const numericValue = report?.audits?.['total-blocking-time']?.numericValue;
    if (
      typeof numericValue !== 'number' ||
      !Number.isFinite(numericValue) ||
      numericValue < 0
    ) {
      throw new Error(
        `Lighthouse report ${index} has invalid total blocking time`,
      );
    }
    tbtValuesByRoute.get(route).push(numericValue);
  });

  const routeOutlierCounts = {};
  for (const route of LIGHTHOUSE_EXPECTED_ROUTES) {
    const values = tbtValuesByRoute.get(route);
    if (values.length !== LIGHTHOUSE_RUNS_PER_ROUTE) {
      throw new Error(
        `Lighthouse route ${route} has ${values.length} TBT reports; expected ${LIGHTHOUSE_RUNS_PER_ROUTE}`,
      );
    }
    routeOutlierCounts[route] = values.filter(
      value => value > LIGHTHOUSE_TBT_MAX_NUMERIC_VALUE,
    ).length;
  }

  const expectedReportCount =
    LIGHTHOUSE_EXPECTED_ROUTES.length * LIGHTHOUSE_RUNS_PER_ROUTE;
  if (reports.length !== expectedReportCount) {
    throw new Error(
      `Lighthouse TBT dataset has ${reports.length} reports; expected ${expectedReportCount}`,
    );
  }

  return {
    schemaVersion: 1,
    ok: Object.values(routeOutlierCounts).every(
      count => count <= LIGHTHOUSE_MAX_ROUTE_OUTLIERS,
    ),
    maxNumericValue: LIGHTHOUSE_TBT_MAX_NUMERIC_VALUE,
    maxOutliersPerRoute: LIGHTHOUSE_MAX_ROUTE_OUTLIERS,
    routeOutlierCounts,
  };
}

export function evaluateLighthouseVerdict({
  eligible,
  assertionOutcome,
  tbtDistributionOk,
}) {
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

  if (tbtDistributionOk !== true) {
    return {
      ok: false,
      failureKind:
        tbtDistributionOk === false ? 'product-budget' : 'missing-evidence',
      reason:
        tbtDistributionOk === false
          ? 'More than one run for a reviewed route exceeded the total blocking time budget.'
          : 'No complete Lighthouse total blocking time distribution verdict was produced.',
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
    reason:
      'The runner was eligible, the TBT distribution was stable, and all Lighthouse assertions passed.',
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function capacityEvidenceLogLine(evidence) {
  const encoded = Buffer.from(JSON.stringify(evidence), 'utf8').toString(
    'base64url',
  );
  return `${LIGHTHOUSE_CAPACITY_LOG_MARKER}${encoded}`;
}

export function capacityEvidenceFromJobLog(source) {
  if (
    typeof source !== 'string' ||
    Buffer.byteLength(source, 'utf8') > maxJobLogBytes
  ) {
    throw new Error('Attempt-one Lighthouse job log is missing or oversized');
  }

  const encodedRecords = [];
  for (const line of source.split(/\r?\n/u)) {
    const markerIndex = line.indexOf(LIGHTHOUSE_CAPACITY_LOG_MARKER);
    if (markerIndex === -1) continue;
    const encoded = line.slice(
      markerIndex + LIGHTHOUSE_CAPACITY_LOG_MARKER.length,
    );
    if (
      !base64UrlPattern.test(encoded) ||
      line.indexOf(
        LIGHTHOUSE_CAPACITY_LOG_MARKER,
        markerIndex + LIGHTHOUSE_CAPACITY_LOG_MARKER.length,
      ) !== -1
    ) {
      throw new Error(
        'Attempt-one Lighthouse job log has a malformed capacity record',
      );
    }
    encodedRecords.push(encoded);
  }

  if (encodedRecords.length !== 1) {
    throw new Error(
      'Attempt-one Lighthouse job log must contain exactly one capacity record',
    );
  }

  const decoded = Buffer.from(encodedRecords[0], 'base64url');
  if (
    decoded.length === 0 ||
    decoded.length > maxEvidenceBytes ||
    decoded.toString('base64url') !== encodedRecords[0]
  ) {
    throw new Error(
      'Attempt-one Lighthouse job log has a non-canonical capacity record',
    );
  }

  try {
    return JSON.parse(decoded.toString('utf8'));
  } catch {
    throw new Error(
      'Attempt-one Lighthouse job log capacity record is not valid JSON',
    );
  }
}

function readRunContext() {
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    workflow: process.env.GITHUB_WORKFLOW,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    headSha: process.env.QUALITY_HEAD_SHA,
    checkoutSha: process.env.GITHUB_SHA,
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
    typeof context.checkoutSha !== 'string' ||
    !gitShaPattern.test(context.checkoutSha) ||
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
    'checkoutSha',
    'runner',
    'classification',
  ];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schemaVersion !== 3) {
    throw new Error('Attempt-one capacity evidence has an invalid envelope');
  }
  if (
    evidence.repository !== current.repository ||
    evidence.workflow !== current.workflow ||
    evidence.runId !== current.runId ||
    evidence.runAttempt !== 1 ||
    evidence.headSha !== current.headSha ||
    evidence.checkoutSha !== current.checkoutSha
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
      'maxSlowSamplesPerRoute',
      'overallBenchmarkMedian',
      'routeBenchmarkMedians',
      'routeSlowSampleCounts',
    ]) ||
    classification.schemaVersion !== 2 ||
    classification.eligible !== false ||
    classification.reportCount !==
      LIGHTHOUSE_EXPECTED_ROUTES.length * LIGHTHOUSE_RUNS_PER_ROUTE ||
    typeof classification.lighthouseVersion !== 'string' ||
    classification.lighthouseVersion.length === 0 ||
    classification.slowCpuBenchmarkIndex !==
      LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX ||
    classification.maxSlowSamplesPerRoute !==
      LIGHTHOUSE_MAX_ROUTE_OUTLIERS ||
    typeof classification.overallBenchmarkMedian !== 'number' ||
    !Number.isFinite(classification.overallBenchmarkMedian) ||
    !hasExactKeys(
      classification.routeBenchmarkMedians,
      LIGHTHOUSE_EXPECTED_ROUTES,
    ) ||
    !hasExactKeys(
      classification.routeSlowSampleCounts,
      LIGHTHOUSE_EXPECTED_ROUTES,
    )
  ) {
    throw new Error('Attempt-one capacity classification is invalid');
  }
  const routeMedians = Object.values(classification.routeBenchmarkMedians);
  const routeSlowCounts = Object.values(classification.routeSlowSampleCounts);
  if (
    !routeMedians.every(
      value => typeof value === 'number' && Number.isFinite(value) && value > 0,
    ) ||
    !routeSlowCounts.every(
      value => Number.isSafeInteger(value) && value >= 0 &&
        value <= LIGHTHOUSE_RUNS_PER_ROUTE,
    ) ||
    (
      routeMedians.every(
        value => value > LIGHTHOUSE_SLOW_CPU_BENCHMARK_INDEX,
      ) &&
      routeSlowCounts.every(
        value => value <= LIGHTHOUSE_MAX_ROUTE_OUTLIERS,
      )
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

  if (expectedAttempt === 1 && expectedConclusions) {
    const lighthouseJob = jobsByName.get('lighthouse');
    if (!Array.isArray(lighthouseJob?.steps)) {
      throw new Error(
        'Quality attempt 1 Lighthouse job has no auditable steps',
      );
    }
    const requiredSteps = new Map([
      ['Authorize Lighthouse workflow attempt', 'success'],
      ['Classify Lighthouse runner capacity', 'success'],
      ['Enforce eligible Lighthouse verdict', 'failure'],
      ['Retain Lighthouse reports', 'success'],
    ]);
    for (const [requiredName, requiredConclusion] of requiredSteps) {
      const matches = lighthouseJob.steps.filter(
        step => step?.name === requiredName,
      );
      if (
        matches.length !== 1 ||
        matches[0].status !== 'completed' ||
        matches[0].conclusion !== requiredConclusion
      ) {
        throw new Error(
          `Quality attempt 1 Lighthouse step ${requiredName} must conclude ${requiredConclusion}`,
        );
      }
    }
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
    const mayStillBeQueued =
      !expectedConclusions &&
      expectedName !== 'lighthouse' &&
      job.status === 'queued' &&
      job.started_at === null;
    if (!Number.isFinite(startedAtMs) && !mayStillBeQueued) {
      throw new Error(
        `Quality attempt ${expectedAttempt} ${expectedName} has no start time`,
      );
    }
    if (
      Number.isFinite(startedAtMs) &&
      earliestStartMs !== null &&
      startedAtMs < earliestStartMs
    ) {
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
  const routeSlowCounts = JSON.stringify(result.routeSlowSampleCounts);
  const context = readRunContext();
  const evidence = {
    schemaVersion: 3,
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
    route_slow_sample_counts: routeSlowCounts,
  });

  console.log(capacityEvidenceLogLine(evidence));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const status = result.eligible ? 'eligible' : 'ineligible';
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Lighthouse runner capacity',
        '',
        `- Status: ${status}`,
        `- Slow-host boundary: benchmark index must be greater than ${result.slowCpuBenchmarkIndex} for every route median`,
        `- Maximum slow samples per route: ${result.maxSlowSamplesPerRoute}`,
        `- Route medians: \`${routeMedians}\``,
        `- Slow-sample counts: \`${routeSlowCounts}\``,
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
  const tbtDistribution = reportDirectory
    ? classifyLighthouseTbtDistribution(
        await loadLighthouseReports(path.resolve(reportDirectory)),
      )
    : null;
  const result = evaluateLighthouseVerdict({
    eligible,
    assertionOutcome,
    tbtDistributionOk: tbtDistribution?.ok ?? null,
  });
  const evidence = {
    schemaVersion: 3,
    ...context,
    eligible,
    assertionOutcome,
    tbtDistribution,
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

async function readTextFile(filePath, label, maxBytes = maxEvidenceBytes) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`Missing ${label}`);
  }
  if (Buffer.byteLength(source, 'utf8') > maxBytes) {
    throw new Error(`${label} exceeds its size limit`);
  }
  return source;
}

async function readJsonFile(filePath, label) {
  const source = await readTextFile(filePath, label);
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

async function authorizeAttemptCommand(evidenceDirectory, priorJobLogPath) {
  if (!evidenceDirectory) {
    throw new Error('An attempt-authorization evidence directory is required');
  }
  const current = readRunContext();
  const resolvedEvidenceDirectory = path.resolve(evidenceDirectory);
  let priorCapacityEvidence = null;
  let priorJobs = null;
  let currentJobs = null;
  let priorEvidence = null;
  let priorEvidenceError = null;

  if (current.runAttempt === LIGHTHOUSE_MAX_RUN_ATTEMPT) {
    if (!priorJobLogPath) {
      throw new Error('The attempt-one Lighthouse job log path is required');
    }
    try {
      const priorJobLog = await readTextFile(
        path.resolve(priorJobLogPath),
        'attempt-one Lighthouse job log',
        maxJobLogBytes,
      );
      priorCapacityEvidence = capacityEvidenceFromJobLog(priorJobLog);
      const normalizedCapacityEvidence = `${JSON.stringify(
        priorCapacityEvidence,
        null,
        2,
      )}\n`;
      await writeFile(
        path.join(
          resolvedEvidenceDirectory,
          'attempt-1-capacity-verdict.json',
        ),
        normalizedCapacityEvidence,
      );
      priorEvidence = {
        source: 'github-actions-job-log',
        logSha256: sha256(priorJobLog),
        capacityEvidenceSha256: sha256(normalizedCapacityEvidence),
      };
    } catch (error) {
      priorEvidenceError =
        error instanceof Error
          ? error.message
          : 'Invalid attempt-one Lighthouse job log';
    }
    priorJobs = await readJsonFile(
      path.join(resolvedEvidenceDirectory, 'attempt-1-jobs.json'),
      'attempt-one jobs evidence',
    );
    currentJobs = await readJsonFile(
      path.join(resolvedEvidenceDirectory, 'attempt-2-jobs.json'),
      'attempt-two jobs evidence',
    );
  }

  const result = priorEvidenceError
    ? {
        authorized: false,
        authorizationKind: null,
        reason: priorEvidenceError,
      }
    : authorizeLighthouseAttempt({
        current,
        priorCapacityEvidence,
        priorJobs,
        currentJobs,
      });
  const evidence = {
    schemaVersion: 3,
    ...current,
    priorEvidence,
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
