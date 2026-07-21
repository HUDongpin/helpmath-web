import {lstat, mkdir, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, '.next-private', 'executive-demo-runtime');

const runtimes = [
  {
    id: 'conversion-1-2',
    entry: 'private-demo-runtime/conversion-1-2.ts',
    globalName: 'HelpMathExecutiveRuntimeConversion12',
  },
  {
    id: 'conversion-1-4',
    entry: 'private-demo-runtime/conversion-1-4.ts',
    globalName: 'HelpMathExecutiveRuntimeConversion14',
  },
];

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
