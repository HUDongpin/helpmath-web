import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {describe, it} from 'node:test';

import {
  createDemoClientLeakPolicy,
  findDemoClientLeaks,
  isPublicClientArtifactPath,
  isValidatedPublicLifecycleState,
  loadBlockedPublicDemoDataArtifacts,
  loadPublicDemoResponseArtifacts,
  PUBLIC_DYNAMIC_DEMO_ROUTES,
  publicDemoDataRoutes,
} from '../scripts/check-private-demo-leaks.mjs';

const runtimeBytes = Buffer.from('candidate-runtime-binary');
const runtimeSha256 = createHash('sha256').update(runtimeBytes).digest('hex');

function fixtureCandidate() {
  return {
    id: 'demo-a',
    candidateId: 'demo-a--2026-07-22--deadbeef',
    artifactSha256: 'a'.repeat(64),
    source: {flaSha256: 'b'.repeat(64), swfSha256: 'c'.repeat(64)},
    runtime: {
      entry: 'private-demo-runtime/demo-a.ts',
      globalName: 'HelpMathExecutiveRuntimeDemoA',
      bundleSha256: runtimeSha256,
    },
    artifacts: [
      {path: 'demos/modules/demo-a.tsx', sha256: 'd'.repeat(64)},
      {path: 'private-demo-assets/demo-a/picture.png', sha256: runtimeSha256},
    ],
  };
}

function fixtureActivation(candidate: ReturnType<typeof fixtureCandidate>) {
  return {
    updatedAt: '2026-07-22T12:00:00.000Z',
    demos: {
      [candidate.id]: {
        candidateId: candidate.candidateId,
        artifactSha256: candidate.artifactSha256,
        approvals: {
          privatePreview: {
            status: 'approved',
            audience: 'Named executive fixture audience',
            purpose: 'Internal fixture review',
            approvalRef: 'Fixture approval reference',
          },
          rightsAcceptance: {
            status: 'approved',
            candidateId: candidate.candidateId,
            artifactSha256: candidate.artifactSha256,
            evidenceRef: 'docs/evidence/demo-publication/demo-a-rights.json',
            evidenceSha256: 'e'.repeat(64),
            acceptedAt: '2026-07-22T12:01:00.000Z',
            acceptedBy: {
              name: 'Rights Reviewer Fixture',
              authorityRole: 'publication-rights-authority',
              organization: 'Fixture Organization',
            },
          },
          productAcceptance: null,
        },
        activation: {active: false, activatedAt: null},
      },
    },
  };
}

function lifecycleState(
  candidate: ReturnType<typeof fixtureCandidate>,
  access: 'private-preview' | 'public' = 'private-preview',
) {
  const publicState = access === 'public';
  return {
    id: candidate.id,
    candidate,
    access,
    active: publicState,
    privatePreview: true,
    public: publicState,
    indexable: false,
    errors: [],
  };
}

function fixturePolicy(access: 'private-preview' | 'public') {
  const candidate = fixtureCandidate();
  return {
    candidate,
    policy: createDemoClientLeakPolicy({
      activationManifest: fixtureActivation(candidate),
      candidates: {[candidate.id]: candidate},
      lifecycleStates: {[candidate.id]: lifecycleState(candidate, access)},
      runtimeText: {[candidate.id]: ['DEMO_A_RUNTIME_TEXT']},
    }),
  };
}

