import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateAssetDirectory = path.join(repositoryRoot, 'private-demo-assets');
const staticDirectory = path.join(repositoryRoot, '.next', 'static');

const privateFingerprints = [
  'quart-pouring-full.png',
  'quart-empty-stage.png',
  'pitcher-back.png',
  'GALLON_MOVE_MATRICES',
  'LITER_SURFACE_TWIPS',
  '1 gallon equals 128 fluid ounces',
  '1 liter equals 1000 milliliters',
  'private-demo-runtime',
  'demos/modules/conversion-1-2',
  'demos/modules/conversion-1-4',
];

async function filesBelow(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  }));
  return nested.flat();
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

const privateAssetFiles = await filesBelow(privateAssetDirectory);
const privateAssetHashes = new Map();

for (const privateAssetFile of privateAssetFiles) {
  const hash = sha256(await readFile(privateAssetFile));
  const matchingAssets = privateAssetHashes.get(hash) ?? [];
  matchingAssets.push(path.relative(repositoryRoot, privateAssetFile));
  privateAssetHashes.set(hash, matchingAssets);
}

const staticFiles = await filesBelow(staticDirectory);
const leaks = [];

for (const staticFile of staticFiles) {
  const contents = await readFile(staticFile);
  const staticRelativePath = path.relative(repositoryRoot, staticFile);
  const matchingAssets = privateAssetHashes.get(sha256(contents));

  if (matchingAssets) {
    leaks.push({
      file: staticRelativePath,
      fingerprint: 'sha256',
      matches: matchingAssets,
    });
  }

  const text = contents.toString('utf8');
  for (const fingerprint of privateFingerprints) {
    if (text.includes(fingerprint)) {
      leaks.push({
        file: staticRelativePath,
        fingerprint,
      });
    }
  }
}

if (leaks.length > 0) {
  console.error(JSON.stringify({privateDemoStaticLeaks: leaks}, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    privateDemoStaticLeaks: 0,
    privateAssetsHashed: privateAssetFiles.length,
    scannedFiles: staticFiles.length,
  }));
}
