import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {applyDemoLifecycleContent} from '../content/demo-lifecycle-content';
import {enContent} from '../content/en';
import {esContent} from '../content/es';

describe('demo lifecycle content', () => {
  it('preserves the current no-public-demo copy byte-for-byte by identity', () => {
    assert.equal(
      applyDemoLifecycleContent(enContent, {
        publicDemoIds: [],
        indexableDemoIds: [],
        reviewDemoIds: ['conversion-1-2', 'conversion-1-4'],
      }),
      enContent,
    );
    assert.equal(
      applyDemoLifecycleContent(esContent, {
        publicDemoIds: [],
        indexableDemoIds: [],
        reviewDemoIds: ['conversion-1-2', 'conversion-1-4'],
      }),
      esContent,
    );
  });

  it('publishes only selected conditional candidates with explicit limits', () => {
    const content = applyDemoLifecycleContent(enContent, {
      publicDemoIds: ['conversion-1-2'],
      indexableDemoIds: [],
      reviewDemoIds: ['conversion-1-4'],
    });

    assert.deepEqual(content.pages.demos.items.map(({id}) => id), ['conversion-1-2']);
    assert.equal(
      content.pages.demos.items[0].action.href,
      '/demos/conversion-1-2',
    );
    assert.ok(content.pages.demos.previewNotice.action);
    assert.equal(content.pages.demos.previewNotice.action.href, '/executive-preview');
    assert.match(content.pages.demos.hero.title, /conditional/u);
    assert.match(content.pages.demoDetails['conversion-1-2'].statusDetail, /Public access/u);
    assert.match(
      content.pages.demoDetails['conversion-1-2'].disclaimer,
      /must not be described as a completed or faithful migration/u,
    );
    assert.equal(
      content.pages.demoDetails['conversion-1-4'],
      enContent.pages.demoDetails['conversion-1-4'],
    );
  });

  it('uses reviewed Spanish copy only when the public candidate is indexable', () => {
    const content = applyDemoLifecycleContent(esContent, {
      publicDemoIds: ['conversion-1-4'],
      indexableDemoIds: ['conversion-1-4', 'conversion-1-2'],
      reviewDemoIds: [],
    });

    assert.deepEqual(content.pages.demos.items.map(({id}) => id), ['conversion-1-4']);
    assert.equal(
      content.pages.demos.items[0].action.href,
      '/es/demos/conversion-1-4',
    );
    assert.ok(content.pages.demos.previewNotice.action);
    assert.equal(
      content.pages.demos.previewNotice.action.href,
      '/es/demos/conversion-1-4',
    );
    assert.match(content.pages.demos.hero.title, /revisadas/u);
    assert.match(content.pages.demoDetails['conversion-1-4'].statusDetail, /Publicada/u);
    assert.doesNotMatch(
      content.pages.demoDetails['conversion-1-4'].statusDetail,
      /Validación estricta incompleta/u,
    );
  });

  it('deduplicates repeated public ids and ignores non-public indexable ids', () => {
    const content = applyDemoLifecycleContent(enContent, {
      publicDemoIds: ['conversion-1-2', 'conversion-1-2'],
      indexableDemoIds: ['conversion-1-4'],
      reviewDemoIds: [],
    });

    assert.equal(content.pages.demos.items.length, 1);
    assert.match(content.pages.demos.hero.title, /conditional/u);
  });
});
