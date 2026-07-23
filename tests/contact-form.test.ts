import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {ContactForm} from '../components/contact-form';
import {getPageContent} from '../content';

const originalEnabled = process.env.NEXT_PUBLIC_CONTACT_ENABLED;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
      createElement(ContactForm, {
        content: getPageContent(locale, 'contact'),
        locale,
        repositoryGateApproved: true,
      }),
    );

    assert.match(html, new RegExp(`href="${privacyPath}"`), locale);
    assert.match(html, new RegExp(linkLabel), locale);
    assert.match(html, /id="contact-privacy-consent"/, locale);
    assert.match(html, /<form\b[^>]*action="\/api\/contact"/u, locale);
    assert.match(html, /<form\b[^>]*method="post"/u, locale);
  }
});

test('the repository gate keeps the contact form closed even when the environment flag is true', () => {
  process.env.NEXT_PUBLIC_CONTACT_ENABLED = 'true';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';

  const html = renderToStaticMarkup(
    createElement(ContactForm, {
      content: getPageContent('en', 'contact'),
      locale: 'en',
      repositoryGateApproved: false,
    }),
  );

  assert.doesNotMatch(html, /<form\b/);
  assert.match(html, /Contact intake is not accepting messages yet/);
});
