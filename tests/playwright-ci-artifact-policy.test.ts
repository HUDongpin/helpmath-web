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
    const [handoff, operator] = await Promise.all([
      readFile(
        path.join(repositoryRoot, 'docs/EXECUTIVE_PREVIEW_HANDOFF.md'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, 'scripts/executive-preview-operator-check.ts'),
        'utf8',
      ),
    ]);

    assert.match(handoff, /if \[\[ -z "\$EXEC_KEY" \]\]/u);
    assert.match(handoff, /npm run smoke:executive-preview/u);
    assert.match(handoff, /single non-skipped browser result/u);
    assert.match(handoff, /No local process can guarantee cleanup after `SIGKILL`/u);
    assert.doesNotMatch(handoff, /EXECUTIVE_PREVIEW_DEPLOYMENT_EVIDENCE/u);
    assert.match(operator, /EXPECTED_REPOSITORY = "HUDongpin\/helpmath-web"/u);
    assert.match(operator, /liveIdentityCheckedBeforeAndAfter: true/u);
    assert.match(operator, /temporaryArtifacts: "deleted-before-result"/u);
    assert.match(operator, /--project=chromium/u);
  });
});
