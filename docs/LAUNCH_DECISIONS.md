# Owner launch decisions

This file is the non-secret decision record for the HELP Math public website.
It is an implementation gate, not legal advice. Never place API keys, DNS
credentials, private contracts, student information, or personal records here.
Store sensitive evidence in an owner-approved system and record only its name
or reference.

The machine-readable mirror is
[`config/launch-gates.json`](../config/launch-gates.json). Run
`npm run check:launch-gates` after every decision update. This repository
revision is locked to the all-`holding` state: every attempted approval fails
build validation even when its proposed evidence is structurally complete.
The dependency graph and preparatory evidence requirements are fixed in code
rather than trusted from the manifest.
Follow [`LAUNCH_GATE_EVIDENCE.md`](./LAUNCH_GATE_EVIDENCE.md) for the non-secret
envelope contract and required follow-up lifecycle work. The manifest makes
unresolved state fail closed; it does not authenticate an approver or replace
counsel, rights-owner, provider, DNS, mail, or release evidence. Do not change a
gate away from `holding` until a separate reviewed change removes the code-level
transition lock and implements every listed intermediate and terminal state.

## Operational holding state while decisions are open

This state prevents accidental data intake and premature domain cutover. It is
not a legal safe harbor or evidence that public demo rights have been cleared.

- Privacy and Terms remain visibly marked as drafts, send `noindex, follow`,
  and stay outside the sitemap.
- The contact form remains unavailable and the API fails closed.
- A Vercel environment flag cannot open contact intake by itself. Both
  `legalPublication` and `contactIntake` must be approved in the repository
  before `NEXT_PUBLIC_CONTACT_ENABLED=true` is honored.
- `helpprogram.net` remains on its existing host.
- Demo prototypes and extracted assets remain private. Their former public
  routes now return non-indexable `404` responses until written publication
  rights and technical acceptance are documented.
- An explicitly time-boxed CEO Executive Preview may temporarily expose only
  the two named prototypes behind the signed-session boundary. This internal
  review exception does not change either demo's public publication status.
- The private legacy payload remains local until unused Git LFS capacity is
  confirmed separately in the archive repository.

## 1. Responsible identity and legal review

Complete every field before removing the legal-draft boundary.

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Full legal name and organization type of the website operator/data controller | Pending | Pending |
| Registration country/state and public or counsel-approved contact address | Pending | Pending |
| Relationship of “HELP Math” to that entity: brand, DBA, trademark, or project name | Pending | Pending |
| Privacy-request email and general support email | Pending | Pending |
| Whether a public telephone number is required | Pending | Pending |
| Governing law, venue, and whether arbitration applies | Pending | Pending |
| Service scope: United States only or international | Pending | Pending |
| Final effective date for Privacy and Terms | Pending | Pending |
| English legal copy approval | Pending | Pending |
| Spanish legal copy approval | Pending | Pending |

