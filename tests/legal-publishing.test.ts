import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import sitemap from '../app/sitemap';
import {
  DRAFT_LEGAL_PAGE_NAMES,
  DRAFT_LEGAL_PATHS,
  isDraftLegalPage,
} from '../lib/legal-publishing';
import {isLegalCopyDraft, isLegalCopyReady} from '../lib/legal-copy-readiness';

describe('draft legal publishing boundary', () => {
  it('keeps every draft route out of the public sitemap', () => {
    const sitemapUrls = sitemap().map((entry) => new URL(entry.url).pathname);

    for (const path of DRAFT_LEGAL_PATHS) {
      assert.equal(sitemapUrls.includes(path), false, path);
    }
  });

  it('identifies only the legal draft page names', () => {
    assert.deepEqual(DRAFT_LEGAL_PAGE_NAMES, ['privacy', 'terms']);
    assert.equal(isDraftLegalPage('privacy'), true);
    assert.equal(isDraftLegalPage('terms'), true);
    assert.equal(isDraftLegalPage('contact'), false);
  });

  it('keeps the machine-readable legal copy state aligned with the holding gate', () => {
    assert.equal(isLegalCopyDraft(), true);
    assert.equal(isLegalCopyReady(), false);
  });
});
