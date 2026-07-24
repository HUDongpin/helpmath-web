import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import nextConfig from '../next.config';

type Rewrite = {destination: string; source: string};

test('static marketing rewrites cover both locales without exposing internal route names', async () => {
  assert.ok(nextConfig.rewrites);
  const configured = await nextConfig.rewrites();
  assert.ok(Array.isArray(configured));
  const rewrites = configured as Rewrite[];
  const bySource = new Map(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));

  assert.equal(bySource.get('/'), '/static/en/home');
  assert.equal(bySource.get('/es'), '/static/es/home');
  assert.equal(bySource.get('/research'), '/static/en/research');
  assert.equal(bySource.get('/es/research'), '/static/es/research');
  assert.equal(bySource.get('/demos'), '/static/en/demos');
  assert.equal(bySource.get('/es/demos'), '/static/es/demos');
  assert.equal(bySource.get('/resources'), '/static/en/resources');
  assert.equal(bySource.get('/es/resources'), '/static/es/resources');
  assert.equal(bySource.get('/demos/:id'), '/en/demos/:id');
  assert.equal(
    [...bySource.keys()].some((source) => /^\/demos\/conversion-/u.test(source)),
    false,
  );
  assert.equal([...bySource.keys()].some((source) => source.startsWith('/static/')), false);
});

test('every static marketing page disables the Next client runtime', async () => {
  for (const page of ['home', 'research', 'resources', 'demos'] as const) {
    const source = await readFile(
      new URL(`../pages/static/[locale]/${page}.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(source, /unstable_runtimeJS:\s*false/u, page);
  }
});

test('the resource controller is small, local, and network independent', async () => {
  const source = await readFile(
    new URL('../public/static-resource-library.js', import.meta.url),
    'utf8',
  );
  assert.ok(Buffer.byteLength(source) <= 10_000);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/u);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\b/u);
  assert.match(source, /resourceCategory/u);
  assert.match(source, /resource-fragment-navigation/u);

  const proxySource = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxySource, /['"]\/static-resource-library\.js['"]/u);
});

test('the static navigation controller is small, local, and network independent', async () => {
  const source = await readFile(
    new URL('../public/static-marketing-navigation.js', import.meta.url),
    'utf8',
  );
  assert.ok(Buffer.byteLength(source) <= 9_000);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/u);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\b/u);
  assert.match(source, /help-math:location-change/u);
  assert.match(source, /status-strip--menu-open/u);
  assert.match(source, /prefers-reduced-motion/u);

  const proxySource = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxySource, /['"]\/static-marketing-navigation\.js['"]/u);
});
