import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {
  ERROR_RECOVERY_COPY,
  ErrorRecovery,
  errorLocaleFromPathname,
} from '../components/error-recovery';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

describe('error recovery experience', () => {
  it('renders complete, privacy-preserving recovery choices in both locales', () => {
    for (const locale of ['en', 'es'] as const) {
      const copy = ERROR_RECOVERY_COPY[locale];
      const html = renderToStaticMarkup(
        createElement(ErrorRecovery, {locale, onRetry() {}}),
      );

      assert.match(
        html,
        /<main\b[^>]*id="main-content"[^>]*tabindex="-1"/u,
        locale,
      );
      assert.match(html, /<h1\b[^>]*id="error-recovery-title"[^>]*tabindex="-1"/u, locale);
      assert.match(html, new RegExp(copy.title, 'u'), locale);
      assert.match(html, new RegExp(copy.retry, 'u'), locale);
      assert.match(html, new RegExp(copy.privacy, 'u'), locale);
      assert.match(html, /<button\b[^>]*type="button"/u, locale);
      assert.match(html, new RegExp(`href="${locale === 'es' ? '/es' : '/'}"`, 'u'), locale);
      assert.match(
        html,
        new RegExp(`href="${locale === 'es' ? '/es/support' : '/support'}"`, 'u'),
        locale,
      );
      assert.doesNotMatch(html, /digest|stack trace|error message/iu, locale);
    }
  });

  it('derives the global fallback locale only from a leading locale segment', () => {
    assert.equal(errorLocaleFromPathname('/es'), 'es');
    assert.equal(errorLocaleFromPathname('/es/research'), 'es');
    assert.equal(errorLocaleFromPathname('/research'), 'en');
    assert.equal(errorLocaleFromPathname('/estimate'), 'en');
    assert.equal(errorLocaleFromPathname('/ES/research'), 'en');
  });

  it('keeps the Next.js error entry points client-side and free of raw error output', async () => {
    const localized = await readFile(
      path.join(repositoryRoot, 'app/[locale]/error.tsx'),
      'utf8',
    );
    const global = await readFile(path.join(repositoryRoot, 'app/global-error.tsx'), 'utf8');

    for (const [name, source] of [['localized', localized], ['global', global]] as const) {
      assert.match(source, /^'use client';/u, name);
      assert.match(source, /unstable_retry/u, name);
      assert.doesNotMatch(source, /error\.(?:message|stack|digest)|console\.error/u, name);
    }

    assert.match(global, /<html\b/u);
    assert.match(global, /<body\b/u);
    assert.match(global, /<title>/u);
  });
});
