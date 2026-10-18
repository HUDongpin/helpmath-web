import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const workflowPath = path.join(
  process.cwd(),
  '.github/workflows/executive-preview-lifecycle.yml',
);

describe('executive preview lifecycle workflow', () => {
  it('verifies an explicit preview at its own commit and never defaults to www', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /^on:\n  deployment_status:/mu);
    assert.doesNotMatch(workflow, /schedule:/u);
    assert.match(workflow, /^  workflow_dispatch:\s*$/mu);
    assert.match(workflow, /github\.event\.deployment\.environment == 'Preview'/u);
    assert.match(workflow, /SMOKE_BASE_URL: \$\{\{ github\.event\.deployment_status\.environment_url \|\| inputs\.base_url \}\}/u);
    assert.match(workflow, /ref: \$\{\{ env\.SMOKE_SHA \}\}/u);
    assert.match(workflow, /Smoke skipped/u);
    assert.doesNotMatch(workflow, /www\.helpmath\.ai/u);
    assert.match(workflow, /timeout-minutes: 10/u);
  });

  it('reuses the full public smoke and then enforces the repository window', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /node scripts\/release-smoke\.mjs/u);
    assert.match(workflow, /node scripts\/check-executive-preview-lifecycle\.mjs/u);
    assert.match(workflow, /canonical-contract\.json/u);
    assert.match(workflow, /lifecycle-observation\.json/u);
  });

  it('uses no credential or write permission and retains only non-secret evidence', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /permissions:\n  contents: read/u);
    assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./u);
    assert.doesNotMatch(
      workflow,
      /EXECUTIVE_PREVIEW_ACCESS_KEY|EXECUTIVE_PREVIEW_SESSION_SECRET|AUTOMATION_BYPASS_SECRET/u,
    );
    assert.match(workflow, /retention-days: 30/u);
  });

  it('skips protected previews instead of authenticating', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /Protection probe/u);
    assert.match(workflow, /"\$\{status\}" == "401" \|\| "\$\{status\}" == "403"/u);
    assert.match(workflow, /vercel\\\.com\/sso/u);
    assert.match(workflow, /SKIPPED \(protected preview/u);
  });
});
