# Legacy Apache host cutover package

This directory contains a deterministic, fail-closed Apache 2.4 handoff for
the retired `helpprogram.net` host. It is prepared for an operations review;
it does not deploy anything and does not change DNS.

## Authority and behavior

`next.config.ts` exports `legacyRedirects`, the single source of truth for all
listed legacy-to-modern mappings. Running the generator produces two
byte-identical deployment forms under `generated/`:

- `.htaccess` for the legacy `DocumentRoot` when `AllowOverride FileInfo` is
  enabled.
- `helpmath-legacy-redirects.conf` for an explicit `Include` inside the legacy
  `DocumentRoot` `<Directory>` block.

The old-host root redirect is necessarily operational-only: adding `/ -> /`
to the Next.js application would create a loop. The two prohibited legacy
artifacts are also old-host-only rules and return a body-only `404` even when
the old files still exist. A final catch-all does the same for every unlisted
path, so stale files cannot bypass the audited map.

Every redirect is a one-hop `301` to the absolute
`https://www.helpmath.ai` origin. Exact paths are emitted before directory
wildcards. `NE` preserves destination fragments such as
`#help-math-1-catalog`. Ordinary targets inherit the original query by Apache
default. Fragment targets place `%{QUERY_STRING}` explicitly before the
fragment so the result keeps the correct `path?query#fragment` order. This
avoids Apache 2.4.66's fragment-only substitution edge case.

## Generate and verify

```bash
npm run generate:legacy-apache
npm run check:legacy-apache
npm run test:legacy-apache
```

The contract test starts the local `/usr/sbin/httpd` Apache 2.4.66 on an
ephemeral non-privileged loopback port. It executes the same request matrix
against both deployment forms and verifies root, exact, encoded-space,
fragment, query, wildcard, `Beta`/`beta`, prohibited-file, and unknown-path
behavior. It also places marker content at the prohibited and unknown paths to
prove that no retired file body leaks.

The pinned 2.4.66 integration contract is intentionally separate from the
default cross-platform `npm test`: GitHub Quality still runs the generator's
Node unit tests and `check:generated` on Linux, while a release operator runs
`test:legacy-apache` on the version-matched legacy-host test machine. Set
`HELP_MATH_HTTPD_BIN` only when that reviewed 2.4.66 binary is installed at a
different path.

## Deployment shapes (operations only)

Choose exactly one form after approval and after taking a recoverable backup
of the legacy virtual-host configuration.

For `.htaccess`, copy `generated/.htaccess` to the legacy document root and
ensure that the existing directory policy permits `FileInfo` overrides.

For an explicit include, place the following inside the existing legacy
document-root `<Directory>` block, using the reviewed absolute path:

```apache
AllowOverride None
Include "/absolute/reviewed/path/helpmath-legacy-redirects.conf"
```

Before reload, run `httpd -t` against the actual server configuration. After
reload, repeat the contract against both the HTTP and HTTPS legacy hostnames.
DNS, TLS, rollback ownership, source-archive custody, legal/contact readiness,
and the final cutover timestamp remain separate release gates.
