import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createElement, Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {renderResearchEvidenceMarkup} from '../components/research-evidence-markup';
import {Archive, CheckCircle2, FileCheck2, SearchCheck} from '../components/server-icons';
import {Action} from '../components/ui';
import {getSiteContent} from '../content';
import type {EvidenceEntry, EvidenceStatus} from '../content/types';

const referenceIcons: Record<EvidenceStatus, typeof Archive> = {
  archived: Archive,
  verification: SearchCheck,
  context: FileCheck2,
  verified: CheckCircle2,
};

const baseEntry: EvidenceEntry = {
  id: 'reviewed-evidence',
  title: 'Evidence & <context> "quoted" \'single\'',
  dateLabel: 'Reviewed <July> & August',
  status: 'verified',
  statusLabel: 'Verified & reviewed',
  summary: 'A reviewed <source> & its scope.',
  interpretation: 'Use "carefully" & preserve limits.',
  sourceLabel: 'Source: Researcher\'s <archive>',
  sourceActions: [{
    label: 'Open the "record" & notes',
    href: 'https://example.com/report?lang=en&kind=review',
  }],
};

function renderReferenceMarkup(entries: EvidenceEntry[]) {
  const indexMarkup = renderToStaticMarkup(createElement(
    'ol',
    null,
    entries.map((entry) => createElement(
      'li',
      {key: entry.id},
      createElement(
        'a',
        {href: `#${entry.id}`},
        createElement(
          'span',
          {className: `status-badge status-badge--${entry.status}`},
          entry.statusLabel,
        ),
        createElement('span', null, entry.title),
      ),
    )),
  )).replaceAll('&#x27;', '&#39;');

  const entriesMarkup = renderToStaticMarkup(createElement(
    Fragment,
    null,
    entries.map((entry) => {
      const Icon = referenceIcons[entry.status];
      return createElement(
        'article',
        {className: 'evidence-entry', id: entry.id, key: entry.id},
        createElement(
          'div',
          {className: 'evidence-entry__meta'},
          createElement(Icon, {'aria-hidden': true, size: 22}),
          createElement(
            'span',
            {className: `status-badge status-badge--${entry.status}`},
            entry.statusLabel,
          ),
          createElement('span', null, entry.dateLabel),
        ),
        createElement(
          'div',
          null,
          createElement('h2', null, entry.title),
          createElement('p', null, entry.summary),
          createElement(
            'p',
            {className: 'evidence-entry__interpretation'},
            entry.interpretation,
          ),
          createElement(
            'p',
            {className: 'evidence-entry__source'},
            entry.sourceLabel,
          ),
          entry.sourceActions?.length
            ? createElement(
                'div',
                {className: 'evidence-entry__actions'},
                entry.sourceActions.map((action) => createElement(Action, {
                  action,
                  key: action.href,
                  kind: 'quiet',
                  navigation: 'document',
                })),
              )
            : null,
        ),
      );
    }),
  )).replaceAll('&#x27;', '&#39;');

  return {entriesMarkup, indexMarkup};
}

describe('static research-evidence markup', () => {
  it('is DOM- and SVG-equivalent to the prior React evidence register', () => {
    const entries: EvidenceEntry[] = (
      ['archived', 'verification', 'context', 'verified'] as const
    ).map((status, index) => ({
      ...baseEntry,
      id: `${status}-evidence`,
      sourceActions: index === 3 ? baseEntry.sourceActions : undefined,
      status,
    }));

    assert.deepEqual(
      renderResearchEvidenceMarkup(entries),
      renderReferenceMarkup(entries),
    );

    const {entriesMarkup, indexMarkup} = renderResearchEvidenceMarkup(entries);
    assert.match(indexMarkup, /Evidence &amp; &lt;context&gt; &quot;quoted&quot; &#39;single&#39;/u);
    assert.match(entriesMarkup, /A reviewed &lt;source&gt; &amp; its scope\./u);
    assert.match(entriesMarkup, /Researcher&#39;s &lt;archive&gt;/u);
    assert.match(entriesMarkup, /href="https:\/\/example\.com\/report\?lang=en&amp;kind=review"/u);
  });

  it('preserves every localized index and article in source order', () => {
    for (const locale of ['en', 'es'] as const) {
      const entries = getSiteContent(locale).pages.research.entries;
      const {entriesMarkup, indexMarkup} = renderResearchEvidenceMarkup(entries);

      assert.equal(indexMarkup.match(/<li>/gu)?.length, entries.length, locale);
      assert.equal(
        entriesMarkup.match(/<article class="evidence-entry"/gu)?.length,
        entries.length,
        locale,
      );

      let priorIndexPosition = -1;
      let priorEntryPosition = -1;
      for (const entry of entries) {
        const indexPosition = indexMarkup.indexOf(`href="#${entry.id}"`);
        const entryPosition = entriesMarkup.indexOf(`id="${entry.id}"`);
        assert.ok(indexPosition > priorIndexPosition, `${locale}:${entry.id} index order`);
        assert.ok(entryPosition > priorEntryPosition, `${locale}:${entry.id} entry order`);
        priorIndexPosition = indexPosition;
        priorEntryPosition = entryPosition;
      }
    }
  });

  it('accepts only reviewed internal paths and HTTPS source destinations', () => {
    for (const href of [
      '/resources#reviewed-record',
      '/es/resources#reviewed-record',
      'https://example.com/report?lang=en&kind=review',
    ]) {
      const {entriesMarkup} = renderResearchEvidenceMarkup([{
        ...baseEntry,
        sourceActions: [{label: 'Open source', href}],
      }]);
      assert.match(entriesMarkup, /<a class="action action--quiet" href=/u, href);
    }

    for (const href of [
      'javascript:alert(1)',
      '//evil.example/report',
      '/\\evil.example/report',
      '/\nevil.example/report',
      ' https://example.com/report',
      'https://user@example.com/report',
    ]) {
      assert.throws(
        () => renderResearchEvidenceMarkup([{
          ...baseEntry,
          sourceActions: [{label: 'Open source', href}],
        }]),
        /Unsafe research evidence source href/u,
        href,
      );
    }
  });

  it('fails closed for invalid or duplicate evidence identities', () => {
    for (const id of [
      '',
      'Uppercase-Id',
      'unsafe id',
      'unsafe/id',
      'unsafe" onclick="alert(1)',
      '-leading',
      'trailing-',
    ]) {
      assert.throws(
        () => renderResearchEvidenceMarkup([{...baseEntry, id}]),
        /Unsafe research evidence id/u,
        id,
      );
    }

    assert.throws(
      () => renderResearchEvidenceMarkup([baseEntry, {...baseEntry}]),
      /Duplicate research evidence id: reviewed-evidence/u,
    );
  });

  it('fails closed when runtime data violates the evidence-status enum', () => {
    assert.throws(
      () => renderResearchEvidenceMarkup([{
        ...baseEntry,
        status: 'verified" onclick="alert(1)' as EvidenceStatus,
      }]),
      /Unsafe research evidence status/u,
    );
  });
});
