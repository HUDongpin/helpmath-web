import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {reviewDemoRoutes} from '../demos/catalog';
import executivePreviewWindow from '../config/executive-preview-window.json';
import {
  EXECUTIVE_PREVIEW_COOKIE_NAME,
  EXECUTIVE_PREVIEW_PRODUCTION_EXPIRY_CEILING,
  EXECUTIVE_PREVIEW_SESSION_TTL_MS,
  EXECUTIVE_PREVIEW_SESSION_TTL_SECONDS,
  buildExecutivePreviewDemoPaths,
  createExecutivePreviewSession,
  getExecutivePreviewConfig,
  getExecutivePreviewReturnTo,
  isAllowedExecutiveReturnTo,
  isExecutivePreviewAssetPath,
  isExecutivePreviewDemoPath,
  isExecutivePreviewProtectedPath,
  verifyExecutivePreviewAccessKey,
  verifyExecutivePreviewSession,
  type ExecutivePreviewConfig,
} from '../lib/executive-preview-access';

const NOW = Date.parse('2026-07-21T12:00:00.000Z');
const VALID_ENV = {
  VERCEL_ENV: 'production',
  EXECUTIVE_PREVIEW_ENABLED: 'true',
  EXECUTIVE_PREVIEW_ACCESS_KEY: 'HM-Access-Key-2026-Ab7Qp9Lm4Tx8Vr2N',
  EXECUTIVE_PREVIEW_SESSION_SECRET: 'HM-Session-Secret-2026-Rt8Vn4Qp7Lx2Az9K',
  EXECUTIVE_PREVIEW_EXPIRES_AT: '2026-07-22T12:00:00.000Z',
};

function validConfig(overrides: Partial<ExecutivePreviewConfig> = {}): ExecutivePreviewConfig {
  return {
    accessKey: VALID_ENV.EXECUTIVE_PREVIEW_ACCESS_KEY,
    sessionSecret: VALID_ENV.EXECUTIVE_PREVIEW_SESSION_SECRET,
    expiresAt: Date.parse(VALID_ENV.EXECUTIVE_PREVIEW_EXPIRES_AT),
    ...overrides,
  };
}

