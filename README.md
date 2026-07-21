# HELP Math website

Production website for [www.helpmath.ai](https://www.helpmath.ai). This is a
self-contained Next.js application with English as the unprefixed default
locale and Spanish under `/es`.

## Local verification

```bash
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run check:generated
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

Two browser-native reconstruction prototypes are retained for private review.
Original FLA/SWF evidence, Ruffle, migration catalogs, and the Flash workbench
are not part of this repository or its deployment artifact. Reviewed runtime
sources and image derivatives are pinned in `demos/SNAPSHOT.json`. Build-time
runtime bundles and PNG derivatives are served only by authenticated,
non-cacheable API handlers; unauthenticated demo pages return a non-indexable
branded HTML `404`, while runtime and asset requests return empty `404`
responses. Image-optimizer requests are rejected without image content.
Publication requires documented rights plus
the technical and visual acceptance recorded by that manifest.

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

The publicly readable Privacy and Terms pages are explicitly marked as drafts,
send `noindex, follow`, and remain outside the sitemap until owner/legal review
is complete. They must not be described as final policies.

The exact non-secret decisions still required from the project owner are kept
in [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md). Do not paste API
keys, DNS credentials, or other secrets into that file, GitHub, or chat.
