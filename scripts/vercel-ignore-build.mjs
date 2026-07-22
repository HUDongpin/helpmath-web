#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PREVIOUS_SHA_ENVIRONMENT_KEY = 'VERCEL_GIT_PREVIOUS_SHA';
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const SAFE_CHANGE_STATUSES = new Set(['A', 'M']);
const SAFE_EXACT_PATHS = new Set([
  'docs/LAUNCH_DECISIONS.md',
  'docs/LEGACY_CUTOVER.md',
]);
const ALIAS_EVIDENCE_PATTERN =
  /^docs\/evidence\/vercel-production-alias-[^/]+\.json$/u;

function outputBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  return Buffer.alloc(0);
}

function commandSucceeded(result) {
  return !result.error && result.signal === null && result.status === 0;
}

function defaultRunGit(argumentsList, cwd) {
  return spawnSync('git', argumentsList, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 2 * 1024 * 1024,
  });
}

function requiredPath(fields, index, status) {
  const value = fields[index];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Malformed git diff record for status ${status}.`);
  }
  return value;
}

export function parseGitNameStatus(output) {
  const bytes = outputBuffer(output);
  if (bytes.length > 0 && bytes.at(-1) !== 0) {
    throw new Error('Git diff output is not NUL-terminated.');
  }
  const decoded = bytes.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(bytes)) {
    throw new Error('Git diff contains a non-UTF-8 path.');
  }

  const fields = decoded.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length === 0) return [];

  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index];
    index += 1;
    if (!/^[A-Z](?:\d{1,3})?$/u.test(status)) {
      throw new Error('Git diff contains an unknown change status.');
    }

    if (/^[CR]\d{1,3}$/u.test(status)) {
      const sourcePath = requiredPath(fields, index, status);
      const changedPath = requiredPath(fields, index + 1, status);
      changes.push({status, path: changedPath, sourcePath});
      index += 2;
      continue;
    }

    const changedPath = requiredPath(fields, index, status);
    changes.push({status, path: changedPath});
    index += 1;
  }
  return changes;
}

export function isReleaseEvidencePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
  if (relativePath.includes('\0') || relativePath.includes('\\')) return false;
  if (path.posix.isAbsolute(relativePath)) return false;
  if (relativePath.split('/').some((segment) => segment === '..')) return false;
  if (SAFE_EXACT_PATHS.has(relativePath)) return true;
  if (relativePath.startsWith('docs/releases/') && relativePath.length > 'docs/releases/'.length) {
    return true;
  }
  return ALIAS_EVIDENCE_PATTERN.test(relativePath);
}

export function shouldIgnoreVercelBuild(changes) {
  return (
    Array.isArray(changes)
    && changes.length > 0
    && changes.every(
      (change) =>
        change
        && SAFE_CHANGE_STATUSES.has(change.status)
        && typeof change.sourcePath === 'undefined'
        && isReleaseEvidencePath(change.path),
    )
  );
}

function requiredCommit(reference, cwd, runGit) {
  return commandSucceeded(
    runGit(['rev-parse', '--verify', '--quiet', `${reference}^{commit}`], cwd),
  );
}

function baselineReference(environment) {
  const previousSha = environment[PREVIOUS_SHA_ENVIRONMENT_KEY];
  if (typeof previousSha === 'undefined' || previousSha === '') {
    return {reference: 'HEAD^', source: 'parent-commit'};
  }
  if (typeof previousSha !== 'string' || !COMMIT_SHA_PATTERN.test(previousSha)) {
    return {error: 'invalid-previous-deployment-sha'};
  }
  return {reference: previousSha, source: 'previous-successful-deployment'};
}

export function evaluateVercelBuild({
  cwd = process.cwd(),
  environment = process.env,
  runGit = defaultRunGit,
} = {}) {
  const baseline = baselineReference(environment);
  if (baseline.error) return {ignoreBuild: false, reason: baseline.error};

  if (!requiredCommit('HEAD', cwd, runGit)) {
    return {ignoreBuild: false, reason: 'head-commit-unavailable'};
  }
  if (!requiredCommit(baseline.reference, cwd, runGit)) {
    return {ignoreBuild: false, reason: 'baseline-commit-unavailable'};
  }

  const ancestor = runGit(
    ['merge-base', '--is-ancestor', baseline.reference, 'HEAD'],
    cwd,
  );
  if (!commandSucceeded(ancestor)) {
    return {ignoreBuild: false, reason: 'baseline-is-not-a-resolvable-ancestor'};
  }

  const difference = runGit(
    ['diff', '--name-status', '-z', '--find-renames', baseline.reference, 'HEAD', '--'],
    cwd,
  );
  if (!commandSucceeded(difference)) {
    return {ignoreBuild: false, reason: 'git-diff-failed'};
  }

  let changes;
  try {
    changes = parseGitNameStatus(difference.stdout);
  } catch {
    return {ignoreBuild: false, reason: 'git-diff-output-invalid'};
  }

  if (!shouldIgnoreVercelBuild(changes)) {
    return {
      ignoreBuild: false,
      reason: changes.length === 0 ? 'no-auditable-changes' : 'build-relevant-change',
      baselineSource: baseline.source,
      changes,
    };
  }

  return {
    ignoreBuild: true,
    reason: 'release-evidence-only',
    baselineSource: baseline.source,
    changes,
  };
}

export function runVercelIgnoreBuild(options) {
  const result = evaluateVercelBuild(options);
  const outcome = result.ignoreBuild ? 'skipped' : 'required';
  process.stdout.write(`Vercel build ${outcome}: ${result.reason}.\n`);
  return result.ignoreBuild ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runVercelIgnoreBuild();
  } catch {
    process.stdout.write('Vercel build required: ignored-build-check-failed.\n');
    process.exitCode = 1;
  }
}
