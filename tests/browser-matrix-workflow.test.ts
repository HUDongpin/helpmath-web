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

describe('cross-browser quality matrix', () => {
  it('keeps the desktop and native mobile browser projects bound to reviewed tags', async () => {
    const [config, siteSpec] = await Promise.all([
      readFile(path.join(repositoryRoot, 'playwright.config.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'e2e/site.spec.ts'), 'utf8'),
    ]);

    assert.match(
      config,
      /name: 'chromium',[\s\S]*?grepInvert: \/@mobile-webkit-only\/u,[\s\S]*?devices\['Desktop Chrome'\]/u,
    );
    assert.match(
      config,
      /name: 'webkit-smoke',[\s\S]*?grep: \/@cross-browser-smoke\/u,[\s\S]*?devices\['Desktop Safari'\]/u,
    );
    assert.match(
      config,
      /name: 'mobile-webkit-smoke',[\s\S]*?grep: \/@mobile-webkit-smoke\/u,[\s\S]*?devices\['iPhone 13'\]/u,
    );
    assert.match(
      config,
      /name: 'firefox-smoke',[\s\S]*?grep: \/@cross-browser-smoke\/u,[\s\S]*?devices\['Desktop Firefox'\]/u,
    );

    assert.match(
      siteSpec,
      /test\('native mobile WebKit[^']*', \{\s+tag: \['@mobile-webkit-smoke', '@mobile-webkit-only'\]/u,
    );
    assert.match(
      siteSpec,
      /test\('executive preview grants[^']*', \{\s+tag: \['@cross-browser-smoke', '@mobile-webkit-smoke'\]/u,
    );
    assert.equal(siteSpec.match(/@mobile-webkit-only/gu)?.length, 1);
    assert.match(siteSpec, /@cross-browser-smoke/u);
  });

  it('runs browser contracts and visual checks together in the pinned browser job', async () => {
    const workflow = await readFile(
      path.join(repositoryRoot, '.github/workflows/quality.yml'),
      'utf8',
    );
    const verify = workflowJob(workflow, 'verify');
    const browserQuality = workflowJob(workflow, 'browser-quality');

    assert.doesNotMatch(verify, /playwright install|npm run test:e2e/u);
    assert.match(
      browserQuality,
      /image: mcr\.microsoft\.com\/playwright:v1\.61\.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48/u,
    );
    assert.match(browserQuality, /options: --user 1001/u);
    assert.match(browserQuality, /run: npm run test:e2e/u);
    assert.match(browserQuality, /run: npm run test:visual/u);
    assert.ok(
      browserQuality.indexOf('run: npm run test:e2e') <
        browserQuality.indexOf('run: npm run test:visual'),
      'Browser contracts must pass before visual regression begins',
    );
    assert.doesNotMatch(browserQuality, /test:visual:update|--update-snapshots/u);
  });

  it('keeps package scripts and local browser installation guidance aligned', async () => {
    const [packageSource, readme] = await Promise.all([
      readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
      readFile(path.join(repositoryRoot, 'README.md'), 'utf8'),
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, string>;
    };

    assert.deepEqual(
      {
        chromium: packageJson.scripts?.['test:e2e:chromium'],
        firefox: packageJson.scripts?.['test:e2e:firefox'],
        mobileWebkit: packageJson.scripts?.['test:e2e:mobile-webkit'],
        webkit: packageJson.scripts?.['test:e2e:webkit'],
      },
      {
        chromium: 'playwright test --project=chromium',
        firefox: 'playwright test --project=firefox-smoke',
        mobileWebkit: 'playwright test --project=mobile-webkit-smoke',
        webkit: 'playwright test --project=webkit-smoke',
      },
    );
    assert.equal(packageJson.scripts?.['test:e2e'], 'playwright test');

    assert.match(readme, /npx playwright install chromium firefox webkit/u);
    for (const script of [
      'test:e2e:chromium',
      'test:e2e:firefox',
      'test:e2e:mobile-webkit',
      'test:e2e:webkit',
    ]) {
      assert.match(readme, new RegExp(`npm run ${script}`, 'u'));
    }
  });
});
