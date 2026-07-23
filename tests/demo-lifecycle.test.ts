import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

import activationManifestJson from '../config/demo-activations.json';
import {
  DEMO_CANDIDATE_IDS,
  demoCandidates,
  isDemoCandidateId,
} from '../demos/candidates';
import {
  computeDemoArtifactSha256,
  type DemoAcceptance,
  type DemoActivationManifest,
  type DemoCandidate,
  parseNormalizedJson,
  sha256Hex,
  validateDemoActivationManifest,
  validateDemoCandidate,
} from '../lib/demo-lifecycle-validation';
import {
  deriveDemoLifecycleState,
  demoLifecycleStates,
  getDemoLifecycleCatalog,
  getDemoLifecycleState,
  isDemoDenied,
  isDemoIndexable,
  isDemoPrivatePreview,
  isDemoPublic,
} from '../lib/demo-lifecycle';
import {validateEvidenceDirectoryContract} from '../scripts/evidence-directory-contract';

const NOW_MS = Date.parse('2026-07-23T00:00:00.000Z');
const UPDATED_AT = '2026-07-22T12:00:00.000Z';
const ACCEPTED_AT = '2026-07-22T10:00:00.000Z';
const ACTIVATED_AT = '2026-07-22T11:00:00.000Z';

type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? {-readonly [Key in keyof T]: Mutable<T[Key]>}
    : T;

function candidateFixture(id = DEMO_CANDIDATE_IDS[0]): Mutable<DemoCandidate> {
  return structuredClone(demoCandidates[id]) as Mutable<DemoCandidate>;
}

function activationFixture(): Mutable<DemoActivationManifest> {
  return structuredClone(activationManifestJson) as Mutable<DemoActivationManifest>;
}

function acceptance(
  candidate: DemoCandidate,
  authorityRole: 'publication-rights-authority' | 'product-acceptance-authority',
): Mutable<DemoAcceptance> {
  const kind = authorityRole === 'publication-rights-authority' ? 'rights' : 'product';
  return {
    status: 'approved',
    candidateId: candidate.candidateId,
    artifactSha256: candidate.artifactSha256,
    evidenceRef: `docs/evidence/demo-publication/${candidate.id}-${kind}.json`,
    evidenceSha256: kind === 'rights' ? 'a'.repeat(64) : 'b'.repeat(64),
    acceptedAt: ACCEPTED_AT,
    acceptedBy: {
      name: kind === 'rights' ? 'Riley Morgan' : 'Avery Chen',
      authorityRole,
      organization: kind === 'rights' ? 'Program Rights Office' : 'Product Review Board',
    },
  };
}

function activate(
  manifest: Mutable<DemoActivationManifest>,
  id = DEMO_CANDIDATE_IDS[0],
) {
  const candidate = demoCandidates[id];
  const demo = manifest.demos[id];
  manifest.updatedAt = UPDATED_AT;
  demo.approvals.rightsAcceptance = acceptance(candidate, 'publication-rights-authority');
  demo.approvals.productAcceptance = acceptance(candidate, 'product-acceptance-authority');
  demo.activation.active = true;
  demo.activation.activatedAt = ACTIVATED_AT;
}

function activationErrors(
  manifest: unknown,
  demoPublicationGateApproved = false,
): string[] {
  return validateDemoActivationManifest(manifest, {
    candidates: demoCandidates,
    demoPublicationGateApproved,
    nowMs: NOW_MS,
  });
}

