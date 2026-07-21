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
const pr15CanonicalEvidencePath =
  'docs/evidence/executive-preview-canonical-pr15-2026-07-22.json';
const pr15CanonicalEvidenceSha256 =
  '05c5297a04b12ab934272f8946a7b1105e4a1920ee28e582cd981bb690f9ac63';
const pr15ExecutiveEvidencePath =
  'docs/evidence/executive-preview-production-pr15-2026-07-22.json';
const pr15ExecutiveEvidenceSha256 =
  '798efec3041590068a5cc7dfe8ece2d6786252e66ff67fb6d1f368c81561ac25';
const pr15UiEvidencePath = 'docs/evidence/production-ui-pr15-2026-07-22.json';
const pr15UiEvidenceSha256 =
  'd7fb8dde8fad4346872ca016ecbd43c94fab177430b1679cdf437a7ed148080e';
const pr15UiMachineEvidencePath =
  'docs/evidence/production-ui-machine-pr15-2026-07-22.json';
const pr15UiMachineEvidenceSha256 =
  'da2bb0228f4e4e484020999ec8a7451421d32cb1517134ebbdb00f1959ab92ed';
const pr15ProductionCommit = 'd3b84e8dcf539d8859641bdb58cbaa5237efc461';
const pr15VercelDeploymentId = 'dpl_GAwLFodMFiqAE7RDibwp77mgwjUQ';

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

