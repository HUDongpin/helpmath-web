import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {describe, it} from 'node:test';

const evidencePath =
  'docs/evidence/legacy-login-surface-baseline-2026-07-23.json';

type Baseline = {
  schemaVersion: number;
  observedAt: string;
  request: {
    method: string;
    redirect: string;
    credentialsSubmitted: boolean;
    querySubmitted: boolean;
  };
  scope: {origins: string[]; paths: string[]};
  summary: Record<string, number>;
  statusMatrix: Array<{
    origin: string;
    statuses: number[];
    locations: Array<string | null>;
    bodySha256ByPath: string[];
    server: string;
  }>;
  bodiesByPath: Array<{
    path: string;
    bytes: number;
    sha256: string;
    markers: Record<string, boolean>;
  }>;
  retention: {
    responseBodiesRetained: boolean;
    cookiesRetained: boolean;
    headersRetained: string[];
    note: string;
  };
  limitations: string[];
};

function assertExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expectedKeys].sort(),
    `${label} contains an unknown or missing field`,
  );
}

describe('legacy login-surface public baseline', () => {
  it('retains a complete credential-free 4-origin by 5-path observation matrix', async () => {
    const baseline = JSON.parse(await readFile(evidencePath, 'utf8')) as Baseline;
    const expectedOrigins = [
      'http://helpprogram.net',
      'https://helpprogram.net',
      'http://www.helpprogram.net',
      'https://www.helpprogram.net',
    ];
    const expectedPaths = [
      '/student_login.aspx',
      '/teacher_login.aspx',
      '/school_login.aspx',
      '/district_login.aspx',
      '/Project_Admin_Login.aspx',
    ];
    const expectedBodyHashes = [
      'f5d79f24629db06ad443daeb8e826be45fb22a6c0ba75576a9ede0726f54e8b0',
      '5c978d44b3a8292d19bc57dd764befae59d7c555535ee0294bf7fbc883c8f288',
      'f4c3d79adee10e115c1a5bb614fbd2d92e2385aa7f91f0ae4871d9533b8c8b6d',
      '0e3400274d88da62ccbb83b01929c6f76f9f72138d01fe984290ddbdc855b0ea',
      '8ddc2d5affc9c85d081667bbd5d421cc43bed69d7cfa23eca6159945701317df',
    ];
    assertExactKeys(
      baseline,
      [
        'schemaVersion',
        'observedAt',
        'request',
        'scope',
        'summary',
        'statusMatrix',
        'bodiesByPath',
        'retention',
        'limitations',
      ],
      'baseline',
    );
    assert.equal(baseline.schemaVersion, 1);
    assertExactKeys(
      baseline.request,
      ['method', 'redirect', 'credentialsSubmitted', 'querySubmitted'],
      'request',
    );
    assertExactKeys(baseline.scope, ['origins', 'paths'], 'scope');
    assertExactKeys(
      baseline.summary,
      [
        'requests',
        'status200',
        'redirects',
        'pageDirective',
        'codeFile',
        'serverControl',
        'passwordControl',
      ],
      'summary',
    );
    assert.match(baseline.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepEqual(baseline.request, {
      method: 'GET',
      redirect: 'manual',
      credentialsSubmitted: false,
      querySubmitted: false,
    });
    assert.deepEqual(baseline.scope.origins, expectedOrigins);
    assert.deepEqual(baseline.scope.paths, expectedPaths);
    assert.deepEqual(
      baseline.bodiesByPath.map(({sha256}) => sha256),
      expectedBodyHashes,
    );
    assert.equal(baseline.statusMatrix.length, 4);

    for (const [index, row] of baseline.statusMatrix.entries()) {
      assertExactKeys(
        row,
        ['origin', 'statuses', 'locations', 'bodySha256ByPath', 'server'],
        `statusMatrix[${index}]`,
      );
      assert.equal(row.origin, expectedOrigins[index]);
      assert.deepEqual(row.statuses, [200, 200, 200, 200, 200]);
      assert.deepEqual(row.locations, [null, null, null, null, null]);
      assert.deepEqual(row.bodySha256ByPath, expectedBodyHashes);
      assert.equal(row.server, 'Apache');
    }
    assert.deepEqual(baseline.summary, {
      requests: 20,
      status200: 20,
      redirects: 0,
      pageDirective: 20,
      codeFile: 20,
      serverControl: 20,
      passwordControl: 20,
    });
  });

  it('retains only sanitized fingerprints and accurately bounds the finding', async () => {
    const raw = await readFile(evidencePath, 'utf8');
    const baseline = JSON.parse(raw) as Baseline;
    assert.deepEqual(
      baseline.bodiesByPath.map(({path}) => path),
      baseline.scope.paths,
    );
    for (const [index, body] of baseline.bodiesByPath.entries()) {
      assertExactKeys(body, ['path', 'bytes', 'sha256', 'markers'], `bodiesByPath[${index}]`);
      assertExactKeys(
        body.markers,
        ['pageDirective', 'codeFile', 'serverControl', 'passwordControl'],
        `bodiesByPath[${index}].markers`,
      );
      assert.ok(Number.isSafeInteger(body.bytes) && body.bytes > 0);
      assert.match(body.sha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(body.markers, {
        pageDirective: true,
        codeFile: true,
        serverControl: true,
        passwordControl: true,
      });
    }
    assertExactKeys(
      baseline.retention,
      ['responseBodiesRetained', 'cookiesRetained', 'headersRetained', 'note'],
      'retention',
    );
    assert.deepEqual(baseline.retention, {
      responseBodiesRetained: false,
      cookiesRetained: false,
      headersRetained: ['Location', 'Server'],
      note: 'Each origin row binds the five path-ordered response fingerprints. Identical fingerprints show that all four origins returned the same bytes for each path. Only status, selected non-secret headers, byte counts, SHA-256 fingerprints, and marker booleans are retained.',
    });
    assert.deepEqual(baseline.limitations, [
      'This is a point-in-time public-network observation, not proof of legacy-host administrative control.',
      'The markers describe unprocessed ASP.NET page directives and server-control markup, not code-behind source.',
      'This baseline does not prove that the prepared containment package has been installed.',
    ]);
    assert.doesNotMatch(raw, /"(?:authorization|cookie|passphrase|token|username)"\s*:/i);
  });
});
