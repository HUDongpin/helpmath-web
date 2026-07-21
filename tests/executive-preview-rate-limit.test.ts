import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  EXECUTIVE_PREVIEW_FAILURE_LIMIT,
  EXECUTIVE_PREVIEW_FAILURE_WINDOW_MS,
  ExecutivePreviewFailureLimiter,
  getExecutivePreviewClientIdentifier,
} from '../lib/executive-preview-rate-limit';

describe('executive preview failure limiter', () => {
  it('blocks the threshold failure until the fixed window expires', () => {
    const limiter = new ExecutivePreviewFailureLimiter();
    const now = Date.parse('2026-07-21T12:00:00.000Z');

    for (let attempt = 1; attempt < EXECUTIVE_PREVIEW_FAILURE_LIMIT; attempt += 1) {
      const result = limiter.recordFailure('203.0.113.7', now + attempt);
      assert.equal(result.blocked, false);
      assert.equal(result.remaining, EXECUTIVE_PREVIEW_FAILURE_LIMIT - attempt);
    }

    const blocked = limiter.recordFailure('203.0.113.7', now + 8);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterSeconds, 900);
    assert.equal(limiter.check('203.0.113.7', now + 10_000).blocked, true);
    assert.equal(
      limiter.check('203.0.113.7', now + EXECUTIVE_PREVIEW_FAILURE_WINDOW_MS + 1).blocked,
      false,
    );
  });

  it('clears failures after successful authentication', () => {
    const limiter = new ExecutivePreviewFailureLimiter();
    limiter.recordFailure('203.0.113.8', 1_000);
    limiter.clear('203.0.113.8');
    assert.deepEqual(limiter.check('203.0.113.8', 1_001), {
      blocked: false,
      remaining: EXECUTIVE_PREVIEW_FAILURE_LIMIT,
      retryAfterSeconds: 0,
    });
  });

  it('accepts only normalized IP forwarding values and collapses invalid keys', () => {
    assert.equal(
      getExecutivePreviewClientIdentifier(new Headers({
        'x-vercel-forwarded-for': '2001:DB8::1, 198.51.100.2',
      })),
      '2001:db8::1',
    );
    assert.equal(
      getExecutivePreviewClientIdentifier(new Headers({'x-forwarded-for': '203.0.113.9'})),
      '203.0.113.9',
    );
    assert.equal(
      getExecutivePreviewClientIdentifier(new Headers({'x-forwarded-for': 'attacker-key'})),
      'unknown',
    );
  });
});
