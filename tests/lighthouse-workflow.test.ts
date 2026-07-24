import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const require = createRequire(import.meta.url);

function workflowJob(source: string, jobName: string) {
  const marker = `  ${jobName}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${jobName} workflow job`);

  const remainder = source.slice(start + marker.length);
  const nextJob = remainder.search(/^  [a-z][a-z0-9-]*:\n/mu);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob);
}

describe('Lighthouse quality gate', () => {
  it('classifies runner capacity without changing the three-job Quality contract', async () => {
    const [workflow, lighthouseConfig, legacyPreflight] = await Promise.all([
      readFile(path.join(repositoryRoot, '.github/workflows/quality.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, 'lighthouserc.cjs'), 'utf8'),
      readFile(
        path.join(repositoryRoot, 'lib/legacy-cutover-preflight.ts'),
        'utf8',
      ),
    ]);
    const verdict = workflowJob(workflow, 'lighthouse');
    const jobs = workflow.slice(workflow.indexOf('jobs:\n') + 'jobs:\n'.length);

    assert.deepEqual(
      [...jobs.matchAll(/^  ([a-z][a-z0-9-]+):$/gmu)].map(match => match[1]),
      ['verify', 'browser-quality', 'lighthouse'],
    );
    assert.match(workflow, /^permissions:\n  contents: read$/mu);
    assert.equal(
      [
        ...verdict.matchAll(
          /QUALITY_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/gu,
        ),
      ].length,
      3,
    );
    assert.match(
      verdict,
      /permissions:\n\s+actions: read\n\s+contents: read/u,
    );
    assert.match(verdict, /runs-on: macos-15-intel/u);
    assert.doesNotMatch(verdict, /runs-on: macos-15(?:\s|$)/u);
    assert.doesNotMatch(verdict, /runs-on: ubuntu-latest/u);
    assert.match(verdict, /run: npx playwright install chromium/u);
    assert.doesNotMatch(verdict, /playwright install --with-deps/u);
    assert.match(verdict, /id: lighthouse_assertions/u);
    assert.match(verdict, /continue-on-error: true/u);
    assert.match(
      verdict,
      /name: Authorize Lighthouse workflow attempt[\s\S]*attempts\/1\/jobs\?per_page=100[\s\S]*actions\/jobs\/\$prior_lighthouse_job_id\/logs[\s\S]*attempts\/2\/jobs\?per_page=100[\s\S]*authorize-attempt/u,
    );
    assert.doesNotMatch(verdict, /gh run download/u);
    assert.match(
      verdict,
      /fetch_github_api\(\)[\s\S]*for fetch_attempt in 1 2 3 4; do[\s\S]*sleep 3/u,
    );
    assert.match(
      verdict,
      /for poll_attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do[\s\S]*e\.jobs\?\.length === 3[\s\S]*sleep 5/u,
    );
    assert.match(
      verdict,
      /name: Classify Lighthouse runner capacity\n\s+id: environment\n\s+if: \$\{\{ !cancelled\(\) \}\}/u,
    );
    assert.match(
      verdict,
      /name: Enforce eligible Lighthouse verdict\n\s+if: \$\{\{ !cancelled\(\) \}\}/u,
    );
    assert.match(verdict, /run: npm run test:lighthouse/u);
    assert.match(
      verdict,
      /run: node scripts\/lighthouse-run-policy\.mjs classify artifacts\/lighthouse-ci/u,
    );
    assert.match(
      verdict,
      /run: node scripts\/lighthouse-run-policy\.mjs verdict artifacts\/lighthouse-ci/u,
    );
    assert.ok(
      verdict.indexOf('Enforce eligible Lighthouse verdict') <
        verdict.indexOf('Retain Lighthouse reports'),
      'The final verdict must be written before the retained artifact is uploaded',
    );
    assert.match(
      verdict,
      /name: lighthouse-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u,
    );
    assert.match(verdict, /artifacts\/lighthouse-rerun/u);
    assert.doesNotMatch(
      verdict.slice(verdict.indexOf('Enforce eligible Lighthouse verdict')),
      /continue-on-error: true/u,
    );
    assert.match(
      legacyPreflight,
      /LEGACY_CUTOVER_PRODUCTION_QUALITY_MAX_RUN_ATTEMPT = 2 as const/u,
    );

    assert.match(lighthouseConfig, /aggregationMethod: 'median'/u);
    assert.match(lighthouseConfig, /numberOfRuns: 1/u);
    const lighthouseRuntimeConfig = require(
      path.join(repositoryRoot, 'lighthouserc.cjs'),
    );
    const urls = lighthouseRuntimeConfig.ci.collect.url as string[];
    const routes = ['/', '/es', '/research', '/resources', '/demos'];
    assert.equal(urls.length, 25);
    assert.equal(lighthouseRuntimeConfig.ci.collect.numberOfRuns, 1);
    const collectedRoutes = urls.map((rawUrl) => {
      const url = new URL(rawUrl);
      assert.equal(url.origin, 'http://127.0.0.1:3216');
      assert.equal(url.search, '');
      assert.equal(url.hash, '');
      return url.pathname;
    });
    for (const route of routes) {
      assert.equal(
        collectedRoutes.filter(candidate => candidate === route).length,
        5,
      );
    }
    for (let round = 0; round < 5; round += 1) {
      assert.deepEqual(
        new Set(collectedRoutes.slice(round * 5, round * 5 + 5)),
        new Set(routes),
      );
    }
    for (const [routeIndex, route] of routes.entries()) {
      assert.deepEqual(
        Array.from({length: 5}, (_, round) =>
          collectedRoutes[round * 5 + ((routeIndex - round + 5) % 5)],
        ),
        Array(5).fill(route),
      );
    }
    assert.match(
      lighthouseConfig,
      /'total-blocking-time': \['error', \{maxNumericValue: 200\}\]/u,
    );
  });
});
