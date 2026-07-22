# Contact readiness and delivery release contract

**Gate:** `contactIntake`
**Status:** Pending
**Required evidence kind:** `contact-readiness`

This document is the canonical blocker contract for accepting public contact
submissions. It does not authorize intake, and the page and API must continue to
fail closed while either the legal-publication or contact-intake gate is holding.
The future lifecycle has two distinct phases: readiness evidence can close
`contactIntake` only after the current holding-only lock is replaced by a
separately reviewed implementation, and only a subsequently approved and
enabled Production deployment can produce real delivery evidence. Closing the
gate is not a claim that a message has already been delivered.

## Preparatory phase 1: readiness approval

The `contact-readiness` review is performed while public intake remains closed.
It confirms that the proposed Production service, accountable owners, and
post-activation test plan are ready for a controlled enablement.

### Required owner and service decisions

- Confirm the production Vercel, Turnstile, Resend, sender-domain, and monitored
  recipient configuration without recording secrets in the repository, and bind
  the reviewed candidate to an exact repository commit and Vercel deployment.
- Name the inbox owner, backup owner, privacy-request handler, and roles permitted
  to access submitted messages.
- Approve the message, delivery-log, security-log, and vendor retention periods,
  processing regions, deletion process, and cross-border treatment.
- Confirm whether `support@helpmath.ai` exists and is actively monitored, and
  decide whether legacy-domain mail is retained, forwarded, or retired.
- Approve the fallback privacy-request channel used whenever the form is closed.
- Approve a post-activation test plan naming the responsible operator, enabled
  Production deployment, required delivery, Reply-To, abuse-control and
  redaction checks, evidence custodian, failure response, and disable or rollback
  owner.

### Checks required to close the gate

- Production service configuration and the fail-closed deployment candidate are
  reviewed.
- Turnstile action and hostname configuration are reviewed.
- Edge rate limiting is configured.
- The sender domain is verified and the monitored inbox is confirmed.
- Retention, inbox access, escalation, and deletion owners are confirmed.
- The complete post-activation Production test plan is approved.

No real Production message, Reply-To result, or abuse submission is required to
close `contactIntake`, and none may be represented as having passed before the
gate is genuinely approved and the reviewed service is deployed with intake
enabled.

### Evidence required to close the gate

The repository may retain only a non-secret `contact-readiness` JSON envelope
directly under `docs/evidence/launch-gates/`. It must bind the reviewed commit,
fail-closed Vercel deployment, observation time, all readiness checks, and the
restricted readiness record by SHA-256. The restricted configuration review,
owner confirmations, and test plan remain outside the repository.

This repository revision cannot move the manifest gate from `holding`; the
code-level transition lock rejects every attempted approval. After a separate
reviewed lifecycle implementation is complete, `legalPublication`, the actual
named contact-release authority, and the hash-bound readiness envelope must all
pass before this contract may change to `Satisfied`.

## Phase 2: approved activation and real Production validation

After `contactIntake` is genuinely approved, deploy the exact approved commit and
reviewed service configuration with public intake enabled. Record the enabled
Production deployment ID, then perform the approved plan against the real
Production host:

- Confirm Turnstile accepts only the approved action and explicit Production
  hostnames.
- Send a real end-to-end message and confirm it reaches the monitored inbox,
  preserves the validated Reply-To address, and creates no sensitive repository
  artifact.
- Record separate results for same-origin enforcement, honeypot handling, edge
  rate limiting, malformed-body rejection, oversized-body rejection, invalid
  Turnstile rejection, replayed Turnstile rejection, automated-submission
  handling, abusive-submission handling, log redaction, and the approved
  failure or rollback disposition.

Service receipts, message samples, and security-test details must remain in the
restricted evidence system. The resulting record must bind the approved commit,
enabled Vercel deployment, observation time, outcomes, and restricted source
bytes. Those real results are not retroactive `contact-readiness` evidence. They
must be recorded as a separate, deployment-bound
`contact-production-verification` envelope before `legacyCutover`. Repeat the
Production validation and create a fresh envelope before `productionLaunch`;
neither the cutover authorization nor the final release may replace this
fine-grained operational evidence. Re-run the validation after any material
deployment or contact-service configuration change.

If delivery, Reply-To, or abuse-control validation fails, disable intake or use
the approved rollback path and keep the later cutover and release gates holding.

## No provisional or manufactured approval

Temporary, test-only, conditional, backdated, placeholder, inferred, or
fabricated approval is not valid. A mock submission, synthetic receipt, preview
environment, disabled endpoint, or pre-approval test cannot stand in for the
post-activation Production results. Codex and CI may verify structure and hashes;
they cannot act as the contact-release authority or manufacture the underlying
approval or service evidence.
