import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {it} from 'node:test';

it('retains only blocker contracts while holding and excludes every evidence artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'helpmath-vercel-ignore-'));
  try {
    await writeFile(path.join(root, '.gitignore'), await readFile('.vercelignore'));
    const retained = [
      'docs/DEMO_PROMOTION.md',
      'docs/LEGAL_REVIEW.md',
      'docs/CONTACT_DELIVERY.md',
      'docs/LAUNCH_DECISIONS.md',
      'docs/LEGACY_CUTOVER.md',
    ];
    const ignored = [
      'docs/unrelated.md',
      'docs/evidence/other.json',
      'docs/evidence/launch-gates/legal-review.json',
      'docs/evidence/launch-gates/private-contract.json',
      'docs/evidence/launch-gates/secret.txt',
      'docs/evidence/launch-gates/.env',
      'docs/evidence/launch-gates/nested/secret.txt',
      'docs/evidence/launch-gates/nested/receipt.json',
    ];
    for (const relativePath of [...retained, ...ignored]) {
      const absolutePath = path.join(root, relativePath);
      await mkdir(path.dirname(absolutePath), {recursive: true});
      await writeFile(absolutePath, 'boundary probe\n');
    }
    const initialized = spawnSync('git', ['init', '--quiet'], {cwd: root, encoding: 'utf8'});
    assert.equal(initialized.status, 0, initialized.stderr);
    const checked = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: root,
      encoding: 'utf8',
      input: `${[...retained, ...ignored].join('\n')}\n`,
    });
    assert.equal(checked.status, 0, checked.stderr);
    const ignoredPaths = new Set(checked.stdout.trim().split(/\r?\n/u));
    for (const relativePath of retained) {
      assert.equal(ignoredPaths.has(relativePath), false, relativePath);
    }
    for (const relativePath of ignored) {
      assert.equal(ignoredPaths.has(relativePath), true, relativePath);
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
