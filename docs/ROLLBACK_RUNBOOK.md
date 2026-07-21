# Production rollback runbook

This runbook covers a HELP Math application rollback on Vercel and a separate
website-record rollback during the future legacy-domain cutover. It does not
authorize either operation. Assign a release owner and rollback owner in
`LAUNCH_DECISIONS.md` before using it, and never place credentials, access
keys, cookies, DNS secrets, or private customer data in the record.

## Incident record

Complete this non-secret record before acting when time permits, or
immediately after an emergency containment action:

| Field | Recorded value or evidence reference |
| --- | --- |
| Incident start in UTC and local time | Pending |
| Decision owner and operator | Pending |
| Trigger and measured threshold | Pending |
| Current production commit | Pending |
| Current GitHub and Vercel deployment IDs | Pending |
| Reviewed rollback commit | Pending |
| Reviewed rollback Vercel deployment ID | Pending |
| Prior Quality run and release record | Pending |
| Contact mode before rollback | Pending |
| Executive-preview state and expiry before rollback | Pending |
| Action start and completion timestamps | Pending |
| Post-action smoke artifact or retained output | Pending |
| Follow-up owner and review date | Pending |

Do not select a target merely because it rendered successfully in the past.
Confirm its repository commit, successful Quality run, Vercel project, and
publication boundaries. In particular, an older deployment must not reopen a
private demo or asset, enable an unapproved contact form, publish final-looking
legal copy, or restore a withdrawn vulnerable dependency.

## Immediate containment triggers

The named owners must set quantitative availability and performance thresholds
before launch. Regardless of those pending numbers, treat the following as
immediate containment candidates:

- a private demo, runtime, image derivative, secret, or source document becomes
  publicly retrievable;
- contact intake becomes active without its approved privacy, inbox,
  anti-abuse, and delivery controls;
- sustained production `5xx`, timeout, redirect-loop, or TLS failure is
  reproduced from an independent network;
- the canonical domain serves an unexpected deployment or an unreviewed
  release; or
- a security defect is actively exploitable and a previously reviewed build
  safely removes the exposure.

If the incident involves a leaked credential, rotate or revoke that credential
in addition to rolling back code. A deployment rollback does not invalidate a
secret by itself.

## Vercel application rollback

1. Freeze further production promotions and record the current canonical
   response, incident symptoms, commit, GitHub deployment, Vercel deployment,
   and UTC time. Do not delete the current deployment; it is evidence and may
   still be needed for diagnosis.
2. Identify the intended rollback deployment in the authenticated Vercel
   project. Match it to the full Git commit, successful Quality run, and its
   immutable release record. Confirm it belongs to this private repository and
   project.
3. Review the target against the current safety boundaries: both unauthenticated
   demo families and their assets/runtimes are closed, Contact is disabled
   unless separately approved, legal drafts remain non-indexable, and no
   retired source payload is public.
4. Use Vercel's reviewed Instant Rollback control for that exact deployment.
   Record the operator, target deployment, and action timestamp. Do not combine
   this with a DNS edit.
5. In authenticated Vercel evidence, confirm both `www.helpmath.ai` and the apex
   redirect are assigned as expected. Retain the prior and resulting deployment
   IDs; a successful page load alone does not prove alias identity.
6. Run `npm run smoke:production` against the canonical domain and retain the
   complete JSON plus timestamp. Confirm `failures: []`, then verify the
   specific incident path from an independent network. If executive access is
   still approved, test it only through the separate ephemeral-credential
   procedure in `RELEASE_EVIDENCE.md`.
7. If the rollback target fails the contract or preserves the incident, stop
   repeated blind promotions. Restore the last independently verified safe
   deployment or disable the affected feature at its fail-closed control,
   record the second action, and escalate to the named owner.
8. Keep the promotion freeze until the owner records the result, remaining
   exposure, monitoring window, and forward-fix plan. A rollback is containment,
   not proof that the underlying defect is fixed.

## Website DNS or TLS rollback

This section applies only after an approved `helpprogram.net` cutover begins.
It is separate from an application rollback.

1. Use the pre-cutover DNS export and the exact prior website A/AAAA/CNAME
   values recorded in `LEGACY_CUTOVER.md`.
2. Restore only the affected website records. Do not modify MX, SPF, DKIM,
   DMARC, mailbox, or ownership-verification records as part of a website
   rollback.
3. Record the provider, operator, TTL, old value, restored value, UTC time, and
   provider change reference without storing credentials.
4. Verify old apex and `www` over HTTP and HTTPS from independent resolvers.
   Recheck TLS, representative legacy paths, unknown-path behavior, and mailbox
   continuity throughout the recorded monitoring window.
5. If the direct Apache mapping was changed, restore its backed-up virtual-host
   configuration, run the actual host's `httpd -t`, reload only after it passes,
   and retain the command result. Do not infer host correctness from the local
   Apache workbench.

## Closure evidence

A rollback record is complete only when it identifies the incident, owners,
before/after deployments or DNS values, timestamps, exact action, post-action
contract output, monitoring result, remaining exceptions, and forward-fix
owner. Link the record from the corresponding append-only release entry; do
not rewrite an earlier release as though the incident never occurred.
