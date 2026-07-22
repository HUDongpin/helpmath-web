import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {siteContent} from '../content';

const identityKeys = new Set(['category', 'id', 'status']);

function contentShape(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => contentShape(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, entryValue]) => [
          entryKey,
          contentShape(entryValue, entryKey),
        ]),
    );
  }
  return identityKeys.has(key) ? value : typeof value;
}

describe('public HELP Math resource catalog', () => {
  it('keeps the complete English and Spanish content structures aligned', () => {
    assert.deepEqual(
      contentShape(siteContent.es),
      contentShape(siteContent.en),
    );
  });

  it('keeps the English and Spanish libraries structurally aligned', () => {
    const english = siteContent.en.pages.resources.items;
    const spanish = siteContent.es.pages.resources.items;
    const englishIds = english.map((item) => item.id);
    const spanishIds = spanish.map((item) => item.id);

    assert.deepEqual(spanishIds, englishIds);
    assert.equal(englishIds.length, 18);
    assert.equal(new Set(englishIds).size, englishIds.length);

    for (const items of [english, spanish]) {
      assert.equal(items.filter((item) => item.category === 'program').length, 4);
      assert.equal(items.filter((item) => item.category === 'research').length, 12);
      assert.equal(items.filter((item) => item.category === 'technical').length, 2);
    }
  });

  it('does not use the retiring legacy domain as a public citation target', () => {
    for (const [locale, content] of Object.entries(siteContent)) {
      assert.doesNotMatch(
        JSON.stringify(content),
        /(?:www\.)?helpprogram\.net/i,
        `${locale} public content must use canonical or durable external sources`,
      );
    }
  });

  it('keeps the confirmed partnership statement explicit in both locales', () => {
    assert.match(
      siteContent.en.pages.home.partnership.body,
      /Both organizations have confirmed this bilateral partnership/i,
    );
    assert.match(
      siteContent.es.pages.home.partnership.body,
      /Ambas organizaciones han confirmado esta alianza bilateral/i,
    );
  });
});
