import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {tsImport} from 'tsx/esm/api';

const repositoryRoot = process.cwd();
const nextRoot = path.join(repositoryRoot, '.next');
const appOutputRoot = path.join(nextRoot, 'server/app');
const turnstileRuntimeMarker = 'challenges.cloudflare.com/turnstile/';

async function htmlFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return htmlFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith('.html') ? [absolutePath] : [];
    }),
  );
  return nested.flat();
}

function clientAssetPaths(html) {
  return [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/_next\/static\/(?:chunks|css)\/[^"?]+)"/gu)].map(
        (match) => match[1],
      ),
    ),
  ];
}

async function referencesTurnstile(html) {
  for (const assetPath of clientAssetPaths(html)) {
    const absolutePath = path.join(nextRoot, assetPath.replace('/_next/', ''));
    const source = await readFile(absolutePath, 'utf8');
    if (source.includes(turnstileRuntimeMarker)) return true;
  }
  return false;
}

const launchGateRuntimeModule = await tsImport(
  '../lib/launch-gates.ts',
  import.meta.url,
);
const launchGateRuntime = launchGateRuntimeModule.resolveLaunchGateRuntime();
assert.equal(
  launchGateRuntime.valid,
  true,
  `Launch-gate runtime is invalid: ${launchGateRuntime.errors.join('; ')}`,
);
const contactRepositoryGateApproved =
  launchGateRuntime.gates.legalPublication.active &&
  launchGateRuntime.gates.contactIntake.active;
const pages = (await htmlFiles(appOutputRoot))
  .filter((filename) => /\/server\/app\/(?:en|es)(?:\/|\.html$)/u.test(filename))
  .sort();

assert.ok(pages.length > 0, 'No prerendered public locale pages were found.');

const turnstilePages = [];
for (const filename of pages) {
  const relativePath = path.relative(appOutputRoot, filename);
  const html = await readFile(filename, 'utf8');
  const hasTurnstile = await referencesTurnstile(html);
  const isContact = /^(?:en|es)\/contact\.html$/u.test(relativePath);

  if (hasTurnstile) turnstilePages.push(relativePath);
  assert.ok(
    isContact || !hasTurnstile,
    `${relativePath} references the gated Turnstile contact runtime.`,
  );

  if (isContact && !contactRepositoryGateApproved) {
    assert.equal(
      hasTurnstile,
      false,
      `${relativePath} must not preload Turnstile while contact gates are holding.`,
    );
    assert.doesNotMatch(html, /<form\b/iu, `${relativePath} unexpectedly renders a form.`);
    assert.match(
      html,
      /Contact intake is not accepting messages yet|El formulario de contacto aún no acepta mensajes/iu,
      `${relativePath} is missing the closed-intake status.`,
    );
  }
}

console.log(
  JSON.stringify({
    checkedPublicPages: pages.length,
    contactRepositoryGateApproved,
    turnstilePages,
  }),
);