describe('lifecycle-aware demo client leak policy', () => {
  it('treats only a fully bound, error-free active lifecycle state as public', () => {
    const candidate = fixtureCandidate();
    const valid = lifecycleState(candidate, 'public');
    assert.equal(isValidatedPublicLifecycleState(candidate, valid), true);
    assert.equal(
      isValidatedPublicLifecycleState(candidate, {...valid, active: false}),
      false,
    );
    assert.equal(
      isValidatedPublicLifecycleState(candidate, {...valid, errors: ['invalid gate']}),
      false,
    );
    assert.equal(
      isValidatedPublicLifecycleState(candidate, {
        ...valid,
        candidate: {...candidate, artifactSha256: 'f'.repeat(64)},
      }),
      false,
    );
  });

  it('rejects private runtime text, paths, and exact resource bytes', () => {
    const {candidate, policy} = fixturePolicy('private-preview');
    const leaks = findDemoClientLeaks([
      {
        file: '.next/static/chunks/private.js',
        contents: [
          'DEMO_A_RUNTIME_TEXT',
          'demos/modules/demo-a',
          '/demos/demo-a',
          candidate.runtime.globalName,
          '/api/executive-preview/runtime/demo-a.js',
        ].join(' '),
      },
      {file: 'public/private-demo-assets/demo-a/picture.png', contents: runtimeBytes},
    ], policy);

    assert.ok(leaks.some((leak) => leak.category === 'inactive-runtime-text'));
    assert.ok(leaks.some((leak) => leak.category === 'inactive-runtime-file'));
    for (const fingerprint of [
      'candidate route',
      'runtime global name',
      'candidate runtime API',
    ]) {
      assert.ok(leaks.some((leak) => leak.fingerprint === fingerprint), fingerprint);
    }
  });

  it('allows approved public runtime content but never approval metadata', () => {
    const {candidate, policy} = fixturePolicy('public');
    const runtimeLeaks = findDemoClientLeaks([
      {
        file: '.next/static/chunks/public.js',
        contents: 'DEMO_A_RUNTIME_TEXT demos/modules/demo-a',
      },
      {file: '.next/static/media/picture.png', contents: runtimeBytes},
    ], policy);
    assert.deepEqual(runtimeLeaks, []);

    const approvalLeaks = findDemoClientLeaks([{
      file: '.next/server/app/en/demos/demo-a.rsc',
      contents: `${candidate.candidateId} Rights Reviewer Fixture evidenceRef`,
    }], policy);
    assert.ok(approvalLeaks.length >= 3);
    assert.ok(approvalLeaks.every((leak) => leak.category === 'approval-metadata'));
  });

  it('allows runtime bytes shared with a public candidate but keeps private-only content blocked', () => {
    const publicCandidate = fixtureCandidate();
    const privateCandidate = {
      ...fixtureCandidate(),
      id: 'demo-b',
      candidateId: 'demo-b--2026-07-22--feedface',
      artifactSha256: 'f'.repeat(64),
      runtime: {
        ...fixtureCandidate().runtime,
        entry: 'private-demo-runtime/demo-b.ts',
        globalName: 'HelpMathExecutiveRuntimeDemoB',
        bundleSha256: '1'.repeat(64),
      },
      artifacts: [
        {path: 'demos/shared-runtime.ts', sha256: runtimeSha256},
        {path: 'demos/modules/demo-b.tsx', sha256: '2'.repeat(64)},
      ],
    };
    publicCandidate.artifacts = [
      {path: 'demos/shared-runtime.ts', sha256: runtimeSha256},
    ];
    const policy = createDemoClientLeakPolicy({
      activationManifest: {demos: {}},
      candidates: {
        [publicCandidate.id]: publicCandidate,
        [privateCandidate.id]: privateCandidate,
      },
      lifecycleStates: {
        [publicCandidate.id]: lifecycleState(publicCandidate, 'public'),
        [privateCandidate.id]: lifecycleState(privateCandidate, 'private-preview'),
      },
      runtimeText: {
        [publicCandidate.id]: ['SHARED_RUNTIME_TEXT'],
        [privateCandidate.id]: ['SHARED_RUNTIME_TEXT', 'PRIVATE_B_RUNTIME_TEXT'],
      },
    });

    assert.deepEqual(findDemoClientLeaks([
      {file: '.next/static/chunks/shared.js', contents: 'SHARED_RUNTIME_TEXT'},
      {file: '.next/static/media/shared.bin', contents: runtimeBytes},
    ], policy), []);
    assert.ok(findDemoClientLeaks([{
      file: '.next/static/chunks/private-b.js',
      contents: 'PRIVATE_B_RUNTIME_TEXT demos/modules/demo-b',
    }], policy).some((leak) => leak.category === 'inactive-runtime-text'));
  });

  it('recognizes client, RSC, and prerender payloads without scanning server code', () => {
    for (const artifact of [
      'public/icon.svg',
      '.next/static/chunks/app.js',
      '.next/server/app/en.html',
      '.next/server/app/en.rsc',
      '.next/server/app/en.segments/_full.segment.rsc',
      '.next/server/app/robots.txt.body',
      '.next/server/app/en.meta',
      '.next/server/pages/500.html',
      '.next/server/pages/page.json',
    ]) {
      assert.equal(isPublicClientArtifactPath(artifact), true, artifact);
    }
    assert.equal(isPublicClientArtifactPath('.next/server/app/en/page.js'), false);
    assert.equal(isPublicClientArtifactPath('.next/server/chunks/server-only.js'), false);
    assert.equal(isPublicClientArtifactPath('.next/prerender-manifest.json'), false);
  });

  it('scans both dynamic public demo HTML responses', async () => {
    const requested: string[] = [];
    const artifacts = await loadPublicDemoResponseArtifacts(
      'http://127.0.0.1:3210',
      async (input, init) => {
        requested.push(String(input));
        assert.equal(init?.redirect, 'manual');
        assert.deepEqual(init?.headers, {Accept: 'text/html'});
        assert.ok(init?.signal instanceof AbortSignal);
        return new Response('<!doctype html><main>Public demo fixture</main>', {
          headers: {'Content-Type': 'text/html; charset=utf-8'},
          status: 200,
        });
      },
    );

    assert.deepEqual(PUBLIC_DYNAMIC_DEMO_ROUTES, ['/demos', '/es/demos']);
    assert.deepEqual(requested, [
      'http://127.0.0.1:3210/demos',
      'http://127.0.0.1:3210/es/demos',
    ]);
    assert.deepEqual(
      artifacts.map(({file}) => file),
      ['http-response:/demos', 'http-response:/es/demos'],
    );
  });

  it('fails closed when a dynamic public demo response cannot be scanned as HTML', async () => {
    for (const response of [
      new Response(null, {headers: {Location: '/login'}, status: 302}),
      new Response('{}', {headers: {'Content-Type': 'application/json'}, status: 200}),
      new Response(null, {headers: {'Content-Type': 'text/html'}, status: 200}),
    ]) {
      await assert.rejects(
        loadPublicDemoResponseArtifacts(
          'http://127.0.0.1:3210',
          async () => response.clone(),
        ),
        /requires HTTP 200|requires HTML|empty body/u,
      );
    }

    await assert.rejects(
      loadPublicDemoResponseArtifacts(
        'http://127.0.0.1:3210',
        async () => {
          throw new Error('fixture connection failure');
        },
      ),
      /could not complete/u,
    );
  });

  it('requires public and internal Pages data paths to return a fast protected 404', async () => {
    const requested: string[] = [];
    const artifacts = await loadBlockedPublicDemoDataArtifacts(
      'http://127.0.0.1:3210',
      'fixture-build_1',
      async (input, init) => {
        requested.push(String(input));
        assert.equal(init?.redirect, 'manual');
        assert.deepEqual(init?.headers, {Accept: 'application/json'});
        assert.ok(init?.signal instanceof AbortSignal);
        return new Response('blocked fixture', {
          headers: {
            'Cache-Control': 'private, no-store, max-age=0',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
          status: 404,
        });
      },
    );

    const expectedRoutes = [
      '/_next/data/fixture-build_1/demos.json',
      '/_next/data/fixture-build_1/es/demos.json',
      '/_next/data/fixture-build_1/static/en/demos.json',
      '/_next/data/fixture-build_1/static/es/demos.json',
    ];
    assert.deepEqual(publicDemoDataRoutes('fixture-build_1'), expectedRoutes);
    assert.deepEqual(
      requested,
      expectedRoutes.map((route) => `http://127.0.0.1:3210${route}`),
    );
    assert.deepEqual(
      artifacts.map(({file}) => file),
      expectedRoutes.map((route) => `http-response:${route}`),
    );
    assert.throws(() => publicDemoDataRoutes(''), /valid Next\.js build ID/u);
    assert.throws(() => publicDemoDataRoutes('../foreign'), /valid Next\.js build ID/u);
  });

  it('fails closed when a Pages data endpoint is reachable or lacks denial headers', async () => {
    for (const response of [
      new Response('{}', {status: 200}),
      new Response(null, {
        headers: {'X-Robots-Tag': 'noindex, nofollow, noarchive'},
        status: 404,
      }),
      new Response(null, {
        headers: {'Cache-Control': 'private, no-store, max-age=0'},
        status: 404,
      }),
    ]) {
      await assert.rejects(
        loadBlockedPublicDemoDataArtifacts(
          'http://127.0.0.1:3210',
          'fixture-build',
          async () => response.clone(),
        ),
        /requires HTTP 404|not private\/no-store|not noindex/u,
      );
    }

    await assert.rejects(
      loadBlockedPublicDemoDataArtifacts(
        'http://127.0.0.1:3210',
        'fixture-build',
        async () => {
          throw new Error('fixture connection failure');
        },
      ),
      /could not complete/u,
    );
  });

  it('detects candidate, approval, and SHA fingerprints in a dynamic demo response', () => {
    const {candidate, policy} = fixturePolicy('private-preview');
    const leaks = findDemoClientLeaks([{
      file: 'http-response:/demos',
      contents: [
        candidate.candidateId,
        candidate.artifactSha256,
        'approvalRef',
        'DEMO_A_RUNTIME_TEXT',
      ].join(' '),
    }], policy);

    assert.ok(leaks.some((leak) => leak.category === 'inactive-runtime-text'));
    assert.ok(leaks.some((leak) =>
      leak.category === 'approval-metadata'
      && leak.fingerprint === 'immutable candidate identity',
    ));
    assert.ok(leaks.some((leak) =>
      leak.category === 'approval-metadata'
      && leak.fingerprint === 'candidate aggregate SHA-256',
    ));
    assert.ok(leaks.some((leak) =>
      leak.category === 'approval-metadata'
      && leak.fingerprint === 'approval metadata field: approvalRef',
    ));
  });
});
