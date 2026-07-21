# Deployment runbook

## Release gate

The repository gate manifest is `config/launch-gates.json`. Both `npm test`
and `npm run build` validate it before continuing. This revision has a
code-level holding-only transition lock: all five gates must remain exactly
`holding`, and neither manifest edits nor environment variables can unlock
them. The validator also enforces canonical manifest bytes and rejects future
or inconsistent approval data, arbitrary Markdown evidence, unsafe paths,
symbolic files, credential-shaped content, and a build with
`NEXT_PUBLIC_CONTACT_ENABLED=true`. The typed evidence shapes in
[`LAUNCH_GATE_EVIDENCE.md`](./LAUNCH_GATE_EVIDENCE.md) are preparatory and do
not authorize a status change. Record the manifest SHA-256 in release evidence.

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

Changing a manifest status is currently forbidden. A later reviewed lifecycle
change must keep legal publishing, contact intake, demos, cutover, and release
consumers fail closed throughout each approval and activation transition.

After promotion, run `npm run smoke:production` against the canonical domain.
This checks the exact sitemap set, metadata and reciprocal language alternates,
internal links, legacy and `/en` redirects, branded 404 policy, draft indexing,
private demo routes/assets/optimizer paths, static assets, security headers,
the closed contact contract,
and the apex/www HTTP/HTTPS matrix. Keep the JSON result with the release
record; a successful Preview result does not replace the Production run.
When an Executive Preview state is operationally required, set the non-secret
`EXPECT_EXECUTIVE_PREVIEW_STATE` command input to `login` before the review or
`unavailable` after closure. The smoke then fails if the two localized entries
disagree, the login expiry is malformed or elapsed, or the observed state does
not match the requested state. Before a scheduled review, also set
`EXPECT_EXECUTIVE_PREVIEW_EXPIRES_AT` to the approved canonical UTC timestamp
(for example, `2026-07-28T15:59:00.000Z`). This second input requires the
expected state to be `login` and fails unless both localized entries expose
that exact expiry. These inputs are operator expectations, not Vercel
deployment variables.

Record the owner inputs and approvals in
[`LAUNCH_DECISIONS.md`](./LAUNCH_DECISIONS.md). Secret values belong only in
the relevant provider's protected settings, never in the repository.

Unless the legal and contact repository gates are approved,
`NEXT_PUBLIC_CONTACT_ENABLED=true`, and a public Turnstile key is present, the
contact page intentionally shows an unavailable notice and renders no form.
The API independently requires the same repository approvals and enable flag
and fails closed. Set the flag to `true` last, then redeploy;
`NEXT_PUBLIC_*` values are embedded into the client build.

Until release-gate item 2 is complete, the English and Spanish Privacy and
Terms drafts send `X-Robots-Tag: noindex, follow`, render matching robots meta,
and are excluded from the sitemap. After signed review, update the legal copy,
the `legalPublication` manifest approval, and the boundary/browser tests in
the same reviewed commit. The application derives draft headers, metadata, and
sitemap inclusion from that repository gate.

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
| `EXECUTIVE_PREVIEW_ENABLED` | Server-only `true` only during an approved executive review window; otherwise `false` or unset | Same rule; scope to the intended environment |
| `EXECUTIVE_PREVIEW_ACCESS_KEY` | Server-only high-entropy access passphrase | Separate server-only passphrase when Preview access is required |
| `EXECUTIVE_PREVIEW_SESSION_SECRET` | Server-only signing secret, independent from the access passphrase | Separate server-only signing secret |
| `EXECUTIVE_PREVIEW_EXPIRES_AT` | Server-only absolute ISO-8601 end of the approved review window | Environment-specific absolute end time |

The four `EXECUTIVE_PREVIEW_*` variables above are server-only Vercel
settings. Never prefix them with `NEXT_PUBLIC_`, expose them to client code,
write their values in release evidence, or reuse a signing secret as the
human-entered access passphrase. Missing, short, malformed, disabled, or
expired configuration fails closed.

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

## CEO Executive Preview