describe('historical PR #13 Production evidence', () => {
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

describe('PR #15 current Production evidence', () => {
  it('pins the retained credential-free authenticated canonical result', async () => {
    const bytes = await readFile(pr15CanonicalEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      baseUrl: string;
      canonicalOrigin: string;
      launchGateManifestSha256: string;
      launchGates: Record<string, string>;
      expectedSitemapPages: number;
      publicPages: number;
      internalLinks: number;
      privateDemoRoutes: number;
      closedLegacyDemoAssets: number;
      executivePreviewAssets: number;
      privateDemoOptimizerProbes: number;
      executivePreviewEntries: number;
      executivePreviewExpectedState: string;
      executivePreviewExpectedExpiresAt: string;
      executivePreviewState: string;
      executivePreviewExpiresAt: string;
      executivePreviewAuthentication: string;
      executivePreviewAuthenticatedDemoRoutes: number;
      executivePreviewAuthenticatedAssets: number;
      executivePreviewAuthenticatedRuntimes: number;
      legalPublicationGate: string;
      legalDrafts: number;
      legalPublishedPages: number;
      contactRepositoryGate: string;
      contactExpectation: string;
      failures: unknown[];
    };

    assert.equal(sha256(bytes), pr15CanonicalEvidenceSha256);
    assert.equal(evidence.baseUrl, 'https://www.helpmath.ai');
    assert.equal(evidence.canonicalOrigin, evidence.baseUrl);
    assert.equal(
      evidence.launchGateManifestSha256,
      'd32e105c55729568f645ac058b55d33e923b76eee893e6e80d61aa907bed1530',
    );
    assert.deepEqual(evidence.launchGates, {
      legalPublication: 'holding',
      contactIntake: 'holding',
      demoPublication: 'holding',
      legacyCutover: 'holding',
      productionLaunch: 'holding',
    });
    assert.equal(evidence.expectedSitemapPages, 20);
    assert.equal(evidence.publicPages, 20);
    assert.equal(evidence.internalLinks, 54);
    assert.equal(evidence.privateDemoRoutes, 4);
    assert.equal(evidence.closedLegacyDemoAssets, 12);
    assert.equal(evidence.executivePreviewAssets, 12);
    assert.equal(evidence.privateDemoOptimizerProbes, 4);
    assert.equal(evidence.executivePreviewEntries, 2);
    assert.equal(evidence.executivePreviewExpectedState, 'login');
    assert.equal(evidence.executivePreviewState, 'login');
    assert.equal(
      evidence.executivePreviewExpectedExpiresAt,
      '2026-07-28T15:59:00.000Z',
    );
    assert.equal(evidence.executivePreviewExpiresAt, evidence.executivePreviewExpectedExpiresAt);
    assert.equal(evidence.executivePreviewAuthentication, 'validated');
    assert.equal(evidence.executivePreviewAuthenticatedDemoRoutes, 4);
    assert.equal(evidence.executivePreviewAuthenticatedAssets, 12);
    assert.equal(evidence.executivePreviewAuthenticatedRuntimes, 2);
    assert.equal(evidence.legalPublicationGate, 'holding');
    assert.equal(evidence.legalDrafts, 4);
    assert.equal(evidence.legalPublishedPages, 0);
    assert.equal(evidence.contactRepositoryGate, 'holding');
    assert.equal(evidence.contactExpectation, 'disabled');
    assert.deepEqual(evidence.failures, []);
    assert.equal(Object.hasOwn(evidence, 'repositoryCommit'), false);
    assert.equal(Object.hasOwn(evidence, 'githubDeploymentId'), false);
    assert.equal(Object.hasOwn(evidence, 'vercelDeploymentId'), false);
    assert.equal(Object.hasOwn(evidence, 'recordedAt'), false);
  });

  it('pins the accompanying operator identity record and privacy boundary', async () => {
    const bytes = await readFile(pr15ExecutiveEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      source: {
        identityAssociation: string;
        canonicalResultRetained: boolean;
        canonicalResultPath: string;
        canonicalResultSha256: string;
        sensitiveInputOrSessionOutputRetained: boolean;
      };
      identity: {
        pullRequest: number;
        repositoryCommit: string;
        githubDeploymentId: number;
        vercelDeploymentId: string;
        canonicalUrl: string;
        immutableUrl: string;
      };
      preview: {
        authentication: string;
        authenticatedDemoRoutes: number;
        expectedAuthenticatedDemoRoutes: number;
        authenticatedPrivateAssets: number;
        expectedAuthenticatedPrivateAssets: number;
        authenticatedRuntimes: number;
        expectedAuthenticatedRuntimes: number;
        failures: unknown[];
      };
      browserCheck: {
        evidenceLevel: string;
        result: string;
        testsPassed: number;
        testsFailed: number;
        traceRetained: boolean;
        screenshotRetained: boolean;
      };
      privacyBoundary: Record<string, boolean | string>;
      sensitiveValueHandling: {
        injectedOnlyIntoEachTemporaryVerificationProcess: boolean;
      };
      limitations: string[];
    };

    assert.equal(sha256(bytes), pr15ExecutiveEvidenceSha256);
    assert.equal(evidence.source.canonicalResultRetained, true);
    assert.match(evidence.source.identityAssociation, /contains no commit, deployment, or observation-time field/iu);
    assert.equal(evidence.source.canonicalResultPath, pr15CanonicalEvidencePath);
    assert.equal(evidence.source.canonicalResultSha256, pr15CanonicalEvidenceSha256);
    assert.equal(evidence.source.sensitiveInputOrSessionOutputRetained, false);
    assert.equal(evidence.identity.pullRequest, 15);
    assert.equal(evidence.identity.repositoryCommit, pr15ProductionCommit);
    assert.equal(evidence.identity.githubDeploymentId, 5544827753);
    assert.equal(evidence.identity.vercelDeploymentId, pr15VercelDeploymentId);
    assert.equal(evidence.identity.canonicalUrl, 'https://www.helpmath.ai');
    assert.equal(
      evidence.identity.immutableUrl,
      'https://helpmath-peh16hg5x-peter-dongpin-hu-s-projects.vercel.app',
    );
    assert.equal(evidence.preview.authentication, 'validated');
    assert.equal(
      evidence.preview.authenticatedDemoRoutes,
      evidence.preview.expectedAuthenticatedDemoRoutes,
    );
    assert.equal(
      evidence.preview.authenticatedPrivateAssets,
      evidence.preview.expectedAuthenticatedPrivateAssets,
    );
    assert.equal(
      evidence.preview.authenticatedRuntimes,
      evidence.preview.expectedAuthenticatedRuntimes,
    );
    assert.deepEqual(evidence.preview.failures, []);
    assert.match(evidence.browserCheck.evidenceLevel, /operator-observed/iu);
    assert.equal(evidence.browserCheck.result, 'pass');
    assert.equal(evidence.browserCheck.testsPassed, 1);
    assert.equal(evidence.browserCheck.testsFailed, 0);
    assert.equal(evidence.browserCheck.traceRetained, false);
    assert.equal(evidence.browserCheck.screenshotRetained, false);
    assert.equal(
      evidence.sensitiveValueHandling.injectedOnlyIntoEachTemporaryVerificationProcess,
      true,
    );
    assert.equal(evidence.privacyBoundary.publicDemoPublicationGate, 'holding');
    assert.ok(
      evidence.limitations.some((value) =>
        /does not independently identify PR #15, a repository commit, a deployment, or an observation time/iu.test(
          value,
        ),
      ),
    );
  });

  it('pins the scoped reviewer-entry and Spanish mobile production regression result', async () => {
    const bytes = await readFile(pr15UiEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      source: {
        evidenceLevel: string;
        standaloneReportRetained: boolean;
        traceRetained: boolean;
        screenshotRetained: boolean;
      };
      identity: {
        pullRequest: number;
        repositoryCommit: string;
        githubDeploymentId: number;
        vercelDeploymentId: string;
        canonicalUrl: string;
      };
      browserCheck: {
        testsPassed: number;
        testsFailed: number;
        checks: Record<string, boolean>;
      };
    };

    assert.equal(sha256(bytes), pr15UiEvidenceSha256);
    assert.match(evidence.source.evidenceLevel, /operator-observed/iu);
    assert.equal(evidence.source.standaloneReportRetained, false);
    assert.equal(evidence.source.traceRetained, false);
    assert.equal(evidence.source.screenshotRetained, false);
    assert.equal(evidence.identity.pullRequest, 15);
    assert.equal(evidence.identity.repositoryCommit, pr15ProductionCommit);
    assert.equal(evidence.identity.githubDeploymentId, 5544827753);
    assert.equal(evidence.identity.vercelDeploymentId, pr15VercelDeploymentId);
    assert.equal(evidence.identity.canonicalUrl, 'https://www.helpmath.ai');
    assert.equal(evidence.browserCheck.testsPassed, 2);
    assert.equal(evidence.browserCheck.testsFailed, 0);
    assert.deepEqual(evidence.browserCheck.checks, {
      englishAndSpanishDemoPagesLinkToTheBareAuthorizedReviewerEntry: true,
      demoPagesContainNoDirectPrototypeRouteAnchors: true,
      demoPagesContainNoFlashAssetSources: true,
      spanishTermsHeroFitsAt320PxAfterFontsLoad: true,
      spanishTermsHeroFitsAt390PxAfterFontsLoad: true,
    });
  });

  it('pins the retained PR #15 Lighthouse reports and production screenshots', async () => {
    const bytes = await readFile(pr15UiMachineEvidencePath);
    const evidence = JSON.parse(bytes.toString('utf8')) as {
      source: {
        evidenceLevel: string;
        lighthouseVersion: string;
        playwrightCliVersion: string;
        absoluteOperatorChromePathRetained: boolean;
      };
      identity: {
        pullRequest: number;
        repositoryCommit: string;
        githubDeploymentId: number;
        vercelDeploymentId: string;
        canonicalUrl: string;
      };
      lighthouseReports: Array<{
        formFactor: 'desktop' | 'mobile';
        path: string;
        sha256: string;
        bytes: number;
        lighthouseVersion: string;
        fetchTime: string;
        requestedUrl: string;
        finalUrl: string;
        screenEmulation: {
          mobile: boolean;
          width: number;
          height: number;
          deviceScaleFactor: number;
        };
        scores: {
          performance: number;
          accessibility: number;
          bestPractices: number;
          seo: number;
        };
        metrics: {
          firstContentfulPaintMs: number;
          largestContentfulPaintMs: number;
          totalBlockingTimeMs: number;
          cumulativeLayoutShift: number;
          speedIndexMs: number;
        };
        runWarnings: unknown[];
        runtimeError: unknown;
      }>;
      screenshots: Array<{
        route: string;
        locale: string;
        viewport: string;
        fullPage: boolean;
        path: string;
        sha256: string;
        bytes: number;
        pixelWidth: number;
        pixelHeight: number;
      }>;
      privacyBoundary: Record<string, boolean | string>;
      limitations: string[];
    };

    assert.equal(sha256(bytes), pr15UiMachineEvidenceSha256);
    assert.match(evidence.source.evidenceLevel, /retained machine reports/iu);
    assert.equal(evidence.source.lighthouseVersion, '13.0.3');
    assert.equal(evidence.source.playwrightCliVersion, '0.1.17');
    assert.equal(evidence.source.absoluteOperatorChromePathRetained, false);
    assert.equal(evidence.identity.pullRequest, 15);
    assert.equal(evidence.identity.repositoryCommit, pr15ProductionCommit);
    assert.equal(evidence.identity.githubDeploymentId, 5544827753);
    assert.equal(evidence.identity.vercelDeploymentId, pr15VercelDeploymentId);
    assert.equal(evidence.identity.canonicalUrl, 'https://www.helpmath.ai/');
    assert.equal(evidence.lighthouseReports.length, 2);
    assert.equal(evidence.screenshots.length, 5);
    assert.equal(evidence.privacyBoundary.credentialUsed, false);
    assert.equal(evidence.privacyBoundary.privateDemoContentCaptured, false);
    assert.equal(evidence.privacyBoundary.publicDemoPublicationGate, 'holding');
    assert.ok(evidence.limitations.some((value) => /not field Core Web Vitals/iu.test(value)));

    for (const report of evidence.lighthouseReports) {
      const [reportBytes, metadata] = await Promise.all([readFile(report.path), stat(report.path)]);
      const raw = JSON.parse(reportBytes.toString('utf8')) as {
        lighthouseVersion: string;
        fetchTime: string;
        requestedUrl: string;
        finalUrl: string;
        finalDisplayedUrl: string;
        runWarnings: unknown[];
        runtimeError?: unknown;
        configSettings: {
          formFactor: string;
          screenEmulation: {
            mobile: boolean;
            width: number;
            height: number;
            deviceScaleFactor: number;
            disabled: boolean;
          };
          onlyCategories: string[];
        };
        categories: Record<string, {score: number}>;
        audits: Record<string, {numericValue: number}>;
      };

      assert.equal(metadata.size, report.bytes);
      assert.equal(sha256(reportBytes), report.sha256);
      assert.equal(raw.lighthouseVersion, report.lighthouseVersion);
      assert.equal(raw.fetchTime, report.fetchTime);
      assert.equal(raw.requestedUrl, report.requestedUrl);
      assert.equal(raw.finalUrl, report.finalUrl);
      assert.equal(raw.finalDisplayedUrl, report.finalUrl);
      assert.equal(raw.configSettings.formFactor, report.formFactor);
      assert.deepEqual(raw.configSettings.screenEmulation, {
        ...report.screenEmulation,
        disabled: false,
      });
      assert.deepEqual(raw.configSettings.onlyCategories, [
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ]);
      assert.deepEqual(
        {
          performance: raw.categories.performance?.score,
          accessibility: raw.categories.accessibility?.score,
          bestPractices: raw.categories['best-practices']?.score,
          seo: raw.categories.seo?.score,
        },
        report.scores,
      );
      assert.deepEqual(
        {
          firstContentfulPaintMs: raw.audits['first-contentful-paint']?.numericValue,
          largestContentfulPaintMs: raw.audits['largest-contentful-paint']?.numericValue,
          totalBlockingTimeMs: raw.audits['total-blocking-time']?.numericValue,
          cumulativeLayoutShift: raw.audits['cumulative-layout-shift']?.numericValue,
          speedIndexMs: raw.audits['speed-index']?.numericValue,
        },
        report.metrics,
      );
      assert.deepEqual(raw.runWarnings, report.runWarnings);
      assert.equal(raw.runtimeError ?? null, report.runtimeError);
      assert.deepEqual(report.scores, {
        performance: 1,
        accessibility: 1,
        bestPractices: 1,
        seo: 1,
      });
    }

    for (const screenshot of evidence.screenshots) {
      await assertScreenshot({
        screenshot: screenshot.path,
        screenshotWidth: screenshot.pixelWidth,
        screenshotHeight: screenshot.pixelHeight,
        bytes: screenshot.bytes,
        sha256: screenshot.sha256,
      });
    }

    assert.deepEqual(
      evidence.screenshots.map(({route, locale, viewport, fullPage}) => ({
        route,
        locale,
        viewport,
        fullPage,
      })),
      [
        {route: '/', locale: 'en', viewport: '1440x1000', fullPage: true},
        {route: '/', locale: 'en', viewport: '390x844', fullPage: true},
        {route: '/demos', locale: 'en', viewport: '1440x1000', fullPage: true},
        {route: '/es/demos', locale: 'es', viewport: '390x844', fullPage: true},
        {route: '/es/terms', locale: 'es', viewport: '320x740', fullPage: false},
      ],
    );
  });

  it('contains no retained credential-shaped fields or values', async () => {
    const serialized = await Promise.all([
      readFile(pr15CanonicalEvidencePath, 'utf8'),
      readFile(pr15ExecutiveEvidencePath, 'utf8'),
      readFile(pr15UiEvidencePath, 'utf8'),
      readFile(pr15UiMachineEvidencePath, 'utf8'),
      ...[
        'production-home-desktop-pr15-2026-07-22.lhr.json',
        'production-home-mobile-pr15-2026-07-22.lhr.json',
      ].map((name) =>
        readFile(`docs/evidence/production-ui-pr15-2026-07-22/${name}`, 'utf8'),
      ),
    ]).then((records) => records.join('\n'));

    assert.doesNotMatch(serialized, /"(?:token|secret|password|passphrase|cookie|privateKey)"\s*:/iu);
    assert.doesNotMatch(serialized, /(?:Bearer\s+|gh[opsu]_[A-Za-z0-9]+|vercel_[A-Za-z0-9]+)/u);
  });
});
