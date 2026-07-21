# Owner launch decisions

This file is the non-secret decision record for the HELP Math public website.
It is an implementation gate, not legal advice. Never place API keys, DNS
credentials, private contracts, student information, or personal records here.
Store sensitive evidence in an owner-approved system and record only its name
or reference.

## Operational holding state while decisions are open

This state prevents accidental data intake and premature domain cutover. It is
not a legal safe harbor or evidence that public demo rights have been cleared.

- Privacy and Terms remain visibly marked as drafts, send `noindex, follow`,
  and stay outside the sitemap.
- The contact form remains unavailable and the API fails closed.
- `helpprogram.net` remains on its existing host.
- Public demo status remains `conditional`. Because those routes are already
  public, the owner must promptly cite existing publication authority or
  approve removal until that authority is documented.
- The private legacy payload remains local until unused Git LFS capacity is
  confirmed separately in the archive repository.

## 1. Responsible identity and legal review

Complete every field before removing the legal-draft boundary.

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Full legal name and organization type of the website operator/data controller | Pending | Pending |
| Registration country/state and public or counsel-approved contact address | Pending | Pending |
| Relationship of “HELP Math” to that entity: brand, DBA, trademark, or project name | Pending | Pending |
| Privacy-request email and general support email | Pending | Pending |
| Whether a public telephone number is required | Pending | Pending |
| Governing law, venue, and whether arbitration applies | Pending | Pending |
| Service scope: United States only or international | Pending | Pending |
| Final effective date for Privacy and Terms | Pending | Pending |
| English legal copy approval | Pending | Pending |
| Spanish legal copy approval | Pending | Pending |

Historical pages are not sufficient evidence of the current operator. The old
[Contact page](https://www.helpprogram.net/Contact.htm) names Boulder Learning,
Inc.; the old [Login page](https://www.helpprogram.net/Login.htm) and
[privacy PDF](https://www.helpprogram.net/HELP%20Math%20Privacy%20Policy%203.12.07.pdf)
name Digital Directions International, Inc. The current relationship and any
transfer or license must be confirmed by the owner. Before changing the old
host, retain a private archived copy, SHA-256, or other stable evidence
reference; a live legacy URL alone is not a durable record.

## 2. Privacy and contact data flow

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Confirm production vendors: Vercel, Cloudflare Turnstile, and Resend | Pending | Pending |
| List any analytics, Speed Insights, cookies, CDN, logging, or monitoring added beyond those vendors | Pending | Pending |
| Retention period for contact messages | Pending | Pending |
| Retention period for Resend delivery records | Pending | Pending |
| Retention period for Vercel logs and Turnstile signals | Pending | Pending |
| Data-processing locations and any required cross-border transfer mechanism | Pending | Pending |
| People or roles allowed to access contact messages | Pending | Pending |
| Process and verifier for access, correction, and deletion requests | Pending | Pending |
| Confirm that contact is presented as adult-intended but has no age verification; decide whether another control is required | Pending | Pending |
| Confirm `support@helpmath.ai` exists and is monitored, or provide the approved alternative | Pending | Pending |
| Decide whether old `helpprogram.net` mailboxes remain, forward, or close | Pending | Pending |
| Alternative privacy-request channel while the form is unavailable | Pending | Pending |
| Provider or edge rate-limit rule for `/api/contact` | Pending | Pending |

Configure these names in protected Vercel settings for Preview and Production;
record only completion and test evidence here, never their values:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONTACT_ENABLED` (set `true` only after every contact gate passes)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_ALLOWED_HOSTNAMES` (comma-separated, non-secret allowlist)
- `RESEND_API_KEY`
- `SUPPORT_TO_EMAIL`
- `SUPPORT_FROM_EMAIL`

The sender domain must be verified without replacing existing MX, SPF, DKIM,
DMARC, or ownership-verification records. Record a real end-to-end delivery
test, Reply-To test, abuse rejection test, and approver before enabling the
form.

## 3. Rights and public demo approval

Record the authority or evidence reference for each category:

- HELP Math name, marks, logo, course text, FLA/SWF, illustrations, audio,
  fonts, historical PDFs, and third-party materials.
- The relationship or rights transfer among Boulder Learning, Digital
  Directions International, and the current project operator.
- The owner of the new website code, visual design, and copy.
- Permission and citation evidence for historical quotations, testimonials,
  awards, and research claims.
- The allowed public uses: viewing, classroom display, copying, downloading,
  republishing, modification, localization, and accessibility adaptation.
- Territory, term, attribution, and takedown process.

Each demo requires its own written approval covering public display, JavaScript
adaptation, Spanish localization, PNG derivatives, and Vercel/CDN distribution:

| Demo | Source and derivative evidence | Rights approver / date | Product acceptance / date |
| --- | --- | --- | --- |
| `conversion-1-2` | `demos/SNAPSHOT.json` and workbench migration record | Pending | Pending |
| `conversion-1-4` | `demos/SNAPSHOT.json` and workbench migration record | Pending | Pending |

For the two demos already online, record either the pre-existing authorization
evidence or an explicit temporary-removal decision. A `conditional` technical
validation label does not resolve copyright or license questions.

Source hashes and fidelity evidence prove provenance and behavior; they do not
by themselves prove publication rights.

## 4. Delivery governance

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Keep automatic `main` production assignment, or require manual promotion | Pending | Pending |
| GitHub Pro upgrade for required PR checks on the private repository, or documented manual control | Pending | Pending |
| Release owner and rollback owner | Pending | Pending |
| Final production commit and Vercel deployment ID | Pending | Pending |

Until private-repository branch protection is available, every production
change should still use a PR, wait for the complete `Quality` workflow, and
record the exact merged commit and deployment.

## 5. Legacy-domain and mail cutover

Complete the operational details in `LEGACY_CUTOVER.md` and record:

| Decision | Owner answer or evidence reference | Approved by / date |
| --- | --- | --- |
| Registrar and DNS administrator for apex and `www` | Pending | Pending |
| Complete DNS export and website-record rollback values | Pending | Pending |
| MX/SPF/DKIM/DMARC and mailbox continuity owner | Pending | Pending |
| Cutover window, timezone, monitoring window, and rollback threshold | Pending | Pending |
| Google Search Console owners for both domains | Pending | Pending |
| Whether `/Sales.htm` should end at `/contact` or `/resources` | Pending | Pending |
| Final destination for the broken historical partnership PDF | Pending | Pending |

Do not call the domain migration complete until old apex and `www`, HTTP and
HTTPS, representative paths, query preservation, unknown-path behavior, TLS,
mail continuity, and Search Console checks all have retained evidence.

## Final authorization

| Gate | Approver | Date | Evidence reference |
| --- | --- | --- | --- |
| Legal and privacy | Pending | Pending | Pending |
| Rights and demos | Pending | Pending | Pending |
| Contact delivery | Pending | Pending | Pending |
| Production release | Pending | Pending | Pending |
| Legacy-domain cutover | Pending | Pending | Pending |
