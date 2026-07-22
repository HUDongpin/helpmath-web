import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {NextRequest} from 'next/server';

import {POST} from '../app/api/executive-preview/session/route';
import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  getExecutivePreviewConfig,
  verifyExecutivePreviewSession,
} from '../lib/executive-preview-access';

const envKeys = [
  'VERCEL_ENV',
  'EXECUTIVE_PREVIEW_ENABLED',
  'EXECUTIVE_PREVIEW_ACCESS_KEY',
  'EXECUTIVE_PREVIEW_SESSION_SECRET',
  'EXECUTIVE_PREVIEW_EXPIRES_AT',
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const accessKey = 'HM-Test-Executive-Preview-Key-2026-X9';
const sessionSecret = 'HM-Test-Session-Secret-2026-V7qL4mN8R2xZ';

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function request(
  form: URLSearchParams,
  headers: Record<string, string> = {},
  url = 'https://www.helpmath.ai/api/executive-preview/session',
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://www.helpmath.ai',
      ...headers,
    },
    body: form.toString(),
  });
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(new RegExp(`${EXECUTIVE_PREVIEW_COOKIE_NAME}=([^;]+)`));
  assert.ok(match, setCookie);
  return match[1];
}

beforeEach(() => {
  setEnv('VERCEL_ENV', 'development');
  setEnv('EXECUTIVE_PREVIEW_ENABLED', 'true');
  setEnv('EXECUTIVE_PREVIEW_ACCESS_KEY', accessKey);
  setEnv('EXECUTIVE_PREVIEW_SESSION_SECRET', sessionSecret);
  setEnv('EXECUTIVE_PREVIEW_EXPIRES_AT', '2099-01-01T00:00:00.000Z');
});

afterEach(() => {
  for (const key of envKeys) setEnv(key, originalEnv[key]);
});

describe('POST /api/executive-preview/session', () => {
  it('rejects cross-origin and unsupported requests without setting a cookie', async () => {
    const crossOrigin = await POST(request(new URLSearchParams(), {origin: 'https://evil.example'}));
    assert.equal(crossOrigin.status, 403);
    assert.equal(crossOrigin.headers.get('set-cookie'), null);

    const browserCrossSite = await POST(request(new URLSearchParams(), {
      origin: 'https://www.helpmath.ai',
      'sec-fetch-site': 'cross-site',
    }));
    assert.equal(browserCrossSite.status, 403);
    assert.equal(browserCrossSite.headers.get('set-cookie'), null);

    const unsupported = await POST(
      request(new URLSearchParams(), {'content-type': 'application/json'}),
    );
    assert.equal(unsupported.status, 415);
    assert.equal(unsupported.headers.get('cache-control'), 'private, no-store, max-age=0');
  });

  it('fails closed with one generic redirect when configuration or the key is invalid', async () => {
    const wrongKey = await POST(request(new URLSearchParams({
      locale: 'en',
      passphrase: 'wrong-key-that-is-long-enough',
      returnTo: '/demos/conversion-1-4',
    })));
    assert.equal(wrongKey.status, 303);
    assert.equal(
      wrongKey.headers.get('location'),
      '/executive-preview?error=1&returnTo=%2Fdemos%2Fconversion-1-4',
    );
    assert.equal(wrongKey.headers.get('set-cookie'), null);

    setEnv('EXECUTIVE_PREVIEW_ENABLED', 'false');
    const disabled = await POST(request(new URLSearchParams({
      locale: 'es',
      passphrase: accessKey,
    })));
    assert.equal(disabled.status, 303);
    assert.equal(
      disabled.headers.get('location'),
      '/es/executive-preview?error=1',
    );
  });

  it('rate limits repeated failures per trusted forwarding address', async () => {
    const headers = {'x-vercel-forwarded-for': '203.0.113.42'};
    const failedForm = new URLSearchParams({
      locale: 'en',
      passphrase: 'wrong-key-that-is-long-enough',
    });

    for (let attempt = 1; attempt < 8; attempt += 1) {
      const response = await POST(request(failedForm, headers));
      assert.equal(response.status, 303, `attempt ${attempt}`);
    }

    const blocked = await POST(request(failedForm, headers));
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '900');
    assert.deepEqual(await blocked.json(), {
      ok: false,
      error: {code: 'EXECUTIVE_PREVIEW_RATE_LIMITED'},
    });
    assert.equal(blocked.headers.get('set-cookie'), null);
  });

  it('creates a secure short-lived session and permits only a whitelisted return path', async () => {
    const response = await POST(request(new URLSearchParams({
      locale: 'en',
      passphrase: accessKey,
      returnTo: '/demos/conversion-1-4',
    })));
    const cookieHeader = response.headers.get('set-cookie') ?? '';

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get('location'),
      '/demos/conversion-1-4',
    );
    assert.match(cookieHeader, /HttpOnly/u);
    assert.match(cookieHeader, /Secure/u);
    assert.match(cookieHeader, /SameSite=lax/iu);
    assert.match(cookieHeader, /Path=\//u);
    assert.doesNotMatch(cookieHeader, new RegExp(accessKey));

    const config = getExecutivePreviewConfig();
    assert.ok(config);
    assert.equal(await verifyExecutivePreviewSession(sessionCookie(response), config), true);

    const forwardedHttps = await POST(request(new URLSearchParams({
      locale: 'en',
      passphrase: accessKey,
    }), {
      host: 'www.helpmath.ai',
      origin: 'https://www.helpmath.ai',
      'x-forwarded-host': 'www.helpmath.ai',
      'x-forwarded-proto': 'https',
    }, 'http://127.0.0.1:3211/api/executive-preview/session'));
    assert.equal(forwardedHttps.status, 303);
    assert.match(forwardedHttps.headers.get('set-cookie') ?? '', /Secure/u);

    const browserSameOrigin = await POST(request(new URLSearchParams({
      locale: 'en',
      passphrase: accessKey,
      returnTo: '/demos/conversion-1-2',
    }), {
      origin: 'http://localhost:3211',
      host: 'localhost:3211',
      'x-forwarded-proto': 'http',
      'sec-fetch-site': 'same-origin',
    }));
    assert.equal(browserSameOrigin.status, 303);
    assert.equal(
      browserSameOrigin.headers.get('location'),
      '/demos/conversion-1-2',
    );

    const openRedirect = await POST(request(new URLSearchParams({
      locale: 'en',
      passphrase: accessKey,
      returnTo: '//evil.example',
    })));
    assert.equal(
      openRedirect.headers.get('location'),
      '/executive-preview',
    );
  });

  it('clears the session cookie on logout', async () => {
    const response = await POST(request(new URLSearchParams({
      action: 'logout',
      locale: 'es',
    })));
    const cookieHeader = response.headers.get('set-cookie') ?? '';

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get('location'),
      '/es/executive-preview',
    );
    assert.match(cookieHeader, new RegExp(`${EXECUTIVE_PREVIEW_COOKIE_NAME}=`));
    assert.match(cookieHeader, /Max-Age=0/iu);
  });
});
