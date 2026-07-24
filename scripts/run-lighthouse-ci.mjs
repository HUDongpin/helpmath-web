#!/usr/bin/env node

import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const LIGHTHOUSE_RETRYABLE_RUNTIME_ERROR = 'NO_NAVSTART';

const repositoryRoot = process.cwd();
const lighthouseWorkingDirectory = path.join(repositoryRoot, '.lighthouseci');
const reportDirectory = path.join(repositoryRoot, 'artifacts/lighthouse-ci');
const retryEvidenceDirectory = path.join(
  repositoryRoot,
  'artifacts/lighthouse-rerun',
);
const maxCapturedOutputCharacters = 2 * 1024 * 1024;
const runtimeErrorPattern =
  /Runtime error encountered:[^\r\n]*\(NO_NAVSTART\)(?:\r?\n|$)/gu;

function normalizedFailureExitCode(exitCode) {
  return Number.isSafeInteger(exitCode) && exitCode > 0 ? exitCode : 1;
}

export function shouldRetryLighthouseInfrastructureFailure({
  exitCode,
  output,
  finalizedReportCount,
}) {
  if (
    !Number.isSafeInteger(exitCode) ||
    exitCode === 0 ||
    typeof output !== 'string' ||
    finalizedReportCount !== 0
  ) {
    return false;
  }

  return [...output.matchAll(runtimeErrorPattern)].length === 1;
}

export async function runLighthouseWithInfrastructureRetry({
  invoke,
  resetGeneratedOutputs,
  countFinalizedReports,
  recordRetry,
}) {
  await resetGeneratedOutputs();
  const first = await invoke();
  if (first.exitCode === 0) return 0;

  const finalizedReportCount = await countFinalizedReports();
  if (
    !shouldRetryLighthouseInfrastructureFailure({
      ...first,
      finalizedReportCount,
    })
  ) {
    return normalizedFailureExitCode(first.exitCode);
  }

  await recordRetry(first, finalizedReportCount);
  await resetGeneratedOutputs();
  const second = await invoke();
  return second.exitCode === 0
    ? 0
    : normalizedFailureExitCode(second.exitCode);
}

async function resetGeneratedOutputs() {
  await Promise.all([
    rm(lighthouseWorkingDirectory, {recursive: true, force: true}),
    rm(reportDirectory, {recursive: true, force: true}),
  ]);
}

async function countFinalizedReports() {
  let entries;
  try {
    entries = await readdir(reportDirectory, {withFileTypes: true});
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }

  return entries.filter(
    entry => entry.isFile() && entry.name.endsWith('.report.json'),
  ).length;
}

function appendCapturedOutput(current, chunk) {
  if (current.length >= maxCapturedOutputCharacters) return current;
  return current + chunk.slice(0, maxCapturedOutputCharacters - current.length);
}

async function invokeLighthouse() {
  const executable = process.platform === 'win32' ? 'lhci.cmd' : 'lhci';
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(executable, ['autorun'], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', chunk => {
      const value = chunk.toString('utf8');
      process.stdout.write(value);
      output = appendCapturedOutput(output, value);
    });
    child.stderr.on('data', chunk => {
      const value = chunk.toString('utf8');
      process.stderr.write(value);
      output = appendCapturedOutput(output, value);
    });
    child.once('error', reject);
    child.once('close', exitCode => resolve({exitCode, output}));
  });
}

async function recordRetry(first, finalizedReportCount) {
  const evidence = {
    schemaVersion: 1,
    retryKind: 'complete-lighthouse-collection',
    runtimeErrorCode: LIGHTHOUSE_RETRYABLE_RUNTIME_ERROR,
    firstExitCode: normalizedFailureExitCode(first.exitCode),
    finalizedReportCount,
    firstOutputSha256: createHash('sha256')
      .update(first.output, 'utf8')
      .digest('hex'),
  };
  await mkdir(retryEvidenceDirectory, {recursive: true});
  await writeFile(
    path.join(retryEvidenceDirectory, 'in-job-infrastructure-retry.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.warn(
    `Lighthouse ended with ${LIGHTHOUSE_RETRYABLE_RUNTIME_ERROR} before producing reports; retrying the complete collection once.`,
  );
}

async function main() {
  const exitCode = await runLighthouseWithInfrastructureRetry({
    invoke: invokeLighthouse,
    resetGeneratedOutputs,
    countFinalizedReports,
    recordRetry,
  });
  if (exitCode !== 0) process.exitCode = exitCode;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