Historical pages are not sufficient evidence of the current operator. The old
[Contact page](https://www.helpprogram.net/Contact.htm) names Boulder Learning,
Inc.; the old [Login page](https://www.helpprogram.net/Login.htm) and
[privacy PDF](https://www.helpprogram.net/HELP%20Math%20Privacy%20Policy%203.12.07.pdf)
name Digital Directions International, Inc. The current relationship and any
transfer or license must be confirmed by the owner. Before changing the old
host, retain a private archived copy, SHA-256, or other stable evidence
reference; a live legacy URL alone is not a durable record.

## 2. Privacy and contact data flow

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Confirm production vendors: Vercel, Cloudflare Turnstile, and Resend | Pending | Pending |
| List any analytics, Speed Insights, cookies, CDN, logging, or monitoring added beyond those vendors | Pending | Pending |
| Retention period for contact messages | Pending | Pending |
| Retention period for Resend delivery records | Pending | Pending |
| Retention period for Vercel logs and Turnstile signals | Pending | Pending |
| Data-processing locations and any required cross-border transfer mechanism | Pending | Pending |
| People or roles allowed to access contact messages | Pending | Pending |
| Process and verifier for access, correction, and deletion requests | Pending | Pending |
| Confirm that contact is presented as adult-intended but has no age verification; decide whether another control is required | Pending | Pending |
| Confirm `support@helpmath.ai` exists and is monitored, or provide the approved alternative | Pending | Pending |
| Decide whether old `helpprogram.net` mailboxes remain, forward, or close | Pending | Pending |
| Alternative privacy-request channel while the form is unavailable | Pending | Pending |
| Provider or edge rate-limit rule for `/api/contact` | Pending | Pending |

Configure these names in protected Vercel settings for Preview and Production;
record only completion and test evidence here, never their values:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONTACT_ENABLED` (set `true` only after every contact gate passes)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_ALLOWED_HOSTNAMES` (comma-separated, non-secret allowlist)
- `RESEND_API_KEY`
- `SUPPORT_TO_EMAIL`
- `SUPPORT_FROM_EMAIL`

The sender domain must be verified without replacing existing MX, SPF, DKIM,
DMARC, or ownership-verification records. Record a real end-to-end delivery
test, Reply-To test, abuse rejection test, and approver before enabling the
form.

## 3. Rights and public demo approval

Record the authority or evidence reference for each category:

- HELP Math name, marks, logo, course text, FLA/SWF, illustrations, audio,
  fonts, historical PDFs, and third-party materials.
- The relationship or rights transfer among Boulder Learning, Digital
  Directions International, and the current project operator.
- The owner of the new website code, visual design, and copy.
- Permission and citation evidence for historical quotations, testimonials,
  awards, and research claims.
- The allowed public uses: viewing, classroom display, copying, downloading,
  republishing, modification, localization, and accessibility adaptation.
- Territory, term, attribution, and takedown process.

Each demo requires its own written approval covering public display, JavaScript
adaptation, Spanish localization, PNG derivatives, and Vercel/CDN distribution:

| Demo | Source and derivative evidence | Rights approver / date | Product acceptance / date |
| --- | --- | --- | --- |
| `conversion-1-2` | `demos/candidates/conversion-1-2.json`, legacy snapshot, and workbench migration record | Pending | Pending |
| `conversion-1-4` | `demos/candidates/conversion-1-4.json`, legacy snapshot, and workbench migration record | Pending | Pending |

The repository now separates immutable candidates, private review, rights and
product acceptance, and public activation. Its conservative default requires
both acceptance records and the `demoPublication` gate before any public
route; `strict-complete` remains additionally required for indexing. The
current holding-only gate lock makes every activation fail closed. The owner
must still decide whether a future policy may permit a rights-cleared,
non-indexed `conditional` preview or whether the conservative default is
permanent. Until that decision and a separately reviewed transition-lock
change are complete, keep both activations `false` regardless of new evidence:

| Demo publication policy decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Permit rights-cleared conditional public preview, or require technical/product acceptance before any public route | Pending | Pending |

The application implements the temporary-removal state for both previously
online demos. Record pre-existing authorization evidence or a new approval
before adding either acceptance envelope or changing an activation in
`config/demo-activations.json`. Never mutate a candidate digest to make old
evidence fit. A `conditional` technical label does not resolve copyright or
license questions.

Source hashes and fidelity evidence prove provenance and behavior; they do not
by themselves prove publication rights.

Public history, research, and collaborator statements are tracked in
`docs/CONTENT_SOURCES.md`. Boulder Learning and PedaNova have bilaterally
confirmed that they are strategic partners for the modernization of HELP Math
1.0 into HELP Math 2.0. Dr. Peter Hu, CEO of PedaNova, instructed on 2026-07-21
that this jointly confirmed relationship be stated publicly as fact. This
approval does not release Boulder Learning’s confidential two-module strategy;
publishing those internal details still requires Boulder Learning’s separate
written public-release approval.

### CEO Executive Preview decision record

Internal executive review authorization is not public-display permission,
copyright or license clearance, strict fidelity validation, technical/product
acceptance, or approval to forward, record, republish, or distribute the
prototypes. Keep the two demos private after the meeting unless every public
promotion gate in `DEMO_PROMOTION.md` is independently satisfied.

Record references only; never record an access passphrase, signing secret, or
session cookie here.

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Named executive audience and purpose of the review | CEO and Chairman John Ramo; internal JavaScript prototype review | HELP Math project researcher/software engineer request / 2026-07-21 |
| Approved demo scope: `conversion-1-2` and `conversion-1-4` only | Project-team-requested scope; public status remains unchanged | HELP Math project researcher/software engineer request / 2026-07-21 |
| Public discoverability of the restricted review entry | The public Demos status page may link only to the locale-specific bare entry/status route. The route fails closed outside an approved review window and must not expose a passphrase, session value, direct demo route, runtime, asset path, or demo content; it does not change the demos' private publication status. | Engineering implementation under the named-executive review request / 2026-07-22 |
| Review start and absolute expiry time | Configured for the Production review. Production closes `2026-07-28T15:59:00Z` (`2026-07-28 23:59` China Standard Time). `config/executive-preview-window.json` enforces that timestamp for Production, Preview, missing, and unknown deployment contexts while allowing an earlier safe close; only exact local `development` may use a later test fixture. The credential-free scheduled lifecycle smoke checks the boundary every six hours. | Engineering configuration and repository enforcement / 2026-07-22 |
| Private channel used to deliver the access passphrase | Pending (channel name only; never the value). Follow `EXECUTIVE_PREVIEW_HANDOFF.md`. | Pending |
| Confirm session maximum is 12 hours and bounded by the global expiry | Implemented and covered by unit and local browser checks. An earlier credentialed production check validated both entries, 12 private images, and 2 private runtimes, but the current production commit's retained smoke did not request authentication and no raw current-commit credentialed result was retained. Repeat the private check in `EXECUTIVE_PREVIEW_HANDOFF.md` before the CEO review. | Engineering verification and evidence clarification / 2026-07-21 |
| Vercel WAF rate limit on executive session POST (IP, 15 requests / 10 minutes, default `429`) | Published rule `rule_executive_preview_session_post_limit_e7i95N`: exact path + POST, fixed window, IP, 15 requests / 600 seconds, default rate-limit action. In the production probe, requests 1–7 received the application’s expected `303`, request 8 onward received `429`, request 16 received `429`, and a follow-up edge response included `X-Vercel-Mitigated: deny`. Application defense in depth separately blocks the eighth failed attempt per warm instance. | Engineering configuration and production verification / 2026-07-21 |
| Post-meeting action: disable access or rotate passphrase and signing secret | Pending. The default close and verification procedure is in `EXECUTIVE_PREVIEW_HANDOFF.md`. | Pending |
| Confirm no recording, forwarding, republication, or public presentation was authorized | Pending. Obtain and record the recipient's acknowledgement using `EXECUTIVE_PREVIEW_HANDOFF.md`; never store the passphrase or cookie. | Pending |
| Separate rights/publication approval | Pending; not granted by this executive review | Pending |
| Separate technical and product acceptance | Pending; not granted by this executive review | Pending |

The Vercel review environment requires four server-only settings:
`EXECUTIVE_PREVIEW_ENABLED`, `EXECUTIVE_PREVIEW_ACCESS_KEY`,
`EXECUTIVE_PREVIEW_SESSION_SECRET`, and `EXECUTIVE_PREVIEW_EXPIRES_AT`.
Record only that each was configured for the intended environment and that the
fail-closed checks passed. `SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY` must be
injected only into the operator's local, temporary command environment for the
single verification process; it must not be persisted in Vercel, GitHub, any
file, shell history, retained command output, or this record.

## 4. Delivery governance

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Keep automatic `main` production assignment, or require manual promotion | Pending | Pending |
| GitHub Pro upgrade for required PR checks on the private repository, or documented manual control | Pending | Pending |
| Release owner and rollback owner | Pending | Pending |
| Most recent application release baseline (historical evidence gaps disclosed) | Localized-error-recovery and keyboard-resilience release commit `f297d0230264577b19f5f06274bd802a6e725b48`; GitHub/Vercel Production deployment `5552454732` / `FirM93JbPzFneEXQX4UWJZdN9XYn`; Production Quality run `29905358787` and production smoke run `29905407356` passed; authenticated alias evidence is `docs/evidence/vercel-production-alias-2026-07-22-pr32.json`. `docs/releases/2026-07-22-pr32.md` records the exact candidate, Preview, Production, READY-only canonical alias transition, Chromium/Firefox/desktop and mobile WebKit, seven visual baselines, five-route Lighthouse budgets, private/public demo boundary, and zero-failure public smoke while disclosing the protected-Preview semantic-smoke, current authenticated-playback, no-JavaScript mobile-navigation, and custody gaps. Each later release must retain its own PR/Vercel evidence rather than silently overwriting this baseline. | Engineering release / 2026-07-22 |

Until private-repository branch protection is available, every production
change should still use a PR, wait for the complete `Quality` workflow, and
record the exact merged commit and deployment.

## 5. Legacy-domain and mail cutover

Complete the operational details in `LEGACY_CUTOVER.md` and record:

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Public DNS, HTTP, and TLS observation before cutover | Point-in-time evidence is retained in `docs/DOMAIN_PUBLIC_BASELINE.md` and `docs/evidence/domain-public-baseline-2026-07-21.json`. It confirms the old host had not redirected and records the seven visible MX and two TXT values. It is not a complete zone export, administrator/control proof, mail-continuity test, Vercel alias binding, or Search Console proof. | Engineering observation / 2026-07-21 |
| Registrar and DNS administrator for apex and `www` | Pending | Pending |
| Complete DNS export and website-record rollback values | Pending | Pending |
| MX/SPF/DKIM/DMARC and mailbox continuity owner | Pending | Pending |
| Cutover window, timezone, monitoring window, and rollback threshold | Pending | Pending |
| Google Search Console owners for both domains | Pending | Pending |
| Whether `/Sales.htm` should end at `/contact` or `/resources` | Pending | Pending |
| Final destination for the broken historical partnership PDF | Pending | Pending |

Do not call the domain migration complete until old apex and `www`, HTTP and
HTTPS, representative paths, query preservation, unknown-path behavior, TLS,
mail continuity, and Search Console checks all have retained evidence.

## Final authorization

| Gate | Approver | Date | Evidence reference |
| --- | --- | --- | --- |
| Legal and privacy | Pending | Pending | Pending |
| Rights and demos | Pending | Pending | Pending |
| Contact delivery | Pending | Pending | Pending |
| Legacy-domain cutover | Pending | Pending | Pending |
| Production release | Pending | Pending | Pending |

Completing a row records an external decision but does not unlock the current
manifest. Only after a separate reviewed lifecycle implementation removes the
holding-only transition lock may a later change update the matching gate. Do
not delete `Pending` text or set a gate to `approved` in anticipation of
evidence. `productionLaunch` remains `holding` while the lock is active or any
required decision is unresolved.
