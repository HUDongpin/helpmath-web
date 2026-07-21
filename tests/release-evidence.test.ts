import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const releaseDirectory = path.join(repositoryRoot, 'docs/releases');
const releaseNamePattern = /^(\d{4}-\d{2}-\d{2})-pr(\d+)\.md$/u;

type ReleaseRecord = {
  date: string;
  filename: string;
  pullRequest: number;
};

function tableValue(record: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = record.match(new RegExp(`^\\| ${escaped} \\| (.+) \\|$`, 'mu'));
  assert.ok(match, `${field} is missing`);
  return match[1];
}

async function releaseRecords(): Promise<ReleaseRecord[]> {
  return (await readdir(releaseDirectory))
    .flatMap((filename) => {
      const match = filename.match(releaseNamePattern);
      if (!match) return [];
      return [{date: match[1], filename, pullRequest: Number(match[2])}];
    })
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.pullRequest - right.pullRequest,
    );
}

describe('release evidence records', () => {
  it('keeps the latest immutable record as both operational baselines', async () => {
    const records = await releaseRecords();
    assert.ok(records.length > 0, 'No dated release records were found.');
    const latest = records.at(-1);
    assert.ok(latest);
    const reference = `docs/releases/${latest.filename}`;
    const [launchDecisions, legacyCutover] = await Promise.all([
      readFile(path.join(repositoryRoot, 'docs/LAUNCH_DECISIONS.md'), 'utf8'),
      readFile(path.join(repositoryRoot, 'docs/LEGACY_CUTOVER.md'), 'utf8'),
    ]);

    assert.match(
      tableValue(
        launchDecisions,
        'Most recent application release baseline (historical evidence gaps disclosed)',
      ),
      new RegExp(reference.replaceAll('.', '\\.')),
    );
    assert.match(
      tableValue(legacyCutover, 'Release commit and Vercel deployment evidence'),
      new RegExp(reference.replaceAll('.', '\\.')),
    );
  });

  it('retains the required identity, smoke, boundary, and exception fields', async () => {
    const records = await releaseRecords();
    const latest = records.at(-1);
    assert.ok(latest);
    const record = await readFile(path.join(releaseDirectory, latest.filename), 'utf8');

    const candidateCommit = tableValue(record, 'Candidate commit');
    const productionCommit = tableValue(record, 'Production commit');
    assert.match(candidateCommit, /^`[0-9a-f]{40}`$/u);
    assert.match(productionCommit, /^`[0-9a-f]{40}`$/u);
    assert.notEqual(candidateCommit, productionCommit);

    const pullRequest = tableValue(record, 'Pull request');
    assert.match(pullRequest, /https:\/\/github\.com\/HUDongpin\/helpmath-web\/pull\/\d+/u);
    assert.match(pullRequest, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/u);

    for (const field of ['Candidate Quality run', 'Production Quality run']) {
      const quality = tableValue(record, field);
      assert.match(quality, /https:\/\/github\.com\/HUDongpin\/helpmath-web\/actions\/runs\/\d+/u);
      assert.match(quality, /`success`/u);
      assert.match(quality, /matching the (?:candidate|production) commit/u);
    }

    for (const field of ['Protected Preview', 'Production']) {
      const deployment = tableValue(record, field);
      assert.match(deployment, /GitHub deployment `\d+`/u);
      assert.match(
        deployment,
        /https:\/\/vercel\.com\/peter-dongpin-hu-s-projects\/helpmath-web\/[A-Za-z0-9]+/u,
      );
      assert.match(deployment, /`success`/u);
      assert.match(deployment, /matching the (?:candidate|production) commit/u);
      assert.match(deployment, /https:\/\/[a-z0-9-]+\.vercel\.app/u);
    }

    const aliasAssignment = tableValue(record, 'Canonical alias assignment');
    assert.match(aliasAssignment, /Owner-authenticated Vercel CLI/iu);
    assert.match(aliasAssignment, /`READY` Production deployment/iu);
    assert.match(aliasAssignment, /https:\/\/www\.helpmath\.ai/u);
    assert.match(aliasAssignment, /https:\/\/helpmath\.ai/u);
    assert.match(aliasAssignment, /docs\/evidence\/vercel-production-alias-\d{4}-\d{2}-\d{2}\.json/u);
    assert.match(aliasAssignment, /SHA-256 `[0-9a-f]{64}`/u);

    assert.match(tableValue(record, 'Contact mode'), /^Disabled;/u);
    const smokeBlocks = [...record.matchAll(/```json\n([\s\S]*?)\n```/gu)].map(
      (match) =>
        JSON.parse(match[1]) as {
          baseUrl?: string;
          failures?: unknown[];
        },
    );
    assert.ok(
      smokeBlocks.some(
        (smoke) =>
          smoke.baseUrl === 'https://www.helpmath.ai' &&
          Array.isArray(smoke.failures) &&
          smoke.failures.length === 0,
      ),
      'No valid zero-failure smoke JSON was retained.',
    );
    assert.match(record, /^## Exceptions and follow-up gates$/mu);
    assert.match(record, /^## Alias-assignment evidence$/mu);
    assert.match(record, /semantic smoke behind the protected PR #\d+ Preview was not retained/iu);
    assert.match(record, /did not request executive authentication/iu);
    assert.match(record, /off-device custody/iu);
    assert.match(record, /not authorization|not authoriz(?:e|ation)/iu);
  });
});
