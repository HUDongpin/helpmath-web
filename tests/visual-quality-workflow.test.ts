import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repositoryRoot = process.cwd();
const workflowPath = path.join(repositoryRoot, '.github/workflows/quality.yml');
const snapshotDirectory = path.join(
  repositoryRoot,
  'visual-tests/public-pages.visual.spec.ts-snapshots',
);
const expectedSnapshots = [
  'home-desktop.png',
  'home-mobile.png',
  'partnership-en-desktop.png',
  'partnership-es-mobile.png',
  'program-lineage-en-desktop.png',
  'research-hero-desktop.png',
  'spanish-terms-hero-320.png',
] as const;

describe('visual regression quality gate', () => {
  it('runs only against the reviewed pinned Playwright container', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    assert.match(workflow, /^  browser-quality:\n/mu);
    assert.match(
      workflow,
      /mcr\.microsoft\.com\/playwright:v1\.61\.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48/u,
    );
    assert.match(workflow, /options: --user 1001/u);
    assert.match(workflow, /run: npm run test:visual/u);
    assert.doesNotMatch(workflow, /test:visual:update|--update-snapshots/u);
    assert.match(workflow, /name: visual-regression-\$\{\{ github\.run_id \}\}/u);
    assert.match(workflow, /artifacts\/playwright-visual-report\/results\.xml/u);
    assert.match(workflow, /if-no-files-found: error/u);

    const visualConfig = await readFile(
      path.join(repositoryRoot, 'playwright.visual.config.ts'),
      'utf8',
    );
    assert.match(visualConfig, /\['junit', \{outputFile: 'artifacts\/playwright-visual-report\/results\.xml'\}\]/u);
  });

  it('retains exactly the seven reviewed public-page PNG baselines', async () => {
    const filenames = (await readdir(snapshotDirectory)).sort();
    assert.deepEqual(filenames, [...expectedSnapshots].sort());

    for (const filename of filenames) {
      const bytes = await readFile(path.join(snapshotDirectory, filename));
      assert.deepEqual(
        [...bytes.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
        `${filename} is not a PNG baseline`,
      );
      assert.ok(bytes.length > 10_000, `${filename} is implausibly small`);
    }
  });
});
