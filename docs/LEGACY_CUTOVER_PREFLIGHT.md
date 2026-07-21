# Legacy cutover preflight contract

This document defines the external, non-secret inputs consumed by
`npm run preflight:legacy-cutover`. The command verifies pre-change readiness;
it does not collect evidence or prove the post-change result. Registrar, mail,
Search Console, Vercel, legacy-host, DNS, and HTTP/TLS operators must produce
the underlying evidence through approved procedures.

Do not copy placeholder values into a real plan and do not store these files in
the repository. The plan, evidence artifacts, underlying collector outputs,
and retained receipt must use absolute paths in a restricted external store.
Files must grant no group or other access. The receipt directory must already
exist with mode `0700`. Real-path containment checks reject inputs or outputs
that resolve into the repository through a symbolic-link ancestor.

## Plan schema

The plan is strict JSON with no extra fields. The abbreviated `evidence` object
shown below must be expanded to contain every evidence key in the contract
table.

```json
{
  "schemaVersion": 1,
  "cutoverId": "help-math-legacy-YYYY-MM-DD",
  "topology": "direct-one-hop",
  "repositoryCommit": "FULL_40_CHARACTER_GIT_SHA",
  "vercelDeploymentId": "dpl_DEPLOYMENT_ID",
  "salesDestination": "/resources",
  "owners": {
    "change": "NAMED_OWNER",
    "rollback": "NAMED_OWNER",
    "dns": "NAMED_OWNER",
    "mail": "NAMED_OWNER",
    "searchConsole": "NAMED_OWNER"
  },
  "window": {
    "startsAt": "YYYY-MM-DDTHH:MM:SS.000Z",
    "monitorUntil": "YYYY-MM-DDTHH:MM:SS.000Z",
    "timezone": "Asia/Shanghai"
  },
  "ttl": {
    "previousSeconds": 3600,
    "reducedAt": "YYYY-MM-DDTHH:MM:SS.000Z"
  },
  "rollbackThresholds": {
    "consecutiveProbeFailures": 2,
    "maxFiveXxPercent": 5,
    "maxTimeoutPercent": 5,
    "probeIntervalSeconds": 30,
    "minimumProbeCount": 4,
    "tlsFailureImmediate": true,
    "mailRecordChangeImmediate": true
  },
  "decisions": {
    "topology": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "dnsZoneProposed"
    },
    "salesDestination": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "legacyHostConfigTest"
    },
    "dnsChange": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "preCutoverDnsObservation"
    },
    "mailContinuity": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "mailContinuity"
    },
    "contactDelivery": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "contactDelivery"
    },
    "searchConsole": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "searchConsoleControl"
    },
    "rollbackPlan": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "dnsZoneBefore"
    },
    "sourceRightsAccessibility": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "rightsAccessibilityDisposition"
    },
    "stableExternalLinks": {
      "status": "approved",
      "approvedBy": "NAMED_OWNER",
      "approvedAt": "YYYY-MM-DDTHH:MM:SS.000Z",
      "evidenceKey": "stableExternalLinkReview"
    }
  },
  "evidence": {
    "EVIDENCE_KEY": {
      "reference": "/absolute/restricted/path/EVIDENCE_KEY.json",
      "sha256": "LOWERCASE_64_CHARACTER_SHA256",
      "observedAt": "YYYY-MM-DDTHH:MM:SS.000Z"
    }
  }
}
```

`topology` accepts only `direct-one-hop` or `temporary-two-hop`;
`salesDestination` accepts only `/contact` or `/resources`. All timestamps are
canonical millisecond UTC. The start must be between 15 minutes in the past and
60 minutes in the future, the monitoring end must still be future, and the
monitoring window must last at least one hour. The prior TTL must already have
elapsed. Every machine approval must be later than the evidence it approves.
Error and timeout percentages must remain below 100, and the monitoring window
must fit the configured minimum probe count at the configured interval.

## Evidence artifact envelope

Each plan reference is a strict JSON artifact of at most 1 MiB. Its identity
fields must match the plan exactly. It also binds the retained full collector
output, which may be at most 50 MiB.

```json
{
  "schemaVersion": 1,
  "evidenceKind": "EVIDENCE_KEY",
  "status": "pass",
  "cutoverId": "SAME_AS_PLAN",
  "observedAt": "SAME_AS_PLAN_EVIDENCE_ENTRY",
  "repositoryCommit": "SAME_AS_PLAN",
  "vercelDeploymentId": "SAME_AS_PLAN",
  "topology": "SAME_AS_PLAN",
  "source": "NON_SECRET_COLLECTOR_AND_RECEIPT_DESCRIPTION",
  "underlyingEvidence": {
    "reference": "/absolute/restricted/path/FULL_COLLECTOR_OUTPUT",
    "sha256": "LOWERCASE_64_CHARACTER_SHA256",
    "bytes": 1234,
    "collector": "COLLECTOR_OR_OPERATOR_IDENTITY",
    "collectorVersion": "COLLECTOR_VERSION"
  },
  "checks": {
    "REQUIRED_CHECK_ID": true
  }
}
```

