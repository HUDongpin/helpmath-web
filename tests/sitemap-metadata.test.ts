import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import sitemap from '../app/sitemap';
import {PUBLISHED_LEGAL_PAGE_PATHS} from '../lib/legal-publishing';
import {STATIC_SITEMAP_PAGES} from '../lib/sitemap-metadata';

describe('static sitemap metadata', () => {
  it('keeps every static date explicit, canonical, and unique by path', () => {
    const paths = STATIC_SITEMAP_PAGES.map(({path}) => path);
    assert.equal(new Set(paths).size, paths.length);

    for (const {lastModified, path} of STATIC_SITEMAP_PAGES) {
      assert.equal(new Date(lastModified).toISOString(), lastModified, path);
    }
  });

  it('records the July 22 content update without redating unchanged pages', () => {
    const dates = new Map(
      STATIC_SITEMAP_PAGES.map(({lastModified, path}) => [path, lastModified]),
    );
    const july22 = '2026-07-22T00:00:00.000Z';
    const july21 = '2026-07-21T00:00:00.000Z';

    for (const path of ['/', '/about', '/research'] as const) {
      assert.equal(dates.get(path), july22, path);
    }
    for (const path of [
      '/approach',
      '/curriculum',
      '/resources',
      '/support',
      '/login',
      '/contact',
      '/privacy',
      '/terms',
    ] as const) {
      assert.equal(dates.get(path), july21, path);
    }
  });

  it('publishes matching English and Spanish dates from the canonical source', () => {
    const entries = sitemap();
    const publishedLegalPaths = new Set(PUBLISHED_LEGAL_PAGE_PATHS);

    for (const page of STATIC_SITEMAP_PAGES) {
      if (page.publication === 'legal' && !publishedLegalPaths.has(page.path)) continue;

      const englishPath = page.path;
      const spanishPath = page.path === '/' ? '/es' : `/es${page.path}`;
      const english = entries.find(({url}) => new URL(url).pathname === englishPath);
      const spanish = entries.find(({url}) => new URL(url).pathname === spanishPath);

      assert.ok(english, `Missing English sitemap entry for ${page.path}`);
      assert.ok(spanish, `Missing Spanish sitemap entry for ${page.path}`);
      assert.deepEqual(english.lastModified, new Date(page.lastModified), page.path);
      assert.deepEqual(spanish.lastModified, english.lastModified, page.path);
    }
  });
});
