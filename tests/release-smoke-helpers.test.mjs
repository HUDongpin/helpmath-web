import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  buildDemoLifecycleSmokeModel,
  evaluateCanonicalRedirect,
  evaluateExecutivePreviewEntries,
  evaluateExecutivePreviewLifecycle,
  inspectExecutivePreviewEntry,
  isRetryableHttpStatus,
  isStrictIsoUtcTimestamp,
  mapWithConcurrency,
  retryDelayMs,
  retryOperation,
} from '../scripts/release-smoke-helpers.mjs';

const lifecycleFixture = {
  assetsById: {
    'conversion-1-2': [
      '/api/executive-preview/assets/conversion-1-2/gallon.png',
    ],
    'conversion-1-4': [
      '/api/executive-preview/assets/conversion-1-4/pitcher.png',
    ],
  },
  candidateIds: ['conversion-1-2', 'conversion-1-4'],
  headingsByLocale: {
    en: {'conversion-1-2': 'Conversion 1.2', 'conversion-1-4': 'Conversion 1.4'},
    es: {'conversion-1-2': 'Conversión 1.2', 'conversion-1-4': 'Conversión 1.4'},
  },
};

test('demo lifecycle smoke model preserves the current all-private contract', () => {
  const model = buildDemoLifecycleSmokeModel({
    ...lifecycleFixture,
    indexableIds: [],
    publicIds: [],
    reviewIds: ['conversion-1-2', 'conversion-1-4'],
  });

  assert.deepEqual(model.publicDemoIds, []);
  assert.deepEqual(model.privateDemoRoutes, [
    '/demos/conversion-1-2',
    '/es/demos/conversion-1-2',
    '/demos/conversion-1-4',
    '/es/demos/conversion-1-4',
  ]);
  assert.deepEqual(
    model.authenticatedDemoCases.map(({path, locale}) => ({path, locale})),
    [
      {path: '/demos/conversion-1-2', locale: 'en'},
      {path: '/es/demos/conversion-1-2', locale: 'es'},
      {path: '/demos/conversion-1-4', locale: 'en'},
      {path: '/es/demos/conversion-1-4', locale: 'es'},
    ],
  );
  assert.deepEqual(model.privateAssetPaths, [
    '/api/executive-preview/assets/conversion-1-2/gallon.png',
    '/api/executive-preview/assets/conversion-1-4/pitcher.png',
  ]);
});

test('demo lifecycle smoke model separates conditional, indexable, and private demos', () => {
  const conditional = buildDemoLifecycleSmokeModel({
    ...lifecycleFixture,
    indexableIds: [],
    publicIds: ['conversion-1-2'],
    reviewIds: ['conversion-1-4'],
  });
  assert.deepEqual(conditional.publicDemoRoutes, [
    '/demos/conversion-1-2',
    '/es/demos/conversion-1-2',
  ]);
  assert.deepEqual(conditional.indexableDemoRoutes, []);
  assert.deepEqual(conditional.privateDemoRoutes, [
    '/demos/conversion-1-4',
    '/es/demos/conversion-1-4',
  ]);
  assert.deepEqual(conditional.publicAssetPaths, [
    '/api/executive-preview/assets/conversion-1-2/gallon.png',
  ]);
  assert.deepEqual(conditional.reviewRuntimePaths, [
    '/api/executive-preview/runtime/conversion-1-4.js',
  ]);

  const indexable = buildDemoLifecycleSmokeModel({
    ...lifecycleFixture,
    indexableIds: ['conversion-1-2'],
    publicIds: ['conversion-1-2'],
    reviewIds: ['conversion-1-4'],
  });
  assert.deepEqual(indexable.indexableDemoRoutes, [
    '/demos/conversion-1-2',
    '/es/demos/conversion-1-2',
  ]);

  const assetless = buildDemoLifecycleSmokeModel({
    ...lifecycleFixture,
    assetsById: {
      ...lifecycleFixture.assetsById,
      'conversion-1-4': [],
    },
    indexableIds: [],
    publicIds: ['conversion-1-4'],
    reviewIds: ['conversion-1-2'],
  });
  assert.deepEqual(assetless.publicAssetPaths, []);
  assert.deepEqual(assetless.reviewAssetPaths, [
    '/api/executive-preview/assets/conversion-1-2/gallon.png',
  ]);
});

