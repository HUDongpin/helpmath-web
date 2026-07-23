# Emergency legacy login containment

This package stops only the five retired credential-entry paths that the
legacy host currently serves as unprocessed ASP.NET page directives and
server-control markup. It is intentionally separate from the complete
legacy-domain cutover package.

It does **not** redirect the legacy root, retire marketing or research pages,
change DNS, change TLS, alter mail, publish a demo, or satisfy the later
legacy-cutover gate.

## Exact containment boundary

The generated rules cover exactly:

- `/student_login.aspx`
- `/teacher_login.aspx`
- `/school_login.aspx`
- `/district_login.aspx`
- `/Project_Admin_Login.aspx`

Every case variant of those paths receives one `301` to
`https://www.helpmath.ai/login`. The rules discard the complete incoming query
string and do not forward a request body. All unmatched legacy requests
continue through the existing host configuration.

The mappings are selected fail-closed from `next.config.ts` `legacyRedirects`.
Generation fails if any required path is missing, duplicated, non-permanent,
or mapped anywhere other than `/login`.

## Generated deployment forms

Run:

```bash
npm run generate:legacy-apache
npm run check:legacy-apache
npm run test:legacy-apache
```

The command generates two byte-identical containment forms:

- `generated/login-containment.prepend.htaccess`
- `generated/helpmath-login-containment.conf`

The Apache 2.4.66 contract proves that both forms:

- redirect the five exact paths;
- match case variants;
- discard incoming queries;
- redirect a `POST` without serving the legacy page;
- leave `/About.htm` and an unrelated existing file untouched; and
- contain no root redirect, catch-all, custom error document, or broad file
  rule.

## Required owner-side preflight

Only the legacy-host owner or named operator can execute these steps:

1. Resolve the exact active Apache virtual host, `DocumentRoot`, server version,
   loaded `mod_rewrite`, active `.htaccess` policy, and configuration reload
   command. The active server must be Apache 2.4 or newer because the generated
   block uses `QSD`. Do not infer any of these facts from DNS or the public
   response.
2. Record the operator, UTC start time, host identity, configuration path,
   current file mode/owner, and SHA-256 of every file that will change.
3. Take a recoverable byte-for-byte backup outside the public `DocumentRoot`.
   Confirm the rollback operator can read it before editing.
4. Confirm `https://www.helpmath.ai/login` returns `200`, contains no password
   field, and clearly states that legacy accounts are not yet available.
5. Choose exactly one installation shape below. Never install the complete
   `ops/legacy-host/generated/` cutover package for this emergency action.

## Installation shape A: prepend to the active `.htaccess`

Use this shape only when the active legacy `DocumentRoot` permits
`AllowOverride FileInfo`.

Prepend the exact bytes from
`generated/login-containment.prepend.htaccess` before every existing rewrite,
handler, proxy, or fallback rule. Preserve the remainder of the existing
`.htaccess` byte-for-byte. Do not replace an existing file with the generated
block alone. Use the host's reviewed atomic deployment mechanism so a partial
write cannot become active.

## Installation shape B: explicit virtual-host include

Copy `generated/helpmath-login-containment.conf` to a reviewed, non-public,
root/operator-controlled configuration path. Include it at the beginning of
the active legacy `DocumentRoot` `<Directory>` block, before existing rewrite,
handler, proxy, or fallback directives.

The reviewed server configuration must identify the exact absolute include
path. Do not place a writable include inside a user-upload or public content
directory.

## Validate before and after reload

Before reload:

1. Run the actual server's Apache configuration test.
2. Confirm the diff contains only the five-rule block or one reviewed include
   line.
3. Confirm the backup still matches its recorded SHA-256.

After reload, test all four origins—`http://helpprogram.net`,
`https://helpprogram.net`, `http://www.helpprogram.net`, and
`https://www.helpprogram.net`—from a network outside the host:

- all five exact paths return one-hop `301`;
- `Location` is exactly `https://www.helpmath.ai/login`;
- a mixed-case path also returns that exact location;
- a request such as
  `/student_login.aspx?containment_probe=discard` returns a
  location with no query;
- `GET`, `HEAD`, and a harmless empty `POST` do not return the retired page;
- `/About.htm` and at least two other reviewed non-login legacy pages retain
  their pre-change behavior; and
- no response body contains `<%@ Page`, `<asp:TextBox`, `CodeFile=`, or a
  password control.

Record response status, `Location`, observation time, hostname, and sanitized
body hash only. Never record submitted credentials, cookies, authorization
headers, query values, or full legacy page bodies.

## Rollback

Rollback is removal of only the prepended five-rule block or only the reviewed
include line, followed by the actual server configuration test and reload.
Restore the byte-for-byte backup if any unrelated directive changed.

After rollback, record the restored SHA-256 and response behavior. A rollback
does not make the retired credential pages safe; if containment cannot remain
installed, the owner must use a reviewed host-level deny or `410` response
until the redirect can be restored.

## Completion boundary

This emergency action is complete only when the live HTTP and HTTPS evidence
shows the five paths contained and unrelated legacy paths unchanged. Repository
tests and a prepared package do not prove that the legacy host was modified.
