import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {
  languageSwitchGatewayHref,
  localizeHref,
  stripLocalePrefix,
} from '../i18n/href';

describe('localized document navigation', () => {
  test('preserves query and fragment data while switching locale', () => {
    const href = '/contact?topic=research#main-content';

    assert.equal(localizeHref(href, 'es'), '/es/contact?topic=research#main-content');
    assert.equal(
      localizeHref('/es/contact?topic=research#main-content', 'en'),
      href,
    );
  });

  test('normalizes locale roots without duplicating prefixes', () => {
    assert.equal(stripLocalePrefix('/es'), '/');
    assert.equal(stripLocalePrefix('/es/research'), '/research');
    assert.equal(localizeHref('/es/research', 'es'), '/es/research');
    assert.equal(localizeHref('/en/research', 'en'), '/research');
  });

  test('leaves external and protocol-relative destinations untouched', () => {
    assert.equal(localizeHref('https://www.boulderlearning.com/', 'es'), 'https://www.boulderlearning.com/');
    assert.equal(localizeHref('//www.boulderlearning.com/', 'es'), '//www.boulderlearning.com/');
  });

  test('builds a static-safe language gateway from only the local pathname', () => {
    assert.equal(
      languageSwitchGatewayHref('/es/contact?topic=research#main-content', 'en'),
      '/api/language-switch/en?path=%2Fcontact',
    );
    assert.equal(
      languageSwitchGatewayHref('/resources', 'es'),
      '/api/language-switch/es?path=%2Fresources',
    );
  });
});
