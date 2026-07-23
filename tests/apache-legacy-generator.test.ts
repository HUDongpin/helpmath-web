import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {describe, it} from 'node:test';

import {legacyRedirects} from '../next.config';
import {
  LEGACY_APACHE_OUTPUT_PATHS,
  LEGACY_BLOCKED_PATHS,
  LEGACY_LOGIN_CONTAINMENT_OUTPUT_PATHS,
  LEGACY_LOGIN_CONTAINMENT_PATHS,
  LEGACY_TARGET_ORIGIN,
  buildApacheLoginContainmentRules,
  buildApacheLegacyRuleSet,
  getExpectedApacheLoginContainmentRules,
  getExpectedApacheLegacyRules,
  legacySourceToApachePattern,
  renderApacheLoginContainmentRules,
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
        discardQuery: false,
        caseInsensitive: false,
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
      const credentialEntry = LEGACY_LOGIN_CONTAINMENT_PATHS.includes(
        record.source as (typeof LEGACY_LOGIN_CONTAINMENT_PATHS)[number],
      );
      assert.equal(generated.discardQuery, credentialEntry, record.source);
      assert.equal(generated.caseInsensitive, credentialEntry, record.source);
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

  it('uses one-hop targets, preserving ordinary queries but discarding login queries', async () => {
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
    const containmentLines = redirectLines.filter((line) =>
      line.endsWith('[R=301,L,NE,QSD,NC]'),
    );
    const ordinaryLines = redirectLines.filter((line) =>
      line.endsWith('[R=301,L,NE]'),
    );
    assert.equal(containmentLines.length, LEGACY_LOGIN_CONTAINMENT_PATHS.length);
    assert.equal(containmentLines.length + ordinaryLines.length, redirectLines.length);
    for (const line of ordinaryLines) {
      assert.match(line, / "https:\/\/www\.helpmath\.ai\//);
      assert.match(line, / \[R=301,L,NE\]$/);
      assert.doesNotMatch(line, /QSD|QSA/);
    }
    for (const source of LEGACY_LOGIN_CONTAINMENT_PATHS) {
      const pattern = legacySourceToApachePattern(source).pattern.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      assert.match(
        rendered,
        new RegExp(
          `RewriteRule "${pattern}" "https:\\/\\/www\\.helpmath\\.ai\\/login" \\[R=301,L,NE,QSD,NC\\]`,
        ),
      );
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

  it('generates a five-path emergency login containment block without broader cutover', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    const rules = buildApacheLoginContainmentRules(records);
    assert.deepEqual(
      rules.map((rule) => rule.source),
      [...LEGACY_LOGIN_CONTAINMENT_PATHS],
    );
    assert.ok(
      rules.every(
        (rule) =>
          rule.destination === '/login' &&
          rule.target === `${LEGACY_TARGET_ORIGIN}/login` &&
          !rule.pattern.includes('.*'),
      ),
    );

    const rendered = renderApacheLoginContainmentRules(rules);
    const redirectLines = rendered
      .split('\n')
      .filter((line) => line.startsWith('RewriteRule '));
    assert.equal(redirectLines.length, LEGACY_LOGIN_CONTAINMENT_PATHS.length);
    assert.ok(redirectLines.every((line) => line.endsWith('[R=301,L,NE,QSD,NC]')));
    assert.doesNotMatch(
      rendered,
      /^ErrorDocument |\[R=404|^RewriteRule "\^" "-"|old-host root/m,
    );
    assert.match(rendered, /Unmatched legacy requests continue to the existing host/);
  });

  it('keeps both emergency-containment deployment forms byte-for-byte generated', async () => {
    const expected = await getExpectedApacheLoginContainmentRules();
    for (const outputPath of LEGACY_LOGIN_CONTAINMENT_OUTPUT_PATHS) {
      assert.equal(await readFile(outputPath, 'utf8'), expected, outputPath);
    }
  });

  it('fails closed when a required login containment mapping is missing or broadened', async () => {
    const records = (await legacyRedirects()) as LegacyRedirectRecord[];
    assert.throws(
      () =>
        buildApacheLoginContainmentRules(
          records.filter((record) => record.source !== LEGACY_LOGIN_CONTAINMENT_PATHS[0]),
        ),
      /Missing required legacy login containment source/,
    );
    assert.throws(
      () =>
        buildApacheLoginContainmentRules(
          records.map((record) =>
            record.source === LEGACY_LOGIN_CONTAINMENT_PATHS[0]
              ? {...record, destination: '/support'}
              : record,
          ),
        ),
      /must be a permanent \/login redirect/,
    );
    assert.throws(
      () =>
        buildApacheLoginContainmentRules([
          ...records,
          records.find((record) => record.source === LEGACY_LOGIN_CONTAINMENT_PATHS[0])!,
        ]),
      /Duplicate legacy login containment source/,
    );
    assert.throws(
      () =>
        buildApacheLoginContainmentRules([
          ...records,
          {source: '/STUDENT_LOGIN.ASPX', destination: '/support', permanent: true},
        ]),
      /collides after Apache path normalization/,
    );
    assert.throws(
      () =>
        buildApacheLoginContainmentRules([
          ...records,
          {source: '/%73tudent_login.aspx', destination: '/support', permanent: true},
        ]),
      /collides after Apache path normalization/,
    );
    assert.throws(
      () => renderApacheLoginContainmentRules([]),
      /requires exactly 5 rules/,
    );
    assert.throws(
      () =>
        renderApacheLoginContainmentRules(
          buildApacheLoginContainmentRules(records).map((rule, index) =>
            index === 0 ? {...rule, target: `${LEGACY_TARGET_ORIGIN}/support`} : rule,
          ),
        ),
      /does not match the reviewed exact mapping/,
    );
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
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {
            source: LEGACY_LOGIN_CONTAINMENT_PATHS[0],
            destination: '/support',
            permanent: true,
          },
        ]),
      /credential-entry redirect must keep the reviewed \/login destination/,
    );
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: '/STUDENT_LOGIN.ASPX', destination: '/support', permanent: true},
        ]),
      /collides after Apache path normalization with reviewed credential entry/,
    );
    assert.throws(
      () =>
        buildApacheLegacyRuleSet([
          {source: '/%73tudent_login.aspx', destination: '/support', permanent: true},
        ]),
      /collides after Apache path normalization with reviewed credential entry/,
    );
  });

  it('rejects a contradictory full-cutover rule that preserves and discards a query', () => {
    assert.throws(
      () =>
        renderApacheLegacyRules({
          blocked: [],
          redirects: [
            {
              source: '/student_login.aspx',
              destination: '/login#review',
              pattern: '^/?student_login\\.aspx$',
              target: `${LEGACY_TARGET_ORIGIN}/login#review`,
              queryTarget: `${LEGACY_TARGET_ORIGIN}/login?%{QUERY_STRING}#review`,
              wildcard: false,
              operationalOnly: false,
              discardQuery: true,
              caseInsensitive: true,
            },
          ],
        }),
      /cannot both preserve and discard a query string/,
    );
    assert.throws(
      () =>
        renderApacheLegacyRules({
          blocked: [],
          redirects: [
            {
              source: '/student_login.aspx',
              destination: '/login',
              pattern: '^/?student_login\\.aspx$',
              target: `${LEGACY_TARGET_ORIGIN}/login`,
              wildcard: false,
              operationalOnly: false,
              discardQuery: true,
              caseInsensitive: false,
            },
          ],
        }),
      /privacy flags must be enabled together/,
    );
  });
});
