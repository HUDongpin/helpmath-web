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
| `/About.htm`, `/ProgramInfo.htm` | `/about` |
| `/AcademicLanguage.htm`, `/Ped.htm`, `/SIOP.htm` | `/approach` |
| `/Content.htm`, `/Standards.htm` | `/curriculum` |
| `/Evidence.htm`, `/Awards.htm`, `/Testimonials.htm` | `/research` |
| `/Resources.htm` | `/resources` |
| `/Sales.htm`, `/Trial.htm`, `/Purchasing.htm`, `/PurchaseInfo.htm`, `/Contact.htm` | `/contact` |
| `/Login.htm` | `/login` |
| `/TechSpecs.htm` | `/support` |
| `/Demo.htm`, `/shortdemo/*` | `/demos` |
| `/PR/*` | `/research` |
| `/DealerDocs/*` | `/resources` |
| `/Beta/*` | `/curriculum` |

## Cutover checklist

1. Export the current DNS zone and record the historical host's rollback
   values. Preserve MX, SPF, DKIM, DMARC, and ownership-verification records.
2. Confirm administrative control of both `helpprogram.net` and
   `www.helpprogram.net`.
3. Attach both hosts only after the release gates pass. Configure a permanent
   host redirect to `https://www.helpmath.ai` while preserving path and query.
4. Probe every audited mapping over both HTTP and HTTPS. The final response
   must be a permanent redirect to the canonical HTTPS destination, with no
   loop and no raw Flash delivery.
5. Verify `/PR/*`, `/DealerDocs/*`, `/shortdemo/*`, and `/Beta/*` samples, plus
   a true unknown path that must end in the modern non-indexable `404`.
6. Submit the new sitemap in the relevant search-console property and monitor
   crawl errors, indexing, and redirect chains.
7. Keep the historical host rollback values until logs show a stable cutover.

