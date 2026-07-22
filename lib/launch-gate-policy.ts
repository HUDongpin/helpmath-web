import type {LaunchGateId} from './launch-gate-ids';

export const LAUNCH_GATE_SUBJECT_PATHS = [
  '.env.example',
  '.nvmrc',
  '.vercelignore',
  'app',
  'components',
  'config/executive-preview-window.json',
  'content',
  'data',
  'demos',
  'i18n',
  'lib',
  'ops',
  'private-demo-assets',
  'private-demo-runtime',
  'public',
  'scripts',
  'next.config.ts',
  'package-lock.json',
  'package.json',
  'postcss.config.mjs',
  'proxy.ts',
  'tsconfig.json',
] as const;

export const LAUNCH_GATE_DEPENDENCIES = {
  legalPublication: [],
  contactIntake: ['legalPublication'],
  demoPublication: [],
  legacyCutover: ['legalPublication', 'contactIntake'],
  productionLaunch: [
    'legalPublication',
    'contactIntake',
    'demoPublication',
    'legacyCutover',
  ],
} as const satisfies Record<LaunchGateId, readonly LaunchGateId[]>;

export const LAUNCH_GATE_AUTHORITY_ROLES = {
  legalPublication: 'legal-review-authority',
  contactIntake: 'contact-release-authority',
  demoPublication: 'demo-publication-authority',
  legacyCutover: 'legacy-cutover-authority',
  productionLaunch: 'production-release-authority',
} as const satisfies Record<LaunchGateId, string>;

export const LAUNCH_GATE_BLOCKER_REFS = {
  legalPublication: ['docs/LEGAL_REVIEW.md'],
  contactIntake: ['docs/CONTACT_DELIVERY.md'],
  demoPublication: ['docs/DEMO_PROMOTION.md', 'docs/LAUNCH_DECISIONS.md'],
  legacyCutover: ['docs/LEGACY_CUTOVER.md'],
  productionLaunch: ['docs/LAUNCH_DECISIONS.md'],
} as const satisfies Record<LaunchGateId, readonly string[]>;

export const LAUNCH_GATE_EVIDENCE_CHECKS = {
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
} as const;

export type LaunchGateEvidenceKind = keyof typeof LAUNCH_GATE_EVIDENCE_CHECKS;

export const LAUNCH_GATE_REQUIRED_EVIDENCE = {
  legalPublication: ['legal-review'],
  contactIntake: ['contact-readiness'],
  demoPublication: ['demo-rights', 'demo-product-acceptance'],
  legacyCutover: ['contact-production-verification', 'legacy-cutover-authorization'],
  productionLaunch: [
    'post-cutover-verification',
    'contact-production-verification',
    'production-release',
  ],
} as const satisfies Record<LaunchGateId, readonly LaunchGateEvidenceKind[]>;

export const LAUNCH_GATE_EVIDENCE_REQUIRES_DEPLOYMENT = {
  'legal-review': false,
  'contact-readiness': true,
  'contact-production-verification': true,
  'demo-rights': false,
  'demo-product-acceptance': true,
  'legacy-cutover-authorization': true,
  'post-cutover-verification': true,
  'production-release': true,
} as const satisfies Record<LaunchGateEvidenceKind, boolean>;
