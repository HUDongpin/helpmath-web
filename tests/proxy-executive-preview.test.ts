import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

import {NextRequest} from 'next/server';

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
    has?: Array<{key?: string; type?: string; value?: string}>;
    headers?: Record<string, string>;
    src?: string;
    status?: number;
  }>;
};

describe('executive preview entry canonicalization', () => {
  it('routes raw path variants through the proxy before Next.js normalization', () => {
    assert.equal(nextConfig.skipProxyUrlNormalize, true);
    assert.equal(nextConfig.skipTrailingSlashRedirect, true);
  });

  it('sanitizes pre-proxy repeated-slash variants at the Vercel edge', () => {
    const routes = vercelConfig.routes ?? [];
    assert.equal(routes.length, 4);

    for (const route of routes) {
      assert.equal(route.status, 307);
      assert.equal(route.headers?.['Cache-Control'], 'private, no-store, max-age=0');
      assert.equal(route.headers?.Vary, 'Cookie');
      assert.equal(route.headers?.['X-Robots-Tag'], 'noindex, nofollow, noarchive');
    }

    for (const [paths, expectedLocation] of [
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
        '/executive-preview',
      ],
      [
        [
          '//es/executive-preview',
          '/es//executive-preview',
          '/es/executive-preview/',
        ],
        '/es/executive-preview',
      ],
    ] as const) {
      for (const path of paths) {
        const matchingRoutes = routes.filter(
          ({src}) => typeof src === 'string' && new RegExp(src, 'u').test(path),
        );
        assert.equal(matchingRoutes.length, 2, path);
        assert.equal(matchingRoutes[0]?.has?.[0]?.type, 'query', path);
        assert.equal(matchingRoutes[0]?.has?.[0]?.key, 'error', path);
        assert.equal(matchingRoutes[0]?.has?.[0]?.value, '1', path);
        assert.equal(
          matchingRoutes[0]?.headers?.Location,
          `${expectedLocation}?error=1`,
          path,
        );
        assert.equal(matchingRoutes[1]?.has, undefined, path);
        assert.equal(matchingRoutes[1]?.headers?.Location, expectedLocation, path);
      }
    }

    for (const canonicalPath of ['/executive-preview', '/es/executive-preview']) {
      assert.equal(
        routes.some(({src}) =>
          typeof src === 'string' && new RegExp(src, 'u').test(canonicalPath)
        ),
        false,
        canonicalPath,
      );
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
