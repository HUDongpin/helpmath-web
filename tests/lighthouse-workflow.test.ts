import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();

function workflowJob(source: string, jobName: string) {
  const marker = `  ${jobName}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${jobName} workflow job`);

  const remainder = source.slice(start + marker.length);
  const nextJob = remainder.search(/^  [a-z][a-z0-9-]*:\n/mu);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob);
}

describe('Lighthouse quality gate', () => {
  it('uses the pinned standard four-core runner without weakening mobile budgets', async () => {
    const [workflow, lighthouseConfig] = await Promise.all([
      readFile(path.join(repositoryRoot, '.github/workflows/quality.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, 'lighthouserc.cjs'), 'utf8'),
    ]);
    const lighthouse = workflowJob(workflow, 'lighthouse');

    assert.match(lighthouse, /runs-on: macos-15-intel/u);
    assert.doesNotMatch(lighthouse, /runs-on: macos-15(?:\s|$)/u);
    assert.doesNotMatch(lighthouse, /runs-on: ubuntu-latest/u);
    assert.match(lighthouse, /run: npx playwright install chromium/u);
    assert.doesNotMatch(lighthouse, /playwright install --with-deps/u);
    assert.match(lighthouse, /run: npm run test:lighthouse/u);

    assert.match(lighthouseConfig, /aggregationMethod: 'median'/u);
    assert.match(lighthouseConfig, /numberOfRuns: 3/u);
    for (const route of ['/', '/es', '/research', '/resources', '/demos']) {
      assert.match(
        lighthouseConfig,
        new RegExp(`http://127\\.0\\.0\\.1:3216${route === '/' ? '/' : route}`, 'u'),
      );
    }
    assert.match(
      lighthouseConfig,
      /'total-blocking-time': \['error', \{maxNumericValue: 200\}\]/u,
    );
  });
});
