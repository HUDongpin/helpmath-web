#!/usr/bin/env node

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {verifyArchiveClosure} from './legacy-source-recovery-lib.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.dirname(SCRIPT_DIRECTORY);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!options.archiveRoot) {
    throw new Error('--archive-root is required');
  }

  const registryPath = path.join(REPOSITORY_ROOT, 'data/legacy-source-registry.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const evidencePath = options.manifest
    ? path.resolve(options.manifest)
    : path.join(REPOSITORY_ROOT, registry.currentEvidenceManifest);
  const result = await verifyArchiveClosure({
    archiveRoot: path.resolve(options.archiveRoot),
    registryPath,
    evidencePath,
  });
  if (result.errors.length > 0) {
    throw new Error(`legacy source archive closure failed:\n- ${result.errors.join('\n- ')}`);
  }

  process.stdout.write(
    `Verified closed archive: ${result.files.length} files, ` +
      `${result.selectedManifest.captures.length} selected captures, ` +
      `${result.manifests.length} dated manifest(s).\n`,
  );
}

function parseArguments(arguments_) {
  const options = {archiveRoot: null, manifest: null, help: false};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--archive-root' || argument === '--manifest') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      options[argument === '--archive-root' ? 'archiveRoot' : 'manifest'] = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function helpText() {
  return `Usage: node scripts/verify-legacy-source-archive.mjs --archive-root <absolute-path> [options]\n\nOptions:\n  --archive-root <path>  Dedicated external source archive\n  --manifest <path>      Repository evidence manifest (defaults to registry pointer)\n  --help                 Show this help\n`;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
