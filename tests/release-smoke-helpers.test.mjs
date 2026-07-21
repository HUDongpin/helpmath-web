import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDemoLifecycleSmokeModel,
  evaluateExecutivePreviewEntries,
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
