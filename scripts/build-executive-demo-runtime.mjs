import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, '.next-private', 'executive-demo-runtime');
const candidateDirectory = path.join(repositoryRoot, 'demos', 'candidates');
const candidateFiles = (await readdir(candidateDirectory, {withFileTypes: true}))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort();

if (candidateFiles.length === 0) {
  throw new Error('No immutable demo candidates were found.');
}

const runtimes = [];
for (const filename of candidateFiles) {
  const text = await readFile(path.join(candidateDirectory, filename), 'utf8');
  const candidate = JSON.parse(text);
  const normalized = `${JSON.stringify(candidate, null, 2)}\n`;
  if (text !== normalized) {
    throw new Error(`Demo candidate must use canonical JSON: ${filename}`);
  }
  const id = candidate.id;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) || filename !== `${id}.json`) {
    throw new Error(`Unsafe or mismatched demo candidate id: ${filename}`);
  }
  const entry = candidate.runtime?.entry;
  const globalName = candidate.runtime?.globalName;
  const bundleSha256 = candidate.runtime?.bundleSha256;
  if (entry !== `private-demo-runtime/${id}.ts`) {
    throw new Error(`Candidate runtime entry does not match ${id}.`);
  }
  if (!/^HelpMathExecutiveRuntime[A-Za-z0-9]+$/u.test(globalName)) {
    throw new Error(`Candidate runtime global is invalid for ${id}.`);
  }
  if (!/^[a-f0-9]{64}$/u.test(bundleSha256)) {
    throw new Error(`Candidate runtime bundle digest is invalid for ${id}.`);
  }
  const artifactPaths = new Set(
    Array.isArray(candidate.artifacts)
      ? candidate.artifacts.map((artifact) => artifact?.path)
      : [],
  );
  runtimes.push({id, entry, globalName, bundleSha256, artifactPaths});
}

if (new Set(runtimes.map(({globalName}) => globalName)).size !== runtimes.length) {
  throw new Error('Candidate runtime globals must be unique.');
}

const expectedOutputDirectory = path.resolve(
  repositoryRoot,
  '.next-private',
  'executive-demo-runtime',
);
if (path.resolve(outputDirectory) !== expectedOutputDirectory) {
  throw new Error('Refusing to clean an unexpected private runtime output directory.');
}

const gitignore = await readFile(path.join(repositoryRoot, '.gitignore'), 'utf8');
const ignoredPaths = gitignore.split(/\r?\n/u).map((line) => line.trim());
if (!ignoredPaths.includes('.next-private/')) {
  throw new Error('The private runtime output root must remain ignored by Git.');
}

for (const candidate of [path.dirname(outputDirectory), outputDirectory]) {
  const metadata = await lstat(candidate).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (metadata?.isSymbolicLink()) {
    throw new Error(`Refusing to clean through a symbolic link: ${candidate}`);
  }
}

await rm(outputDirectory, {recursive: true, force: true});
await mkdir(outputDirectory, {recursive: true});

for (const runtime of runtimes) {
  const result = await build({
    absWorkingDir: repositoryRoot,
    bundle: true,
    define: {'process.env.NODE_ENV': '"production"'},
    entryPoints: [runtime.entry],
    format: 'iife',
    globalName: runtime.globalName,
    legalComments: 'none',
    metafile: true,
    minify: true,
    outfile: path.join(outputDirectory, `${runtime.id}.js`),
    platform: 'browser',
    sourcemap: false,
    target: ['es2022'],
    write: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`Failed to build the private runtime for ${runtime.id}.`);
  }

  const repositoryInputs = Object.keys(result.metafile.inputs)
    .filter((input) => !input.includes('node_modules/'))
    .sort();
  const missingInputs = repositoryInputs.filter(
    (input) => !runtime.artifactPaths.has(input),
  );
  if (missingInputs.length > 0) {
    throw new Error(
      `Candidate ${runtime.id} omits runtime inputs: ${missingInputs.join(', ')}`,
    );
  }

  const bundle = await readFile(path.join(outputDirectory, `${runtime.id}.js`));
  const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
  if (bundleSha256 !== runtime.bundleSha256) {
    throw new Error(
      `Private runtime digest mismatch for ${runtime.id}: expected ${runtime.bundleSha256}, received ${bundleSha256}`,
    );
  }
}

const expectedFiles = runtimes.map((runtime) => `${runtime.id}.js`).sort();
const outputEntries = await readdir(outputDirectory, {withFileTypes: true});
const outputFiles = outputEntries.map((entry) => entry.name).sort();
if (
  outputEntries.some((entry) => !entry.isFile())
  || JSON.stringify(outputFiles) !== JSON.stringify(expectedFiles)
) {
  throw new Error(
    `Unexpected private runtime output set: ${JSON.stringify(outputFiles)}`,
  );
}

console.log(`Built ${runtimes.length} authenticated executive demo runtimes.`);