Use the non-secret [CEO executive preview handoff](./EXECUTIVE_PREVIEW_HANDOFF.md)
for passphrase delivery, the meeting walkthrough, evidence retention, and the
post-meeting close procedure.

The restricted entry routes are `/executive-preview` and
`/es/executive-preview`. They provide temporary internal access to the two
JavaScript prototypes without changing the demos' public-promotion state.
The server proxy performs an early check on the exact demo pages using a signed,
`HttpOnly`, `SameSite=Lax` session cookie. Each protected demo page also
revalidates that session at the server-component boundary. Separate API
handlers independently revalidate the same cookie before serving build-time
JavaScript runtime bundles or PNG derivatives from server-only directories.
The obsolete `/flash-assets/` URLs remain closed.
Entry, demo, runtime, and asset responses retain private/no-store and
`noindex`, `nofollow`, `noarchive` boundaries.

Sessions last at most 12 hours and never outlive the absolute
`EXECUTIVE_PREVIEW_EXPIRES_AT` value. Setting
`EXECUTIVE_PREVIEW_ENABLED` to anything other than the exact value `true`, or
omitting, weakening, malforming, reusing the same value for access and signing,
or expiring any required server-only value closes access. Access and signing
credentials accept only 32–128 character base64url values with sufficient
character diversity. Logout clears the cookie. This is a convenience boundary
for a known executive audience, not a substitute for publication-rights
clearance, technical acceptance, strict fidelity evidence, or a confidential
data room.

Before setting `EXECUTIVE_PREVIEW_ENABLED=true`, publish a Vercel WAF rule for
Request Path `/api/executive-preview/session` AND Method `POST`, using a fixed
window keyed by IP of at most 15 requests per 10 minutes and the default `429`
action. Confirm the sixteenth request receives `429` in the intended environment
and retain the rule reference in `LAUNCH_DECISIONS.md`. Vercel documents this
dashboard flow at
<https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting>. The route's
additional in-memory limiter blocks the eighth failed attempt for 15 minutes
per client on each warm instance; it is not a distributed replacement for the
WAF rule. The WAF allowance includes successful login, logout, bilingual
verification, and one test retry; avoid repeated production suites immediately
before the executive meeting.

Create the access passphrase in an approved password manager and deliver it to
the CEO through a private channel separate from the public URL. Do not send it
in a public calendar description, issue, PR, commit, build log, screenshot, or
shared release report. Immediately after the meeting, disable the preview or
rotate both the access passphrase and session-signing secret, set a new review
expiry only if another session is approved, and redeploy. Existing cookies
must no longer validate after the signing-secret rotation.

Smoke credentials are command inputs, not deployment configuration. Inject
`SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY` and `SMOKE_VERCEL_BYPASS_SECRET` only into
the operator's local, temporary shell process that runs the smoke command;
never save smoke-only variables in Vercel, GitHub Actions, any `.env` file,
shell history, or repository documentation. Redact them from retained JSON and
logs.

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
primary, and configure a permanent apex-to-www redirect. Change only the
website CNAME/A records in the confirmed active DNS control plane to the exact
values Vercel reports. The 2026-07-21
[public domain baseline](./DOMAIN_PUBLIC_BASELINE.md) shows Vercel nameservers
for `helpmath.ai`; it does not prove registrar or administrator control. Confirm
those facts before editing. Preserve mail and ownership-verification records,
and capture the old values before editing so the website records can be
restored.

Do not claim an SEO migration from `helpprogram.net` until administrative
control of that host is confirmed and page-level permanent redirects are live.
The audited URL mapping and verification procedure are recorded in
[LEGACY_CUTOVER.md](./LEGACY_CUTOVER.md).

## Rollback

Use the reviewed [production rollback runbook](./ROLLBACK_RUNBOOK.md) and retain
its incident record. For an application failure, select an exact previously
reviewed deployment and use Vercel Instant Rollback; then rerun the production
contract and verify authenticated alias identity. For DNS/TLS failure, restore
only the recorded previous website A/AAAA/CNAME values. Never roll back mail
records as part of a website incident.
