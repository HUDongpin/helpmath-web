import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  REQUEST_POLICY,
  StableLinkError,
  assertSafeRequestUrl,
  checkLink,
  checkStableLinks,
  extractHttpsLinks,
  isPublicIpAddress,
  loadStableLinkConfiguration,
  probeLinkOnce,
  requestHttpsHeaders,
  resolvePublicAddresses,
} from '../scripts/stable-external-links-lib.mjs';

const entry = {
  id: 'ies-record',
  category: 'research',
  url: 'https://ies.ed.gov/start',
  allowedRedirectHosts: ['ies.ed.gov'],
};

describe('stable external link configuration', () => {
  it('reconciles the finite registry with governed documentation and custody replacements', async () => {
    const registry = await loadStableLinkConfiguration();
    assert.equal(registry.links.length, 16);
    assert.deepEqual(registry.requestPolicy, REQUEST_POLICY);
    assert.deepEqual(
      registry.links.map((link: {id: string}) => link.id),
      [...registry.links.map((link: {id: string}) => link.id)].sort(),
    );
  });

  it('extracts unique HTTPS Markdown destinations in deterministic order', () => {
    assert.deepEqual(
      extractHttpsLinks(
        '[B](https://b.example/path) [A](https://a.example/path) [B](https://b.example/path)',
      ),
      ['https://a.example/path', 'https://b.example/path'],
    );
  });
});

describe('stable external link request boundary', () => {
  it('accepts only exact reviewed HTTPS hosts without credentials, ports, fragments, or IP literals', () => {
    assert.equal(
      assertSafeRequestUrl('https://ies.ed.gov/record?id=1', ['ies.ed.gov']).href,
      'https://ies.ed.gov/record?id=1',
    );

    for (const value of [
      'http://ies.ed.gov/record',
      'https://user:secret@ies.ed.gov/record',
      'https://ies.ed.gov:444/record',
      'https://ies.ed.gov/record#section',
      'https://127.0.0.1/record',
      'https://evil.example/record',
    ]) {
      assert.throws(() => assertSafeRequestUrl(value, ['ies.ed.gov']), StableLinkError, value);
    }
  });

  it('rejects private, loopback, documentation, and mixed public/private DNS answers', async () => {
    assert.equal(isPublicIpAddress('8.8.8.8'), true);
    assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
    for (const address of ['127.0.0.1', '10.0.0.1', '192.0.2.10', '::1', 'fc00::1']) {
      assert.equal(isPublicIpAddress(address), false, address);
    }

    const mixedLookup = (async () => [
      {address: '8.8.8.8', family: 4},
      {address: '127.0.0.1', family: 4},
    ]) as unknown as typeof import('node:dns/promises').lookup;
    await assert.rejects(
      resolvePublicAddresses('ies.ed.gov', mixedLookup),
      (error: unknown) => error instanceof StableLinkError && error.code === 'dns-non-public-address',
    );
  });

  it('bounds DNS resolution with the request wall-clock deadline', async () => {
    const neverResolvingLookup = (() => new Promise(() => undefined)) as unknown as
      typeof import('node:dns/promises').lookup;
    const startedAt = Date.now();

    await assert.rejects(
      requestHttpsHeaders(new URL('https://ies.ed.gov/record'), {
        timeoutMs: 20,
        lookup: neverResolvingLookup,
        request: (() => assert.fail('HTTPS must not start before DNS resolves.')) as never,
      }),
      (error: unknown) =>
        error instanceof StableLinkError && error.code === 'request-timeout' && error.retryable,
    );
    assert.ok(Date.now() - startedAt < 1_000, 'DNS timeout exceeded the bounded deadline.');
  });

  it('follows only bounded same-allowlist redirects', async () => {
    const requests: string[] = [];
    const result = await probeLinkOnce(entry, REQUEST_POLICY, {
      request: async (url: URL) => {
        requests.push(url.href);
        return requests.length === 1
          ? {status: 302, location: '/final'}
          : {status: 206, location: undefined};
      },
    });

    assert.deepEqual(requests, ['https://ies.ed.gov/start', 'https://ies.ed.gov/final']);
    assert.deepEqual(result, {
      status: 206,
      finalUrl: 'https://ies.ed.gov/final',
      redirects: 1,
    });

    await assert.rejects(
      probeLinkOnce(entry, REQUEST_POLICY, {
        request: async () => ({status: 302, location: 'https://evil.example/final'}),
      }),
      (error: unknown) =>
        error instanceof StableLinkError && error.code === 'redirect-host-not-allowed',
    );
  });
});

describe('stable external link retry and summary behavior', () => {
  it('retries only transient failures and preserves deterministic output', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await checkLink(entry, REQUEST_POLICY, {
      probe: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new StableLinkError('network-error', {retryable: true});
        }
        return {status: 200, finalUrl: entry.url, redirects: 0};
      },
      delay: async (delayMs: number) => {
        delays.push(delayMs);
      },
    });

    assert.deepEqual(result, {
      id: entry.id,
      url: entry.url,
      outcome: 'ok',
      status: 200,
      attempts: 2,
      redirects: 0,
    });
    assert.deepEqual(delays, [250]);
  });

  it('does not retry deterministic HTTP failures', async () => {
    let attempts = 0;
    const result = await checkLink(entry, REQUEST_POLICY, {
      probe: async () => {
        attempts += 1;
        return {status: 404, finalUrl: entry.url, redirects: 0};
      },
      delay: async () => assert.fail('A 404 must not be retried.'),
    });

    assert.equal(attempts, 1);
    assert.deepEqual(result, {
      id: entry.id,
      url: entry.url,
      outcome: 'failed',
      status: 404,
      attempts: 1,
      redirects: 0,
      error: 'http-404',
    });
  });

  it('summarizes results in registry order even when workers finish out of order', async () => {
    const entries = [
      {...entry, id: 'first'},
      {...entry, id: 'second', url: 'https://ies.ed.gov/second'},
    ];
    const summary = await checkStableLinks(entries, REQUEST_POLICY, {
      probe: async (candidate: typeof entry) => {
        if (candidate.id === 'first') await new Promise((resolve) => setTimeout(resolve, 5));
        return {status: 200, finalUrl: candidate.url, redirects: 0};
      },
      delay: async () => undefined,
    });

    assert.equal(summary.registered, 2);
    assert.equal(summary.successful, 2);
    assert.equal(summary.failed, 0);
    assert.deepEqual(summary.results.map((result: {id: string}) => result.id), ['first', 'second']);
  });
});
