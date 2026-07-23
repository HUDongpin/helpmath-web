# Launch-gate evidence contract

The checked-in launch-gate manifest currently uses schema version 2. Its
dependency graph, holding documents, authority roles, evidence kinds, and
required checks are fixed in `lib/launch-gate-policy.ts`; changing JSON alone
cannot weaken that policy.

All five real gates currently remain `holding`, and every row in the final
launch-authorization table remains `Pending`. This document explains
preparatory schema-v2 evidence and the separately adoptable schema-v3
lifecycle. It is not approval evidence.

## Current schema-v2 holding-only transition lock

Every schema-v2 manifest is deliberately holding-only. The validator rejects
every non-`holding` schema-v2 gate state, even when it contains a structurally
complete synthetic approval chain. This lock is shared by build validation and
release smoke and cannot be disabled by editing the manifest or an environment
variable. The schema-v2 evidence shapes below remain preparatory contracts.

The repository also contains a schema-v3 lifecycle implementation for separate
review and adoption. Its presence does not migrate
`config/launch-gates.json`, append an event, approve a gate, or change a public
capability. Until an authorized change adopts a valid schema-v3 manifest, the
current schema-v2 holding behavior remains authoritative. Codex, CI, a name in
Markdown, an evidence JSON file, or a code path cannot create the underlying
decision or authority.

`.vercelignore` keeps the evidence tree out of Vercel except for direct,
non-hidden `*.json` files in exactly `docs/evidence/launch-gates/` and
`docs/evidence/demo-publication/`, plus direct normalized Quality receipts in
`docs/evidence/github-actions/`. Non-JSON files, hidden files, nested files, and
every other evidence directory remain excluded. This narrow build-input
allowlist is packaging readiness only; it does not approve a gate or activate
a demo.

Before the Vercel build proceeds, the launch-gate, Quality-receipt, and
demo-lifecycle validators enumerate the complete entry set in their respective
allowlisted directory.
Every entry must be a direct regular non-symlink file, the set must exactly
equal the manifest or activation references, and every file byte must match its
recorded SHA-256. An unreferenced, missing, nested, hidden, non-JSON, symbolic,
or digest-mismatched entry fails closed. With the current holding gates and null
demo acceptances, both reference sets are empty, so each allowlisted directory
may be absent or empty but may not contain a preparatory artifact.

## Schema-v3 append-only lifecycle

Schema v3 records a linked, append-only event history for each gate. The only
statuses are `holding`, `candidate`, `approved`, `disabled`, `private`, and
`revoked`. Existing events must never be edited, reordered, deleted, or
backdated. Every new event names the immediately preceding event, and renewal
or revocation also identifies the exact event and decision it supersedes.

For pull requests, CI compares the merge base with `HEAD`; for pushes it
requires the exact nonzero `before` SHA from the GitHub event and compares that
entire range. A schema-v3 comparison may append at most one event to one gate.
Missing or malformed push baselines fail closed. Manual `workflow_dispatch`
runs still execute every validator and test, but do not pretend to prove an
append-only transition because they have no trusted before/after event range.

A gate moves from `holding` to `candidate` only through a submitted candidate
that states the intended terminal disposition and binds the exact repository
commit plus the Vercel deployment when that gate requires one. A candidate
contains no decision or evidence and expires no later than seven days after it
is submitted. A named authority may resolve only that exact, still-valid
candidate, and only to a disposition permitted for the gate:

| Gate | Allowed resolved disposition | Required evidence path |
| --- | --- | --- |
| `legalPublication` | `approved` | `legal-review` |
| `contactIntake` | `approved` | `contact-readiness` |
| `contactIntake` | `disabled` | `contact-disabled-disposition` |
| `demoPublication` | `approved` | `demo-rights`, then `demo-product-acceptance` |
| `demoPublication` | `private` | `demo-private-disposition` |
| `legacyCutover` | `approved`, with contact enabled | `contact-production-verification`, then `legacy-cutover-authorization` |
| `legacyCutover` | `approved`, with contact disabled | `contact-disabled-verification`, then `legacy-cutover-authorization` |
| `productionLaunch` | `approved`, with contact enabled | `post-cutover-verification`, `contact-production-verification`, then `production-release` |
| `productionLaunch` | `approved`, with contact disabled | `post-cutover-verification`, `contact-disabled-verification`, then `production-release` |
| Any resolved gate | `revoked` | `gate-revocation` |

Each evidence kind has a code-defined `scopeId`, an exact ordered set of
repository subject paths, required checks, permitted gate and outcome,
deployment-binding rule, and maximum validity. The envelope must bind that
fixed scope digest, the candidate and decision IDs, the exact commit and
deployment, the actual authority, dependency decision IDs, canonical
timestamps, and restricted-source bytes. Callers cannot substitute a broader
or narrower file list, omit a required dependency, or extend an evidence
kind's maximum lifetime.