describe('demo candidates', () => {
  it('accepts exactly the two current immutable candidate manifests', () => {
    assert.deepEqual(DEMO_CANDIDATE_IDS, ['conversion-1-2', 'conversion-1-4']);
    assert.equal(isDemoCandidateId('conversion-1-2'), true);
    assert.equal(isDemoCandidateId('conversion-1-4'), true);
    assert.equal(isDemoCandidateId('conversion-1-3'), false);

    for (const id of DEMO_CANDIDATE_IDS) {
      const candidate = demoCandidates[id];
      assert.deepEqual(validateDemoCandidate(candidate, id), [], id);
      assert.equal(candidate.maturity, 'legacy-prototype', id);
      assert.equal(candidate.validationStatus, 'conditional', id);
      assert.equal(computeDemoArtifactSha256(candidate), candidate.artifactSha256, id);
    }
  });

  it('matches Node SHA-256 for empty, ASCII, and Unicode payloads', () => {
    for (const payload of ['', 'abc', 'HELP MATH — matemáticas 数学']) {
      const expected = createHash('sha256').update(payload, 'utf8').digest('hex');
      assert.equal(sha256Hex(payload), expected, JSON.stringify(payload));
    }
  });

  it('requires normalized JSON and rejects unknown fields at every security boundary', () => {
    for (const id of DEMO_CANDIDATE_IDS) {
      const canonical = readFileSync(`demos/candidates/${id}.json`, 'utf8');
      assert.deepEqual(parseNormalizedJson(canonical, id).errors, [], id);
      assert.match(
        parseNormalizedJson(canonical.replace('  "schemaVersion"', '    "schemaVersion"'), id)
          .errors.join('\n'),
        /normalized two-space JSON with one trailing newline/u,
      );
    }

    const candidate = candidateFixture();
    const candidateWithUnknown = candidate as Mutable<DemoCandidate> & {unexpected?: string};
    candidateWithUnknown.unexpected = 'fail closed';
    assert.match(
      validateDemoCandidate(candidateWithUnknown).join('\n'),
      /candidate contains unknown field unexpected/u,
    );

    const artifactWithUnknown = candidate.artifacts[0] as typeof candidate.artifacts[0] & {
      url?: string;
    };
    artifactWithUnknown.url = 'https://example.invalid/artifact';
    assert.match(
      validateDemoCandidate(candidate).join('\n'),
      /candidate\.artifacts\[0\] contains unknown field url/u,
    );
  });

  it('rejects unsafe paths, malformed hashes, and a stale aggregate digest', () => {
    const candidate = candidateFixture();
    candidate.artifacts[0].path = '../private-demo-runtime/escape.ts';
    candidate.artifacts[0].sha256 = 'A'.repeat(64);
    candidate.source.flaSha256 = 'short';
    const errors = validateDemoCandidate(candidate).join('\n');
    assert.match(errors, /artifacts\[0\]\.path must be a normalized in-repository artifact path/u);
    assert.match(errors, /artifacts\[0\]\.sha256 must be a lowercase SHA-256/u);
    assert.match(errors, /source\.flaSha256 must be a lowercase SHA-256/u);

    const aggregate = candidateFixture();
    aggregate.artifacts[0].sha256 = 'c'.repeat(64);
    assert.match(
      validateDemoCandidate(aggregate).join('\n'),
      /artifactSha256 does not match the canonical artifact digest/u,
    );

    const provenance = candidateFixture();
    provenance.source.flaSha256 = 'd'.repeat(64);
    assert.match(
      validateDemoCandidate(provenance).join('\n'),
      /artifactSha256 does not match the canonical artifact digest/u,
    );
  });

  it('binds the candidate id to the runtime digest and the aggregate to ordered artifacts', () => {
    const candidate = candidateFixture();
    candidate.candidateId = `${candidate.id}--2026-07-22--deadbeef`;
    let errors = validateDemoCandidate(candidate).join('\n');
    assert.match(errors, /candidateId digest prefix must match runtime\.bundleSha256/u);
    assert.match(errors, /artifactSha256 does not match the canonical artifact digest/u);

    const reordered = candidateFixture();
    [reordered.artifacts[0], reordered.artifacts[1]] = [
      reordered.artifacts[1],
      reordered.artifacts[0],
    ];
    errors = validateDemoCandidate(reordered).join('\n');
    assert.match(errors, /candidate\.artifacts must be sorted by path/u);
    assert.match(errors, /artifactSha256 does not match the canonical artifact digest/u);
  });
});

