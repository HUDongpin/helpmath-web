import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

import {NextRequest} from 'next/server';

import {
  DELETE as rejectCanonicalEntryDelete,
  GET as canonicalizeExecutivePreview,
  HEAD as canonicalizeExecutivePreviewHead,
  OPTIONS as rejectCanonicalEntryOptions,
  PATCH as rejectCanonicalEntryPatch,
  POST as rejectCanonicalEntryPost,
  PUT as rejectCanonicalEntryPut,
} from '../app/api/canonical-entry/[locale]/route';
import nextConfig from '../next.config';
import proxy from '../proxy';

const origin = 'https://www.helpmath.ai';
const candidateId = 'conversion-1-2';
const encodedEnglishDemoPath = encodeURIComponent(`/demos/${candidateId}`);
const encodedSpanishDemoPath = encodeURIComponent(`/es/demos/${candidateId}`);
const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as {
  routes?: Array<{
    dest?: string;
    has?: Array<{key?: string; type?: string; value?: string}>;
    headers?: Record<string, string>;
    src?: string;
    status?: number;
    transforms?: Array<{
      args?: string;
      op?: string;
      type?: string;
    }>;
  }>;
};

describe('executive preview entry canonicalization', () => {
  it('routes raw path variants through the proxy before Next.js normalization', () => {
    assert.equal(nextConfig.skipProxyUrlNormalize, true);
    assert.equal(nextConfig.skipTrailingSlashRedirect, true);
  });

  it('validates nominal alias-regex syntax and query-dropping request.path transforms', () => {
    const routes = vercelConfig.routes ?? [];
    assert.equal(routes.length, 2);

    // These assertions validate the route expressions themselves. Vercel's
    // front door can normalize a raw repeated slash before deployment routing;
    // release smoke separately validates that platform 308 and its clean second hop.
    for (const [paths, expectedRuntimePath] of [
      [
        [
          '//executive-preview',
          '/executive-preview/',
          '/executive-preview//',
          '/en/executive-preview',
          '/en//executive-preview',
          '/en/executive-preview/',
          '//en/executive-preview',
          '//en//executive-preview',
        ],
        '/api/canonical-entry/en',
      ],
      [
        [
          '//es/executive-preview',
          '/es//executive-preview',
          '/es/executive-preview/',
        ],
        '/api/canonical-entry/es',
      ],
    ] as const) {
      for (const path of paths) {
        const matchingRoutes = routes.filter(
          ({src}) => typeof src === 'string' && new RegExp(src, 'u').test(path),
        );
        assert.equal(matchingRoutes.length, 1, path);
        assert.equal(matchingRoutes[0]?.dest, expectedRuntimePath, path);
        assert.deepEqual(
          matchingRoutes[0]?.transforms,
          [{
            type: 'request.path',
            op: 'set',
            args: expectedRuntimePath,
          }],
          path,
        );
        assert.equal(matchingRoutes[0]?.has, undefined, path);
        assert.equal(matchingRoutes[0]?.headers, undefined, path);
        assert.equal(matchingRoutes[0]?.status, undefined, path);
      }
    }

    for (const path of [
      '/executive-preview',
      '/es/executive-preview',
    ]) {
      assert.equal(
        routes.some(({src}) =>
          typeof src === 'string' && new RegExp(src, 'u').test(path)
        ),
        false,
        path,
      );
    }
  });

  it('drops rewritten query data in the route-handler response', async () => {
    for (const [locale, query, expectedLocation] of [
      ['en', `?returnTo=${encodedEnglishDemoPath}`, '/executive-preview'],
      [
        'en',
        `?returnTo=${encodedEnglishDemoPath}&error=1`,
        '/executive-preview?error=1',
      ],
      ['es', `?foo=${encodedSpanishDemoPath}`, '/es/executive-preview'],
      [
        'es',
        `?ReturnTo=${encodedSpanishDemoPath}&error=1`,
        '/es/executive-preview?error=1',
      ],
    ] as const) {
      const response = await canonicalizeExecutivePreview(
        new NextRequest(
          `${origin}/api/canonical-entry/${locale}${query}`,
        ),
        {params: Promise.resolve({locale})},
      );
      const disclosureSurface = [
        ...response.headers.entries().map(([name, value]) => `${name}: ${value}`),
        await response.text(),
      ].join('\n');

      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), expectedLocation);
      assert.equal(
        response.headers.get('cache-control'),
        'private, no-store, max-age=0',
      );
      assert.equal(response.headers.get('vary'), 'Cookie');
      assert.equal(
        response.headers.get('x-robots-tag'),
        'noindex, nofollow, noarchive',
      );
      assert.equal(response.body, null);
      assert.doesNotMatch(disclosureSurface, /returnto/iu);
      assert.doesNotMatch(disclosureSurface, /conversion-1-2/iu);
      assert.doesNotMatch(disclosureSurface, /\/demos\//iu);
    }

    const invalidLocale = await canonicalizeExecutivePreview(
      new NextRequest(
        `${origin}/api/canonical-entry/fr?returnTo=${encodedEnglishDemoPath}`,
      ),
      {params: Promise.resolve({locale: 'fr'})},
    );
    assert.equal(invalidLocale.status, 404);
    assert.equal(await invalidLocale.text(), '');
  });

  it('keeps HEAD canonicalization bodyless and private', async () => {
    const response = await canonicalizeExecutivePreviewHead(
      new NextRequest(
        `${origin}/api/canonical-entry/es?ReturnTo=${encodedSpanishDemoPath}&error=1`,
        {method: 'HEAD'},
      ),
      {params: Promise.resolve({locale: 'es'})},
    );

    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/es/executive-preview?error=1');
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.equal(response.headers.get('vary'), 'Cookie');
    assert.equal(
      response.headers.get('x-robots-tag'),
      'noindex, nofollow, noarchive',
    );
    assert.equal(response.body, null);
    assert.equal(await response.text(), '');
  });

  it('rejects unsupported methods without reflecting request data', async () => {
    for (const [method, handler] of [
      ['DELETE', rejectCanonicalEntryDelete],
      ['OPTIONS', rejectCanonicalEntryOptions],
      ['PATCH', rejectCanonicalEntryPatch],
      ['POST', rejectCanonicalEntryPost],
      ['PUT', rejectCanonicalEntryPut],
    ] as const) {
      const response = handler();
      const disclosureSurface = [
        ...response.headers.entries().map(([name, value]) => `${name}: ${value}`),
        await response.text(),
      ].join('\n');

      assert.equal(response.status, 405, method);
      assert.equal(response.headers.get('allow'), 'GET, HEAD', method);
      assert.equal(
        response.headers.get('cache-control'),
        'private, no-store, max-age=0',
        method,
      );
      assert.equal(response.headers.get('vary'), 'Cookie', method);
      assert.equal(
        response.headers.get('x-robots-tag'),
        'noindex, nofollow, noarchive',
        method,
      );
      assert.equal(response.body, null, method);
      assert.doesNotMatch(disclosureSurface, /returnto/iu, method);
      assert.doesNotMatch(disclosureSurface, /conversion-1-2/iu, method);
      assert.doesNotMatch(disclosureSurface, /\/demos\//iu, method);
      assert.doesNotMatch(disclosureSurface, /\/api\/executive-preview\//iu, method);
    }
  });

  it('returns private redirects before rendering any unsupported entry query', async () => {
    for (const [path, expectedLocation] of [
      [
        `/executive-preview?returnTo=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      [
        `/executive-preview?returnTo=${encodedEnglishDemoPath}&error=1`,
        '/executive-preview?error=1',
      ],
      [
        `/es/executive-preview?returnTo=${encodedSpanishDemoPath}`,
        '/es/executive-preview',
      ],
      [
        `/es/executive-preview?returnTo=${encodedSpanishDemoPath}&error=1`,
        '/es/executive-preview?error=1',
      ],
      [
        `/en/executive-preview?returnTo=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      [
        `/en/executive-preview?returnTo=${encodedEnglishDemoPath}&error=1`,
        '/executive-preview?error=1',
      ],
      [
        `/executive-preview/?ReturnTo=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      [
        `/es/executive-preview/?foo=${encodedSpanishDemoPath}`,
        '/es/executive-preview',
      ],
      [
        `/en/executive-preview/?returnto=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      // Function-contract coverage only: Vercel can intercept these repeated
      // slashes before the proxy. The deployed two-hop behavior is smoke-tested.
      [
        `//executive-preview?returnTo=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      [
        `//en/executive-preview?returnTo=${encodedEnglishDemoPath}`,
        '/executive-preview',
      ],
      [
        `//en//executive-preview?foo=${encodedEnglishDemoPath}&error=1`,
        '/executive-preview?error=1',
      ],
      [
        `/es//executive-preview?ReturnTo=${encodedSpanishDemoPath}&error=1`,
        '/es/executive-preview?error=1',
      ],
      [
        `/en//executive-preview?foo=${encodedEnglishDemoPath}&error=1`,
        '/executive-preview?error=1',
      ],
    ] as const) {
      const response = await proxy(new NextRequest(`${origin}${path}`));
      const body = await response.text();
      const location = response.headers.get('location');
      const disclosureSurface = [
        ...response.headers.entries().map(([name, value]) => `${name}: ${value}`),
        body,
      ].join('\n');

      assert.equal(response.status, 307, path);
      assert.ok(location, path);
      const target = new URL(location, origin);
      assert.equal(target.origin, origin, path);
      assert.equal(`${target.pathname}${target.search}`, expectedLocation, path);
      assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0', path);
      assert.equal(response.headers.get('vary'), 'Cookie', path);
      assert.equal(
        response.headers.get('x-robots-tag'),
        'noindex, nofollow, noarchive',
        path,
      );
      assert.equal(response.body, null, path);
      assert.equal(body, '', path);
      assert.doesNotMatch(disclosureSurface, /returnto/iu, path);
      assert.doesNotMatch(disclosureSurface, /conversion-1-2/iu, path);
      assert.doesNotMatch(disclosureSurface, /\/demos\//iu, path);
      assert.doesNotMatch(disclosureSurface, /\/api\/executive-preview\//iu, path);
    }
  });

  it('drops every query parameter except the exact error marker', async () => {
    const response = await proxy(new NextRequest(
      `${origin}/executive-preview?error=0&source=private&returnTo=${encodedEnglishDemoPath}`,
    ));

    assert.equal(response.status, 307);
    const location = response.headers.get('location');
    assert.ok(location);
    const target = new URL(location, origin);
    assert.equal(target.origin, origin);
    assert.equal(`${target.pathname}${target.search}`, '/executive-preview');
    assert.equal(await response.text(), '');
  });

  it('uses private temporary redirects for path-only canonicalization', async () => {
    for (const [path, expectedLocation] of [
      ['/executive-preview/', '/executive-preview'],
      ['/es/executive-preview/', '/es/executive-preview'],
      ['/es//executive-preview?error=1', '/es/executive-preview?error=1'],
      ['/en/executive-preview/', '/executive-preview'],
    ] as const) {
      const response = await proxy(new NextRequest(`${origin}${path}`));
      const location = response.headers.get('location');
      assert.ok(location, path);
      const target = new URL(location, origin);

      assert.equal(response.status, 307, path);
      assert.equal(target.origin, origin, path);
      assert.equal(`${target.pathname}${target.search}`, expectedLocation, path);
      assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0', path);
      assert.equal(response.headers.get('vary'), 'Cookie', path);
      assert.equal(
        response.headers.get('x-robots-tag'),
        'noindex, nofollow, noarchive',
        path,
      );
      assert.equal(await response.text(), '', path);
    }
  });

  it('preserves global no-trailing-slash URL behavior outside the private entry', async () => {
    for (const [path, expectedLocation] of [
      ['/about/?source=legacy', '/about?source=legacy'],
      ['/es/resources/?topic=research', '/es/resources?topic=research'],
    ] as const) {
      const response = await proxy(new NextRequest(`${origin}${path}`));
      const location = response.headers.get('location');
      assert.ok(location, path);
      const target = new URL(location, origin);

      assert.equal(response.status, 308, path);
      assert.equal(target.origin, origin, path);
      assert.equal(`${target.pathname}${target.search}`, expectedLocation, path);
    }
  });
});
