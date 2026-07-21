import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {describe, it} from 'node:test';

import {
  createDemoClientLeakPolicy,
  findDemoClientLeaks,
  isPublicClientArtifactPath,
  isValidatedPublicLifecycleState,
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
    const {policy} = fixturePolicy('private-preview');
    const leaks = findDemoClientLeaks([
      {
        file: '.next/static/chunks/private.js',
        contents: 'DEMO_A_RUNTIME_TEXT demos/modules/demo-a',
      },
      {file: 'public/private-demo-assets/demo-a/picture.png', contents: runtimeBytes},
    ], policy);

    assert.ok(leaks.some((leak) => leak.category === 'inactive-runtime-text'));
    assert.ok(leaks.some((leak) => leak.category === 'inactive-runtime-file'));
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
});
