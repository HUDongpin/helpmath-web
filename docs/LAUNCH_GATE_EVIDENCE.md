# Launch-gate evidence contract

The launch-gate manifest uses schema version 2. Its dependency graph, holding
documents, authority roles, evidence kinds, and required checks are fixed in
`lib/launch-gate-policy.ts`; changing JSON alone cannot weaken that policy.

All five gates currently remain `holding`. This document explains the future
approval mechanism and is not approval evidence.

## Current holding-only transition lock

The current repository deliberately rejects every non-`holding` gate state,
even when a manifest contains a structurally complete synthetic approval chain.
The lock is fixed in code, is shared by build validation and release smoke, and
cannot be disabled by editing the manifest or an environment variable. The
evidence schemas below are preparatory contracts only; they are not an
operational approval or promotion lifecycle in this release.

The demo subsystem now has an inactive, digest-bound candidate-to-activation
foundation, but it does not remove this lock. Before any launch-gate transition
can be enabled, a separately reviewed implementation must add fixed
evidence-kind subject scopes, approval identity, revocation and renewal rules,
and explicit private or disabled terminal decisions for optional demo and
contact features. It must also prove that legal publishing, contact intake,
demo routes and assets, legacy cutover, release smoke, and every other consumer
fail closed in each intermediate state. Until then, Codex, CI, an approver
name, an evidence JSON file, or a manifest edit cannot unlock a gate.

While this lock is active, `.vercelignore` excludes the entire `docs/evidence/`
tree from every Vercel build context. No preparatory envelope, private contract,
receipt, or accidentally misplaced JSON is uploaded. A future lifecycle may
retain evidence files only after its validator proves that the directory's
complete regular-file set exactly equals the manifest references and scans
every retained byte before the Vercel build proceeds.

## Approval record

An approved gate must replace `approval: null` with:

```json
{
  "approvedBy": {
    "name": "Full name of the actual approver",
    "authorityRole": "the exact role fixed for this gate",
    "organization": "Approver organization"
  },
  "approvedAt": "2026-07-21T21:00:00.000Z"
}
```

Placeholder identities are rejected. Temporary, test-only, conditional,
backdated, inferred, or fabricated approvals are also invalid. The approval time
must be canonical UTC, must not be in the future or later than the manifest
update, and must not precede any dependency approval. Evidence observations must
not precede the approval of a gate dependency or an earlier required evidence
item.

## Repository evidence reference

Each required evidence item has this manifest shape:

```json
{
  "kind": "legal-review",
  "reference": "docs/evidence/launch-gates/legal-review-YYYY-MM-DD.json",
  "sha256": "64 lowercase hexadecimal characters",
  "observedAt": "2026-07-21T20:50:00.000Z"
}
```

Only JSON files directly under `docs/evidence/launch-gates/` are accepted.
Markdown, absolute paths, path traversal, repeated references, symbolic files,
missing files, oversized files, and hash mismatches fail the build.

The referenced JSON envelope must contain only these top-level fields:

```json
{
  "schemaVersion": 1,
  "gateId": "legalPublication",
  "evidenceKind": "legal-review",
  "status": "pass",
  "observedAt": "2026-07-21T20:50:00.000Z",
  "approval": {
    "approvedBy": {
      "name": "Exact manifest approver name",
      "authorityRole": "legal-review-authority",
      "organization": "Exact manifest organization"
    },
    "approvedAt": "2026-07-21T21:00:00.000Z"
  },
  "subject": {
    "repositoryCommit": "40 lowercase hexadecimal characters",
    "repositoryContentSha256": "SHA-256 of the current governed source scope",
    "vercelDeploymentId": null
  },
  "underlyingEvidence": {
    "system": "Name of the restricted evidence system",
    "reference": "Non-secret record identifier",
    "sha256": "SHA-256 of the restricted source bytes",
    "bytes": 1
  },
  "checks": {
    "everyCheckFixedForThisEvidenceKind": true
  }
}
```

