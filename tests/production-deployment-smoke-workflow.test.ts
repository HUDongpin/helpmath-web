import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const workflowPath = path.join(
  process.cwd(),
  '.github/workflows/production-deployment-smoke.yml',
);

describe('production deployment smoke workflow', () => {
  it('runs only for a successful Production deployment event', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /^on:\n  deployment_status:\s*$/mu);
    assert.doesNotMatch(workflow, /workflow_dispatch/u);
    assert.match(
      workflow,
      /github\.event\.deployment\.environment == 'Production'[\s\S]*github\.event\.deployment_status\.state == 'success'/u,
    );
  });

  it('never executes checked-out smoke code before deployment identity succeeds', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /ref: \$\{\{ env\.DEPLOYMENT_REF \}\}/u);
    assert.match(workflow, /id: identity/u);
    assert.match(workflow, /Deployment event SHA is invalid\./u);
    assert.match(workflow, /Checked-out SHA does not match the deployment event\./u);
    assert.match(workflow, /'merge-base',[\s\S]*'--is-ancestor',[\s\S]*'refs\/remotes\/origin\/main'/u);
    assert.match(
      workflow,
      /if: always\(\) && steps\.identity\.outcome == 'success'[\s\S]*node scripts\/release-smoke\.mjs/u,
    );
  });

  it('runs the credential-free public hydration contract in the pinned Playwright image', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(
      workflow,
      /container:\n\s+image: mcr\.microsoft\.com\/playwright:v1\.61\.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48/u,
    );
    assert.match(workflow, /options: --user 1001/u);
    assert.match(workflow, /name: Verify public browser hydration\n\s+id: browser/u);
    assert.match(
      workflow,
      /if: always\(\) && steps\.identity\.outcome == 'success' && steps\.canonical\.outcome == 'success'/u,
    );
    assert.match(workflow, /PLAYWRIGHT_BASE_URL: \$\{\{ env\.CANONICAL_URL \}\}/u);
    assert.match(
      workflow,
      /PLAYWRIGHT_JUNIT_OUTPUT_FILE: \$\{\{ runner\.temp \}\}\/helpmath-production-smoke\/public-browser\.xml/u,
    );
    assert.match(
      workflow,
      /npx playwright test --project=chromium --grep @production-public-smoke/u,
    );
    assert.match(workflow, /--reporter=line,junit/u);
  });

  it('retains no bypass or executive credential in GitHub Actions', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./u);
    assert.doesNotMatch(workflow, /AUTOMATION_BYPASS_SECRET|EXECUTIVE_PREVIEW_ACCESS_KEY/u);
    assert.match(workflow, /aliasIdentity:[\s\S]*Not independently proven/iu);
  });

  it('surfaces the non-secret executive preview state in retained evidence', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /Executive preview state:[^\n]*canonical\?\.executivePreviewState/u);
    assert.match(workflow, /Executive preview expiry:[^\n]*canonical\?\.executivePreviewExpiresAt/u);
    assert.match(workflow, /executivePreviewState: canonical\?\.executivePreviewState/u);
    assert.match(workflow, /executivePreviewExpiresAt: canonical\?\.executivePreviewExpiresAt/u);
  });

  it('records the public browser outcome in the summary and observation evidence', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /BROWSER_OUTCOME: \$\{\{ steps\.browser\.outcome \}\}/u);
    assert.match(workflow, /Public browser outcome:[^\n]*process\.env\.BROWSER_OUTCOME/u);
    assert.match(workflow, /publicBrowserOutcome: process\.env\.BROWSER_OUTCOME/u);
  });
});
