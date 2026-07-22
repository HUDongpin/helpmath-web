# Legacy-domain cutover

## Current state

The modern site is live at `https://www.helpmath.ai`. The historical site at
`https://www.helpprogram.net` remains on its existing host. Do not move the old
domain until the legal review and verified contact-delivery gates in
`DEPLOYMENT.md` are complete.

The Next.js project defines permanent redirects for the audited legacy paths.
`next.config.ts` is the runtime authority. `tests/legacy-redirects.test.ts` and
the Playwright suite are release gates for the complete mapping and
representative `308` responses; any mapping change is incomplete until both
suites are synchronized and pass against a production build.

For the preferred direct one-hop old-host topology, the operational handoff is
the generated Apache 2.4 package in `ops/legacy-host/`. It is derived from the
same `next.config.ts` authority, fails closed for unlisted files, and must pass
`npm run check:legacy-apache`, `npm run test:legacy-apache`, and the actual
host's `httpd -t` before installation. Preparing this package does not deploy
it or authorize a DNS change.

`LEGACY_RESOURCE_MAP.md` records the editorial reason, preferred stable source,
and rights disposition for high-value historical documents. Complete its
source-custody work before redirecting the old domain: a live legacy URL will
become circular evidence once it points back to the modern page.

## Audited page mapping

| Historical path | Canonical destination |
| --- | --- |
| `/Home.htm`, `/Index.htm` | `/` |
| `/About.htm`, `/Kf.htm`, `/Mph.htm`, `/Mth.htm`, `/Csh.htm`, `/Bah.htm`, `/Bdh.htm` | `/about` |
| `/ProgramInfo.htm`, `/Content.htm` | `/curriculum#help-math-1-catalog` |
| `/AcademicLanguage.htm`, `/Ped.htm`, `/SIOP.htm`, `/Sheltered.htm`, `/Sheltered Instruction.wmv` | `/approach` |
| `/Standards.htm`, `/As.htm`, the root CCS correlation PDFs, `/HELP_Alignment_CO.pdf` | `/curriculum` |
| `/Evidence.htm`, `/Awards.htm`, `/Testimonials.htm`, `/PR.htm`, `/Rb.htm`, `/onlineprogram.html`, the root evaluation/research/award PDFs | `/research` |
| Root CODiE award PDF and release | `/resources#codie-past-winners` |
| `/Resources.htm`, `/Tst.htm`, `/Pd.htm`, `/Sales.htm` | `/resources` |
| `/Trial.htm`, `/Purchasing.htm`, `/PurchaseInfo.htm`, `/Contact.htm`, `/Pricing.htm`, `/Gfs.htm`, `/trial_register.aspx` | `/contact` |
| `/Login.htm`, `/district_login.aspx`, `/school_login.aspx`, `/student_login.aspx`, `/teacher_login.aspx`, `/user_studentlogin.aspx`, `/student_register.aspx`, `/teacher_register.aspx`, `/trialuser_login.aspx`, `/Project_Admin_Login.aspx` | `/login` |
| `/TechSpecs.htm`, `/Ti.htm` | `/support` |
| `/Privacy.htm`, `/HELP Math Privacy Policy 3.12.07.pdf` and `.doc` | `/privacy` |
| `/Demo.htm`, `/shortdemo/*` | `/demos` |
| `/PR/*` | `/research` |
| Exact DealerDocs evaluation and marketing summary | `/research#help-math-pilot` or `/research#wwc-tran-study`, according to source |
| Exact DealerDocs sheltered-instruction, SPED, and academic-language papers | `/approach#support-layers` |
| Exact DealerDocs scope, reports, and RtI files; teacher guide v3.1.2 | `/curriculum#help-math-1-catalog` |
| Exact DealerDocs WWC, DOI-linked study, ERIC-linked article, media report, and brochure files | Matching `/resources#...` record listed in `LEGACY_RESOURCE_MAP.md` |
| Other `/DealerDocs/*`, `/teacher_guide/*` paths | `/resources` |
| `/Beta/*`, `/beta/*` | `/curriculum` |

The crawl intentionally keeps two exceptions out of production redirects:

- `/Images/Help_Slideshow.swf` remains a modern `404`; raw Flash must not be
  served while a reviewed JavaScript replacement is unavailable.
- `/0214 Sunburst and BLI Form partnership for HELP Math2.pdf` is already a
  broken `404` on the historical host and has no unambiguous modern target.
  Record an editorial decision in `LAUNCH_DECISIONS.md` before adding a
  permanent redirect.

This mapping was expanded on 2026-07-21 by auditing 44 historical page
endpoints and 92 same-origin navigation or embedded-object references,
including the dynamic entries in `/Menu.js` and links in `/PR.htm`. `/Bdh.htm`
is retained as a defensive mapping because its old endpoint still returns
`200`, although its menu entry was commented out. Unknown paths remain true
non-indexable `404` responses rather than being redirected to the home page.

