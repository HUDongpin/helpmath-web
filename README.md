# HELP Math website

Production website for [www.helpmath.ai](https://www.helpmath.ai). This is a
self-contained Next.js application with English as the unprefixed default
locale and Spanish under `/es`.

See the authoritative
[website migration status matrix](docs/WEBSITE_MIGRATION_STATUS.md) for the
separate public-website and HELP Math 2.0 product scopes, completed work,
remaining launch gates, and owner inputs.

## Local verification

```bash
npm ci
npx playwright install chromium firefox webkit
npm run lint
npm run typecheck
npm run check:generated
npm run check:demo-lifecycle
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

The Quality workflow also runs eight visual-regression checks in a
digest-pinned Playwright Linux container as the image's non-root test user. The
same job runs the full Chromium contract plus focused Desktop Safari/WebKit,
native iPhone WebKit touch, and Firefox projects. Visual baselines are
container-specific; do not regenerate them from a normal host run.
`npm run test:e2e:chromium`,
`npm run test:e2e:webkit`, `npm run test:e2e:mobile-webkit`, and
`npm run test:e2e:firefox` are available for focused local diagnostics.

The Lighthouse job retains three samples for each of five reviewed routes,
plus versioned capacity and quality verdicts. Every route's median Lighthouse
benchmark index must be greater than Lighthouse's own slow-host boundary. An
identity-bound, explicitly ineligible first runner permits exactly one complete
Quality workflow rerun on a fresh runner. Because GitHub's native full-rerun
surface does not make the prior attempt's artifact available to attempt two,
attempt two reconstructs the versioned capacity record from the GitHub-served
exact-run Lighthouse job log, verifies that record and the required prior
steps, and verifies all three replacement Quality jobs, including jobs that are
still queued. For pull requests, the evidence binds both the source-branch SHA
reported by the Jobs API and the synthetic merge SHA actually checked out by
Actions;
focused job retries, attempts after two, and retries of an eligible product
budget failure are rejected.

This rerun policy establishes lineage for reviewed candidate code; it is not a
cryptographic attestation against a malicious pull request that rewrites its own
workflow or policy script. Production evidence independently accepts only a
reviewed Quality `push` run for the exact `main` commit.

Every external GitHub Action is pinned to a reviewed full commit SHA.
Dependabot groups proposed GitHub Actions updates into a weekly pull request;
review the new commit identity and keep the version comment when accepting an
update.

Two browser-native reconstruction prototypes are retained for private review.
Original FLA/SWF evidence, Ruffle, migration catalogs, and the Flash workbench
are not part of this repository or its deployment artifact. Reviewed runtime
sources and image derivatives are pinned in `demos/SNAPSHOT.json`. Build-time
runtime bundles and PNG derivatives are served only by authenticated,
non-cacheable API handlers; unauthenticated demo pages return a non-indexable
branded HTML `404`, while runtime and asset requests return empty `404`
responses. Image-optimizer requests are rejected without image content.
Immutable candidate manifests under `demos/candidates/` bind the source,
runtime bundle, and repository artifacts independently from the inactive
switches in `config/demo-activations.json`. Publication requires documented
rights, product acceptance, an approved launch gate, and an explicit activation
bound to the same candidate digest.

## Deployment

Import this private repository into Vercel with the repository root as the
project root. Configure the variables in `.env.example`; production contact
delivery fails closed unless it is explicitly enabled and Turnstile and Resend
are fully configured. See
`docs/DEPLOYMENT.md` before promoting a deployment or changing DNS.
Use `npm run smoke:production` for the repeatable post-deployment contract and
record the authenticated GitHub/Vercel identity described in
[`docs/RELEASE_EVIDENCE.md`](docs/RELEASE_EVIDENCE.md). The private repository
commit is deliberately not exposed through a public health endpoint.
The time-bounded, unauthenticated DNS/HTTP/TLS snapshot for both domains is in
[`docs/DOMAIN_PUBLIC_BASELINE.md`](docs/DOMAIN_PUBLIC_BASELINE.md); it is not a
substitute for an authenticated zone export or mail-continuity test.

The publicly readable Privacy and Terms pages are explicitly marked as drafts,
send `noindex, follow`, and remain outside the sitemap until owner/legal review
is complete. They must not be described as final policies.

The exact non-secret decisions still required from the project owner are kept
in [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md). Do not paste API
keys, DNS credentials, or other secrets into that file, GitHub, or chat.
