import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const expectedAssetPaths = [
  'private-demo-assets/conversion-1-2/gallon-0.png',
  'private-demo-assets/conversion-1-2/gallon-32.png',
  'private-demo-assets/conversion-1-2/gallon-64.png',
  'private-demo-assets/conversion-1-2/gallon-96.png',
  'private-demo-assets/conversion-1-2/gallon-128.png',
  'private-demo-assets/conversion-1-2/quart-empty-stage.png',
  'private-demo-assets/conversion-1-2/quart-full-stage.png',
  'private-demo-assets/conversion-1-2/quart-pouring-empty.png',
  'private-demo-assets/conversion-1-2/quart-pouring-full.png',
  'private-demo-assets/conversion-1-4/cylinder-base.png',
  'private-demo-assets/conversion-1-4/pitcher-back.png',
  'private-demo-assets/conversion-1-4/pitcher-front.png',
].sort();

const expectedRuntimePaths = [
  '.next-private/executive-demo-runtime/conversion-1-2.js',
  '.next-private/executive-demo-runtime/conversion-1-4.js',
].sort();

const traceContracts = [
  {
    expected: expectedAssetPaths,
    name: 'executive preview assets',
    path: path.join(
      repositoryRoot,
      '.next/server/app/api/executive-preview/assets/[...asset]/route.js.nft.json',
    ),
  },
  {
    expected: expectedRuntimePaths,
    name: 'executive preview runtime',
    path: path.join(
      repositoryRoot,
      '.next/server/app/api/executive-preview/runtime/[id]/route.js.nft.json',
    ),
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function isPrivateDemoPath(relativePath) {
  return relativePath.startsWith('private-demo-assets/')
    || relativePath.startsWith('private-demo-runtime/')
    || relativePath.startsWith('.next-private/executive-demo-runtime/');
}

async function privatePathsInTrace(tracePath) {
  let trace;
  try {
    trace = JSON.parse(await readFile(tracePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(repositoryRoot, tracePath)}: ${error.message}`);
  }

  if (!trace || !Array.isArray(trace.files) || trace.files.some((file) => typeof file !== 'string')) {
    throw new Error(`Invalid Next.js trace manifest: ${path.relative(repositoryRoot, tracePath)}`);
  }

  return trace.files
    .map((file) => path.resolve(path.dirname(tracePath), file))
    .map((absolutePath) => toPosixPath(path.relative(repositoryRoot, absolutePath)))
    .filter(isPrivateDemoPath)
    .sort();
}

for (const contract of traceContracts) {
  const actual = await privatePathsInTrace(contract.path);
  if (JSON.stringify(actual) !== JSON.stringify(contract.expected)) {
    console.error(JSON.stringify({
      privateDemoTraceMismatch: contract.name,
      expected: contract.expected,
      actual,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  privateDemoTraceFiles: expectedAssetPaths.length + expectedRuntimePaths.length,
  privateDemoAssets: expectedAssetPaths.length,
  privateDemoRuntimes: expectedRuntimePaths.length,
}));