The page/reference counts describe that crawl, not the number of redirect
rules. Exact document routes may be added ahead of a wildcard without changing
the original crawl count. Use the exported crawl and `next.config.ts`, rather
than a count copied into prose, to determine current coverage.

## Source-preservation gate

Domain cutover must not erase the evidentiary trail behind the modern history
and research pages. Before DNS or old-host redirect changes:

1. Inventory each `helpprogram.net` page or document cited by public copy.
2. Preserve the reviewed bytes in an owner-controlled archive and record the
   original URL, filename, capture date, SHA-256, size, document date, and
   version where known.
3. Record the rights owner, public-republication decision, third-party-content
   review, and accessibility status separately from source custody.
4. Record the preferred stable external agency, ERIC, DOI, award-owner, or
   publisher source when one exists. Link to it rather than copying it unless
   republication permission is documented.
5. Confirm that no public claim relies only on an old-domain backlink. After
   cutover, that backlink may resolve to the claim itself and become circular.

Completion of this gate does not authorize public PDF downloads. It preserves
the evidence needed for editorial and rights review.

## Redirect topology

Prefer one permanent hop from each historical URL to its final canonical URL:

```text
https://www.helpprogram.net/Ped.htm
  -> https://www.helpmath.ai/approach
```

Implementing only a host-wide path-preserving redirect would instead produce
`helpprogram.net/Ped.htm -> helpmath.ai/Ped.htm -> helpmath.ai/approach`.
That two-hop fallback is functional because the Next.js rules are already
tested, but it is not the preferred final SEO topology. If the historical host
can serve path rules, point the audited paths directly at their canonical
destinations. Do not redirect a true unknown path to the home page; it must end
as a non-indexable `404`.

## Cutover record

Complete this record in an owner-approved operational system before editing
DNS. Do not store registrar credentials or mail secrets in the repository.

| Field | Recorded value or evidence reference |
| --- | --- |
| Change owner and rollback owner | Pending |
| Local and UTC cutover window | Pending |
| Expected monitoring window | Pending |
| DNS export and prior website A/AAAA/CNAME values | Pending |
| Public DNS, HTTP, and TLS observation | `docs/DOMAIN_PUBLIC_BASELINE.md` and `docs/evidence/domain-public-baseline-2026-07-21.json`; the 2026-07-21 snapshot records the old host still serving four direct `200` responses, the visible website records, seven Google MX records, two TXT values, and both certificate fingerprints. This does not satisfy the complete-zone export, administrator/control, mail-continuity, Vercel alias-binding, or Search Console gates. |
| Prior TTL and any planned TTL reduction time | Pending |
| MX/SPF/DKIM/DMARC and ownership-record comparison | Pending |
| Old mailbox continuity test | Pending |
| Release commit and Vercel deployment evidence | Pre-cutover baseline: `f29d7e003811e78b58e482d113bba56fa4f808e1`; GitHub deployment `5555746655`; Vercel deployment locator `EfquxEu2Y5o8BRYrvzpGJV5WJhmN`; successful same-commit Quality run `29921608812`; successful production-smoke run `29921664873`; authenticated canonical alias evidence `docs/evidence/vercel-production-alias-2026-07-22-pr39.json`; see `docs/releases/2026-07-22-pr39.md`. Replace with the final reviewed cutover candidate before DNS changes. |
| Chosen one-hop or temporary two-hop topology | Pending |
| Legacy source archive manifest and hash record | Local pre-cutover capture: 23/23 governed locators, 23 content-addressed objects, 14,280,549 bytes. Metadata evidence is in `docs/evidence/legacy-source-crawl-2026-07-21.{json,csv,sha256}`; JSON SHA-256 `9e12d758ff2b0d37805da1d1f34cfcfad4a45e517c86831248df59015882927a`. Archive closure passed for 27 files. A deterministic restricted local recovery package and fresh-directory same-machine restore drill passed; bundle SHA-256 `bcc030474eda6d99aade0b9012c5645b47f819b244acc22da0069c4e0736928e`, receipt `docs/evidence/legacy-source-recovery-2026-07-21.json`. Original bytes and the recovery package remain local. Encrypted off-device custody and an independent restore remain pending. |
| Rights/accessibility disposition for owner-held PDFs | Pending |
| External-source link review and resource-map revision | 2026-07-21 baseline complete in `LEGACY_RESOURCE_MAP.md` and `data/legacy-source-registry.json`; repeat immediately before cutover. |
| Quantitative rollback threshold | Pending |
| Search Console owners for both domains | Pending |

## Executable preflight

**Current revision:** the code-level holding-only transition lock makes every
invocation return `NO_GO` with exit code `2`, even if all historical preflight
inputs are structurally complete. The `GO_TO_CHANGE` contract below is dormant
design documentation for a future reviewed lifecycle; it cannot authorize a
cutover in this revision.

Run the fail-closed preflight from the exact clean release commit before any
legacy-host or DNS change:

```bash
npm run preflight:legacy-cutover -- \
  --plan /owner-approved/legacy-cutover-plan.json \
  --evidence-dir /owner-approved/append-only-receipts
```