Deployment-bound evidence requires a `dpl_...` Vercel deployment ID. The
envelope gate, kind, observation time, approver identity, organization,
authority role, and approval time must exactly match the manifest.
Every check fixed for that evidence kind must exist and equal `true`; unknown
or omitted checks fail. Credential-shaped fields and values are forbidden.
The file must be the exact two-space `JSON.stringify` representation followed
by one newline, so duplicate keys, alternate encodings, and ambiguous JSON
formatting fail verification.

The verifier recomputes `repositoryContentSha256` over the deterministic source
scope in `LAUNCH_GATE_SUBJECT_PATHS`. That scope includes deployed application,
content, private-runtime, public-asset, build, validation, environment-contract,
runtime-version, and Vercel-boundary files, while excluding the self-referential
manifest and evidence envelopes. Replaying an older approval after a governed
source byte changes therefore fails. The restricted source SHA-256 separately
binds contracts, service receipts, rights records, and other approval material
that must not be committed to this repository.

## Preparatory evidence requirements by gate

| Gate | Authority role | Required evidence |
| --- | --- | --- |
| `legalPublication` | `legal-review-authority` | `legal-review` |
| `contactIntake` | `contact-release-authority` | `contact-readiness` |
| `demoPublication` | `demo-publication-authority` | `demo-rights`, `demo-product-acceptance` |
| `legacyCutover` | `legacy-cutover-authority` | `contact-production-verification`, `legacy-cutover-authorization` |
| `productionLaunch` | `production-release-authority` | `post-cutover-verification`, `contact-production-verification`, `production-release` |

## Two-stage contact evidence

`contact-readiness` closes `contactIntake` without claiming that public intake
or real delivery testing has already occurred. It is deployment-bound to the
reviewed, fail-closed Production candidate and confirms the Production service
configuration, Turnstile configuration, edge rate limit, verified sender domain,
monitored inbox, retention and inbox owners, and approved post-activation test
plan. It must not contain a mock, synthetic, preview, or pre-approval delivery
result represented as Production success.

Only after the actual contact-release authority approves `contactIntake` and the
approved commit and reviewed configuration are deployed with intake enabled may
the team run real Production delivery, validated Reply-To, and abuse-control
tests. The observation time for those tests must be later than the gate approval
and enabled deployment. Their restricted evidence must identify the enabled
deployment and record delivery, Reply-To, Turnstile, rate-limit, same-origin,
honeypot, malformed and oversized request, replay, automated submission, abuse,
and redaction outcomes.

The real post-activation results are required as their own typed evidence at
both later approvals:

- `legacyCutover` requires a deployment-bound
  `contact-production-verification` envelope before the separate
  `legacy-cutover-authorization` envelope.
- `productionLaunch` requires a fresh deployment-bound
  `contact-production-verification` envelope after post-cutover verification
  and before the separate `production-release` envelope. It may not inherit a
  stale assertion from the earlier gate.

Each `contact-production-verification` envelope independently requires true
results for Production Turnstile, real inbox delivery, validated Reply-To,
same-origin and honeypot controls, edge rate limiting, malformed, oversized,
replayed, automated, and abusive submission handling, log redaction, and the
recorded failure or rollback disposition.

A material deployment or contact-service configuration change invalidates the
earlier operational result and requires another real Production validation. A
failed result keeps the affected cutover or release gate holding and triggers the
approved disable or rollback response; `contact-readiness` approval cannot waive
that failure.

`legacyCutover` authorizes the controlled change. The post-change DNS, HTTP,
TLS, mail, Search Console, monitoring, and rollback decision belong to the
`post-cutover-verification` evidence required by `productionLaunch`; requiring
them before the change would create a circular gate.

## Security boundary

Keep contracts, signatures, private email, account data, message samples, and
credentials in the restricted source system. The repository retains only the
non-secret envelope and hashes. A SHA-256 match proves byte identity, not that
the named person truly had authority. Protected review, external evidence
custody, and final owner verification remain required; Codex or CI cannot
manufacture approvals, Production receipts, or test outcomes.