The fixed scopes include the lifecycle validators and their transitive policy
helpers, CI wiring, deployment workflows, and the execution/test surfaces
whose results the evidence claims. The subject digest is recomputed from the
candidate commit's Git tree, not from whichever working tree happens to run
the validator. The legal and contact contract documents remain fully bound
except for their single machine-checked `Status` line: that line is normalized
for hashing so an authorized `Pending` to `Satisfied` or `Disabled` lifecycle
transition does not invalidate its own candidate, while any other contract
change still changes the digest. A current resolved decision is accepted only
while the present governed bytes still match that candidate-tree digest.

Maximum evidence validity is measured from `observedAt`, not from the later
approval time. Delaying recording or approval therefore consumes the evidence
window and cannot make an old observation fresh again.

`disabled` is a safe, resolved disposition only for `contactIntake`. It means
public message intake is not authorized: the page must show the unavailable
state, the API must fail closed, no delivery may be attempted, and an approved
alternative support channel must remain available. It may satisfy the contact
dependency for later cutover and release review, but each downstream resolution
additionally requires fresh, deployment-bound
`contact-disabled-verification`. It never enables the contact capability.

`private` is a safe, resolved disposition only for `demoPublication`. It means
anonymous demo routes, runtimes, and assets remain closed and public activation
is not authorized. It may satisfy the demo dependency for production review,
but it never enables public demo publication. Moving later from `disabled` or
`private` to a public capability requires explicit revocation of the safe
disposition, reopening to a new candidate, and a new authorized decision with
the public-path evidence.

Every resolved decision has an explicit `validUntil`. At expiry it becomes
ineffective and all dependent capabilities fail closed. Renewal is allowed
only before expiry, must append a superseding decision, and must use evidence
observed after the earlier decision. An expired candidate must be reopened with
a new candidate window before it can be decided. An expired resolved decision
cannot be renewed: append an explicit `revoked` decision with
`gate-revocation` containment evidence, then reopen a new candidate. The same
explicit revocation path applies whenever authority is withdrawn or
containment is otherwise required. No expiry, renewal, revocation, or reopening
silently restores a capability.

A revocation envelope permanently preserves the historical containment
evidence and keeps the affected capability fail closed. It does not require all
future governed repository bytes to remain identical to the historically bound
candidate snapshot; safe remediation and maintenance after revocation must remain
possible. The validator nevertheless recomputes the envelope's historical
subject digest from the exact candidate commit Git tree for every revocation;
it never trusts a digest copied from the envelope itself. Reopening still
requires a new candidate and a new authorized decision. Revocation evidence
must be observed strictly after the decision it supersedes, so an old
containment artifact cannot be reused to authorize a later revocation.

A downstream decision records the exact dependency decision IDs that were
active when it was made. An upstream dependency may continue through an
unbroken chain of timely renewals, but revocation, reopening, or a new
candidate breaks that lineage. Re-approving the upstream gate therefore does
not resurrect descendants; each affected downstream authority must append its
own fresh renewal or decision in dependency order.

The timestamps also enforce the operational causal chain inherited from the
schema-v2 dependency and evidence-order rules, with strict schema-v3
boundaries. Every evidence observation for a resolved decision must be later
than every dependency decision active when that decision is made. Required
evidence observations must then increase strictly in their code-defined order;
equal timestamps are rejected, and array order alone cannot make an
out-of-order observation valid. The same rules apply to renewal evidence
against the dependency decisions active at renewal time.

For `demoPublication=approved`, `demo-rights` must be observed before
`demo-product-acceptance`. The `private` path has only its exact
`demo-private-disposition` evidence and does not manufacture a second ordering
step; because `demoPublication` has no static gate dependencies, its single
observation remains governed by the envelope timing, candidate/decision
binding, and freshness rules. A later `productionLaunch` decision must observe
all of its evidence after the active `demoPublication` decision whether that
dependency is `approved` or `private`.

For `legacyCutover`, Production contact or disabled-state verification must be
observed after the active `contactIntake` decision, and
`legacy-cutover-authorization` must be observed after that verification. For
`productionLaunch`, post-cutover verification must be observed after the
active `legacyCutover` decision, followed by fresh contact verification and
finally the production-release observation.

## Schema-v2 preparatory approval record

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

## Schema-v2 preparatory repository evidence reference

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

## Schema-v2 preparatory evidence requirements by gate

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

