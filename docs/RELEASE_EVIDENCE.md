# Release evidence contract

Every Preview and Production promotion must be tied to one private Git commit.
Use authenticated GitHub and Vercel evidence; do not publish a private commit
SHA, repository identifier, environment value, or deployment token through a
public health endpoint.

## Required record

Store these non-secret fields in the pull request, release record, or another
owner-approved operational system:

Completed in-repository records are append-only under [`docs/releases`](./releases/README.md).
The active pull request remains the record for a candidate that has not yet
been promoted, because its final production deployment ID cannot exist inside
the candidate commit itself.

| Field | Required evidence |
| --- | --- |
| Candidate commit | Full Git SHA from the local reviewed worktree |
| Pull request | Number and final review/merge decision |
| Quality run | GitHub Actions run ID, conclusion, and matching head SHA |
| Preview | Vercel deployment ID, protected URL, state, and matching Git SHA |
| Preview smoke | Timestamp, command options, and zero-failure JSON output |
| Production | Vercel deployment ID assigned to `www.helpmath.ai` |
| Canonical alias assignment | Owner-authenticated Vercel evidence tying `www.helpmath.ai` and `helpmath.ai` to that exact Production deployment and commit |
| Production smoke | Timestamp and zero-failure JSON output after promotion |
| Contact mode | `disabled` or the separate approved delivery-test evidence |
| Launch gates | Manifest SHA-256 and the five non-secret gate statuses |
| Exceptions | Every accepted failure, owner, reason, and expiry/review date |

## Verification sequence

From the clean candidate worktree:

```bash
git rev-parse HEAD
git status --short
npm ci
npm run lint
npm run typecheck
npm run check:generated
npm test
npm run build
npm run test:e2e
npm run test:visual
npm audit --audit-level=high
```

`check:generated`, `npm test`, and `npm run build` each fail closed on an
invalid launch-gate manifest. Retain only its SHA-256 and statuses; the
manifest must contain no credentials, contracts, or personal data.

Confirm in authenticated GitHub that the successful `Quality` run has the same
head SHA. Confirm in authenticated Vercel that the Preview deployment is
`READY`, belongs to the expected project, and carries that same Git SHA. A URL
that happens to render successfully is not sufficient identity evidence.

Run the deployment contract against the protected Preview while keeping the
production canonical origin:

```bash
SMOKE_BASE_URL="https://the-reviewed-preview.example" \
SMOKE_CANONICAL_ORIGIN="https://www.helpmath.ai" \
SMOKE_VERCEL_BYPASS_SECRET="$VERCEL_AUTOMATION_BYPASS_SECRET" \
npm run smoke:production
```

Run the same browser and accessibility contract against that exact Preview:

```bash
PLAYWRIGHT_BASE_URL="https://the-reviewed-preview.example" \
PLAYWRIGHT_VERCEL_BYPASS_SECRET="$VERCEL_AUTOMATION_BYPASS_SECRET" \
npm run test:e2e
```

Create and store the Vercel Automation Bypass secret in the protected
operational environment. Never put its value in a command transcript, pull
request, repository file, deployment URL, or smoke JSON. The scripts send it
only as `x-vercel-protection-bypass` and never print it. Browser setup sends the
header once to the selected Preview, asks Vercel for a domain-scoped bypass
cookie, stores that cookie in a temporary OS file, disables Playwright traces
for the protected run, and deletes the file after the suite. Do not retain or
upload the temporary browser state.

The script automatically skips the public-domain redirect matrix when its base
URL is not the canonical Production origin. After the exact reviewed deployment
is promoted, run:

```bash
npm run smoke:production
```

The `Production deployment smoke` workflow also runs after a successful GitHub
`Production` deployment status. It checks out the deployment SHA, confirms it
is contained by `main`, verifies the immutable URL's Vercel SSO boundary, runs
the public canonical contract, and retains non-secret JSON artifacts for 90
days. It intentionally stores no bypass or executive credential. Therefore it
does not replace the authenticated Preview semantic smoke, authenticated
executive-demo smoke, or Vercel evidence that the canonical alias is assigned
to the named deployment.

Contact intake is expected to be disabled unless the separate Turnstile,
Resend, rate-limit, inbox, privacy, and owner gates are complete. Only for the
controlled contact-delivery verification run, set
`EXPECT_CONTACT_ENABLED=true`; never use synthetic smoke data to test a real
recipient without prior approval.
