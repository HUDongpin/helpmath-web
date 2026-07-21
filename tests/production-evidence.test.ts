import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {describe, it} from 'node:test';

const executiveEvidencePath = 'docs/evidence/executive-preview-production-2026-07-22.json';
const executiveEvidenceSha256 = '541a6c7cb0da495f18dd271a8fdcd311291f88d8abf3c211050683c9890abc4b';
const uiEvidencePath = 'docs/evidence/production-ui-audit-2026-07-22.json';
const uiEvidenceSha256 = '28b3b2adafb81abac31e675af7dc37b9ed1e0e5fe620c2db08133193b2614c33';
const productionCommit = '05c3b460db78ac61b88b6d34479d925af634d724';
const vercelDeploymentId = 'dpl_2CCekiWMGdnwc78gdifVSs1NWNsX';

type ScreenshotEvidence = {
  screenshot: string;
  screenshotWidth: number;
  screenshotHeight: number;
  bytes: number;
  sha256: string;
};

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngDimensions(bytes: Buffer): {width: number; height: number} {
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'Screenshot is not a PNG file.',
  );
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

async function assertScreenshot(evidence: ScreenshotEvidence): Promise<void> {
  const [bytes, metadata] = await Promise.all([
    readFile(evidence.screenshot),
    stat(evidence.screenshot),
  ]);
  const dimensions = pngDimensions(bytes);

  assert.equal(metadata.size, evidence.bytes);
  assert.equal(sha256(bytes), evidence.sha256);
  assert.equal(dimensions.width, evidence.screenshotWidth);
  assert.equal(dimensions.height, evidence.screenshotHeight);
}

describe('current Production evidence', () => {
  it('pins the non-secret authenticated executive-preview operator attestation', async () => {
    const bytes = await readFile(executiveEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      identity: {
        repositoryCommit: string;
        githubDeploymentId: number;
        vercelDeploymentId: string;
        canonicalUrl: string;
        entryPath: string;
      };
      preview: {
        expiresAt: string;
        authentication: string;
        authenticatedDemoRoutes: number;
        expectedAuthenticatedDemoRoutes: number;
        authenticatedPrivateImages: number;
        expectedAuthenticatedPrivateImages: number;
        authenticatedRuntimes: number;
        expectedAuthenticatedRuntimes: number;
        failures: unknown[];
      };
      browserCheck: {
        result: string;
        testsPassed: number;
        testsFailed: number;
        timeoutMs: number;
      };
      sensitiveValueHandling: {
        accessAndSigningValuesRotatedTogether: boolean;
        sensitiveValuesRetainedInRepositoryOrEvidence: boolean;
      };
      privacyBoundary: Record<string, boolean | string>;
    };

    assert.equal(sha256(bytes), executiveEvidenceSha256);
    assert.equal(evidence.identity.repositoryCommit, productionCommit);
    assert.equal(evidence.identity.githubDeploymentId, 5543929832);
    assert.equal(evidence.identity.vercelDeploymentId, vercelDeploymentId);
    assert.equal(evidence.identity.canonicalUrl, 'https://www.helpmath.ai');
    assert.equal(evidence.identity.entryPath, '/executive-preview');
    assert.equal(evidence.preview.expiresAt, '2026-07-28T15:59:00.000Z');
    assert.equal(evidence.preview.authentication, 'operator-attested');
    assert.equal(
      evidence.preview.authenticatedDemoRoutes,
      evidence.preview.expectedAuthenticatedDemoRoutes,
    );
    assert.equal(
      evidence.preview.authenticatedPrivateImages,
      evidence.preview.expectedAuthenticatedPrivateImages,
    );
    assert.equal(
      evidence.preview.authenticatedRuntimes,
      evidence.preview.expectedAuthenticatedRuntimes,
    );
    assert.deepEqual(evidence.preview.failures, []);
    assert.equal(evidence.browserCheck.result, 'operator-attested-pass');
    assert.equal(evidence.browserCheck.testsPassed, 1);
    assert.equal(evidence.browserCheck.testsFailed, 0);
    assert.equal(evidence.browserCheck.timeoutMs, 90000);
    assert.equal(evidence.sensitiveValueHandling.accessAndSigningValuesRotatedTogether, true);
    assert.equal(
      evidence.sensitiveValueHandling.sensitiveValuesRetainedInRepositoryOrEvidence,
      false,
    );
    assert.equal(evidence.privacyBoundary.publicDemoPublicationGate, 'holding');
  });

  it('contains no retained credential-shaped fields or values', async () => {
    const serialized = await readFile(executiveEvidencePath, 'utf8');

    assert.doesNotMatch(serialized, /"(?:token|secret|password|passphrase|cookie|privateKey)"\s*:/iu);
    assert.doesNotMatch(serialized, /(?:Bearer\s+|gh[opsu]_[A-Za-z0-9]+|vercel_[A-Za-z0-9]+)/u);
  });

  it('pins the production UI audit, Lighthouse scores, and screenshot bytes', async () => {
    const bytes = await readFile(uiEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      identity: {
        repositoryCommit: string;
        vercelDeploymentId: string;
        url: string;
      };
      visualReview: {
        desktop: ScreenshotEvidence;
        mobile: ScreenshotEvidence;
        checks: Record<string, boolean>;
      };
      lighthouse: {
        version: string;
        evidenceLevel: string;
        reportRetained: boolean;
        invocationRetained: boolean;
        finalUrl: string;
        scores: Record<string, number>;
        maxPotentialFirstInputDelayMs: number;
      };
      knownProductionExceptions: Array<{
        route: string;
        viewports: string[];
        remediationStatus: string;
      }>;
    };

    assert.equal(sha256(bytes), uiEvidenceSha256);
    assert.equal(evidence.identity.repositoryCommit, productionCommit);
    assert.equal(evidence.identity.vercelDeploymentId, vercelDeploymentId);
    assert.equal(evidence.identity.url, 'https://www.helpmath.ai/');
    assert.ok(Object.values(evidence.visualReview.checks).every(Boolean));
    assert.equal(evidence.lighthouse.version, '13.0.3');
    assert.equal(
      evidence.lighthouse.evidenceLevel,
      'uncorroborated point-in-time operator observation',
    );
    assert.equal(evidence.lighthouse.reportRetained, false);
    assert.equal(evidence.lighthouse.invocationRetained, false);
    assert.equal(evidence.lighthouse.finalUrl, 'https://www.helpmath.ai/');
    assert.deepEqual(evidence.lighthouse.scores, {
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    });
    assert.equal(evidence.lighthouse.maxPotentialFirstInputDelayMs, 80);
    assert.deepEqual(evidence.knownProductionExceptions[0]?.viewports, [
      '320x740',
      '390x844',
    ]);
    assert.equal(evidence.knownProductionExceptions[0]?.route, '/es/terms');
    assert.match(evidence.knownProductionExceptions[0]?.remediationStatus ?? '', /unmerged/iu);
    await Promise.all([
      assertScreenshot(evidence.visualReview.desktop),
      assertScreenshot(evidence.visualReview.mobile),
    ]);
  });
});
