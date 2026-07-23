import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {activeClientModuleSource} from './client-reference-manifest.mjs';

const repositoryRoot = process.cwd();
const nextRoot = path.join(repositoryRoot, '.next');
const appOutputRoot = path.join(nextRoot, 'server/app');
const turnstileRuntimeMarker = 'challenges.cloudflare.com/turnstile/';
const resourceControlsMarker = '/components/resource-library-controls.tsx';
const pageHeroMotifMarker = '/components/page-hero-motif.tsx';
const siteHeaderMarker = '/components/site-header.tsx';
const nextLinkMarker = '/node_modules/next/dist/client/app-dir/link.js';
const localeProviderBoundaryMarker = ',"LocaleProvider"]';
const resourceHashBootstrapMarker = 'id="help-math-resource-hash-bootstrap"';
const clientLinkFreeRouteManifests = new Set([
  '[locale]/research/page_client-reference-manifest.js',
  '[locale]/resources/page_client-reference-manifest.js',
]);
const resourceHashBootstrapExpectedPages = [
  'en/resources.html',
  'es/resources.html',
];

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

async function filesNamed(directory, suffix) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return filesNamed(absolutePath, suffix);
      return entry.isFile() && entry.name.endsWith(suffix) ? [absolutePath] : [];
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
    const absolutePath = path.join(
      nextRoot,
      decodeURIComponent(assetPath.replace('/_next/', '')),
    );
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
const localeProviderBoundaryPages = [];
const resourceHashBootstrapPages = [];
for (const filename of pages) {
  const relativePath = path.relative(appOutputRoot, filename);
  const html = await readFile(filename, 'utf8');
  const rsc = await readFile(filename.replace(/\.html$/u, '.rsc'), 'utf8');
  const hasTurnstile = await referencesTurnstile(html);
  const isContact = /^(?:en|es)\/contact\.html$/u.test(relativePath);

  if (hasTurnstile) turnstilePages.push(relativePath);
  if (rsc.includes(localeProviderBoundaryMarker)) {
    localeProviderBoundaryPages.push(relativePath);
  }
  if (html.includes(resourceHashBootstrapMarker)) {
    resourceHashBootstrapPages.push(relativePath);
  }
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
assert.deepEqual(
  localeProviderBoundaryPages,
  [],
  'Shared public pages must not render the LocaleProvider client boundary.',
);
assert.deepEqual(
  resourceHashBootstrapPages,
  resourceHashBootstrapExpectedPages,
  'Only the English and Spanish Resources pages may render the resource hash bootstrap.',
);

const clientManifests = (
  await filesNamed(appOutputRoot, '_client-reference-manifest.js')
).sort();
const resourceControlsManifests = [];
const clientLinkFreeManifests = [];
for (const filename of clientManifests) {
  const relativePath = path.relative(appOutputRoot, filename);
  const source = await readFile(filename, 'utf8');
  const activeModuleSource = activeClientModuleSource(source, relativePath);

  assert.doesNotMatch(
    activeModuleSource,
    new RegExp(pageHeroMotifMarker.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `${relativePath} must render the static page-hero motif on the server.`,
  );
  assert.doesNotMatch(
    activeModuleSource,
    new RegExp(siteHeaderMarker.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `${relativePath} must render the site-header shell on the server.`,
  );
  if (clientLinkFreeRouteManifests.has(relativePath)) {
    assert.doesNotMatch(
      activeModuleSource,
      new RegExp(nextLinkMarker.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
      `${relativePath} must use document navigation instead of shipping Next Link.`,
    );
    clientLinkFreeManifests.push(relativePath);
  }
  if (activeModuleSource.includes(resourceControlsMarker)) {
    resourceControlsManifests.push(relativePath);
  }
}
assert.deepEqual(
  resourceControlsManifests,
  ['[locale]/resources/page_client-reference-manifest.js'],
  'Only the Resources route may load the resource controls client island.',
);
assert.deepEqual(
  clientLinkFreeManifests,
  [...clientLinkFreeRouteManifests].sort(),
  'Research and Resources must remain free of the Next Link client runtime.',
);

console.log(
  JSON.stringify({
    checkedPublicPages: pages.length,
    clientLinkFreeManifests,
    contactRepositoryGateApproved,
    localeProviderBoundaryPages,
    resourceHashBootstrapPages,
    resourceControlsManifests,
    turnstilePages,
  }),
);