describe('executive preview configuration', () => {
  it('exports a stable cookie name and twelve-hour TTL', () => {
    assert.equal(EXECUTIVE_PREVIEW_COOKIE_NAME, 'helpmath_executive_preview');
    assert.equal(EXECUTIVE_PREVIEW_SESSION_TTL_SECONDS, 43_200);
    assert.equal(EXECUTIVE_PREVIEW_SESSION_TTL_MS, 43_200_000);
    assert.equal(
      EXECUTIVE_PREVIEW_PRODUCTION_EXPIRY_CEILING,
      '2026-07-28T15:59:00.000Z',
    );
    assert.deepEqual(executivePreviewWindow.demoIds, reviewDemoRoutes.map((route) => route.slice(7)));
  });

  it('loads a complete, enabled, unexpired configuration', () => {
    assert.deepEqual(getExecutivePreviewConfig(VALID_ENV, NOW), validConfig());
  });

  it('fails closed for disabled, missing, short, invalid, or expired values', () => {
    const invalidEnvironments = [
      {...VALID_ENV, EXECUTIVE_PREVIEW_ENABLED: 'false'},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ENABLED: 'TRUE'},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: undefined},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: VALID_ENV.EXECUTIVE_PREVIEW_ACCESS_KEY.slice(0, 31)},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: ` ${VALID_ENV.EXECUTIVE_PREVIEW_ACCESS_KEY}`},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: 'a'.repeat(40)},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: `${'A'.repeat(31)}!`},
      {...VALID_ENV, EXECUTIVE_PREVIEW_ACCESS_KEY: 'A'.repeat(129)},
      {...VALID_ENV, EXECUTIVE_PREVIEW_SESSION_SECRET: undefined},
      {...VALID_ENV, EXECUTIVE_PREVIEW_SESSION_SECRET: 'HM-Session-Secret-2026-Rt8Vn4Qp'},
      {...VALID_ENV, EXECUTIVE_PREVIEW_SESSION_SECRET: `${VALID_ENV.EXECUTIVE_PREVIEW_SESSION_SECRET} `},
      {...VALID_ENV, EXECUTIVE_PREVIEW_SESSION_SECRET: 's'.repeat(48)},
      {...VALID_ENV, EXECUTIVE_PREVIEW_SESSION_SECRET: VALID_ENV.EXECUTIVE_PREVIEW_ACCESS_KEY},
      {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: undefined},
      {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: 'not-a-date'},
      {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: '2026-07-22T12:00:00'},
      {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: new Date(NOW).toISOString()},
      {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: '2026-07-28T15:59:00.001Z'},
    ];

    for (const env of invalidEnvironments) {
      assert.equal(getExecutivePreviewConfig(env, NOW), undefined);
    }
    assert.equal(getExecutivePreviewConfig(VALID_ENV, Number.NaN), undefined);
  });

  it('allows an earlier production close and rejects an environment-only extension', () => {
    assert.deepEqual(
      getExecutivePreviewConfig(
        {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: '2026-07-21T12:00:01.000Z'},
        NOW,
      ),
      validConfig({expiresAt: NOW + 1_000}),
    );
    assert.equal(
      getExecutivePreviewConfig(
        {...VALID_ENV, EXECUTIVE_PREVIEW_EXPIRES_AT: '2099-01-01T00:00:00.000Z'},
        NOW,
      ),
      undefined,
    );
  });

  it('keeps non-production local fixtures independent from the dated production window', () => {
    const localEnvironment = {
      ...VALID_ENV,
      VERCEL_ENV: 'development',
      EXECUTIVE_PREVIEW_EXPIRES_AT: '2099-01-01T00:00:00.000Z',
    };
    assert.equal(
      getExecutivePreviewConfig(localEnvironment, NOW)?.expiresAt,
      Date.parse('2099-01-01T00:00:00.000Z'),
    );
  });

  it('treats missing, preview, and unknown deployment contexts as ceiling-bound', () => {
    for (const vercelEnvironment of [undefined, 'preview', 'unexpected']) {
      assert.equal(
        getExecutivePreviewConfig(
          {
            ...VALID_ENV,
            VERCEL_ENV: vercelEnvironment,
            EXECUTIVE_PREVIEW_EXPIRES_AT: '2099-01-01T00:00:00.000Z',
          },
          NOW,
        ),
        undefined,
        String(vercelEnvironment),
      );
    }
  });
});

describe('executive preview credentials and sessions', () => {
  it('accepts only the configured access key', async () => {
    const config = validConfig();
    assert.equal(await verifyExecutivePreviewAccessKey(config.accessKey, config), true);
    assert.equal(await verifyExecutivePreviewAccessKey(`${config.accessKey}!`, config), false);
    assert.equal(await verifyExecutivePreviewAccessKey('', config), false);
  });

  it('creates a signed session bounded by the twelve-hour TTL', async () => {
    const config = validConfig();
    const token = await createExecutivePreviewSession(config, NOW);
    assert.match(token, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/u);
    assert.equal(await verifyExecutivePreviewSession(token, config, NOW), true);
    assert.equal(
      Number(token.split('.')[1]),
      Math.floor((NOW + EXECUTIVE_PREVIEW_SESSION_TTL_MS) / 1_000),
    );
  });

  it('caps a session at the global preview expiry', async () => {
    const expiresAt = NOW + 10_000;
    const config = validConfig({expiresAt});
    const token = await createExecutivePreviewSession(config, NOW);

    assert.equal(Number(token.split('.')[1]), Math.floor(expiresAt / 1_000));
    assert.equal(await verifyExecutivePreviewSession(token, config, NOW), true);
    assert.equal(await verifyExecutivePreviewSession(token, config, expiresAt), false);
  });

  it('rejects malformed, tampered, incorrectly signed, and expired sessions', async () => {
    const config = validConfig();
    const token = await createExecutivePreviewSession(config, NOW);
    const [version, expiry, signature] = token.split('.');
    const otherConfig = validConfig({sessionSecret: 'x'.repeat(32)});

    assert.equal(await verifyExecutivePreviewSession(undefined, config, NOW), false);
    assert.equal(await verifyExecutivePreviewSession('invalid', config, NOW), false);
    assert.equal(
      await verifyExecutivePreviewSession(`${version}.${Number(expiry) + 1}.${signature}`, config, NOW),
      false,
    );
    assert.equal(
      await verifyExecutivePreviewSession(`${version}.${expiry}.${signature.slice(0, -1)}A`, config, NOW),
      false,
    );
    assert.equal(await verifyExecutivePreviewSession(token, otherConfig, NOW), false);
    assert.equal(
      await verifyExecutivePreviewSession(token, config, Number(expiry) * 1_000),
      false,
    );
    assert.equal(
      await verifyExecutivePreviewSession(token, validConfig({expiresAt: NOW + 1_000}), NOW),
      false,
    );
  });

  it('does not mint a session after the global expiry', async () => {
    await assert.rejects(
      createExecutivePreviewSession(validConfig({expiresAt: NOW}), NOW),
      /expired/u,
    );
  });
});

