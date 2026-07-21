#!/usr/bin/env node

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  checksumManifest,
  expectedDocumentedLocators,
  manifestCsv,
  normalizeLegacyUrl,
  sha256,
  validateManifest,
  validateRegistry,
  verifyArchiveObjects,
} from './legacy-source-custody-lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.dirname(SCRIPT_DIR);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const registryPath = path.join(REPOSITORY_ROOT, 'data/legacy-source-registry.json');
  const registryText = await readFile(registryPath);
  const registry = JSON.parse(registryText.toString('utf8'));
  const evidencePath = options.manifest
    ? path.resolve(options.manifest)
    : path.join(REPOSITORY_ROOT, registry.currentEvidenceManifest);
  const [contentSources, legacyResourceMap, launchDecisions, manifest] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, 'docs/CONTENT_SOURCES.md'), 'utf8'),
    readFile(path.join(REPOSITORY_ROOT, 'docs/LEGACY_RESOURCE_MAP.md'), 'utf8'),
    readFile(path.join(REPOSITORY_ROOT, 'docs/LAUNCH_DECISIONS.md'), 'utf8'),
    readJson(evidencePath),
  ]);
  const [evidenceCsv, evidenceSha256] = await Promise.all([
    readFile(evidencePath.replace(/\.json$/, '.csv'), 'utf8'),
    readFile(evidencePath.replace(/\.json$/, '.sha256'), 'utf8'),
  ]);

  const errors = validateRegistry(registry);
  const expectedLocators = expectedDocumentedLocators(
    contentSources,
    legacyResourceMap,
    launchDecisions,
  );
  const registeredLocators = new Set(registry.sources.map((source) => normalizeLegacyUrl(source.url)));
  for (const locator of expectedLocators) {
    if (!registeredLocators.has(locator)) {
      errors.push(`documented locator is missing from the registry: ${locator}`);
    }
  }
  for (const locator of registeredLocators) {
    if (!expectedLocators.has(locator)) {
      errors.push(`registry locator is not present in the governed documentation: ${locator}`);
    }
  }
  errors.push(
    ...validateManifest(manifest, registry, {
      sourceRegistrySha256: sha256(registryText),
    }),
  );
  if (evidenceCsv !== manifestCsv(manifest)) {
    errors.push('repository CSV evidence does not match the JSON manifest');
  }
  if (evidenceSha256 !== checksumManifest(manifest)) {
    errors.push('repository SHA-256 evidence does not match the JSON manifest');
  }

  if (options.archiveRoot) {
    if (!path.isAbsolute(options.archiveRoot)) {
      errors.push('--archive-root must be an absolute path');
    } else {
      errors.push(...(await verifyArchiveObjects(manifest, options.archiveRoot)));
    }
  }
  if (options.requireSuccessful && manifest.summary.successful !== registry.sources.length) {
    errors.push(
      `successful capture required, but only ${manifest.summary.successful}/${registry.sources.length} sources returned valid HTTP 200 content`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`legacy source custody validation failed:\n- ${[...new Set(errors)].join('\n- ')}`);
  }

  process.stdout.write(
    `Validated ${registry.sources.length} registry locators and ${manifest.captures.length} metadata-only capture records.\n`,
  );
  if (options.archiveRoot) {
    process.stdout.write('Verified every referenced content-addressed object against byte size and SHA-256.\n');
  }
  if (!options.requireSuccessful && manifest.summary.successful !== registry.sources.length) {
    process.stdout.write(
      `Notice: ${manifest.summary.successful}/${registry.sources.length} sources returned valid HTTP 200 content; metadata consistency passes, but cutover completeness does not.\n`,
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function parseArguments(arguments_) {
  const options = {archiveRoot: null, manifest: null, requireSuccessful: false, help: false};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--require-successful') {
      options.requireSuccessful = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--archive-root' || argument === '--manifest') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      options[argument === '--archive-root' ? 'archiveRoot' : 'manifest'] = value;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function helpText() {
  return `Usage: node scripts/validate-legacy-source-custody.mjs [options]\n\nOptions:\n  --manifest <path>              Validate a specific metadata manifest\n  --archive-root <absolute-path> Verify archived bytes against size and SHA-256\n  --require-successful           Fail unless every source returned valid HTTP 200 content\n  --help                         Show this help\n`;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
