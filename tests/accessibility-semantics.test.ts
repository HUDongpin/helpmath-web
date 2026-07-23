import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createElement, type ComponentType, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {ResearchPage, SupportPage} from '../components/content-pages';
import {MainContent} from '../components/main-content';
import {Callout, Section} from '../components/ui';
import {getSiteContent} from '../content';
import {LocaleProvider} from '../i18n/locale-context';

const TestLocaleProvider = LocaleProvider as ComponentType<{
  locale: 'en' | 'es';
  children?: ReactNode;
}>;
const TestSection = Section as ComponentType<{
  ariaLabelledBy?: string;
  children?: ReactNode;
}>;

describe('section and callout semantics', () => {
  it('provides one programmatically focusable main-content target', () => {
    const html = renderToStaticMarkup(
      createElement(MainContent, {className: 'test-main'}, 'Primary content'),
    );

    assert.match(html, /<main\b[^>]*class="test-main"/u);
    assert.match(html, /<main\b[^>]*id="main-content"/u);
    assert.match(html, /<main\b[^>]*tabindex="-1"/u);
    assert.match(html, />Primary content<\/main>/u);
  });

  it('gives every callout landmark an accessible name from its visible title', () => {
    const html = renderToStaticMarkup(
      createElement(Callout, {title: 'Evidence status', body: 'Reviewed evidence.'}),
    );

    assert.match(html, /<aside\b[^>]*aria-label="Evidence status"/u);
    assert.match(html, /<h2>Evidence status<\/h2>/u);
  });

  it('lets a section reference its visible heading', () => {
    const html = renderToStaticMarkup(
      createElement(
        TestSection,
        {ariaLabelledBy: 'section-heading'},
        createElement('h2', {id: 'section-heading'}, 'Named section'),
      ),
    );

    assert.match(html, /<section\b[^>]*aria-labelledby="section-heading"/u);
    assert.match(html, /<h2 id="section-heading">Named section<\/h2>/u);
  });

  it('renders the localized support FAQ as a named section with an h2', () => {
    for (const locale of ['en', 'es'] as const) {
      const content = getSiteContent(locale).pages.support;
      const html = renderToStaticMarkup(
        createElement(
          TestLocaleProvider,
          {locale},
          createElement(SupportPage, {content, locale}),
        ),
      );

      assert.match(
        html,
        /<section\b[^>]*aria-labelledby="support-faq-heading"/u,
        locale,
      );
      assert.match(
        html,
        new RegExp(
          `<h2 class="eyebrow" id="support-faq-heading">${content.faqLabel}</h2>`,
          'u',
        ),
        locale,
      );
    }
  });

  it('renders a localized evidence index for every research entry', () => {
    for (const locale of ['en', 'es'] as const) {
      const content = getSiteContent(locale).pages.research;
      const html = renderToStaticMarkup(
        createElement(
          TestLocaleProvider,
          {locale},
          createElement(ResearchPage, {content, locale}),
        ),
      );

      assert.match(
        html,
        new RegExp(`<nav aria-label="${content.entriesLabel}" class="evidence-index">`, 'u'),
        locale,
      );
      for (const entry of content.entries) {
        assert.match(html, new RegExp(`href="#${entry.id}"`, 'u'), entry.id);
      }
    }
  });
});
