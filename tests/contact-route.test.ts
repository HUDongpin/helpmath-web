import assert from 'node:assert/strict';
import {afterEach, describe, it} from 'node:test';
import {
  buildContactEmail,
  DEVELOPMENT_TURNSTILE_TOKEN,
  POST,
} from '../app/api/contact/route';
import {contactRequestSchema} from '../lib/contact-schema';

const envKeys = [
  'NODE_ENV',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
  'SUPPORT_TO_EMAIL',
  'SUPPORT_FROM_EMAIL',
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    locale: 'en',
    role: 'educator',
    name: 'Ada Lovelace',
    email: 'ada@example.org',
    organization: 'Example School',
    topic: 'support',
    message: 'I need help opening a public demonstration.',
    privacyConsent: true,
    turnstileToken: 'verified-token',
    website: '',
    ...overrides,
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://www.helpmath.ai/api/contact', {
    method: 'POST',
    headers: {'content-type': 'application/json', ...headers},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  for (const key of envKeys) {
    setEnv(key, originalEnv[key]);
  }
  globalThis.fetch = originalFetch;
});

describe('POST /api/contact', () => {
  it('addresses email to support and sets Reply-To to the validated sender', () => {
    const email = buildContactEmail(
      contactRequestSchema.parse(validRequest()),
      'HELP Math <support@helpmath.ai>',
      'team@helpmath.ai',
    );
    assert.deepEqual(email.to, ['team@helpmath.ai']);
    assert.equal(email.replyTo, 'ada@example.org');
    assert.doesNotMatch(email.text, /verified-token|turnstile/i);
  });

  it('returns the same structured error envelope for malformed JSON', async () => {
    const response = await POST(request('{not json'));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.equal(typeof body.error.message, 'string');
  });

  it('returns field errors for invalid submissions', async () => {
    const response = await POST(request(validRequest({email: 'not-an-email'})));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.fieldErrors.email);
  });

  it('quietly accepts and discards honeypot submissions', async () => {
    setEnv('NODE_ENV', 'production');
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(request(validRequest({website: 'https://bot.example'})));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true});
  });

  it('fails closed when Turnstile is not configured in production', async () => {
    setEnv('NODE_ENV', 'production');
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'TURNSTILE_NOT_CONFIGURED');
  });

  it('permits only the explicit local-development Turnstile simulation token', async () => {
    setEnv('NODE_ENV', 'development');
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    const response = await POST(
      request(validRequest({turnstileToken: DEVELOPMENT_TURNSTILE_TOKEN})),
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'EMAIL_NOT_CONFIGURED');
  });

  it('does not treat arbitrary tokens as local-development verification', async () => {
    setEnv('NODE_ENV', 'development');
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(request(validRequest({turnstileToken: 'not-the-bypass'})));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'TURNSTILE_NOT_CONFIGURED');
  });

  it('rejects a failed Turnstile verification before email delivery', async () => {
    setEnv('NODE_ENV', 'production');
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    globalThis.fetch = async () => Response.json({success: false});

    const response = await POST(
      request(validRequest(), {'x-forwarded-for': '203.0.113.8, 10.0.0.1'}),
    );
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error.code, 'TURNSTILE_FAILED');
  });

  it('rejects a successful token issued for a different Turnstile action', async () => {
    setEnv('NODE_ENV', 'production');
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    globalThis.fetch = async () => Response.json({success: true, action: 'login'});

    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error.code, 'TURNSTILE_FAILED');
  });

  it('verifies the Turnstile action and forwarded client address before delivery', async () => {
    setEnv('NODE_ENV', 'production');
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    delete process.env.RESEND_API_KEY;
    let verificationBody = '';
    globalThis.fetch = async (input, init) => {
      assert.equal(
        String(input),
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      );
      verificationBody = String(init?.body);
      return Response.json({success: true, action: 'contact'});
    };

    const response = await POST(
      request(validRequest(), {'x-forwarded-for': '203.0.113.8, 10.0.0.1'}),
    );
    const body = await response.json();
    assert.match(verificationBody, /remoteip=203\.0\.113\.8/);
    assert.match(verificationBody, /response=verified-token/);
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'EMAIL_NOT_CONFIGURED');
  });
});
