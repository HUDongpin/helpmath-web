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

  it('retains no bypass or executive credential in GitHub Actions', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./u);
    assert.doesNotMatch(workflow, /AUTOMATION_BYPASS_SECRET|EXECUTIVE_PREVIEW_ACCESS_KEY/u);
    assert.match(workflow, /aliasIdentity:[\s\S]*Not independently proven/iu);
  });
});
