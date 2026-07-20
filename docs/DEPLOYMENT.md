# Deployment runbook

## Release gate

1. Require the GitHub `Quality` workflow on `main`.
2. Review Privacy and Terms with the project owner or qualified counsel.
3. Configure all variables from `.env.example` in Vercel. Use separate
   Turnstile and Resend credentials for Preview and Production.
4. Verify the Resend sender without replacing existing MX, SPF, DKIM, or DMARC
   records.
5. Deploy a protected Preview and run the browser suite against the exact
   commit.
6. Promote manually only after contact delivery, bilingual navigation, both
   demos, metadata, accessibility, and the raw-Flash 404 probes pass.

## Vercel

- Framework: Next.js
- Root Directory: repository root
- Install: `npm ci`
- Build: `npm run build`
- Node.js: 24.x
- Canonical URL: `https://www.helpmath.ai`
- Production branch: `main`

Preview deployments should use Vercel Authentication. Keep automatic custom
domain assignment disabled during the initial controlled launch.

## Domain cutover

Add `www.helpmath.ai` and `helpmath.ai` to the Vercel project, make `www`
primary, and configure a permanent apex-to-www redirect. In Namecheap, change
only the website CNAME/A records to the exact values Vercel reports. Preserve
mail and ownership-verification records. Capture the old values before editing
so the website records can be restored.

Do not claim an SEO migration from `helpprogram.net` until administrative
control of that host is confirmed and page-level permanent redirects are live.

## Rollback

Record the release commit and prior production deployment. For an application
failure, use Vercel Instant Rollback. For DNS/TLS failure, restore only the
previous website A/AAAA/CNAME values. Never roll back mail records as part of a
website incident.