describe('demo activation manifest', () => {
  it('allows the demo-publication evidence directory to be absent only with null acceptances', async () => {
    for (const id of DEMO_CANDIDATE_IDS) {
      assert.equal(activationManifestJson.demos[id].approvals.rightsAcceptance, null, id);
      assert.equal(activationManifestJson.demos[id].approvals.productAcceptance, null, id);
    }
    assert.deepEqual(await validateEvidenceDirectoryContract({
      repositoryRoot: process.cwd(),
      relativeDirectory: 'docs/evidence/demo-publication',
      references: [],
    }), []);
  });

  it('keeps both current candidates private-preview, inactive, and non-indexable', () => {
    const canonical = readFileSync('config/demo-activations.json', 'utf8');
    assert.deepEqual(parseNormalizedJson(canonical, 'demo activations').errors, []);
    assert.deepEqual(activationErrors(activationManifestJson), []);
    assert.deepEqual(Object.keys(activationManifestJson.demos).sort(), [...DEMO_CANDIDATE_IDS]);

    for (const id of DEMO_CANDIDATE_IDS) {
      const activation = activationManifestJson.demos[id];
      const state = getDemoLifecycleState(id);
      assert.equal(activation.activation.active, false, id);
      assert.equal(activation.activation.activatedAt, null, id);
      assert.equal(activation.approvals.rightsAcceptance, null, id);
      assert.equal(activation.approvals.productAcceptance, null, id);
      assert.equal(state.access, 'private-preview', id);
      assert.equal(state.active, false, id);
      assert.equal(state.public, false, id);
      assert.equal(state.indexable, false, id);
      assert.equal(isDemoPrivatePreview(id), true, id);
      assert.equal(isDemoPublic(id), false, id);
      assert.equal(isDemoIndexable(id), false, id);
      assert.equal(isDemoDenied(id), false, id);
      assert.deepEqual(demoLifecycleStates[id], state, id);
    }
    const lifecycle = getDemoLifecycleCatalog(NOW_MS);
    assert.deepEqual(lifecycle.publicIds, []);
    assert.deepEqual(lifecycle.indexableIds, []);
    assert.deepEqual(lifecycle.privatePreviewIds, DEMO_CANDIDATE_IDS);
  });

  it('rejects non-canonical JSON and unknown activation fields', () => {
    const canonical = readFileSync('config/demo-activations.json', 'utf8');
    assert.match(
      parseNormalizedJson(canonical.replace('  "schemaVersion"', '    "schemaVersion"'), 'demo activations')
        .errors.join('\n'),
      /normalized two-space JSON with one trailing newline/u,
    );

    const manifest = activationFixture() as Mutable<DemoActivationManifest> & {
      publicationOverride?: boolean;
    };
    manifest.publicationOverride = true;
    const demo = manifest.demos[DEMO_CANDIDATE_IDS[0]] as
      Mutable<DemoActivationManifest>['demos'][string] & {public?: boolean};
    demo.public = true;
    const errors = activationErrors(manifest).join('\n');
    assert.match(errors, /manifest contains unknown field publicationOverride/u);
    assert.match(errors, /manifest\.demos\.conversion-1-2 contains unknown field public/u);
  });

  it('rejects candidate and aggregate digest references that do not bind the selected candidate', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    manifest.demos[id].candidateId = 'conversion-1-2--2026-07-22--deadbeef';
    manifest.demos[id].artifactSha256 = 'd'.repeat(64);
    const errors = activationErrors(manifest).join('\n');
    assert.match(errors, /candidateId must match the candidate manifest/u);
    assert.match(errors, /artifactSha256 must match the candidate manifest/u);
  });

  it('refuses activation while the demo publication launch gate is holding', () => {
    const manifest = activationFixture();
    activate(manifest);
    assert.deepEqual(activationErrors(manifest), [
      `manifest.demos.${DEMO_CANDIDATE_IDS[0]}.activation.active requires the demoPublication launch gate`,
    ]);
  });

  it('requires both rights and product acceptance before activation', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    manifest.updatedAt = UPDATED_AT;
    manifest.demos[id].activation.active = true;
    manifest.demos[id].activation.activatedAt = ACTIVATED_AT;
    assert.deepEqual(activationErrors(manifest, true), [
      `manifest.demos.${id}.activation.active requires rights and product acceptance`,
    ]);
  });

  it('rejects acceptance records with wrong bindings, evidence, time, hash, or authority identity', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    const candidate = demoCandidates[id];
    manifest.updatedAt = UPDATED_AT;
    const rights = acceptance(candidate, 'publication-rights-authority');
    rights.candidateId = 'conversion-1-2--2026-07-22--deadbeef';
    rights.artifactSha256 = 'd'.repeat(64);
    rights.evidenceRef = '../rights.json';
    rights.evidenceSha256 = 'A'.repeat(64);
    rights.acceptedAt = '2026-07-24T00:00:00.000Z';
    rights.acceptedBy.name = 'Pending reviewer';
    rights.acceptedBy.authorityRole = 'product-acceptance-authority';
    rights.acceptedBy.organization = 'TBD';
    manifest.demos[id].approvals.rightsAcceptance = rights;

    const errors = activationErrors(manifest).join('\n');
    assert.match(errors, /rightsAcceptance\.candidateId must bind the selected candidate/u);
    assert.match(errors, /rightsAcceptance\.artifactSha256 must bind the selected candidate artifact/u);
    assert.match(errors, /rightsAcceptance\.evidenceRef must identify a demo-publication evidence JSON file/u);
    assert.match(errors, /rightsAcceptance\.evidenceSha256 must be a lowercase SHA-256/u);
    assert.match(errors, /rightsAcceptance\.acceptedAt must not be in the future/u);
    assert.match(errors, /rightsAcceptance\.acceptedAt must not be later than manifest\.updatedAt/u);
    assert.match(errors, /acceptedBy\.name must identify a non-placeholder approver/u);
    assert.match(errors, /acceptedBy\.authorityRole must be publication-rights-authority/u);
    assert.match(errors, /acceptedBy\.organization must identify a non-placeholder organization/u);
  });

  it('derives conditional activation as public but only strict-complete as indexable', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    activate(manifest, id);
    const activation = manifest.demos[id];
    const conditionalCandidate = candidateFixture(id);

    const conditional = deriveDemoLifecycleState({
      id,
      candidate: conditionalCandidate,
      activation,
      candidateErrors: validateDemoCandidate(conditionalCandidate, id),
      manifestErrors: activationErrors(manifest, true),
      demoPublicationGateApproved: true,
    });
    assert.equal(conditional.access, 'public');
    assert.equal(conditional.active, true);
    assert.equal(conditional.public, true);
    assert.equal(conditional.indexable, false);
    assert.deepEqual(conditional.errors, []);

    const strictCandidate = candidateFixture(id);
    strictCandidate.maturity = 'strict-complete';
    strictCandidate.validationStatus = 'strict-complete';
    strictCandidate.artifactSha256 = computeDemoArtifactSha256(strictCandidate);
    assert.deepEqual(validateDemoCandidate(strictCandidate, id), []);
    const strictActivation = structuredClone(activation);
    strictActivation.artifactSha256 = strictCandidate.artifactSha256;
    strictActivation.approvals.rightsAcceptance!.artifactSha256 =
      strictCandidate.artifactSha256;
    strictActivation.approvals.productAcceptance!.artifactSha256 =
      strictCandidate.artifactSha256;
    const strict = deriveDemoLifecycleState({
      id,
      candidate: strictCandidate,
      activation: strictActivation,
      candidateErrors: validateDemoCandidate(strictCandidate, id),
      manifestErrors: [],
      demoPublicationGateApproved: true,
    });
    assert.equal(strict.access, 'indexable');
    assert.equal(strict.active, true);
    assert.equal(strict.public, true);
    assert.equal(strict.indexable, true);
    assert.deepEqual(strict.errors, []);

    const inactiveActivation = structuredClone(strictActivation);
    inactiveActivation.activation.active = false;
    inactiveActivation.activation.activatedAt = null;
    const inactive = deriveDemoLifecycleState({
      id,
      candidate: strictCandidate,
      activation: inactiveActivation,
      candidateErrors: [],
      manifestErrors: [],
      demoPublicationGateApproved: true,
    });
    assert.equal(inactive.access, 'private-preview');
    assert.equal(inactive.active, false);
    assert.equal(inactive.privatePreview, true);
    assert.equal(inactive.public, false);
    assert.equal(inactive.indexable, false);
  });

  it('closes an activated public demo when its launch gate closes without closing private review', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    activate(manifest, id);
    const activation = manifest.demos[id];

    const published = deriveDemoLifecycleState({
      id,
      candidate: demoCandidates[id],
      activation,
      candidateErrors: [],
      manifestErrors: activationErrors(manifest, true),
      demoPublicationGateApproved: true,
    });
    const gateClosed = deriveDemoLifecycleState({
      id,
      candidate: demoCandidates[id],
      activation,
      candidateErrors: [],
      manifestErrors: activationErrors(manifest, true),
      demoPublicationGateApproved: false,
    });

    assert.equal(published.public, true);
    assert.equal(published.access, 'public');
    assert.equal(gateClosed.public, false);
    assert.equal(gateClosed.indexable, false);
    assert.equal(gateClosed.active, false);
    assert.equal(gateClosed.privatePreview, true);
    assert.equal(gateClosed.access, 'private-preview');
    assert.deepEqual(gateClosed.errors, []);
  });

  it('can deactivate a valid activation without changing the immutable candidate digest', () => {
    const manifest = activationFixture();
    const id = DEMO_CANDIDATE_IDS[0];
    const digestBefore = computeDemoArtifactSha256(demoCandidates[id]);
    activate(manifest, id);
    assert.deepEqual(activationErrors(manifest, true), []);

    manifest.demos[id].activation.active = false;
    manifest.demos[id].activation.activatedAt = null;
    manifest.updatedAt = '2026-07-22T13:00:00.000Z';
    assert.deepEqual(activationErrors(manifest, true), []);
    assert.equal(computeDemoArtifactSha256(demoCandidates[id]), digestBefore);
    assert.equal(demoCandidates[id].artifactSha256, digestBefore);
  });
});
