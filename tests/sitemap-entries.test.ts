import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {describe, it} from 'node:test';

import sitemap from '../app/sitemap';
import {PUBLISHED_LEGAL_PAGE_PATHS} from '../lib/legal-publishing';
import {
  buildSitemapEntries,
  buildSitemapEntriesSafely,
  type SitemapBuildInput,
} from '../lib/sitemap-entries';
import {
  SITEMAP_DEMO_FALLBACK_LAST_MODIFIED,
  STATIC_SITEMAP_PAGES,
} from '../lib/sitemap-metadata';

const require = createRequire(import.meta.url);
const {resolveSitemap} = require(
  'next/dist/build/webpack/loaders/metadata/resolve-route-data.js',
) as {
  resolveSitemap: (data: ReturnType<typeof sitemap>) => string;
};

const siteUrl = new URL('https://www.helpmath.ai');
const fallbackDate = new Date(SITEMAP_DEMO_FALLBACK_LAST_MODIFIED);

function input(overrides: Partial<SitemapBuildInput> = {}): SitemapBuildInput {
  return {
    siteUrl,
    staticPages: STATIC_SITEMAP_PAGES,
    publishedLegalPaths: PUBLISHED_LEGAL_PAGE_PATHS,
    readIndexableDemoRoutes: () => [],
    readDemoLastModified: () => SITEMAP_DEMO_FALLBACK_LAST_MODIFIED,
    ...overrides,
  };
}

function pathsOf(entries: ReturnType<typeof buildSitemapEntries>): string[] {
  return entries.map((entry) => new URL(entry.url).pathname);
}

describe('sitemap generation guards', () => {
  it('keeps every returned lastModified serializable', () => {
    for (const entry of sitemap()) {
      assert.ok(entry.lastModified instanceof Date);
      assert.equal(Number.isNaN(entry.lastModified.getTime()), false);
      assert.equal(entry.lastModified.toISOString().length > 0, true);
    }
  });

  it('omits demo routes when lesson metadata cannot be read and keeps static pages', () => {
    const entries = buildSitemapEntries(input({
      readIndexableDemoRoutes: () => {
        throw new Error('catalog read failed');
      },
      readDemoLastModified: () => {
        throw new Error('lifecycle timestamp unavailable');
      },
    }));
    const paths = pathsOf(entries);

    assert.ok(paths.includes('/'));
    assert.ok(paths.includes('/es'));
    assert.ok(paths.includes('/about'));
    assert.equal(paths.some((path) => path.startsWith('/demos/')), false);
    for (const entry of entries) {
      assert.equal(Number.isNaN((entry.lastModified as Date).getTime()), false);
    }
  });

  it('serves only the home locales when sitemap input cannot be read', () => {
    const entries = buildSitemapEntriesSafely(() => {
      throw new Error('cold start metadata failure');
    });

    assert.deepEqual(pathsOf(entries).sort(), ['/', '/es']);
    for (const entry of entries) {
      assert.deepEqual(entry.lastModified, fallbackDate);
      assert.equal(entry.changeFrequency, 'weekly');
      assert.equal(entry.priority, 1);
      assert.equal(entry.alternates?.languages?.en, 'https://www.helpmath.ai/');
      assert.equal(entry.alternates?.languages?.es, 'https://www.helpmath.ai/es');
      assert.equal(entry.alternates?.languages?.['x-default'], 'https://www.helpmath.ai/');
    }
  });

  it('replaces an invalid lastModified instead of emitting an Invalid Date', () => {
    const entries = buildSitemapEntries(input({
      staticPages: [
        {path: '/', lastModified: '2026-07-22T00:00:00.000Z'},
        {path: '/about', lastModified: 'not-a-date'},
      ],
      readIndexableDemoRoutes: () => ['/demos/conversion-1-2'],
      readDemoLastModified: () => 'also-not-a-date',
    }));
    const about = entries.find((entry) => new URL(entry.url).pathname === '/about');
    const demo = entries.find((entry) => new URL(entry.url).pathname === '/demos/conversion-1-2');

    assert.ok(about);
    assert.ok(demo);
    assert.deepEqual(about.lastModified, fallbackDate);
    assert.deepEqual(demo.lastModified, fallbackDate);
    assert.equal(demo.priority, 0.8);
    assert.equal(about.priority, 0.7);
  });

  it('skips a route whose URL cannot be built and still returns the home pages', () => {
    const entries = buildSitemapEntries(input({
      staticPages: [
        {path: '/', lastModified: SITEMAP_DEMO_FALLBACK_LAST_MODIFIED},
        {path: 'https://[' as `/${string}`, lastModified: SITEMAP_DEMO_FALLBACK_LAST_MODIFIED},
      ],
    }));
    const paths = pathsOf(entries);

    assert.deepEqual(paths.sort(), ['/', '/es']);
    assert.equal(paths.includes('https://['), false);
  });

  it('keeps unpublished legal pages out of a partially recovered sitemap', () => {
    const entries = buildSitemapEntries(input({
      staticPages: [
        {path: '/', lastModified: SITEMAP_DEMO_FALLBACK_LAST_MODIFIED},
        {path: '/privacy', lastModified: 'not-a-date', publication: 'legal'},
        {path: '/terms', lastModified: SITEMAP_DEMO_FALLBACK_LAST_MODIFIED, publication: 'legal'},
      ],
      publishedLegalPaths: [],
    }));

    assert.deepEqual(pathsOf(entries).sort(), ['/', '/es']);
  });

  it('serializes recovered entries to sitemap XML, while an Invalid Date would throw', () => {
    assert.throws(() => resolveSitemap([
      {
        url: 'https://www.helpmath.ai/',
        lastModified: new Date('not-a-date'),
      },
    ]));

    const recovered = buildSitemapEntriesSafely(() => {
      throw new Error('metadata unavailable during serialization');
    });
    const xml = resolveSitemap(recovered);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<loc>https:\/\/www\.helpmath\.ai\/<\/loc>/);
    assert.match(xml, /<loc>https:\/\/www\.helpmath\.ai\/es<\/loc>/);
    assert.match(xml, /<lastmod>2026-07-22T00:00:00\.000Z<\/lastmod>/);
    assert.equal(xml.includes('not-a-date'), false);

    const published = resolveSitemap(sitemap());
    assert.match(published, /<loc>https:\/\/www\.helpmath\.ai\/about<\/loc>/);
    assert.equal(published.includes('/privacy'), false);
    assert.equal(published.includes('/terms'), false);
  });

  it('returns the home sitemap when every static route fails', () => {
    const entries = buildSitemapEntries(input({
      staticPages: [
        {path: 'https://[' as `/${string}`, lastModified: SITEMAP_DEMO_FALLBACK_LAST_MODIFIED},
      ],
      readIndexableDemoRoutes: () => ['https://['],
    }));

    assert.deepEqual(pathsOf(entries).sort(), ['/', '/es']);
  });
});
