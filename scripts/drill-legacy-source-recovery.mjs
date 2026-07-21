#!/usr/bin/env node

import path from 'node:path';

import {runStandaloneRestoreDrill} from './legacy-source-recovery-lib.mjs';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!options.bundle || !options.receipt) {
    throw new Error('--bundle and --receipt are required');
  }
  const receipt = await runStandaloneRestoreDrill({
    bundlePath: path.resolve(options.bundle),
    receiptPath: path.resolve(options.receipt),
    temporaryParent: options.temporaryParent
      ? path.resolve(options.temporaryParent)
      : undefined,
  });
  process.stdout.write(
    `Standalone restore drill passed for ${receipt.entryCount} entries.\n` +
      `Bundle SHA-256: ${receipt.bundleSha256}\n` +
      `Receipt: ${path.resolve(options.receipt)}\n`,
  );
}

function parseArguments(arguments_) {
  const options = {bundle: null, receipt: null, temporaryParent: null, help: false};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--bundle' || argument === '--receipt' || argument === '--temporary-parent') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      const key = {
        '--bundle': 'bundle',
        '--receipt': 'receipt',
        '--temporary-parent': 'temporaryParent',
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
  return `Usage: node scripts/drill-legacy-source-recovery.mjs --bundle <path> --receipt <path> [options]\n\nOptions:\n  --bundle <path>            Deterministic recovery bundle\n  --receipt <path>           New metadata-only JSON receipt; never overwritten\n  --temporary-parent <path>  Parent for the fresh temporary restore (defaults to OS temp)\n  --help                     Show this help\n`;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
