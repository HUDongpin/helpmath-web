# Legacy-domain cutover

## Current state

The modern site is live at `https://www.helpmath.ai`. The historical site at
`https://www.helpprogram.net` remains on its existing host. Do not move the old
domain until the legal review and verified contact-delivery gates in
`DEPLOYMENT.md` are complete.

The Next.js project already returns permanent redirects for the audited legacy
paths. `tests/legacy-redirects.test.ts` verifies the complete mapping and the
Playwright suite verifies representative `308` responses through a production
build.

## Audited page mapping

| Historical path | Canonical destination |
| --- | --- |
| `/Home.htm`, `/Index.htm` | `/` |
| `/About.htm`, `/ProgramInfo.htm`, `/Kf.htm` | `/about` |
| `/AcademicLanguage.htm`, `/Ped.htm`, `/SIOP.htm`, `/Sheltered Instruction.wmv` | `/approach` |
| `/Content.htm`, `/Standards.htm`, the root CCS correlation PDFs, `/HELP_Alignment_CO.pdf` | `/curriculum` |
| `/Evidence.htm`, `/Awards.htm`, `/Testimonials.htm`, the root evaluation/research PDFs | `/research` |
| `/Resources.htm` | `/resources` |
| `/Sales.htm`, `/Trial.htm`, `/Purchasing.htm`, `/PurchaseInfo.htm`, `/Contact.htm`, `/trial_register.aspx` | `/contact` |
| `/Login.htm`, `/district_login.aspx`, `/school_login.aspx`, `/student_login.aspx`, `/teacher_login.aspx`, `/user_studentlogin.aspx` | `/login` |
| `/TechSpecs.htm` | `/support` |
| `/HELP Math Privacy Policy 3.12.07.pdf` and `.doc` | `/privacy` |
| `/Demo.htm`, `/shortdemo/*` | `/demos` |
| `/PR/*` | `/research` |
| `/DealerDocs/*`, `/teacher_guide/*` | `/resources` |
| `/Beta/*` | `/curriculum` |

The crawl intentionally keeps two exceptions out of production redirects:

- `/Images/Help_Slideshow.swf` remains a modern `404`; raw Flash must not be
  served while a reviewed JavaScript replacement is unavailable.
- `/0214 Sunburst and BLI Form partnership for HELP Math2.pdf` is already a
  broken `404` on the historical host and has no unambiguous modern target.
  Record an editorial decision in `LAUNCH_DECISIONS.md` before adding a
  permanent redirect.

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
| Prior TTL and any planned TTL reduction time | Pending |
| MX/SPF/DKIM/DMARC and ownership-record comparison | Pending |
| Old mailbox continuity test | Pending |
| Release commit and Vercel deployment ID | Pending |
| Chosen one-hop or temporary two-hop topology | Pending |
| Quantitative rollback threshold | Pending |
| Search Console owners for both domains | Pending |

## Cutover checklist

1. Complete the relevant legal, rights, contact, mail, and release fields in
   `LAUNCH_DECISIONS.md`.
2. Confirm administrative control of both `helpprogram.net` and
   `www.helpprogram.net`, then export the complete DNS zone and prior website
   records. Preserve MX, SPF, DKIM, DMARC, and ownership-verification records.
3. Confirm that every old mailbox which must remain available can send and
   receive before the change. DNS preservation alone does not prove mailbox
   continuity.
4. Record any planned TTL reduction early enough for the previous TTL to
   expire. Change only website records during the cutover.
5. Implement the preferred direct path rules on the old host. If the provider
   permits only a host-wide path-preserving redirect, record the temporary
   two-hop exception before attaching old apex and `www` to the new service.
6. Probe old apex and `www` over HTTP and HTTPS. For each origin, verify `/`,
   `/Home.htm`, `/Contact.htm?source=cutover`, the historical privacy PDF,
   samples under `/PR/`, `/DealerDocs/`, `/teacher_guide/`, `/shortdemo/`, and
   `/Beta/`, the intentionally unavailable SWF, and a true unknown path.
7. Retain status, `Location` headers, redirect-hop count, final canonical URL,
   query preservation, TLS result, and response body type. There must be no
   loop, downgrade, raw Flash delivery, or unknown-path soft `200`.
8. Submit the new sitemap and, when available for the site configuration, the
   domain-move signal in the relevant Search Console properties. Monitor crawl
   errors, indexing, and redirect chains.
9. Roll back the website records if the approved threshold is crossed, or
   immediately for a TLS failure, redirect loop, sustained `5xx`/timeout from
   independent probes, or an unintended mail-record change. Keep the old
   values until the recorded monitoring window closes successfully.
