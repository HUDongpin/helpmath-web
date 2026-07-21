import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {describe, it} from 'node:test';

import {legacyRedirects} from '../next.config';
import {
  LEGACY_APACHE_OUTPUT_PATHS,
  LEGACY_BLOCKED_PATHS,
  LEGACY_TARGET_ORIGIN,
  buildApacheLegacyRuleSet,
  getExpectedApacheLegacyRules,
  legacySourceToApachePattern,
  renderApacheLegacyRules,
  type LegacyRedirectRecord,
} from '../scripts/generate-apache-legacy-redirects';

describe('generated Apache legacy-host rules', () => {
  it('derives every public mapping from the Next.js redirect authority', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    const ruleSet = buildApacheLegacyRuleSet(records);
    const generatedBySource = new Map(ruleSet.redirects.map((rule) => [rule.source, rule]));

    assert.equal(ruleSet.redirects.length, records.length + 1);
    assert.deepEqual(
      ruleSet.redirects[0],
      {
        source: '/',
        destination: '/',
        pattern: '^/?$',
        target: `${LEGACY_TARGET_ORIGIN}/`,
        wildcard: false,
        operationalOnly: true,
      },
    );

    for (const record of records) {
      const generated = generatedBySource.get(record.source);
      assert.ok(generated, `Missing generated Apache rule for ${record.source}`);
      assert.equal(generated.destination, record.destination, record.source);
      const destination = new URL(record.destination, `${LEGACY_TARGET_ORIGIN}/`);
      assert.equal(generated.target, destination.href, record.source);
      assert.equal(
        generated.queryTarget,
        destination.hash
          ? `${destination.origin}${destination.pathname}?%{QUERY_STRING}${destination.hash}`
          : undefined,
        record.source,
      );
      assert.equal(generated.operationalOnly, false, record.source);
    }

    assert.ok(generatedBySource.has('/Beta/:path*'));
    assert.ok(generatedBySource.has('/beta/:path*'));
    assert.equal(new Set(ruleSet.redirects.map((rule) => rule.source)).size, ruleSet.redirects.length);
  });

  it('places every exact redirect before every directory wildcard', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    const redirects = buildApacheLegacyRuleSet(records).redirects;
    const firstWildcard = redirects.findIndex((rule) => rule.wildcard);

    assert.notEqual(firstWildcard, -1);
    assert.ok(redirects.slice(0, firstWildcard).every((rule) => !rule.wildcard));
    assert.ok(redirects.slice(firstWildcard).every((rule) => rule.wildcard));
    assert.ok(
      redirects.findIndex(
        (rule) =>
          rule.source ===
          '/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf',
      ) < redirects.findIndex((rule) => rule.source === '/DealerDocs/:path*'),
    );
  });

  it('decodes encoded legacy literals into safe Apache regular expressions', () => {
    assert.deepEqual(
      legacySourceToApachePattern('/HELP%20Math%20Privacy%20Policy%203.12.07.pdf'),
      {
        pattern: '^/?HELP Math Privacy Policy 3\\.12\\.07\\.pdf$',
        wildcard: false,
      },
    );
    assert.deepEqual(
      legacySourceToApachePattern('/DDI%206-22-09NEWS%20RELEASE%20\\(final\\).pdf'),
      {
        pattern: '^/?DDI 6-22-09NEWS RELEASE \\(final\\)\\.pdf$',
        wildcard: false,
      },
    );
    assert.deepEqual(legacySourceToApachePattern('/DealerDocs/:path*'), {
      pattern: '^/?DealerDocs(?:/.*)?$',
      wildcard: true,
    });
  });

  it('forces the two prohibited artifacts and every unknown path to a body-only 404', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    const ruleSet = buildApacheLegacyRuleSet(records);
    assert.deepEqual(
      ruleSet.blocked.map((rule) => rule.source),
      [...LEGACY_BLOCKED_PATHS],
    );
    assert.ok(
      ruleSet.blocked.every(
        (blocked) => !ruleSet.redirects.some((redirect) => redirect.source === blocked.source),
      ),
    );

    const rendered = renderApacheLegacyRules(ruleSet);
    assert.match(rendered, /ErrorDocument 404 "Not Found"/);
    assert.match(
      rendered,
      /RewriteRule "\^\/\?Images\/Help_Slideshow\\\.swf\$" "-" \[R=404,L\]/,
    );
    assert.match(rendered, /RewriteRule "\^" "-" \[R=404,L\]\n$/);
  });

  it('uses absolute one-hop 301 targets and explicitly preserves fragments and queries', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    const ruleSet = buildApacheLegacyRuleSet(records);
    const rendered = renderApacheLegacyRules(ruleSet);
    const redirectLines = rendered
      .split('\n')
      .filter((line) => line.startsWith('RewriteRule ') && line.includes('[R=301'));

    assert.equal(
      redirectLines.length,
      ruleSet.redirects.reduce((count, rule) => count + (rule.queryTarget ? 2 : 1), 0),
    );
    for (const line of redirectLines) {
      assert.match(line, / "https:\/\/www\.helpmath\.ai\//);
      assert.match(line, / \[R=301,L,NE\]$/);
      assert.doesNotMatch(line, /QSD|QSA/);
    }
    assert.match(
      rendered,
      /"https:\/\/www\.helpmath\.ai\/curriculum\?%\{QUERY_STRING\}#help-math-1-catalog" \[R=301,L,NE\]/,
    );
    assert.match(
      rendered,
      /RewriteCond "%\{QUERY_STRING\}" "!\^\$"\nRewriteRule/,
    );
    assert.equal(rendered, renderApacheLegacyRules(ruleSet));
  });

  it('keeps both checked-in deployment forms byte-for-byte generated', async () => {
    const expected = await getExpectedApacheLegacyRules();
    for (const outputPath of LEGACY_APACHE_OUTPUT_PATHS) {
      assert.equal(await readFile(outputPath, 'utf8'), expected, outputPath);
    }
  });

  it('rejects unsafe or unsupported mappings instead of silently broadening them', () => {
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: '/unsafe', destination: 'https://example.com', permanent: true},
        ]),
      /internal absolute path/,
    );
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: '/duplicate', destination: '/about', permanent: true},
          {source: '/duplicate', destination: '/research', permanent: true},
        ]),
      /Duplicate legacy redirect source/,
    );
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: '/dynamic/:slug', destination: '/resources', permanent: true},
        ]),
      /Unsupported Next\.js legacy redirect pattern/,
    );
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: LEGACY_BLOCKED_PATHS[0], destination: '/resources', permanent: true},
        ]),
      /must remain a 404/,
    );
  });
});
