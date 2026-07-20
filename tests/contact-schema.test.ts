import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  CONTACT_LIMITS,
  contactRequestSchema,
  normalizeContactTopic,
} from '../lib/contact-schema';

function validRequest() {
  return {
    locale: 'en',
    role: 'educator',
    name: '  Ada Lovelace  ',
    email: '  ADA@EXAMPLE.ORG ',
    organization: '  Example School ',
    topic: 'support',
    message: 'I need help opening a public demonstration.',
    privacyConsent: true,
    turnstileToken: 'verified-token',
    website: '',
  };
}

describe('contactRequestSchema', () => {
  it('accepts, trims, and normalizes a valid adult request', () => {
    const result = contactRequestSchema.parse(validRequest());
    assert.equal(result.name, 'Ada Lovelace');
    assert.equal(result.email, 'ada@example.org');
    assert.equal(result.organization, 'Example School');
  });

  it('rejects unknown role and topic values', () => {
    const result = contactRequestSchema.safeParse({
      ...validRequest(),
      role: 'student',
      topic: 'unknown',
    });
    assert.equal(result.success, false);
  });

  it('rejects oversized messages and missing privacy consent', () => {
    const result = contactRequestSchema.safeParse({
      ...validRequest(),
      message: 'x'.repeat(CONTACT_LIMITS.message + 1),
      privacyConsent: false,
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      assert.ok(fields.message);
      assert.ok(fields.privacyConsent);
    }
  });

  it('rejects unexpected fields and a missing verification token', () => {
    const result = contactRequestSchema.safeParse({
      ...validRequest(),
      turnstileToken: '',
      studentRecord: 'must not be accepted',
    });
    assert.equal(result.success, false);
  });

  it('maps legacy contact-link topics to supported categories', () => {
    assert.equal(normalizeContactTopic('privacy'), 'accessibility');
    assert.equal(normalizeContactTopic('resource-html5-proposal'), 'resources');
    assert.equal(normalizeContactTopic('support'), 'support');
    assert.equal(normalizeContactTopic('unknown'), undefined);
  });
});
