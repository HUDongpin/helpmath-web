import {readFile} from 'node:fs/promises';

import executivePreviewWindow from '../config/executive-preview-window.json' with {type: 'json'};
import {evaluateExecutivePreviewLifecycle} from './release-smoke-helpers.mjs';

const [canonicalPath] = process.argv.slice(2);

if (!canonicalPath) {
  throw new Error('Usage: node scripts/check-executive-preview-lifecycle.mjs <canonical-smoke.json>');
}

const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
if (!Array.isArray(canonical.failures) || canonical.failures.length > 0) {
  throw new Error('Canonical production smoke must complete with zero failures first.');
}

const observation = evaluateExecutivePreviewLifecycle(
  {
    state: canonical.executivePreviewState,
    expiresAt: canonical.executivePreviewExpiresAt,
  },
  {
    maximumExpiresAt: executivePreviewWindow.maximumExpiresAt,
    nowMs: Date.now(),
  },
);

process.stdout.write(`${JSON.stringify(observation, null, 2)}\n`);
if (observation.failures.length > 0) process.exitCode = 1;
