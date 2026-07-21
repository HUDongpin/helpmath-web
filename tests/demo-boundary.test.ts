import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbiddenArchiveDirectory =
  /(?:^|\/)(?:catalog|flash|HELP MATH_ORIGINAL FILES|migrations|output|outputs|ruffle|source|source-assets)(?:\/|$)/i;

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  }));
  return nested.flat();
}

test('the reviewed demo snapshot matches every pinned runtime and image hash', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repositoryRoot, 'demos/SNAPSHOT.json'), 'utf8')
  ) as {validationStatus: string; files: Record<string, string>};

  assert.equal(manifest.validationStatus, 'conditional');
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(repositoryRoot, relativePath));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, relativePath);
  }
});

test('the public repository contains no raw Flash or Ruffle payload', async () => {
  const files = await filesBelow(repositoryRoot);
  const relevant = files.filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
  assert.deepEqual(relevant.filter((file) => /\.(?:fla|swf)$/i.test(file)), []);
  assert.deepEqual(relevant.filter((file) => forbiddenArchiveDirectory.test(file)), []);
});
