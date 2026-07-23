import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {NextRequest} from 'next/server';

import {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
  switchLanguage,
} from '../app/api/language-switch/[locale]/route';

const origin = 'https://www.helpmath.ai';

function request(
  locale: string,
  path: string,
  referer?: string,
  method = 'GET',
): NextRequest {
  return new NextRequest(
    `${origin}/api/language-switch/${locale}?path=${encodeURIComponent(path)}`,
    {
      method,
      headers: referer ? {referer} : undefined,
    },
  );
}

describe('static language-switch gateway', () => {
  test('preserves a same-origin query for the exact source pathname', () => {
    const english = switchLanguage(
      request('en', '/contact', `${origin}/es/contact?topic=research`),
      'en',
    );
    const spanish = switchLanguage(
      request('es', '/resources', `${origin}/resources?view=all`),
      'es',
    );

    assert.equal(english.status, 307);
    assert.equal(english.headers.get('location'), '/contact?topic=research');
    assert.equal(spanish.status, 307);
    assert.equal(spanish.headers.get('location'), '/es/resources?view=all');
    assert.equal(spanish.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.equal(spanish.headers.get('vary'), 'Referer');
    assert.equal(spanish.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(spanish.body, null);
  });

  test('does not trust cross-origin or mismatched Referer query data', () => {
    for (const referer of [
      'https://example.com/resources?secret=external',
      `${origin}/contact?topic=research`,
      'not a URL',
    ]) {
      const response = switchLanguage(
        request('es', '/resources', referer),
        'es',
      );
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), '/es/resources');
    }
  });

  test('uses the trusted request host when framework URL normalization differs', () => {
    const browserOrigin = 'http://127.0.0.1:3211';
    const browserRequest = new NextRequest(
      'http://localhost:3211/api/language-switch/en?path=%2Fcontact',
      {
        headers: {
          host: '127.0.0.1:3211',
          referer: `${browserOrigin}/es/contact?topic=research`,
        },
      },
    );
    const response = switchLanguage(browserRequest, 'en');

    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/contact?topic=research');
  });

  test('fails closed for invalid locale and unsafe paths', () => {
    assert.equal(switchLanguage(request('fr', '/contact'), 'fr').status, 404);

    for (const path of [
      '',
      'contact',
      '//example.com/path',
      '/\\example.com/path',
      '/contact?topic=research',
      '/contact#main-content',
      '/contact\nlocation:https://example.com',
      '/%2e%2e//evil.example/x',
      '/safe/%2e%2e//evil.example/x',
      '/safe//nested',
      '/safe_path',
    ]) {
      assert.equal(switchLanguage(request('es', path), 'es').status, 400, path);
    }
  });

  test('keeps GET and HEAD bodyless and rejects every unsupported method', async () => {
    const context = {params: Promise.resolve({locale: 'es'})};
    const getResponse = await GET(request('es', '/contact'), context);
    const headResponse = await HEAD(request('es', '/contact', undefined, 'HEAD'), context);

    assert.equal(getResponse.status, 307);
    assert.equal(headResponse.status, 307);
    assert.equal(await headResponse.text(), '');

    for (const handler of [DELETE, OPTIONS, PATCH, POST, PUT]) {
      const response = handler();
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('allow'), 'GET, HEAD');
      assert.equal(response.body, null);
    }
  });
});
