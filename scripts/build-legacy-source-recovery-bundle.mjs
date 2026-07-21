#!/usr/bin/env node

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildRecoveryBundle} from './legacy-source-recovery-lib.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.dirname(SCRIPT_DIRECTORY);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!options.archiveRoot || !options.outputDirectory) {
    throw new Error('--archive-root and --output-directory are required');
  }

  const archiveRoot = path.resolve(options.archiveRoot);
  const outputDirectory = path.resolve(options.outputDirectory);
  const registryPath = path.join(REPOSITORY_ROOT, 'data/legacy-source-registry.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const evidencePath = options.manifest
    ? path.resolve(options.manifest)
    : path.join(REPOSITORY_ROOT, registry.currentEvidenceManifest);
  const result = await buildRecoveryBundle({
    archiveRoot,
    registryPath,
    evidencePath,
    outputDirectory,
    forbiddenRoots: [REPOSITORY_ROOT, archiveRoot],
  });
  process.stdout.write(
    `Built deterministic recovery bundle ${result.bundlePath}\n` +
      `Bundle SHA-256: ${result.bundleSha256}\n` +
      `Package root SHA-256: ${result.index.packageRootSha256}\n`,
  );
}

function parseArguments(arguments_) {
  const options = {archiveRoot: null, outputDirectory: null, manifest: null, help: false};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (
      argument === '--archive-root' ||
      argument === '--output-directory' ||
      argument === '--manifest'
    ) {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      const key = {
        '--archive-root': 'archiveRoot',
        '--output-directory': 'outputDirectory',
        '--manifest': 'manifest',
      }[argument];
      options[key] = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function helpText() {
  return `Usage: node scripts/build-legacy-source-recovery-bundle.mjs --archive-root <path> --output-directory <empty-path> [options]\n\nOptions:\n  --archive-root <path>       Closed external source archive\n  --output-directory <path>   Existing empty directory outside the archive and repository\n  --manifest <path>           Repository evidence manifest (defaults to registry pointer)\n  --help                      Show this help\n`;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
