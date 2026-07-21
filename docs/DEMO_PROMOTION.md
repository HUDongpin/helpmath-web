# Demo promotion boundary

The live Flash migration workbench is outside this repository. Deployments use
the reviewed snapshot in `demos/`, server-only runtime entry points in
`private-demo-runtime/`, and 12 reviewed PNG derivatives in
`private-demo-assets/`; they never import a live migration workspace. The
private runtime and images are absent from public static chunks and are served
only after the executive-session API handlers revalidate authentication.
`npm run build` fails unless the ignored private-runtime output contains exactly
the two approved bundles, the two API route traces contain exactly the expected
12 PNG and two runtime files, and `.next/static` contains neither a known text
fingerprint nor a byte-for-byte SHA-256 match for any private PNG.

To promote a later conversion:

1. Complete the workbench audit, deterministic keyframe capture, behavior
   tests, visual comparison, accessibility checks, and acceptance checklist.
2. Record source hashes, stage, FPS, frame count, validation status, and every
   known exception.
3. Copy only reviewed browser-native runtime files and derivative assets into
   the server-only directories in this repository. Do not copy FLA, SWF,
   Ruffle, catalogs, or source paths, and do not place unapproved derivatives
   under `public/`.
4. Update `demos/SNAPSHOT.json` and its integrity test.
5. Keep the public label `conditional` until the strict migration gate is
   actually complete and owner-accepted.
6. Run the full Quality workflow and inspect the Vercel Preview before merge.

## CEO Executive Preview is not promotion

An approved CEO Executive Preview may temporarily allow the named executive
audience to open `conversion-1-2` and `conversion-1-4` through the protected
entry route. It does not change `demos/SNAPSHOT.json` to public access, add the
demos to the public library or sitemap, or authorize indexing, forwarding,
recording, republication, classroom use, CDN distribution, or any other public
display.

The executive-preview boundary requires all four server-only Vercel variables:
`EXECUTIVE_PREVIEW_ENABLED`, `EXECUTIVE_PREVIEW_ACCESS_KEY`,
`EXECUTIVE_PREVIEW_SESSION_SECRET`, and `EXECUTIVE_PREVIEW_EXPIRES_AT`. A
session is valid for no more than 12 hours and is further capped by the global
expiry. Disabled, missing, invalid, weak, malformed, duplicate access/signing
credentials, or expired configuration fails closed for the entry, exact demo
routes, authenticated runtime, and protected asset API.

Before enabling the review on an internet-facing deployment, publish a Vercel
WAF rate-limit rule whose conditions are Request Path equals
`/api/executive-preview/session` and Method equals `POST`, keyed by IP, with a
fixed window of at most 15 requests per 10 minutes and the default `429`
action. Verify the rule on the intended environment and record the result.
The route also blocks the eighth failed attempt for 15 minutes per client on a
warm application instance; that defense in depth does not replace the global
WAF rule. See the
[Vercel WAF rate-limiting documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Internal review approval must remain separate from both of these gates:

1. Written publication-rights approval for the original material and every
   browser derivative, localization, asset, and distribution channel.
2. Technical/product acceptance backed by the migration audit, behavior and
   accessibility checks, strict validator, deterministic keyframes, visual
   comparison evidence, documented exceptions, and owner acceptance.

Transmit the high-entropy access passphrase through a private approved channel,
not in the URL or repository. After the meeting, disable the feature or rotate
the access passphrase and signing secret so earlier sessions cannot be reused.
Only set a new global expiry for another explicitly approved review window.

When release smoke needs executive-preview access, supply
`SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY` only to the operator's local, temporary
command process. Do not configure it in Vercel or GitHub Actions, write it to
any `.env` or other file, retain it in shell history or release artifacts, or
include its value in logs or evidence.
