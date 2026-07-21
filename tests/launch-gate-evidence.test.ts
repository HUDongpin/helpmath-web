import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import {
  computeLaunchGateSubjectDigest,
  validateLaunchGateEvidenceEnvelope,
  verifyLaunchGateEvidenceFile,
} from '../lib/launch-gate-evidence';
import {LAUNCH_GATE_EVIDENCE_CHECKS} from '../lib/launch-gate-policy';

const NOW_MS = Date.parse('2026-07-21T22:00:00.000Z');
const OBSERVED_AT = '2026-07-21T20:50:00.000Z';
const REFERENCE = 'docs/evidence/launch-gates/legal-review.json';

function legalApproval() {
  return {
    approvedBy: {
      name: 'Alice Rivera',
      authorityRole: 'legal-review-authority',
      organization: 'Rivera Legal Review LLC',
    },
    approvedAt: '2026-07-21T21:00:00.000Z',
  };
}

function legalEnvelope() {
  return {
    schemaVersion: 1,
    gateId: 'legalPublication',
    evidenceKind: 'legal-review',
    status: 'pass',
    observedAt: OBSERVED_AT,
    approval: legalApproval(),
    subject: {
      repositoryCommit: 'a'.repeat(40),
      repositoryContentSha256: 'c'.repeat(64),
      vercelDeploymentId: null,
    },
    underlyingEvidence: {
      system: 'Restricted legal review registry',
      reference: 'legal-review-record-2026-07-21',
      sha256: 'b'.repeat(64),
      bytes: 128,
    },
    checks: {
      operatingEntityConfirmed: true,
      brandAuthorityConfirmed: true,
      englishLegalCopyApproved: true,
      spanishLegalCopyApproved: true,
      dataPracticesApproved: true,
      effectiveDateApproved: true,
    },
  };
}

function validate(value: unknown): string[] {
  return validateLaunchGateEvidenceEnvelope(value, {
    gateId: 'legalPublication',
    kind: 'legal-review',
    reference: REFERENCE,
    sha256: 'c'.repeat(64),
    observedAt: OBSERVED_AT,
    approval: legalApproval(),
    nowMs: NOW_MS,
  });
}

