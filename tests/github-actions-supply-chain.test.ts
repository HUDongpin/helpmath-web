import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const workflowsDirectory = path.join(repositoryRoot, '.github/workflows');

const approvedActions = new Map([
  ['actions/checkout', 'd23441a48e516b6c34aea4fa41551a30e30af803'],
  ['actions/setup-node', '249970729cb0ef3589644e2896645e5dc5ba9c38'],
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
});