test('demo lifecycle smoke model fails closed on invalid ownership or state overlap', () => {
  assert.throws(
    () => buildDemoLifecycleSmokeModel({
      ...lifecycleFixture,
      indexableIds: [],
      publicIds: ['conversion-1-2'],
      reviewIds: ['conversion-1-2'],
    }),
    /cannot be public and private-review/u,
  );
  assert.throws(
    () => buildDemoLifecycleSmokeModel({
      ...lifecycleFixture,
      assetsById: {
        ...lifecycleFixture.assetsById,
        'conversion-1-2': ['/api/executive-preview/assets/conversion-1-4/pitcher.png'],
      },
      indexableIds: [],
      publicIds: [],
      reviewIds: ['conversion-1-2'],
    }),
    /unique namespaced asset paths/u,
  );
  assert.throws(
    () => buildDemoLifecycleSmokeModel({
      ...lifecycleFixture,
      assetsById: {
        ...lifecycleFixture.assetsById,
        'conversion-1-2': [
          '/api/executive-preview/assets/conversion-1-2/../conversion-1-4/pitcher.png',
        ],
      },
      indexableIds: [],
      publicIds: [],
      reviewIds: ['conversion-1-2'],
    }),
    /unique namespaced asset paths/u,
  );
});

test('isStrictIsoUtcTimestamp accepts only canonical millisecond UTC timestamps', () => {
  assert.equal(isStrictIsoUtcTimestamp('2026-07-28T15:59:00.000Z'), true);

  for (const value of [
    '2026-07-28T15:59:00Z',
    '2026-07-28T15:59:00.000+00:00',
    '2026-02-30T15:59:00.000Z',
    'not-a-date',
    null,
  ]) {
    assert.equal(isStrictIsoUtcTimestamp(value), false, String(value));
  }
});

test('evaluateCanonicalRedirect accepts only the exact same-origin canonical target', () => {
  assert.deepEqual(
    evaluateCanonicalRedirect(
      {status: 307, location: '/executive-preview'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
      },
    ),
    {
      location: 'https://www.helpmath.ai/executive-preview',
      failures: [],
    },
  );

  assert.deepEqual(
    evaluateCanonicalRedirect(
      {status: 307, location: '/es/executive-preview'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/es/executive-preview',
      },
    ).failures,
    [],
  );

  for (const [location, expectedPath] of [
    ['/executive-preview?error=1', '/executive-preview?error=1'],
    ['/es/executive-preview?error=1', '/es/executive-preview?error=1'],
  ]) {
    assert.deepEqual(
      evaluateCanonicalRedirect(
        {status: 307, location},
        {
          baseUrl: 'https://www.helpmath.ai',
          expectedPath,
        },
      ).failures,
      [],
    );
  }

  assert.deepEqual(
    evaluateCanonicalRedirect(
      {status: 308, location: '/executive-preview'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
        expectedStatus: 308,
      },
    ).failures,
    [],
  );

  for (const result of [
    evaluateCanonicalRedirect(
      {status: 200, location: '/executive-preview'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
      },
    ),
    evaluateCanonicalRedirect(
      {status: 307, location: '/executive-preview?returnTo=/demos/conversion-1-2'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
      },
    ),
    evaluateCanonicalRedirect(
      {status: 307, location: 'https://evil.example/executive-preview'},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
      },
    ),
    evaluateCanonicalRedirect(
      {status: 307, location: null},
      {
        baseUrl: 'https://www.helpmath.ai',
        expectedPath: '/executive-preview',
      },
    ),
  ]) {
    assert.ok(result.failures.length > 0);
  }
});

test('inspectExecutivePreviewEntry recognizes an active login in either attribute style', () => {
  for (const dateTimeAttribute of ['dateTime', 'datetime']) {
    const result = inspectExecutivePreviewEntry(`
      <form method="post" action="/api/executive-preview/session">
        <input type="password" name="passphrase" />
      </form>
      <time ${dateTimeAttribute}="2026-07-28T15:59:00.000Z">July 28</time>
    `);

    assert.deepEqual(result, {
      state: 'login',
      hasLoginForm: true,
      hasPassphraseField: true,
      hasUnavailableNotice: false,
      unavailableLocales: [],
      expiryValues: ['2026-07-28T15:59:00.000Z'],
    });
  }
});

test('inspectExecutivePreviewEntry recognizes the bilingual unavailable state', () => {
  for (const notice of [
    'Executive preview is unavailable',
    'La vista previa ejecutiva no está disponible',
  ]) {
    assert.deepEqual(inspectExecutivePreviewEntry(`<h2>${notice}</h2>`), {
      state: 'unavailable',
      hasLoginForm: false,
      hasPassphraseField: false,
      hasUnavailableNotice: true,
      unavailableLocales: [notice.startsWith('Executive') ? 'en' : 'es'],
      expiryValues: [],
    });
  }
});

