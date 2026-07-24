import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {
  PAGES_ERROR_COPY,
  PagesErrorPage,
  type PagesErrorKind,
} from '../components/pages-error-page';

test('Pages Router error views are bilingual and disclose no failure details', () => {
  for (const kind of ['not-found', 'unavailable'] as const satisfies PagesErrorKind[]) {
    const copy = PAGES_ERROR_COPY[kind];
    const html = renderToStaticMarkup(createElement(PagesErrorPage, {kind}));

    assert.match(html, new RegExp(copy.en.title, 'u'), kind);
    assert.match(html, new RegExp(copy.es.title, 'u'), kind);
    assert.match(html, /lang="en"/u, kind);
    assert.match(html, /lang="es"/u, kind);
    assert.match(html, /href="\/"/u, kind);
    assert.match(html, /href="\/es"/u, kind);
    assert.match(html, /href="\/support"/u, kind);
    assert.match(html, /href="\/es\/support"/u, kind);
    assert.doesNotMatch(
      html,
      /(?:error\.(?:message|stack|digest)|stack trace|__NEXT_DATA__|<script\b)/iu,
      kind,
    );
  }
});

test('every Pages Router error entry opts out of the browser runtime', async () => {
  for (const page of ['_error', '404', '500'] as const) {
    const source = await readFile(new URL(`../pages/${page}.tsx`, import.meta.url), 'utf8');

    assert.match(source, /unstable_runtimeJS:\s*false/u, page);
    assert.doesNotMatch(
      source,
      /(?:error\.(?:message|stack|digest)|console\.error|dangerouslySetInnerHTML)/u,
      page,
    );
  }

  const component = await readFile(
    new URL('../components/pages-error-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    component,
    /<meta content="noindex, nofollow, noarchive" name="robots" \/>/u,
  );
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/u);
});