The exact plan, evidence-envelope, required-check, freshness, and exit contract
is documented in `LEGACY_CUTOVER_PREFLIGHT.md`.

The plan must live outside the repository, explicitly choose `direct-one-hop`
or `temporary-two-hop`, pin the full repository commit and Vercel deployment,
resolve `/Sales.htm`, name change/rollback/DNS/mail/Search Console owners,
define the UTC monitoring window and structured rollback thresholds, and record
the nine required decisions as machine-readable approvals. It must reference
fourteen non-secret JSON evidence artifacts by absolute external path,
SHA-256, and observation time: before/proposed DNS zones, mail continuity,
verified production contact delivery, Search Console control, off-device
archive restore, rights/accessibility disposition, a fresh stable-link review,
Production alias assignment, Quality,
Production smoke, a staged target-host config test, and fresh pre-cutover DNS
plus HTTP/TLS baselines.

The preflight reads every referenced artifact and the retained underlying
collector output to which it points. It resolves real paths, rejects repository
paths, symbolic-link terminals, permissive files, and oversized inputs, then
recomputes both SHA-256 values and validates exact evidence kind,
cutover/deployment/commit/topology identity, `pass` status, required check IDs,
and permitted age. Pre-cutover DNS and HTTP/TLS receipts expire after 15
minutes; most release and operational receipts expire after 24 hours; Search
Console control expires after 7 days and the independent off-device restore
and rights/accessibility disposition after 30 days. Credential-shaped fields
or values are rejected.

The command reruns the repository launch-gate, generated Apache, local Apache
2.4 contract, and metadata source-custody checks; confirms the clean worktree
and plan commit; requires `legalPublication`, `contactIntake`, and
`legacyCutover` approval; validates all nine machine-readable plan decisions;
and binds every external receipt to the planned topology, deployment, and
commit. A zero-exit `GO_TO_CHANGE` requires successful creation of a private
`0600`, content-addressed JSON receipt and companion SHA-256 in a pre-existing
absolute external directory that grants no group or other access. The receipt
contains a `validUntil` deadline and must not be used to begin a change after
it. Any failed or
missing check, terminated/timed-out child command, receipt failure, or absent
receipt store yields `NO_GO` and exit code `2`.

This is a pre-change authorization command. Its DNS and HTTP/TLS inputs prove
the unchanged public baseline and target readiness, not the post-change
redirect result. The post-change probes and rollback decision in the checklist
below remain mandatory. This command verifies typed, owner-approved receipts;
it does not itself log
in to the registrar, mail provider, Search Console, Vercel, or the legacy host,
and it does not substitute for those evidence collectors. Full zone exports,
mail receipts, and probe details belong in the owner-approved restricted store,
not the repository. There is no force or success-on-`NO_GO` option.

## Cutover checklist

1. Complete the relevant legal, rights, contact, mail, and release fields in
   `LAUNCH_DECISIONS.md`, plus the source-preservation gate above.
2. Confirm administrative control of both `helpprogram.net` and
   `www.helpprogram.net`, then export the complete DNS zone and prior website
   records. Preserve MX, SPF, DKIM, DMARC, and ownership-verification records.
3. Confirm that every old mailbox which must remain available can send and
   receive before the change. DNS preservation alone does not prove mailbox
   continuity.
4. Record any planned TTL reduction early enough for the previous TTL to
   expire. Change only website records during the cutover.
5. Review `ops/legacy-host/README.md`, run `npm run check:legacy-apache` and
   `npm run test:legacy-apache`, choose exactly one generated deployment form,
   back up the actual virtual-host configuration, install the direct path
   rules, and run `httpd -t` before reload. If the provider permits only a
   host-wide path-preserving redirect, record the temporary two-hop exception
   before attaching old apex and `www` to the new service.
6. Probe old apex and `www` over HTTP and HTTPS. For each origin, verify `/`,
   `/Home.htm`, `/Contact.htm?source=cutover`, the historical privacy PDF,
   samples under `/PR/`, the exact document routes in
   `LEGACY_RESOURCE_MAP.md`, wildcard fallbacks under `/DealerDocs/` and
   `/teacher_guide/`, `/shortdemo/`, `/Beta/`, and `/beta/`, the
   intentionally unavailable SWF, and a true unknown path.
7. Retain status, `Location` headers, redirect-hop count, final canonical URL,
   query preservation, fragment preservation for deep routes, target-element
   existence, TLS result, and response body type. There must be no loop,
   downgrade, raw Flash delivery, missing deep-link target, or unknown-path
   soft `200`.
8. Submit the new sitemap and, when available for the site configuration, the
   domain-move signal in the relevant Search Console properties. Monitor crawl
   errors, indexing, and redirect chains.
9. Roll back the website records if the approved threshold is crossed, or
   immediately for a TLS failure, redirect loop, sustained `5xx`/timeout from
   independent probes, or an unintended mail-record change. Keep the old
   values until the recorded monitoring window closes successfully.