test('inspectExecutivePreviewEntry requires the passphrase field inside the login form', () => {
  const result = inspectExecutivePreviewEntry(`
    <form method="post" action="/api/executive-preview/session">
      <input type="text" name="returnTo" />
    </form>
    <form><input type="password" name="passphrase" /></form>
  `);

  assert.equal(result.hasLoginForm, true);
  assert.equal(result.hasPassphraseField, false);
  assert.equal(result.state, 'unknown');
});

test('evaluateExecutivePreviewEntries rejects inconsistent state, expiry, and expectations', () => {
  const nowMs = Date.parse('2026-07-21T00:00:00.000Z');
  const matching = [
    {state: 'login', expiryValues: ['2026-07-28T15:59:00.000Z']},
    {state: 'login', expiryValues: ['2026-07-28T15:59:00.000Z']},
  ];
  assert.deepEqual(
    evaluateExecutivePreviewEntries(matching, {
      expectedState: 'login',
      expectedExpiresAt: '2026-07-28T15:59:00.000Z',
      nowMs,
    }),
    {
      state: 'login',
      expiresAt: '2026-07-28T15:59:00.000Z',
      failures: [],
    },
  );

  const inconsistent = evaluateExecutivePreviewEntries(
    [
      {state: 'login', expiryValues: ['2026-07-28T15:59:00.000Z']},
      {state: 'unavailable', expiryValues: []},
    ],
    {expectedState: 'login', expectedExpiresAt: '2026-07-29T00:00:00.000Z', nowMs},
  );
  assert.match(inconsistent.failures.join('\n'), /disagree on state/);
  assert.match(inconsistent.failures.join('\n'), /expected login/);
  assert.match(inconsistent.failures.join('\n'), /expected 2026-07-29/);

  const differentExpiries = evaluateExecutivePreviewEntries(
    [
      {state: 'login', expiryValues: ['2026-07-28T15:59:00.000Z']},
      {state: 'login', expiryValues: ['2026-07-29T15:59:00.000Z']},
    ],
    {nowMs},
  );
  assert.match(differentExpiries.failures.join('\n'), /same single review expiry/);
});

test('evaluateExecutivePreviewLifecycle permits a safe early close and enforces the absolute boundary', () => {
  const maximumExpiresAt = '2026-07-28T15:59:00.000Z';
  const beforeClose = Date.parse('2026-07-28T15:58:59.000Z');
  const atClose = Date.parse(maximumExpiresAt);

  assert.deepEqual(
    evaluateExecutivePreviewLifecycle(
      {state: 'login', expiresAt: maximumExpiresAt},
      {maximumExpiresAt, nowMs: beforeClose},
    ).failures,
    [],
  );
  assert.deepEqual(
    evaluateExecutivePreviewLifecycle(
      {state: 'unavailable', expiresAt: null},
      {maximumExpiresAt, nowMs: beforeClose},
    ).failures,
    [],
  );
  assert.match(
    evaluateExecutivePreviewLifecycle(
      {state: 'login', expiresAt: '2026-07-29T00:00:00.000Z'},
      {maximumExpiresAt, nowMs: beforeClose},
    ).failures.join('\n'),
    /expected 2026-07-28/u,
  );
  assert.deepEqual(
    evaluateExecutivePreviewLifecycle(
      {state: 'unavailable', expiresAt: null},
      {maximumExpiresAt, nowMs: atClose},
    ).failures,
    [],
  );
  assert.match(
    evaluateExecutivePreviewLifecycle(
      {state: 'login', expiresAt: maximumExpiresAt},
      {maximumExpiresAt, nowMs: atClose},
    ).failures.join('\n'),
    /expected unavailable after approved close/u,
  );
  assert.throws(
    () => evaluateExecutivePreviewLifecycle(
      {state: 'unavailable', expiresAt: null},
      {maximumExpiresAt: 'not-a-date', nowMs: atClose},
    ),
    /canonical UTC timestamp/u,
  );
});

test('inspectExecutivePreviewEntry fails classification for incomplete or mixed markup', () => {
  for (const markup of [
    '<form method="post" action="/api/executive-preview/session"></form>',
    '<input type="password" name="passphrase" />',
    '<form method="post" action="/api/executive-preview/session"><input type="password" name="passphrase" /></form><h2>Executive preview is unavailable</h2>',
    '<h2>Unexpected entry state</h2>',
  ]) {
    assert.equal(inspectExecutivePreviewEntry(markup).state, 'unknown');
  }
});

