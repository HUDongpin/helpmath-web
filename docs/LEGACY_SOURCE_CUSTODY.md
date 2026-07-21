# Legacy HELP Math source custody

Capture date: 2026-07-21.

This workflow preserves the exact response bytes for the finite historical
sources that currently support public HELP Math copy or have an exact document
disposition in `LEGACY_RESOURCE_MAP.md`. It is a local owner-custody record, not
a public document mirror.

## Current evidence

- Registry: `data/legacy-source-registry.json`
- Repository evidence: dated JSON, CSV, and SHA-256 manifests under
  `docs/evidence/`
- External archive root:
  `/Users/peter/Desktop/helpmath-legacy-web-archive`
- Captured: 23 of 23 registered HTTPS locators returned HTTP 200
- Captured bytes: 14,280,549
- Integrity: 23 content-addressed objects, each recorded by byte size and
  SHA-256

The repository evidence contains URLs, final URLs, status, response metadata,
byte counts, hashes, capture timestamps, claim use, stable-replacement fields,
and review statuses. PDF entries also record page count, title, author,
creation/modification dates, the `pdfinfo`/Poppler version used, and `null` for
unavailable values. It contains no captured HTML or PDF bodies. The external
archive contains:

```text
.help-math-source-archive.json
manifests/legacy-source-crawl-2026-07-21.json
manifests/legacy-source-crawl-2026-07-21.csv
manifests/legacy-source-crawl-2026-07-21.sha256
objects/sha256/<first-two-hash-characters>/<full-sha256>
```

## Reproduce or refresh

The crawler reads only the registry allowlist. Its portable default is the
`../helpmath-legacy-web-archive` sibling of the repository; the absolute path
for this workstation is recorded above. It refuses a same-date manifest
overwrite: custody manifests and source objects are append-only, and source
objects are content-addressed. A new archive must be a dedicated leaf directory.
The crawler creates the fixed custody marker on first use; it refuses every
unmarked existing directory, symbolic link, home/repository overlap, or path
inside another Git worktree before changing permissions. The archive root,
manifest/object directory chain, and hash-prefix directories are kept at
`0700`; marker, manifest, and object files are kept at `0600`.

Before a future dated refresh, first advance
`data/legacy-source-registry.json.currentEvidenceManifest` to that UTC date's
new `docs/evidence/legacy-source-crawl-YYYY-MM-DD.json` path. The crawler
refuses to run when this reviewed pointer and its output date differ, and it
never overwrites an existing manifest. This prevents the default validator
from silently selecting an older successful capture after a later run.

```bash
node scripts/crawl-legacy-sources.mjs
node scripts/validate-legacy-source-custody.mjs \
  --require-successful \
  --archive-root /Users/peter/Desktop/helpmath-legacy-web-archive
npm run check:legacy-source-custody
```

Run `node scripts/crawl-legacy-sources.mjs --help` for bounded overrides. The
implementation permits only `https://www.helpprogram.net`, validates every
redirect manually against that origin, rejects credentials/query/fragment
locators, requests identity encoding, limits redirects, applies a per-attempt
timeout, retries only network errors and specified transient HTTP statuses,
caps response size, limits concurrency, and derives storage paths only from a
validated SHA-256 value.

PDF metadata extraction runs the native `pdfinfo` process with a timeout only
after the response passes HTTPS-origin, status, media-type, non-empty-body, and
PDF-signature checks. It is not a strong operating-system sandbox. If control
or integrity of the legacy host is in doubt, perform any future capture and
metadata extraction in a disposable, network-restricted container or virtual
machine before accepting the refreshed evidence.

The validator checks that:

1. every legacy URL made explicit in `CONTENT_SOURCES.md` is registered;
2. every finite locator in the exact-document table of
   `LEGACY_RESOURCE_MAP.md` is registered;
3. the Contact, Login, and historical privacy-policy locators required by
   `LAUNCH_DECISIONS.md` are registered;
4. there are no ungoverned extra registry URLs;
5. the evidence has exactly one matching capture per registry entry;
6. the evidence names the exact registry-file hash; and
7. when an archive root is supplied, every referenced object matches both its
   recorded byte count and SHA-256, and the root has the exact dedicated
   custody marker.

The metadata-only `--require-successful` check is part of the default
`npm test`/CI path so a reviewed 23-of-23 evidence set cannot silently become
an incomplete capture while release documentation continues to cite it.

## Boundary and remaining decisions

All registry and capture values for rights, accessibility, and republication
remain `pending`. HTTP 200 and a matching hash prove only that a particular
response was locally captured intact. They do not prove copyright ownership,
permission to publish, accessibility conformance, document authorship, claim
validity, or durable off-device/remote custody.

Before retiring or redirecting `helpprogram.net`, an authorized owner must
place the archive in approved durable storage, verify restore access, record
retention/ownership, and finish document-by-document rights and accessibility
decisions. Do not add these source bodies to the public website repository.