describe('launch-gate evidence envelope', () => {
  it('pins every gate-specific check instead of trusting a mutable manifest list', () => {
    assert.deepEqual(LAUNCH_GATE_EVIDENCE_CHECKS, {
      'legal-review': [
        'operatingEntityConfirmed',
        'brandAuthorityConfirmed',
        'englishLegalCopyApproved',
        'spanishLegalCopyApproved',
        'dataPracticesApproved',
        'effectiveDateApproved',
      ],
      'contact-readiness': [
        'productionConfigurationReviewed',
        'turnstileConfigurationReviewed',
        'edgeRateLimitConfigured',
        'senderDomainVerified',
        'monitoredInboxConfirmed',
        'retentionAndInboxOwnersConfirmed',
        'postActivationTestPlanApproved',
      ],
      'contact-production-verification': [
        'turnstileProductionPassed',
        'endToEndDeliveryPassed',
        'replyToPassed',
        'sameOriginAndHoneypotPassed',
        'edgeRateLimitPassed',
        'malformedOversizedReplayAndAbusePassed',
        'logRedactionPassed',
        'failureRollbackDispositionRecorded',
      ],
      'demo-rights': [
        'originalMaterialsLicensed',
        'javascriptAdaptationLicensed',
        'spanishLocalizationLicensed',
        'derivedImagesLicensed',
        'publicCdnDistributionLicensed',
        'territoryAndTermRecorded',
        'takedownProcessRecorded',
      ],
      'demo-product-acceptance': [
        'strictMigrationValidationPassed',
        'behaviorValidationPassed',
        'visualValidationPassed',
        'accessibilityValidationPassed',
        'audioDispositionAccepted',
        'knownExceptionsAccepted',
      ],
      'legacy-cutover-authorization': [
        'cutoverPlanApproved',
        'dnsOwnerConfirmed',
        'mailOwnerConfirmed',
        'rollbackPlanApproved',
        'searchConsoleOwnerConfirmed',
        'sourcePreservationConfirmed',
      ],
      'post-cutover-verification': [
        'apexAndWwwVerified',
        'httpHttpsRedirectMatrixPassed',
        'tlsVerified',
        'mailContinuityPassed',
        'searchConsoleChangeVerified',
        'monitoringWindowPassed',
        'rollbackDecisionRecorded',
      ],
      'production-release': [
        'candidateIdentityMatched',
        'qualityPassed',
        'productionSmokePassed',
        'canonicalAliasesVerified',
        'releaseOwnerConfirmed',
        'rollbackOwnerConfirmed',
        'finalLaunchApproved',
      ],
    });
  });

  it('accepts an exact, non-secret, hash-bindable legal-review envelope', () => {
    assert.deepEqual(validate(legalEnvelope()), []);
    const educational = legalEnvelope();
    educational.underlyingEvidence.system = 'Basic Education Registry';
    assert.deepEqual(validate(educational), []);
  });

  it('rejects wrong identity, non-pass status, future time, and unbound observation time', () => {
    const envelope = legalEnvelope();
    envelope.gateId = 'contactIntake';
    envelope.evidenceKind = 'contact-delivery';
    envelope.status = 'pending';
    envelope.observedAt = '2099-01-01T00:00:00.000Z';

    const errors = validate(envelope).join('\n');
    assert.match(errors, /gateId must be legalPublication/);
    assert.match(errors, /evidenceKind must be legal-review/);
    assert.match(errors, /status must be pass/);
    assert.match(errors, /observedAt must match the manifest reference/);
    assert.match(errors, /observedAt must not be in the future/);
  });

  it('requires every exact check to be true and rejects unknown checks', () => {
    const envelope = legalEnvelope();
    envelope.checks.englishLegalCopyApproved = false;
    delete (envelope.checks as Partial<typeof envelope.checks>).spanishLegalCopyApproved;
    (envelope.checks as Record<string, boolean>).unreviewedShortcut = true;

    const errors = validate(envelope).join('\n');
    assert.match(errors, /checks contains unknown field unreviewedShortcut/);
    assert.match(errors, /checks\.englishLegalCopyApproved must be true/);
    assert.match(errors, /checks\.spanishLegalCopyApproved must be true/);
  });

  it('hash-binds the manifest approver identity and approval time', () => {
    const envelope = legalEnvelope();
    envelope.approval.approvedBy.name = 'Different Reviewer';
    envelope.approval.approvedAt = '2026-07-21T20:59:00.000Z';

    const errors = validate(envelope).join('\n');
    assert.match(errors, /approval\.approvedBy\.name must match the manifest/);
    assert.match(errors, /approval\.approvedAt must match the manifest/);
  });

  it('rejects credential-shaped fields and values', () => {
    const envelope = legalEnvelope() as ReturnType<typeof legalEnvelope> & {
      accessToken?: string;
    };
    envelope.accessToken = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
    envelope.underlyingEvidence.reference = 'https://user:pass@example.test/receipt';

    const errors = validate(envelope).join('\n');
    assert.match(errors, /unknown field accessToken/);
    assert.match(errors, /sensitive field accessToken/);
    assert.match(errors, /credential-shaped content/);

    for (const credential of [
      'sk-proj-abcdefghijklmnop123456',
      'github_pat_abcdefghijklmnopqrstuvwxyz123456',
      're_abcdefghijklmnop123456',
      '0x4AAAAAAAAAAAAAAAAAAAAAA',
      'AKIAABCDEFGHIJKLMNOP',
      'eyJabcdefghijk.eyJabcdefghijk.abcdefghijk',
      'Basic YWRtaW46c2VjcmV0',
    ]) {
      const providerEnvelope = legalEnvelope();
      providerEnvelope.underlyingEvidence.reference = credential;
      assert.match(validate(providerEnvelope).join('\n'), /credential-shaped content/);
    }
  });

  it('rejects null Git identities and implausibly short deployment IDs', () => {
    const envelope = legalEnvelope();
    envelope.subject.repositoryCommit = '0'.repeat(40);
    (envelope.subject as {vercelDeploymentId: string | null}).vercelDeploymentId = 'dpl_x';

    const errors = validate(envelope).join('\n');
    assert.match(errors, /repositoryCommit must be a nonzero/);
    assert.match(errors, /vercelDeploymentId must be null or a Vercel deployment ID/);
  });

  it('requires deployment identity for deployment-bound evidence kinds', () => {
    const envelope = {
      ...legalEnvelope(),
      gateId: 'contactIntake',
      evidenceKind: 'contact-readiness',
      approval: {
        approvedBy: {
          name: 'Morgan Lee',
          authorityRole: 'contact-release-authority',
          organization: 'Operations Review Group',
        },
        approvedAt: '2026-07-21T21:10:00.000Z',
      },
      subject: {...legalEnvelope().subject, vercelDeploymentId: null},
      checks: {
        productionConfigurationReviewed: true,
        turnstileConfigurationReviewed: true,
        edgeRateLimitConfigured: true,
        senderDomainVerified: true,
        monitoredInboxConfirmed: true,
        retentionAndInboxOwnersConfirmed: true,
        postActivationTestPlanApproved: true,
      },
    };

    const errors = validateLaunchGateEvidenceEnvelope(envelope, {
      gateId: 'contactIntake',
      kind: 'contact-readiness',
      reference: 'docs/evidence/launch-gates/contact-readiness.json',
      sha256: 'd'.repeat(64),
      observedAt: OBSERVED_AT,
      approval: envelope.approval,
      nowMs: NOW_MS,
    }).join('\n');
    assert.match(errors, /vercelDeploymentId must identify a Vercel deployment/);
  });

  it('rejects prototype-chain evidence kinds with a controlled error', () => {
    assert.deepEqual(
      validateLaunchGateEvidenceEnvelope(legalEnvelope(), {
        gateId: 'legalPublication',
        kind: 'toString' as 'legal-review',
        reference: REFERENCE,
        sha256: 'c'.repeat(64),
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        nowMs: NOW_MS,
      }),
      ['unsupported launch-gate evidence kind toString'],
    );
  });
});