Every required check must be present and exactly `true`; unknown or missing
checks fail. The verifier reads and hashes both the artifact and its underlying
file, validates byte length and collector metadata, and rechecks freshness at
the final decision time after repository commands finish. A `pass` envelope
remains an owner attestation, not an independent login to the source system.

| Evidence key | Maximum age | Required check IDs |
| --- | ---: | --- |
| `dnsZoneBefore` | 24 hours | `authenticatedExport`, `completeZoneCaptured`, `rollbackValuesCaptured` |
| `dnsZoneProposed` | 24 hours | `approvedWebsiteRecordsOnly`, `mailRecordsUnchanged`, `ownershipRecordsUnchanged`, `noApexCnameConflict` |
| `mailContinuity` | 24 hours | `inboundDeliveryPassed`, `outboundDeliveryPassed`, `mxRecordsUnchanged`, `mailTxtRecordsUnchanged` |
| `contactDelivery` | 24 hours | `repositoryGateApproved`, `productionEnvironmentEnabled`, `verifiedSubmissionDelivered`, `retentionAndInboxOwnersConfirmed` |
| `searchConsoleControl` | 7 days | `legacyPropertyControlled`, `newPropertyControlled`, `changeOfAddressOwnerNamed` |
| `offDeviceArchiveRestore` | 30 days | `encryptedOffDeviceCustody`, `independentRestorePassed`, `restoredBytesHashVerified` |
| `rightsAccessibilityDisposition` | 30 days | `allGovernedSourcesClassified`, `republicationDecisionsRecorded`, `accessibilityActionsRecorded` |
| `stableExternalLinkReview` | 24 hours | `allGovernedLinksReviewed`, `zeroUnresolvedFailures`, `reviewCommitMatched` |
| `productionAliasAssignment` | 24 hours | `canonicalWwwAssigned`, `canonicalApexAssigned`, `readyProductionDeployment`, `deploymentCommitMatched` |
| `productionQuality` | 24 hours | `qualityRunSucceeded`, `qualityCommitMatched` |
| `productionSmoke` | 24 hours | `productionSmokeSucceeded`, `zeroFailures`, `smokeCommitMatched` |
| `legacyHostConfigTest` | 24 hours | `targetHostVersionRecorded`, `stagedArtifactHashMatched`, `stagedConfigTestPassed` |
| `preCutoverDnsObservation` | 15 minutes | `authoritativeResolversAgree`, `publicResolversAgree`, `websiteRecordsMatchBeforeZone`, `mailAndOwnershipRecordsMatchBeforeZone` |
| `preCutoverHttpTlsObservation` | 15 minutes | `allFourLegacyOriginsReachable`, `currentRedirectStateMatchesBaseline`, `targetCanonicalRoutesPassed`, `tlsIdentityAndExpiryPassed` |

## Decision and exit behavior

The preflight returns `GO_TO_CHANGE` and exit `0` only when all plan, evidence,
launch-gate, repository, command, destination, and receipt-store checks pass
and the receipt plus companion SHA-256 are written successfully. Every other
result is `NO_GO` with exit `2`. There is no force, skip, or
success-on-`NO_GO` option.

The content-addressed receipt records tool hashes, repository state, plan hash,
every artifact and underlying-evidence expected/actual hash, all checks, all
failures, and `validUntil`, the earliest evidence/window expiry. The operator
must not begin a change with an expired receipt. `GO_TO_CHANGE`
also requires at least five minutes of validity after the later of the final
decision time and planned start time; the writer rechecks that buffer before
atomically publishing the final JSON name. A normal
filesystem receipt must still be copied to the owner-approved append-only or
WORM store; permissions and hashes alone do not make a filesystem immutable.

`GO_TO_CHANGE` authorizes only the beginning of the planned change. Its DNS and
HTTP/TLS evidence proves the unchanged public baseline and target readiness;
it does not assert the target redirect topology is already live. After the
change, operators must perform the live DNS, redirect-hop, TLS, blocked-file,
unknown-path, and mail checks in `LEGACY_CUTOVER.md`. Failure invokes the
structured rollback thresholds. The pre-change receipt must never be described
as a post-change pass.
