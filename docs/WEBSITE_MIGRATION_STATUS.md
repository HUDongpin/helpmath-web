# HELP Math website migration status

This is the single status matrix for the HELP Math website migration. It
summarizes two deliberately separate scopes:

- **Scope A — public informational website:** the bilingual Next.js website,
  public content, production delivery, safety boundaries, and the controlled
  retirement of the legacy website.
- **Scope B — HELP Math 2.0 product platform:** student and teacher product
  capabilities, account and learning data services, and strict-complete
  Flash-to-JavaScript migrations.

The status matrix is a reader-facing summary, not an approval record. The
machine-readable [launch-gate manifest](../config/launch-gates.json),
[demo activation manifest](../config/demo-activations.json), and their
referenced blocker contracts take precedence if this summary ever drifts.
Deployment identifiers are intentionally not duplicated here; use the
[release evidence contract](./RELEASE_EVIDENCE.md),
[append-only release records](./releases/README.md), and the current
observation in [owner launch decisions](./LAUNCH_DECISIONS.md#4-delivery-governance).

## Executive conclusion

Scope A's modern public website is implemented and serving
`www.helpmath.ai`, but the end-to-end domain migration must **not** be called
complete. The legacy apex and `www` endpoints were still returning direct
`200` responses in the retained
[public-domain baseline](./DOMAIN_PUBLIC_BASELINE.md#http-behavior), all five
launch gates remain `holding`, and the owner/account evidence listed below is
still required.

Scope B is a separate product program. This repository and its deployment do
not implement or claim completion of the HELP Math 2.0 learning platform.
The two JavaScript prototypes are a tightly bounded private-review exception;
they do not turn the informational website into the product platform and do
not establish strict-complete Flash fidelity.

## Status definitions

| Status | Meaning in this matrix |
| --- | --- |
| **Completed** | Implemented and supported by retained repository or production evidence within Scope A. |
| **Operationally ready but not executed** | Engineering controls and a reviewed procedure exist, but the production action or current-commit proof has not been performed. |
| **External owner-account evidence required** | Codex and CI cannot create the required legal, rights, product, service-provider, account, DNS, mail, or release decision. |
| **Out of current website scope** | Belongs to Scope B or another workstream and is not evidence needed to say that the informational site itself has been built. |

## Scope A — public informational website

### Completed

| Deliverable | Evidence and boundary |
| --- | --- |
| Modern public application | The private repository contains a self-contained Next.js application with English at unprefixed routes and Spanish under `/es`; the implementation and verification entry points are documented in the [repository README](../README.md). |
| Public information architecture and content | The website publishes the informational About, Approach, Curriculum, Research, Resources, Demos-status, Support, and related bilingual routes. Historical claims, Boulder Learning context, HELP Math 1.0/2.0 lineage, and the bilaterally confirmed Boulder Learning–PedaNova strategic partnership are bounded in the [public content source register](./CONTENT_SOURCES.md). Proposed HELP Math 2.0 capabilities are labeled as roadmap content rather than released functionality. External-source endpoint reachability is a separate, time-bounded operational check described below. |
| Canonical new-domain delivery | `www.helpmath.ai` is the canonical production site and the apex redirects to it. Release identity and quality evidence are governed by the [deployment runbook](./DEPLOYMENT.md) and [release evidence contract](./RELEASE_EVIDENCE.md); this matrix does not copy a deployment ID that will become stale. |
| Fail-closed public demo boundary | Both demo activation switches are `false` in the [demo activation manifest](../config/demo-activations.json). Anonymous demo pages return branded, non-indexable `404` responses, while private assets and runtimes remain unavailable without the executive session. This is a completed privacy boundary, not demo publication or product acceptance; see [demo promotion boundary](./DEMO_PROMOTION.md). |
| Fail-closed legal and contact presentation | Privacy and Terms remain visibly marked as drafts and excluded from indexing, while the public contact form and delivery API remain unavailable. This is the correct implementation for the current `holding` state, not final legal publication or contact readiness; see [legal review](./LEGAL_REVIEW.md) and [contact delivery](./CONTACT_DELIVERY.md). |
| Release, rollback, and cutover engineering controls | The repository contains repeatable quality, production-smoke, release-evidence, rollback, legacy-route mapping, archive-custody, and preflight contracts. Their existence reduces execution risk but does not grant the external approvals required to use them; see the [rollback runbook](./ROLLBACK_RUNBOOK.md) and [legacy cutover plan](./LEGACY_CUTOVER.md). |

### Operationally ready but not executed

| Capability | What is ready | What remains unexecuted |
| --- | --- | --- |
| Current CEO Executive Preview verification | The signed-session boundary, two-demo scope, fail-closed runtime/asset handlers, time ceiling, handoff procedure, and credential-free lifecycle checks are implemented. Both Production credentials were rotated on 2026-07-23, current `main` was redeployed, and a focused private browser check authenticated successfully, displayed exactly two cards, and opened both assigned demos with their Play controls. | The complete fail-closed credentialed operator check bound to the exact merged Production commit remains pending until that checker is merged. The access key must remain outside the repository and be supplied only through the private procedure in [CEO executive preview handoff](./EXECUTIVE_PREVIEW_HANDOFF.md); the configured ceiling is authoritative in [executive preview window](../config/executive-preview-window.json). |
| Legacy-domain cutover | Page-level route mapping, legacy-host workbench, rollback steps, source-custody evidence, and a fail-closed preflight contract exist. | No owner-authorized host/DNS change has been executed. The retained baseline still shows the old apex and `www`, over HTTP and HTTPS, serving direct `200` responses rather than redirecting to `www.helpmath.ai`. A 2026-07-23 live check also found the historical student, teacher, school, district, and project-administrator `.aspx` routes returning unprocessed ASP.NET page directives and server-control markup; this is not code-behind source, but it makes those login surfaces a priority containment item. See [legacy cutover](./LEGACY_CUTOVER.md) and [preflight contract](./LEGACY_CUTOVER_PREFLIGHT.md). |
| Cross-network stable-link review | The finite source allowlist, fail-closed checker, and scheduled workflow are documented in [stable external link checks](./STABLE_EXTERNAL_LINKS.md). | A non-retained local check during the 2026-07-23 status review reached 10 of 16 endpoints; six official ERIC/IES/WWC endpoints returned `network-error`. A network error from one execution does **not** prove that a URL is wrong or globally broken and does not justify replacing a primary source. Recheck from an independent network and the scheduled GitHub workflow, classify every result, and retain a fresh cutover review with `zeroUnresolvedFailures` as required by the [preflight evidence contract](./LEGACY_CUTOVER_PREFLIGHT.md#evidence-artifact-envelope). |
| Launch-gate lifecycle adoption | Fail-closed evidence and lifecycle machinery for a future append-only workflow has been implemented and documented. | The checked-in manifest is still schema version 2 with all five gates `holding`. Schema-v3 adoption and any candidate/decision events require a separate reviewed authorization; implementation code cannot manufacture approval. See [launch-gate evidence](./LAUNCH_GATE_EVIDENCE.md) and [owner launch decisions](./LAUNCH_DECISIONS.md#schema-status-and-decision-authority). |
| Final release promotion | The repository defines candidate, Preview, production identity, smoke, alias, and rollback evidence requirements. | The next release must have a successful exact-commit Quality run and retained release evidence after the GitHub account issue below is resolved. A prior successful formal baseline does not retroactively pass a newer candidate. |

### External owner-account evidence required

The [launch-gate manifest](../config/launch-gates.json) is authoritative: as
checked in, `legalPublication`, `contactIntake`, `demoPublication`,
`legacyCutover`, and `productionLaunch` are all `holding`.

| Blocked decision or evidence | Required input and responsible party |
| --- | --- |
| Final legal publication | The website operator and qualified legal reviewer must confirm the operating entity, brand relationship, jurisdiction, public contacts, data practices, effective date, and semantically equivalent English and Spanish Privacy and Terms approval. Follow [legal review](./LEGAL_REVIEW.md). |
| Contact disposition and delivery | The owner may choose an approved enabled path or a reviewed disabled path with a working alternative support channel. The service/account owners must confirm Vercel, Turnstile, Resend, sender-domain, monitored-inbox, retention, access, privacy-request, abuse-control, and real post-activation evidence where applicable. Follow [contact delivery](./CONTACT_DELIVERY.md). |
| Public demo disposition | Each prototype still has `null` rights and product acceptance and an inactive switch. The named `demo-publication-authority` must decide whether an exact gate candidate remains `private` or targets `approved`. Only the `approved` public path additionally requires exact per-demo rights-owner evidence and product acceptance before activation, plus strict-complete technical evidence before indexing. A `private` disposition does not activate a demo or create either acceptance. Follow [demo promotion boundary](./DEMO_PROMOTION.md). |
| Executive Preview meeting record | The meeting owner/operator must record the approved private delivery channel, recipient acknowledgement of the no-recording/no-forwarding boundary, current credentialed verification, and the post-meeting disable or secret-rotation action. Follow [CEO executive preview handoff](./EXECUTIVE_PREVIEW_HANDOFF.md). |
| GitHub Actions execution | During the 2026-07-23 status review, GitHub reported that the open candidate's Quality jobs ended before any step ran because recent account payments failed or the spending limit required attention. This is a point-in-time, non-secret GitHub observation, not an append-only repository release record; it does not update or replace the separately documented deployed-application observation. It is an **external GitHub account blocker**, not evidence of an application test failure and not evidence of a pass. The GitHub organization/billing owner must restore Actions availability, and the release owner must rerun and record the complete workflow for whichever exact commit becomes the final candidate under the [release evidence contract](./RELEASE_EVIDENCE.md). |
| P1 legacy-login containment | A 2026-07-23 live check confirmed that the historical student, teacher, school, district, and project-administrator `.aspx` login URLs still return `200` responses containing unprocessed ASP.NET `Page`/`CodeFile` and server-control markers. The responses expose legacy filenames and form structure, **not** code-behind source, but they are not trustworthy login surfaces. The legacy-host owner should urgently replace the exact paths with the reviewed one-hop `/login` `301` rules or an explicitly approved `410`; see [legacy cutover current state](./LEGACY_CUTOVER.md#current-state). |
| Legacy host, DNS, mail, and search migration | The registrar/DNS administrator, legacy-host operator, mail owner, Search Console owner, archive custodian, change owner, and rollback owner must provide the authenticated exports, access/control evidence, mail-continuity tests, off-device archive restore, cutover window, thresholds, and approvals required by [legacy cutover](./LEGACY_CUTOVER.md). |
| Final production-launch declaration | A named release authority and rollback owner must approve the exact release only after every selected gate disposition and post-cutover check is current. `productionLaunch=holding` prevents a complete-migration claim today; see [owner launch decisions](./LAUNCH_DECISIONS.md#final-authorization). |

## Scope B — out of current website scope

The following work is important to HELP Math 2.0, but it is not completed by
shipping the public informational website:

| Product workstream | Boundary |
| --- | --- |
| HELP Math 2.0 learning product | Student accounts, teacher accounts, rostering or SSO, assignments, diagnostics, assessments, progress storage, reports, dashboards, classroom administration, AI-supported learning or teacher practice, and their production data systems are not implemented or claimed by this website repository. The source register explicitly treats them as historical features or proposed roadmap content; see [public content source register](./CONTENT_SOURCES.md). |
| Full Flash-to-JavaScript migration | FLA/SWF intake, timeline and ActionScript audit, source hashes, deterministic keyframes, audio, behavior, accessibility, visual comparison, exception records, and owner acceptance belong to the separate migration workbench. The live workbench and original Flash evidence are intentionally outside this repository and its deployment; see [demo promotion boundary](./DEMO_PROMOTION.md). |
| Strict-complete demo acceptance | A private prototype that loads successfully is not a strict-complete migration. Human visual review, original-runtime evidence, rights clearance, technical/product acceptance, and public activation are separate states. The two private prototypes remain non-public unless the exact promotion contract is satisfied. |
| Broader product launch and efficacy | The public site may accurately describe historical HELP Math 1.0 evidence and a proposed HELP Math 2.0 roadmap, but it does not establish that HELP Math 2.0 has launched or inherited HELP Math 1.0 efficacy. |

These Scope B items should have their own product requirements, privacy and
security model, acceptance matrix, and release plan. They must not be added to
the Scope A completion percentage or used to delay truthful reporting that the
informational website itself is already built.

## Actions and inputs needed next

| Priority | Responsible action or input | Enables |
| ---: | --- | --- |
| P1 | Legacy-host owner immediately replaces the student, teacher, school, district, and project-administrator `.aspx` login paths with the reviewed one-hop `/login` `301` rules, or an explicitly approved `410`, while preserving the pre-change host configuration and rollback evidence. | Contains the misleading legacy credential-entry surfaces without waiting for the broader domain cutover. |
| P2 | GitHub organization/billing owner restores Actions execution; release owner reruns the exact candidate workflow. | Trustworthy candidate Quality evidence and the next reviewed release. |
| P3 | Executive Preview operator and meeting owner perform the private current-commit check, deliver access privately, record recipient acknowledgement, and choose the close/rotation action. | CEO review evidence without changing public demo status. |
| P4 | Content/release evidence owner repeats the stable-link check from an independent network and the scheduled GitHub workflow, reviews all six local `network-error` results without assuming broken URLs, and retains a fresh cutover result with `zeroUnresolvedFailures`. | Reader-facing source reachability evidence and the stable-link prerequisite for legacy cutover. |
| P5 | Website operator and legal reviewer complete the exact identity, privacy, Terms, English, and Spanish decisions. | A real `legalPublication` decision in a separately authorized lifecycle. |
| P6 | Contact/service owners choose enabled or disabled contact disposition and provide the corresponding inbox/provider/privacy evidence. | A safe contact dependency for cutover; enabled intake only after its separate production verification. |
| P7 | The named `demo-publication-authority` chooses `private` or `approved` for the exact gate candidate. For an `approved` public path only, the rights owner and product-acceptance authority also provide exact per-demo acceptance evidence. | A reviewed private disposition without activation, or an independently evidenced future public-demo proposal. |
| P8 | DNS, legacy-host, mail, Search Console, archive, change, and rollback owners provide the complete preflight package and approve a cutover window. | One-hop legacy redirects, continuity checks, rollback readiness, and post-cutover verification. |
| P9 | Final release authority records the exact production decision after every dependency is effective. | `productionLaunch` may be resolved and the end-to-end website migration may finally be called complete. |