describe('launch-gate evidence file verification', () => {
  it('recomputes the repository envelope hash and validates its content', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'helpmath-gate-evidence-'));
    try {
      const evidenceDirectory = path.join(repositoryRoot, 'docs/evidence/launch-gates');
      await mkdir(evidenceDirectory, {recursive: true});
      await writeFile(path.join(repositoryRoot, 'subject.txt'), 'reviewed subject\n');
      const envelope = legalEnvelope();
      envelope.subject.repositoryContentSha256 = (
        await computeLaunchGateSubjectDigest(repositoryRoot, ['subject.txt'])
      ).sha256;
      const bytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`);
      await writeFile(path.join(evidenceDirectory, 'legal-review.json'), bytes);
      const digest = createHash('sha256').update(bytes).digest('hex');

      const verified = await verifyLaunchGateEvidenceFile({
        gateId: 'legalPublication',
        kind: 'legal-review',
        reference: REFERENCE,
        sha256: digest,
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        repositoryRoot,
        nowMs: NOW_MS,
        subjectPaths: ['subject.txt'],
      });
      assert.deepEqual(verified.errors, []);
      assert.equal(verified.actualSha256, digest);
      assert.equal(verified.bytes, bytes.length);

      const mismatched = await verifyLaunchGateEvidenceFile({
        gateId: 'legalPublication',
        kind: 'legal-review',
        reference: REFERENCE,
        sha256: '0'.repeat(64),
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        repositoryRoot,
        nowMs: NOW_MS,
        subjectPaths: ['subject.txt'],
      });
      assert.match(mismatched.errors.join('\n'), /SHA-256 mismatch/);

      await writeFile(path.join(repositoryRoot, 'subject.txt'), 'changed subject\n');
      const replayed = await verifyLaunchGateEvidenceFile({
        gateId: 'legalPublication',
        kind: 'legal-review',
        reference: REFERENCE,
        sha256: digest,
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        repositoryRoot,
        nowMs: NOW_MS,
        subjectPaths: ['subject.txt'],
      });
      assert.match(replayed.errors.join('\n'), /subject digest does not match/);

      await writeFile(path.join(repositoryRoot, 'subject.txt'), 'reviewed subject\n');
      const duplicateKeyBytes = Buffer.from(
        bytes.toString('utf8').replace(
          '  "status": "pass",',
          '  "status": "pending",\n  "status": "pass",',
        ),
      );
      await writeFile(path.join(evidenceDirectory, 'legal-review.json'), duplicateKeyBytes);
      const duplicateKeyDigest = createHash('sha256').update(duplicateKeyBytes).digest('hex');
      const ambiguous = await verifyLaunchGateEvidenceFile({
        gateId: 'legalPublication',
        kind: 'legal-review',
        reference: REFERENCE,
        sha256: duplicateKeyDigest,
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        repositoryRoot,
        nowMs: NOW_MS,
        subjectPaths: ['subject.txt'],
      });
      assert.match(ambiguous.errors.join('\n'), /normalized two-space JSON/);
    } finally {
      await rm(repositoryRoot, {recursive: true, force: true});
    }
  });

  it('rejects unsupported paths, missing files, symlinks, and oversized files', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'helpmath-gate-evidence-'));
    try {
      const evidenceDirectory = path.join(repositoryRoot, 'docs/evidence/launch-gates');
      await mkdir(evidenceDirectory, {recursive: true});
      const outside = path.join(repositoryRoot, 'outside.json');
      await writeFile(outside, JSON.stringify(legalEnvelope()));
      await symlink(outside, path.join(evidenceDirectory, 'legal-review.json'));

      const common = {
        gateId: 'legalPublication' as const,
        kind: 'legal-review' as const,
        sha256: '0'.repeat(64),
        observedAt: OBSERVED_AT,
        approval: legalApproval(),
        repositoryRoot,
        nowMs: NOW_MS,
      };
      const unsupported = await verifyLaunchGateEvidenceFile({
        ...common,
        reference: 'docs/LAUNCH_DECISIONS.md',
      });
      assert.match(unsupported.errors.join('\n'), /unsupported launch-gate evidence reference/);

      const missing = await verifyLaunchGateEvidenceFile({
        ...common,
        reference: 'docs/evidence/launch-gates/missing.json',
      });
      assert.match(missing.errors.join('\n'), /does not exist/);

      const linked = await verifyLaunchGateEvidenceFile({...common, reference: REFERENCE});
      assert.match(linked.errors.join('\n'), /regular non-symbolic file/);

      await rm(path.join(evidenceDirectory, 'legal-review.json'));
      await writeFile(path.join(evidenceDirectory, 'legal-review.json'), 'too large');
      const oversized = await verifyLaunchGateEvidenceFile({
        ...common,
        reference: REFERENCE,
        maxBytes: 4,
      });
      assert.match(oversized.errors.join('\n'), /size must be between 1 and 4 bytes/);
    } finally {
      await rm(repositoryRoot, {recursive: true, force: true});
    }
  });
});