describe('executive preview path boundaries', () => {
  const allowedDemoPaths = reviewDemoRoutes.flatMap((route) => [route, `/es${route}`]);

  it('protects only the two canonical English and Spanish demo paths', () => {
    for (const pathname of allowedDemoPaths) {
      assert.equal(isExecutivePreviewDemoPath(pathname), true, pathname);
      assert.equal(isExecutivePreviewProtectedPath(pathname), true, pathname);
    }

    for (const pathname of [
      '/demos',
      '/demos/conversion-1-3',
      '/demos/conversion-1-4/',
      '/en/demos/conversion-1-4',
      '/es/demos/conversion-1-4?frame=1',
    ]) {
      assert.equal(isExecutivePreviewDemoPath(pathname), false, pathname);
    }
  });

  it('derives protection from private-preview routes and releases omitted public routes', () => {
    const paths = buildExecutivePreviewDemoPaths(['/demos/conversion-1-2']);

    assert.deepEqual([...paths].sort(), [
      '/demos/conversion-1-2',
      '/es/demos/conversion-1-2',
    ]);
    assert.equal(paths.has('/demos/conversion-1-4'), false);
    assert.equal(paths.has('/es/demos/conversion-1-4'), false);
    assert.equal(paths.has('/demos/../conversion-1-4'), false);
  });

  it('protects files below flash-assets but not adjacent paths', () => {
    for (const pathname of ['/flash-assets/demo.svg', '/flash-assets/nested/frame.png']) {
      assert.equal(isExecutivePreviewAssetPath(pathname), true, pathname);
      assert.equal(isExecutivePreviewProtectedPath(pathname), true, pathname);
    }

    for (const pathname of ['/flash-assets', '/flash-assets/', '/flash-assets-old/file.png']) {
      assert.equal(isExecutivePreviewAssetPath(pathname), false, pathname);
    }
  });

  it('allows only exact demo return paths and rejects open redirects', () => {
    for (const value of allowedDemoPaths) assert.equal(isAllowedExecutiveReturnTo(value), true);

    for (const value of [
      undefined,
      null,
      '',
      'https://www.helpmath.ai/demos/conversion-1-4',
      '//evil.example/demos/conversion-1-4',
      '/demos/conversion-1-4?next=https://evil.example',
      '/demos/conversion-1-4#frame',
      '/flash-assets/demo.svg',
      '/executive-preview',
    ]) {
      assert.equal(isAllowedExecutiveReturnTo(value), false, String(value));
    }

    assert.equal(
      getExecutivePreviewReturnTo('/demos/conversion-1-4', 'en'),
      '/demos/conversion-1-4',
    );
    assert.equal(
      getExecutivePreviewReturnTo('/demos/conversion-1-4', 'es'),
      '/es/demos/conversion-1-4',
    );
    assert.equal(
      getExecutivePreviewReturnTo('/es/demos/conversion-1-2', 'en'),
      '/demos/conversion-1-2',
    );
    assert.equal(getExecutivePreviewReturnTo('//evil.example', 'en'), '/executive-preview');
    assert.equal(getExecutivePreviewReturnTo('//evil.example', 'es'), '/es/executive-preview');
  });
});
