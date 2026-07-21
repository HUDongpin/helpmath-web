# Stable external link checks

The public HELP Math source register links readers to a finite set of records
maintained by Boulder Learning, PedaNova, WWC/IES, ERIC, publishers, and award
owners. `data/stable-external-links.json` is the reviewed machine-readable
allowlist for those destinations.

The allowlist is reconciled against the HTTPS links in
`docs/CONTENT_SOURCES.md` and `docs/LEGACY_RESOURCE_MAP.md`. It must also contain
every non-null `stableReplacement` in `data/legacy-source-registry.json`.
Adding or removing a governed external link therefore requires an intentional
registry change and review of its exact redirect hosts.

Run the check with:

```bash
npm run check:stable-links
```

The command emits a deterministic JSON summary in registry order and exits
nonzero for invalid configuration or any unreachable destination. Each DNS,
connection, and response attempt shares one strict wall-clock timeout; the
policy also allows two attempts, four redirects, and four concurrent workers.
Retries apply only to bounded transient HTTP statuses and network failures.
Every request and redirect must remain HTTPS, contain no credentials or custom
port, and use an exact reviewed hostname. DNS answers are checked for private,
loopback, link-local, reserved, documentation, and multicast ranges; the
checked public address is pinned to the TLS request to limit DNS-rebinding and
SSRF risk.

`.github/workflows/stable-external-links.yml` runs manually and each Tuesday.
It is deliberately separate from pull-request Quality checks because remote
sites can fail transiently without a repository defect. A scheduled failure
needs human review before changing a citation or its redirect allowance.

## Interpretation boundary

A passing result establishes endpoint reachability at the time of the check.
It does **not** verify claim accuracy, source currency, content identity,
endorsement, accessibility, copyright ownership, license terms, or permission
to copy or republish material. Legacy `helpprogram.net` capture, integrity,
rights, and cutover evidence remain governed by the separate source-custody
workflow.
