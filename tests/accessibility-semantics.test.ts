import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createElement, type ComponentType, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {SupportPage} from '../components/content-pages';
import {Callout, Section} from '../components/ui';
import {getSiteContent} from '../content';
import {LocaleProvider} from '../i18n/navigation';

const TestLocaleProvider = LocaleProvider as ComponentType<{
  locale: 'en' | 'es';
  children?: ReactNode;
}>;
const TestSection = Section as ComponentType<{
  ariaLabelledBy?: string;
  children?: ReactNode;
}>;

describe('section and callout semantics', () => {
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
          createElement(SupportPage, {content}),
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
});
