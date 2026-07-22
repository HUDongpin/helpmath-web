import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();

describe('Playwright CI artifact privacy', () => {
  it('never retains traces or screenshots from the credentialed CI suite', async () => {
    const config = await readFile(path.join(repositoryRoot, 'playwright.config.ts'), 'utf8');
    const quality = await readFile(
      path.join(repositoryRoot, '.github/workflows/quality.yml'),
      'utf8',
    );

    assert.match(config, /screenshot: process\.env\.CI \? 'off' : 'only-on-failure'/u);
    assert.match(
      config,
      /trace: process\.env\.CI \|\| configuredBaseURL \? 'off' : 'retain-on-failure'/u,
    );
    assert.doesNotMatch(quality, /helpmath-site-playwright-results/u);
    assert.doesNotMatch(quality, /name: playwright-\$\{\{ github\.run_id \}\}/u);
  });

  it('keeps the private operator run disposable and Chromium-only', async () => {
    const handoff = await readFile(
      path.join(repositoryRoot, 'docs/EXECUTIVE_PREVIEW_HANDOFF.md'),
      'utf8',
    );

    assert.match(handoff, /mktemp -d \/tmp\/helpmath-executive-preview\.XXXXXX/u);
    assert.match(handoff, /rm -rf -- "\$PW_OUTPUT"/u);
    assert.match(handoff, /playwright test --project=chromium --output="\$PW_OUTPUT"/u);
    assert.match(handoff, /must never be uploaded\s+as an artifact/iu);
  });
});
