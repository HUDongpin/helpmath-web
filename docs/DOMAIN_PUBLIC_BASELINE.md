# Public domain baseline — July 21, 2026

This document summarizes a fixed public observation of `helpmath.ai` and
`helpprogram.net`. The machine-readable evidence is
[`docs/evidence/domain-public-baseline-2026-07-21.json`](evidence/domain-public-baseline-2026-07-21.json).
It is a historical baseline, not a live status page; DNS answers, certificates,
and HTTP behavior may change after the stated windows.

## Observation windows

| Surface | UTC window |
| --- | --- |
| DNS | `2026-07-21T13:19:31Z`–`2026-07-21T13:20:31Z` |
| HTTP | `2026-07-21T13:20:52Z`–`2026-07-21T13:21:19Z` |
| TLS | `2026-07-21T13:21:37Z`–`2026-07-21T13:21:46Z` |

Two public recursive resolvers returned consistent DNS values during the DNS
window. Their identities were not retained in this repository receipt.

## DNS baseline

The new domain returned these public records:

| Owner | Type | TTL | Observed values |
| --- | --- | ---: | --- |
| `helpmath.ai` | A | 1800 | `216.150.16.129`, `216.150.1.129` |
| `helpmath.ai` | NS | 86400 | `ns1.vercel-dns.com.`, `ns2.vercel-dns.com.` |
| `helpmath.ai` | CAA | 60 | issue `letsencrypt.org`, `pki.goog`, `sectigo.com` |
| `www.helpmath.ai` | A | 1800 | `216.150.1.1`, `216.150.1.193` |

No AAAA, CNAME, MX, or TXT answer was found for either `helpmath.ai` or
`www.helpmath.ai` during that window.

The legacy domain returned:

| Owner | Type | TTL | Observed values |
| --- | --- | ---: | --- |
| `helpprogram.net` | A | 900 | `69.13.40.229` |
| `www.helpprogram.net` | A | 900 | `69.13.40.229` |
| `helpprogram.net` | NS | 86400 | `custns1.dal.corespace.com.`, `custns2.dal.corespace.com.` |

The seven observed Google mail exchangers were:

| Priority | Exchange |
| ---: | --- |
| 1 | `aspmx.l.google.com.` |
| 5 | `alt1.aspmx.l.google.com.` |
| 5 | `alt2.aspmx.l.google.com.` |
| 10 | `aspmx2.googlemail.com.` |
| 10 | `aspmx3.googlemail.com.` |
| 10 | `aspmx4.googlemail.com.` |
| 10 | `aspmx5.googlemail.com.` |

Both legacy TXT values ended with one literal space. Here `␠` makes that
otherwise invisible final character explicit:

```text
google-site-verification=BPNsu71vya6smTxbkCcRxs6g8cwYVw_YRcqJxvMSmfc␠
v=spf1 mx a ip4:69.13.40.229 include:_spf.google.com ~all␠
```

Before changing legacy hosting or DNS, preserve all seven MX records and both
TXT values exactly, including those trailing spaces. A separate real inbound
and outbound mail test is still required; public records alone do not prove
mail continuity.

## Mail-policy observations

During the window, neither domain returned TXT answers at the conventional
DMARC (`_dmarc`), MTA-STS (`_mta-sts`), or TLS reporting (`_smtp._tls`) owner
names. These are time-bounded negative observations, not permanent guarantees.

No DKIM absence is claimed. DKIM lookup requires a selector, and DNS does not
provide a complete way to enumerate selectors.

## HTTP behavior

| URL | Status | Location | HSTS |
| --- | ---: | --- | --- |
| `http://helpmath.ai/` | 308 | `https://helpmath.ai/` | — |
| `https://helpmath.ai/` | 308 | `https://www.helpmath.ai/` | `max-age=63072000` |
| `http://www.helpmath.ai/` | 308 | `https://www.helpmath.ai/` | — |
| `https://www.helpmath.ai/` | 200 | — | `max-age=63072000; includeSubDomains; preload` |
| `http://helpprogram.net/` | 200 | — | — |
| `https://helpprogram.net/` | 200 | — | — |
| `http://www.helpprogram.net/` | 200 | — | — |
| `https://www.helpprogram.net/` | 200 | — | — |

The new site responses identified Vercel and the legacy responses identified
Apache. All four legacy endpoints still served HTTP 200 without a redirect,
and neither legacy HTTPS response included HSTS. Therefore the legacy-domain
redirect cutover had **not** occurred during this observation.

## TLS baseline

The new-domain certificate negotiated TLS 1.3, covered `helpmath.ai` and
`*.helpmath.ai`, was issued by Let's Encrypt, and was valid from July 20 through
October 18, 2026. Its SHA-256 fingerprint was:

```text
A3:94:45:17:11:85:6A:01:10:26:88:42:AA:C1:A2:23:F6:B8:26:EB:00:7B:1F:76:92:DD:24:E9:43:79:61:23
```

The legacy certificate covered `helpprogram.net`, `mail.helpprogram.net`, and
`www.helpprogram.net`, and was valid from July 1 through September 29, 2026.
Its SHA-256 fingerprint was:

```text
72:85:A4:C0:1C:5E:B1:27:71:CE:BF:B4:3B:94:76:34:C9:30:A2:F5:81:63:C5:DC:AC:93:21:72:EC:0C:5F:6E
```

## Evidence boundary

This receipt is public, unauthenticated, point-in-time evidence. It does not
establish:

- a complete or authoritative zone export;
- registrar identity, account access, DNS control, or change authority;
- mailbox ownership, real mail delivery, DKIM configuration, or continuity;
- which Vercel project or immutable deployment the production aliases target;
- Search Console ownership, access, property configuration, or indexing state.

In particular, public NS answers that name Vercel are not Vercel project-binding
evidence, and the public Google verification value is not proof of current
Search Console access. Obtain authenticated exports and operational tests
before treating any of those gates as complete.
