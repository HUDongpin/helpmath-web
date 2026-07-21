import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {createElement, type ComponentType, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {ContactForm} from '../components/contact-form';
import {getPageContent} from '../content';
import {LocaleProvider} from '../i18n/navigation';

const originalEnabled = process.env.NEXT_PUBLIC_CONTACT_ENABLED;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TestLocaleProvider = LocaleProvider as ComponentType<{
  locale: 'en' | 'es';
  children?: ReactNode;
}>;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.NEXT_PUBLIC_CONTACT_ENABLED;
  else process.env.NEXT_PUBLIC_CONTACT_ENABLED = originalEnabled;

  if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
});

test('the enabled contact form links its consent control to the localized privacy notice', () => {
  process.env.NEXT_PUBLIC_CONTACT_ENABLED = 'true';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';

  for (const [locale, privacyPath, linkLabel] of [
    ['en', '/privacy', 'Open the privacy notice'],
    ['es', '/es/privacy', 'Abrir el aviso de privacidad'],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(
        TestLocaleProvider,
        {locale},
        createElement(ContactForm, {
          content: getPageContent(locale, 'contact'),
          locale,
        }),
      ),
    );

    assert.match(html, new RegExp(`href="${privacyPath}"`), locale);
    assert.match(html, new RegExp(linkLabel), locale);
    assert.match(html, /id="contact-privacy-consent"/, locale);
  }
});
