import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  evaluateVercelBuild,
  isReleaseEvidencePath,
  parseGitNameStatus,
  shouldIgnoreVercelBuild,
} from '../scripts/vercel-ignore-build.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repositoryRoot, 'scripts/vercel-ignore-build.mjs');

function git(cwd: string, argumentsList: string[]): string {
  const result = spawnSync('git', argumentsList, {cwd, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function createRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'helpmath-vercel-build-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'HELP Math Test']);
  git(root, ['config', 'user.email', 'test@helpmath.invalid']);
  return root;
}

async function commitFile(root: string, relativePath: string, contents: string): Promise<string> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), {recursive: true});
  await writeFile(absolutePath, contents);
  git(root, ['add', '--', relativePath]);
  git(root, ['commit', '--quiet', '-m', `Update ${relativePath}`]);
  return git(root, ['rev-parse', 'HEAD']);
}

function runBoundary(root: string, previousSha?: string) {
  const environment = {...process.env};
  delete environment.VERCEL_GIT_PREVIOUS_SHA;
  if (typeof previousSha !== 'undefined') {
    environment.VERCEL_GIT_PREVIOUS_SHA = previousSha;
  }
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: environment,
  });
}

describe('Vercel ignored-build allowlist', () => {
  it('allows only release records, direct production-alias JSON, and the two exact baselines', () => {
    for (const relativePath of [
      'docs/releases/2026-07-22-pr27.md',
      'docs/releases/archive/2026-07-22-pr27.md',
      'docs/evidence/vercel-production-alias-2026-07-22-pr27.json',
      'docs/LAUNCH_DECISIONS.md',
      'docs/LEGACY_CUTOVER.md',
    ]) {
      assert.equal(isReleaseEvidencePath(relativePath), true, relativePath);
    }

    for (const relativePath of [
      'docs/releases',
      'docs/evidence/vercel-production-alias-.json',
      'docs/evidence/nested/vercel-production-alias-pr27.json',
      'docs/evidence/launch-gates/legal-review.json',
      'docs/LEGAL_REVIEW.md',
      'config/launch-gates.json',
      '.github/workflows/quality.yml',
      'scripts/vercel-ignore-build.mjs',
      'vercel.json',
      '../docs/releases/pr27.md',
      'docs\\releases\\pr27.md',
    ]) {
      assert.equal(isReleaseEvidencePath(relativePath), false, relativePath);
    }
  });

  it('skips only non-empty additions or modifications entirely inside the allowlist', () => {
    assert.equal(
      shouldIgnoreVercelBuild([
        {status: 'A', path: 'docs/releases/2026-07-22-pr27.md'},
        {status: 'M', path: 'docs/LAUNCH_DECISIONS.md'},
      ]),
      true,
    );
    assert.equal(shouldIgnoreVercelBuild([]), false);
    assert.equal(
      shouldIgnoreVercelBuild([
        {status: 'M', path: 'docs/releases/2026-07-22-pr27.md'},
        {status: 'M', path: 'app/page.tsx'},
      ]),
      false,
    );
    assert.equal(
      shouldIgnoreVercelBuild([
        {status: 'D', path: 'docs/releases/2026-07-22-pr27.md'},
      ]),
      false,
    );
    assert.equal(
      shouldIgnoreVercelBuild([
        {
          status: 'R100',
          sourcePath: 'docs/releases/old.md',
          path: 'docs/releases/new.md',
        },
      ]),
      false,
    );
  });

  it('parses NUL-delimited Git records without treating renames as modifications', () => {
    assert.deepEqual(
      parseGitNameStatus(
        Buffer.from(
          'M\0docs/LAUNCH_DECISIONS.md\0R100\0docs/releases/old.md\0docs/releases/new.md\0',
        ),
      ),
      [
        {status: 'M', path: 'docs/LAUNCH_DECISIONS.md'},
        {
          status: 'R100',
          sourcePath: 'docs/releases/old.md',
          path: 'docs/releases/new.md',
        },
      ],
    );
    assert.throws(() => parseGitNameStatus(Buffer.from('M\0missing-terminator')));
    assert.throws(() => parseGitNameStatus(Buffer.from([0xff, 0x00])));
  });
});

describe('Vercel ignored-build Git boundary', () => {
  it('uses the previous successful deployment SHA across multiple commits', async () => {
    const root = await createRepository();
    try {
      const baseline = await commitFile(root, 'README.md', 'baseline\n');
      const sourceCommit = await commitFile(root, 'app/page.tsx', 'export default function Page() {}\n');
      await commitFile(root, 'docs/releases/2026-07-22-pr27.md', 'evidence\n');

      const completeRange = runBoundary(root, baseline);
      assert.equal(completeRange.status, 1, completeRange.stdout + completeRange.stderr);
      assert.match(completeRange.stdout, /build-relevant-change/u);

      const evidenceOnlyRange = runBoundary(root, sourceCommit);
      assert.equal(evidenceOnlyRange.status, 0, evidenceOnlyRange.stdout + evidenceOnlyRange.stderr);
      assert.match(evidenceOnlyRange.stdout, /release-evidence-only/u);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });

  it('falls back to the parent commit only when the previous deployment SHA is absent', async () => {
    const root = await createRepository();
    try {
      await commitFile(root, 'README.md', 'baseline\n');
      await commitFile(root, 'docs/LEGACY_CUTOVER.md', 'evidence\n');

      const result = runBoundary(root);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /release-evidence-only/u);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });

  it('requires a build for no parent, invalid or unavailable baselines, and command failures', async () => {
    const root = await createRepository();
    try {
      await commitFile(root, 'docs/releases/2026-07-22-pr27.md', 'first commit\n');

      for (const previousSha of [undefined, 'not-a-sha', '0'.repeat(40)]) {
        const result = runBoundary(root, previousSha);
        assert.equal(result.status, 1, `${previousSha ?? 'missing'}: ${result.stdout}`);
      }

      const missingGit = spawnSync('helpmath-nonexistent-git-command', [], {
        encoding: 'buffer',
      });
      const decision = evaluateVercelBuild({runGit: () => missingGit});
      assert.deepEqual(decision, {ignoreBuild: false, reason: 'head-commit-unavailable'});
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });

  it('requires a build for deletion and rename changes inside allowed directories', async () => {
    const root = await createRepository();
    try {
      await commitFile(root, 'README.md', 'baseline\n');
      await commitFile(root, 'docs/releases/old.md', 'old evidence\n');
      const deletionBaseline = git(root, ['rev-parse', 'HEAD']);
      git(root, ['rm', '--quiet', '--', 'docs/releases/old.md']);
      git(root, ['commit', '--quiet', '-m', 'Delete evidence']);
      assert.equal(runBoundary(root, deletionBaseline).status, 1);

      const renameBaseline = await commitFile(root, 'docs/releases/old.md', 'old evidence\n');
      git(root, ['mv', 'docs/releases/old.md', 'docs/releases/new.md']);
      git(root, ['commit', '--quiet', '-m', 'Rename evidence']);
      assert.equal(runBoundary(root, renameBaseline).status, 1);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});

it('configures Vercel to call the audited boundary and use reproducible installs', async () => {
  const configuration = JSON.parse(
    await readFile(path.join(repositoryRoot, 'vercel.json'), 'utf8'),
  ) as {ignoreCommand?: string; installCommand?: string};
  assert.equal(configuration.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');
  assert.equal(configuration.installCommand, 'npm ci');
});
