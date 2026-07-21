import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {describe, it} from 'node:test';

import robots, {buildDemoLifecycleRobotsRule} from '../app/robots';
import sitemap from '../app/sitemap';
import {demoIds, indexableDemoIds} from '../demos/catalog';
import {DEMO_CANDIDATE_IDS} from '../demos/candidates';
import {demoLifecycleUpdatedAt} from '../lib/demo-lifecycle';

const require = createRequire(import.meta.url);
const {resolveRobots} = require(
  'next/dist/build/webpack/loaders/metadata/resolve-route-data.js',
) as {resolveRobots: (data: ReturnType<typeof robots>) => string};

describe('demo lifecycle robots boundary', () => {
  it('keeps sitemap, page crawling, and asset crawling aligned with lifecycle indexing', () => {
    const result = robots();
    const sitemapPaths = sitemap().map((entry) => new URL(entry.url).pathname);
    assert.equal(Array.isArray(result.rules), false);
    if (Array.isArray(result.rules)) throw new Error('Expected one robots rule');

    assert.deepEqual(result.rules.allow, [
      '/',
      ...indexableDemoIds.map((id) => `/api/executive-preview/assets/${id}/`),
    ]);
    assert.ok(result.rules.disallow?.includes('/api/'));
    assert.ok(result.rules.disallow?.includes('/executive-preview'));
    assert.ok(result.rules.disallow?.includes('/es/executive-preview'));

    for (const id of DEMO_CANDIDATE_IDS) {
      const isPublic = demoIds.includes(id);
      const indexable = indexableDemoIds.includes(id);
      for (const route of [`/demos/${id}`, `/es/demos/${id}`]) {
        assert.equal(result.rules.disallow?.includes(route), !isPublic, route);
        assert.equal(sitemapPaths.includes(route), indexable, route);
      }
      assert.equal(
        result.rules.allow?.includes(`/api/executive-preview/assets/${id}/`),
        indexable,
        id,
      );
    }
  });

  it('allows a conditional public page while only indexable assets receive an API exception', () => {
    const rule = buildDemoLifecycleRobotsRule(
      DEMO_CANDIDATE_IDS,
      ['conversion-1-2'],
      [],
    );

    assert.deepEqual(rule.allow, ['/']);
    assert.ok(rule.disallow.includes('/api/'));
    assert.equal(rule.disallow.includes('/demos/conversion-1-2'), false);
    assert.equal(rule.disallow.includes('/es/demos/conversion-1-2'), false);
    assert.ok(rule.disallow.includes('/demos/conversion-1-4'));
    assert.ok(rule.disallow.includes('/es/demos/conversion-1-4'));
  });

  it('unblocks an indexable demo page and its exact asset prefix', () => {
    const rule = buildDemoLifecycleRobotsRule(
      DEMO_CANDIDATE_IDS,
      ['conversion-1-2'],
      ['conversion-1-2'],
    );

    assert.deepEqual(rule.allow, [
      '/',
      '/api/executive-preview/assets/conversion-1-2/',
    ]);
    assert.ok(rule.disallow.includes('/api/'));
    assert.ok(rule.disallow.includes('/executive-preview'));
    assert.equal(rule.disallow.includes('/demos/conversion-1-2'), false);
    assert.equal(rule.disallow.includes('/es/demos/conversion-1-2'), false);
    assert.ok(rule.disallow.includes('/demos/conversion-1-4'));
    assert.ok(rule.disallow.includes('/es/demos/conversion-1-4'));
  });

  it('fails closed when an unknown demo is claimed as indexable', () => {
    const rule = buildDemoLifecycleRobotsRule(
      DEMO_CANDIDATE_IDS,
      ['unknown-demo'],
      ['unknown-demo'],
    );

    assert.deepEqual(rule.allow, ['/']);
    for (const id of DEMO_CANDIDATE_IDS) {
      assert.ok(rule.disallow.includes(`/demos/${id}`), id);
      assert.ok(rule.disallow.includes(`/es/demos/${id}`), id);
    }
  });

  it('serializes every allow array entry through the Next metadata route formatter', () => {
    const rule = buildDemoLifecycleRobotsRule(
      DEMO_CANDIDATE_IDS,
      ['conversion-1-2'],
      ['conversion-1-2'],
    );
    const text = resolveRobots({
      rules: rule,
      sitemap: 'https://www.helpmath.ai/sitemap.xml',
      host: 'https://www.helpmath.ai',
    });

    assert.match(text, /^User-Agent: \*$/mu);
    assert.match(text, /^Allow: \/$/mu);
    assert.match(
      text,
      /^Allow: \/api\/executive-preview\/assets\/conversion-1-2\/$/mu,
    );
    assert.match(text, /^Disallow: \/api\/$/mu);
  });

  it('dates the demo sitemap from the validated lifecycle manifest', () => {
    assert.ok(demoLifecycleUpdatedAt);
    const expected = new Date(demoLifecycleUpdatedAt);
    const demoEntries = sitemap().filter(({url}) =>
      ['/demos', '/es/demos'].includes(new URL(url).pathname),
    );

    assert.equal(demoEntries.length, 2);
    for (const entry of demoEntries) assert.deepEqual(entry.lastModified, expected);
  });
});