test('mapWithConcurrency limits active work and preserves result order', async () => {
  let active = 0;
  let maximumActive = 0;
  const release = [];

  const resultPromise = mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => release.push(resolve));
    active -= 1;
    return value * 10;
  });

  while (release.length < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  release.shift()();
  while (release.length < 2) await new Promise((resolve) => setImmediate(resolve));
  release.shift()();

  while (release.length > 0 || active > 0) {
    if (release.length > 0) release.shift()();
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.deepEqual(await resultPromise, [0, 10, 20, 30, 40, 50]);
  assert.equal(maximumActive, 2);
});

test('retryOperation retries transient results with bounded exponential delays', async () => {
  const statuses = [503, 429, 200];
  const delays = [];

  const result = await retryOperation(
    async () => ({status: statuses.shift()}),
    {
      maxAttempts: 3,
      shouldRetryResult: ({status}) => isRetryableHttpStatus(status),
      delayForAttempt: (attempt) => retryDelayMs(attempt, 300, 500),
      sleep: async (delayMs) => delays.push(delayMs),
    },
  );

  assert.equal(result.status, 200);
  assert.deepEqual(delays, [300, 500]);
});

test('retryOperation does not retry deterministic HTTP failures', async () => {
  let attempts = 0;

  const result = await retryOperation(
    async () => {
      attempts += 1;
      return {status: 404};
    },
    {
      maxAttempts: 3,
      shouldRetryResult: ({status}) => isRetryableHttpStatus(status),
    },
  );

  assert.equal(result.status, 404);
  assert.equal(attempts, 1);
});

test('retryOperation retries operational errors and preserves the final error', async () => {
  const expected = new Error('network unavailable');
  let attempts = 0;

  await assert.rejects(
    retryOperation(
      async () => {
        attempts += 1;
        throw expected;
      },
      {maxAttempts: 3, sleep: async () => {}},
    ),
    (error) => error === expected,
  );
  assert.equal(attempts, 3);
});

test('HTTP retry classification is limited to transient statuses', () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableHttpStatus(status), true, `${status} should retry`);
  }
  for (const status of [200, 301, 400, 401, 403, 404, 501]) {
    assert.equal(isRetryableHttpStatus(status), false, `${status} should not retry`);
  }
});

test('release smoke executes through summary and reports effective launch-gate states', {
  timeout: 30_000,
}, async (t) => {
  const server = createServer((request, response) => {
    response.statusCode = 404;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.end(
      '<!doctype html><html><head><title>Smoke fixture</title></head><body>Missing</body></html>',
    );
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const fixtureOrigin = `http://127.0.0.1:${address.port}`;
  const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
  const child = spawn(process.execPath, ['scripts/release-smoke.mjs'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      EXPECT_CONTACT_ENABLED: 'false',
      EXPECT_EXECUTIVE_PREVIEW_EXPIRES_AT: '',
      EXPECT_EXECUTIVE_PREVIEW_STATE: 'any',
      SMOKE_BASE_URL: fixtureOrigin,
      SMOKE_CANONICAL_ORIGIN: fixtureOrigin,
      SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY: '',
      SMOKE_FETCH_TIMEOUT_MS: '1000',
      SMOKE_INTERNAL_LINK_CONCURRENCY: '12',
      SMOKE_REQUEST_MAX_ATTEMPTS: '1',
      SMOKE_REQUEST_RETRY_BASE_DELAY_MS: '0',
      SMOKE_REQUEST_RETRY_MAX_DELAY_MS: '0',
      SMOKE_VERCEL_BYPASS_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const {code, signal} = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode, exitSignal) => {
      resolve({code: exitCode, signal: exitSignal});
    });
  });

  assert.equal(signal, null, stderr);
  assert.equal(code, 1, stderr);
  assert.doesNotMatch(stderr, /ReferenceError|launchGateManifest is not defined/u);
  const summary = JSON.parse(stdout);
  assert.deepEqual(summary.launchGates, {
    legalPublication: 'holding',
    contactIntake: 'holding',
    demoPublication: 'holding',
    legacyCutover: 'holding',
    productionLaunch: 'holding',
  });
  assert.equal(summary.legalPublicationGate, 'holding');
  assert.equal(summary.contactRepositoryGate, 'holding');
  assert.ok(summary.failures.length > 0);
});
