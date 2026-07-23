import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {renderResourceEntriesMarkup} from '../components/resource-entry-markup';
import type {ResourceEntry} from '../content/types';

const entry: ResourceEntry = {
  id: 'reviewed-resource',
  category: 'research',
  title: 'Evidence & context',
  format: 'Official web record',
  dateLabel: 'Reviewed July 2026',
  status: 'available',
  statusLabel: 'Available now',
  description: 'A reviewed <source> with its limits attached.',
  action: {
    label: 'Open the "record"',
    href: 'https://example.com/report?lang=en&kind=review',
  },
};

describe('static resource-entry markup', () => {
  it('preserves the resource library contract without creating client-owned cards', () => {
    const html = renderResourceEntriesMarkup([entry]);

    assert.match(html, /<article class="resource-entry" id="reviewed-resource">/u);
    assert.match(html, /resource-entry__icon--available/u);
    assert.match(html, /status-badge--available/u);
    assert.match(html, /Evidence &amp; context/u);
    assert.match(html, /A reviewed &lt;source&gt; with its limits attached\./u);
    assert.match(
      html,
      /href="https:\/\/example\.com\/report\?lang=en&amp;kind=review"/u,
    );
    assert.match(html, /Open the &quot;record&quot;/u);
    assert.match(html, /aria-hidden="true" class="action__arrow">→<\/span>/u);
  });

  it('fails closed for unsafe or disguised cross-origin destinations', () => {
    for (const href of [
      'javascript:alert(1)',
      '//evil.example/report',
      '/\\evil.example/report',
      '/\nevil.example/report',
      ' https://example.com/report',
      'https://user@example.com/report',
    ]) {
      assert.throws(
        () => renderResourceEntriesMarkup([{
          ...entry,
          action: {...entry.action, href},
        }]),
        /Unsafe resource document href/u,
        href,
      );
    }
  });

  it('fails closed when runtime data violates the resource-status enum', () => {
    assert.throws(
      () => renderResourceEntriesMarkup([{
        ...entry,
        status: 'available" onclick="alert(1)' as ResourceEntry['status'],
      }]),
      /Unsafe resource status/u,
    );
  });
});
