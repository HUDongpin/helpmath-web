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
npm test
npm run build
npm run test:e2e
```

The two browser-native animation previews are intentionally labeled
`conditional`. Original FLA/SWF evidence, Ruffle, migration catalogs, and the
Flash workbench are not part of this repository or its deployment artifact.
Reviewed runtime files and image derivatives are pinned in
`demos/SNAPSHOT.json`.

## Deployment

Import this private repository into Vercel with the repository root as the
project root. Configure the variables in `.env.example`; production contact
delivery fails closed unless it is explicitly enabled and Turnstile and Resend
are fully configured. See
`docs/DEPLOYMENT.md` before promoting a deployment or changing DNS.

The publicly readable Privacy and Terms pages are explicitly marked as drafts,
send `noindex, follow`, and remain outside the sitemap until owner/legal review
is complete. They must not be described as final policies.

The exact non-secret decisions still required from the project owner are kept
in [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md). Do not paste API
keys, DNS credentials, or other secrets into that file, GitHub, or chat.
