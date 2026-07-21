import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRetryableHttpStatus,
  mapWithConcurrency,
  retryDelayMs,
  retryOperation,
} from '../scripts/release-smoke-helpers.mjs';

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
