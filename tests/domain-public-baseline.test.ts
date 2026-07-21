import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const evidencePath = path.join(
  process.cwd(),
  'docs/evidence/domain-public-baseline-2026-07-21.json',
);

async function readEvidence() {
  return JSON.parse(await readFile(evidencePath, 'utf8'));
}

describe('public domain baseline evidence', () => {
  it('pins the three audited UTC observation windows', async () => {
    const evidence = await readEvidence();

    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.evidenceKind, 'help-math-public-domain-baseline');
    assert.deepEqual(evidence.observationWindows, {
      dns: {
        startedAt: '2026-07-21T13:19:31Z',
        completedAt: '2026-07-21T13:20:31Z',
      },
      http: {
        startedAt: '2026-07-21T13:20:52Z',
        completedAt: '2026-07-21T13:21:19Z',
      },
      tls: {
        startedAt: '2026-07-21T13:21:37Z',
        completedAt: '2026-07-21T13:21:46Z',
      },
    });
    assert.equal(evidence.methodology.dns.publicRecursiveResolverCount, 2);
    assert.equal(evidence.methodology.dns.answersConsistentAcrossResolvers, true);
  });

  it('records the new-domain DNS snapshot without treating it as an alias binding', async () => {
    const evidence = await readEvidence();
    const apex = evidence.dns.domains['helpmath.ai'];
    const www = evidence.dns.domains['www.helpmath.ai'];

    assert.deepEqual(apex.records.A, [
      {ttlSeconds: 1800, value: '216.150.16.129'},
      {ttlSeconds: 1800, value: '216.150.1.129'},
    ]);
    assert.deepEqual(apex.records.NS, [
      {ttlSeconds: 86400, value: 'ns1.vercel-dns.com.'},
      {ttlSeconds: 86400, value: 'ns2.vercel-dns.com.'},
    ]);
    assert.deepEqual(
      apex.records.CAA.map((record: {value: string}) => record.value),
      ['letsencrypt.org', 'pki.goog', 'sectigo.com'],
    );
    assert.deepEqual(www.records.A, [
      {ttlSeconds: 1800, value: '216.150.1.1'},
      {ttlSeconds: 1800, value: '216.150.1.193'},
    ]);
    assert.deepEqual(apex.notFoundRecordTypesDuringWindow, ['AAAA', 'CNAME', 'MX', 'TXT']);
    assert.deepEqual(www.notFoundRecordTypesDuringWindow, ['AAAA', 'CNAME', 'MX', 'TXT']);
  });

  it('preserves the seven legacy Google MX records and exact TXT bytes', async () => {
    const evidence = await readEvidence();
    const legacy = evidence.dns.domains['helpprogram.net'];

    assert.deepEqual(legacy.records.A, [{ttlSeconds: 900, value: '69.13.40.229'}]);
    assert.equal(legacy.records.MX.length, 7);
    assert.deepEqual(
      legacy.records.MX.map((record: {priority: number; exchange: string}) => [
        record.priority,
        record.exchange,
      ]),
      [
        [1, 'aspmx.l.google.com.'],
        [5, 'alt1.aspmx.l.google.com.'],
        [5, 'alt2.aspmx.l.google.com.'],
        [10, 'aspmx2.googlemail.com.'],
        [10, 'aspmx3.googlemail.com.'],
        [10, 'aspmx4.googlemail.com.'],
        [10, 'aspmx5.googlemail.com.'],
      ],
    );
    assert.deepEqual(
      legacy.records.TXT.map((record: {value: string}) => record.value),
      [
        'google-site-verification=BPNsu71vya6smTxbkCcRxs6g8cwYVw_YRcqJxvMSmfc ',
        'v=spf1 mx a ip4:69.13.40.229 include:_spf.google.com ~all ',
      ],
    );
    assert.ok(
      legacy.records.TXT.every((record: {value: string}) => record.value.endsWith(' ')),
      'the two observed TXT values must retain their literal trailing space',
    );
    assert.equal(evidence.cutoverGuardrail.preserveLegacyMailRecordsVerbatim, true);
  });

  it('distinguishes negative mail-policy observations from non-enumerable DKIM', async () => {
    const evidence = await readEvidence();

    for (const domain of ['helpmath.ai', 'helpprogram.net']) {
      const signals = evidence.dns.mailPolicySignals[domain];
      assert.equal(signals.dmarc.result, 'not-found-during-window');
      assert.equal(signals.mtaSts.result, 'not-found-during-window');
      assert.equal(signals.tlsReporting.result, 'not-found-during-window');
      assert.equal(signals.dkim.result, 'not-enumerable');
    }
    assert.match(evidence.evidenceBoundary.negativeAnswerMeaning, /observation window/i);
    assert.match(evidence.evidenceBoundary.dkimMeaning, /cannot be enumerated/i);
  });

  it('records canonical redirects while proving the legacy redirect cutover was not observed', async () => {
    const evidence = await readEvidence();

    assert.deepEqual(evidence.http.canonicalHelpMathChain, [
      'http://helpmath.ai/',
      'https://helpmath.ai/',
      'https://www.helpmath.ai/',
    ]);
    const legacyResponses = evidence.http.observations.filter(
      (observation: {url: string}) => new URL(observation.url).hostname.endsWith('helpprogram.net'),
    );
    assert.equal(legacyResponses.length, 4);
    for (const response of legacyResponses) {
      assert.equal(response.status, 200);
      assert.equal(response.location, null);
      assert.equal(response.strictTransportSecurity, null);
    }
    assert.equal(evidence.http.legacyCutoverObserved, false);
  });

  it('pins certificate identity and makes every evidence limitation explicit', async () => {
    const evidence = await readEvidence();

    assert.equal(evidence.tls.certificates['helpmath.ai'].negotiatedProtocol, 'TLSv1.3');
    assert.equal(
      evidence.tls.certificates['helpmath.ai'].sha256Fingerprint,
      'A3:94:45:17:11:85:6A:01:10:26:88:42:AA:C1:A2:23:F6:B8:26:EB:00:7B:1F:76:92:DD:24:E9:43:79:61:23',
    );
    assert.equal(
      evidence.tls.certificates['helpprogram.net'].sha256Fingerprint,
      '72:85:A4:C0:1C:5E:B1:27:71:CE:BF:B4:3B:94:76:34:C9:30:A2:F5:81:63:C5:DC:AC:93:21:72:EC:0C:5F:6E',
    );
    assert.equal(evidence.evidenceBoundary.publicObservationOnly, true);
    assert.deepEqual(
      evidence.evidenceBoundary.doesNotEstablish.map((boundary: {code: string}) => boundary.code),
      [
        'complete-zone-export',
        'registrar-or-control',
        'mail-continuity',
        'vercel-alias-binding',
        'search-console',
      ],
    );
    assert.equal(evidence.sensitiveData.containsPrivateCredentials, false);
    assert.equal(evidence.sensitiveData.containsPrivateKeyMaterial, false);
  });
});
