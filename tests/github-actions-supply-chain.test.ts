import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const workflowsDirectory = path.join(repositoryRoot, '.github/workflows');

const approvedActions = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
]);

describe('GitHub Actions supply-chain policy', () => {
  it('pins every external action to an approved full commit SHA', async () => {
    const workflowNames = (await readdir(workflowsDirectory)).filter((name) =>
      /\.ya?ml$/u.test(name),
    );
    assert.ok(workflowNames.length > 0);

    for (const workflowName of workflowNames) {
      const workflow = await readFile(path.join(workflowsDirectory, workflowName), 'utf8');
      const uses = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gmu)].map(
        (match) => match[1],
      );
      for (const reference of uses) {
        const match = reference.match(/^([^@]+)@([0-9a-f]{40})$/u);
        assert.ok(match, `${workflowName} has a mutable or invalid action reference: ${reference}`);
        assert.equal(
          approvedActions.get(match[1]),
          match[2],
          `${workflowName} has an unreviewed action commit: ${reference}`,
        );
      }
    }
  });

  it('allows Dependabot to propose reviewed GitHub Actions commit updates', async () => {
    const config = await readFile(path.join(repositoryRoot, '.github/dependabot.yml'), 'utf8');

    assert.match(config, /package-ecosystem:\s*github-actions/u);
    assert.match(config, /directory:\s*\//u);
    assert.match(config, /interval:\s*weekly/u);
    assert.match(config, /timezone:\s*Asia\/Shanghai/u);
  });

  it('checks npm dependencies daily and groups security updates', async () => {
    const config = await readFile(path.join(repositoryRoot, '.github/dependabot.yml'), 'utf8');
    const npmBlock = config.match(
      /package-ecosystem:\s*npm(?<block>[\s\S]*?)(?=\n\s*-\s*package-ecosystem:|\s*$)/u,
    )?.groups?.block;

    assert.ok(npmBlock, 'Dependabot must monitor the root npm project');
    assert.match(npmBlock, /directory:\s*\//u);
    assert.match(npmBlock, /interval:\s*daily/u);
    assert.match(npmBlock, /timezone:\s*Asia\/Shanghai/u);
    assert.match(npmBlock, /npm-security:[\s\S]*applies-to:\s*security-updates/u);
    assert.match(npmBlock, /patterns:[\s\S]*-\s*"\*"/u);
    assert.match(npmBlock, /npm-production:[\s\S]*dependency-type:\s*production/u);
    assert.match(npmBlock, /npm-development:[\s\S]*dependency-type:\s*development/u);
  });
});
