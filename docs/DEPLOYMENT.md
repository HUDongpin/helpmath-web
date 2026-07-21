# Deployment runbook

## Release gate

1. Require the GitHub `Quality` workflow on `main`.
2. Review Privacy and Terms with the project owner or qualified counsel.
3. Configure all variables from `.env.example` in Vercel. Use separate
   Turnstile widgets and Resend credentials for Preview and Production. Keep
   `NEXT_PUBLIC_CONTACT_ENABLED=false` until every contact gate passes.
4. Verify the Resend sender without replacing existing MX, SPF, DKIM, or DMARC
   records.
5. Configure a provider or edge rate limit for `/api/contact`; the route also
   validates Turnstile action and hostname and rejects non-JSON or oversized
   bodies.
6. Deploy a protected Preview, bind it to the exact private-repository commit
   using the authenticated checks in `RELEASE_EVIDENCE.md`, and run the browser
   suite and release smoke against that Preview with the automation bypass
   secret supplied only through the local environment.
7. Promote manually only after the closed contact contract, bilingual
   navigation, private-demo route/asset boundary, metadata, accessibility, and
   raw-Flash 404 probes pass.

After promotion, run `npm run smoke:production` against the canonical domain.
This checks the exact sitemap set, metadata and reciprocal language alternates,
internal links, legacy and `/en` redirects, branded 404 policy, draft indexing,
private demo routes/assets/optimizer paths, static assets, security headers,
the closed contact contract,
and the apex/www HTTP/HTTPS matrix. Keep the JSON result with the release
record; a successful Preview result does not replace the Production run.

Record the owner inputs and approvals in
[`LAUNCH_DECISIONS.md`](./LAUNCH_DECISIONS.md). Secret values belong only in
the relevant provider's protected settings, never in the repository.

Unless `NEXT_PUBLIC_CONTACT_ENABLED=true` and a public Turnstile key are both
present, the contact page intentionally shows an unavailable notice and
renders no form. The API independently requires the same enable flag and fails
closed. Set the flag to `true` last, then redeploy; `NEXT_PUBLIC_*` values are
embedded into the client build.

Until release-gate item 2 is complete, the English and Spanish Privacy and
Terms drafts send `X-Robots-Tag: noindex, follow`, render matching robots meta,
and are excluded from the sitemap. After signed review, update the legal copy
first, then remove the paths from `lib/legal-publishing.ts` and update the
boundary and browser tests in the same reviewed commit.

## Environment contract

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.helpmath.ai` | Keep the production canonical URL unless a reviewed preview canonical is required |
| `NEXT_PUBLIC_CONTACT_ENABLED` | `false` until final approval, then `true` | `false` on dynamic previews; `true` only on the controlled contact-test preview |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production widget site key | Separate preview widget site key |
| `TURNSTILE_SECRET_KEY` | Matching production secret | Matching preview secret |
| `TURNSTILE_ALLOWED_HOSTNAMES` | `www.helpmath.ai` | Stable preview hostname used by the preview widget |
| `RESEND_API_KEY` | Production delivery key | Separate preview/test delivery key |
| `SUPPORT_TO_EMAIL` | Monitored production inbox | Explicit test inbox |
| `SUPPORT_FROM_EMAIL` | Verified production sender | Verified preview/test sender |

Vercel injects `VERCEL_URL`, `VERCEL_BRANCH_URL`, and
`VERCEL_PROJECT_PRODUCTION_URL`; do not copy them into custom variables. The
server accepts those hostnames, but Cloudflare Hostname Management must also
allow the hostname where the widget runs. Because dynamic Vercel URLs cannot
all be treated as a wildcard on standard Turnstile plans, keep contact disabled
on those URLs and use one stable, protected preview hostname with its own
widget for real widget-to-Siteverify-to-Resend testing. Scope the `true` enable
flag and preview credentials to that named preview branch/environment, or use a
separate preview project; do not enable them for every dynamic Preview.

Run general browser and accessibility checks on both the commit and branch
Preview URLs using the protected-preview commands in `RELEASE_EVIDENCE.md`.
Run real contact delivery on the stable contact-test Preview,
then repeat on production `www` after promotion. Retain the rate-limit provider,
threshold, expected `429` behavior, and a verification result in the launch
decision record.

## Vercel

- Framework: Next.js
- Root Directory: repository root
- Install: `npm ci`
- Build: `npm run build`
- Node.js: 24.x
- Canonical URL: `https://www.helpmath.ai`
- Production branch: `main`

Preview deployments should use Vercel Authentication. At the 2026-07-21 audit,
automatic custom production-domain assignment was enabled. Record whether to
keep that behavior in `LAUNCH_DECISIONS.md`. If manual promotion is selected,
disable automatic assignment in the Vercel project, redeploy a harmless test
commit, and verify that `www` remains on the previously approved deployment
before using that workflow for release.

When a release withdraws a route or asset, changing the Production alias is not
enough: older immutable `*.vercel.app` deployment URLs may still contain the
previous artifact. Enumerate those deployments after promotion and confirm
that project-wide Deployment Protection covers every non-current generated
URL. If protection cannot cover an old artifact, remove that exact deployment
only through an owner-approved, rollback-aware procedure. Recheck the current
`www` alias directly to confirm the withdrawn routes and assets no longer
return their former content.

## Domain cutover

Add `www.helpmath.ai` and `helpmath.ai` to the Vercel project, make `www`
primary, and configure a permanent apex-to-www redirect. In Namecheap, change
only the website CNAME/A records to the exact values Vercel reports. Preserve
mail and ownership-verification records. Capture the old values before editing
so the website records can be restored.

Do not claim an SEO migration from `helpprogram.net` until administrative
control of that host is confirmed and page-level permanent redirects are live.
The audited URL mapping and verification procedure are recorded in
[LEGACY_CUTOVER.md](./LEGACY_CUTOVER.md).

## Rollback

Record the release commit and prior production deployment. For an application
failure, use Vercel Instant Rollback. For DNS/TLS failure, restore only the
previous website A/AAAA/CNAME values. Never roll back mail records as part of a
website incident.