Each `contact-production-verification` envelope independently requires a
separate true result for Production Turnstile, real inbox delivery, validated
Reply-To, same-origin enforcement, honeypot handling, edge rate limiting,
malformed-body rejection, oversized-body rejection, invalid Turnstile
rejection, replayed Turnstile rejection, automated-submission handling,
abusive-submission handling, log redaction, and the recorded failure or
rollback disposition. Aggregate check names are rejected so one passing
sub-result cannot mask a missing or failed control.

A material deployment or contact-service configuration change invalidates the
earlier operational result and requires another real Production validation. A
failed result keeps the affected cutover or release gate holding and triggers the
approved disable or rollback response; `contact-readiness` approval cannot waive
that failure.

`legacyCutover` authorizes the controlled change. The post-change DNS, HTTP,
TLS, mail, Search Console, monitoring, and rollback decision belong to the
`post-cutover-verification` evidence required by `productionLaunch`; requiring
them before the change would create a circular gate.

## Production Quality provenance

The final schema-v3 `production-release` envelope must bind a successful
`Quality` run triggered by the `push` of the exact Production commit. Candidate
`pull_request` runs remain useful pre-merge evidence, but they are not the
Production release run. A manual `workflow_dispatch` run is never acceptable
for this envelope because its launch-transition step is skipped and it has no
trusted push range.

`production-release` therefore has one additional required top-level field,
`qualityRun`. No other evidence kind may contain that field. Its exact shape is:

```json
{
  "qualityRun": {
    "repository": "HUDongpin/helpmath-web",
    "workflow": "Quality",
    "workflowPath": ".github/workflows/quality.yml",
    "event": "push",
    "ref": "refs/heads/main",
    "headBranch": "main",
    "headSha": "SAME_AS_CANDIDATE_REPOSITORY_COMMIT",
    "runId": 29921608812,
    "runAttempt": 1,
    "runUrl": "https://github.com/HUDongpin/helpmath-web/actions/runs/29921608812",
    "status": "completed",
    "conclusion": "success",
    "completedAt": "2026-07-23T19:59:30.000Z",
    "updatedAt": "2026-07-23T20:00:00.000Z",
    "launchTransition": {
      "job": "verify",
      "step": "Enforce launch-gate transition history",
      "conclusion": "success"
    },
    "jobs": {
      "verify": "success",
      "browser-quality": "success",
      "lighthouse": "success"
    }
  }
}
```

The run ID and attempt must be positive safe integers, and the canonical URL
must contain that exact run ID in the fixed repository. `completedAt` and
`updatedAt` must be canonical, non-future GitHub receipt timestamps, with
`completedAt <= updatedAt`. The envelope `observedAt` must equal
`qualityRun.updatedAt` exactly; the time when an old run is copied or approved
cannot be substituted as a newer observation.

For this evidence kind, `underlyingEvidence.system` must be exactly
`GitHub Actions Quality provenance receipt`. Its reference must be the derived
repository path
`docs/evidence/github-actions/quality-run-<runId>-attempt-<runAttempt>.json`.
That file contains exactly the normalized `qualityRun` object shown above as
two-space JSON followed by one newline. File verification reads the receipt,
requires a regular non-symbolic repository file, verifies its exact byte count
and SHA-256 against `underlyingEvidence`, and then requires the parsed receipt
to equal the envelope `qualityRun` field. Updating the raw receipt hash while
leaving contradictory typed provenance, or changing typed provenance without
the receipt bytes, fails closed. Only direct referenced JSON receipts are
admitted as Vercel build inputs; the complete directory entry set is checked,
and the files are not exposed as public application routes.

The fixed checks require `qualityRunEventWasPush`,
`launchGateTransitionPassed`, `verifyJobPassed`,
`browserQualityJobPassed`, and `lighthouseJobPassed` in addition to the
aggregate quality result and commit identity. Each must be present and exactly
true. A missing, skipped, cancelled, or failed launch-transition step or
`verify`, `browser-quality`, or `lighthouse` job keeps
`productionLaunch` unresolved even if the overall run, a retry, or a manually
dispatched run is reported as successful.

This repository-stored receipt and typed record remain an authority
attestation. Validation proves internal identity, timestamp, result, and byte
consistency; it does not log in to GitHub, independently query the Actions API,
or prove that the recorded API response was independently obtained. Protected
authority review and external custody remain required.

## Security boundary

Keep contracts, signatures, private email, account data, message samples, and
credentials in the restricted source system. The repository retains only the
non-secret envelope and hashes. A SHA-256 match proves byte identity, not that
the named person truly had authority. Protected review, external evidence
custody, and final owner verification remain required; Codex or CI cannot
manufacture approvals, Production receipts, or test outcomes.
