# Legal publication review contract

**Gate:** `legalPublication`
**Status:** Pending
**Required evidence kind:** `legal-review`

This document is the canonical blocker contract for publishing the English and
Spanish Privacy and Terms notices. It records what must be decided and approved;
it is not legal advice and does not itself approve publication.

## Required owner and counsel decisions

- Confirm the full legal name, organization type, registration jurisdiction,
  public address, and data-controller role of the website operator.
- Confirm the HELP Math brand, DBA, trademark, ownership, or license relationship
  between the operator and Boulder Learning.
- Approve the privacy-request address, support address, service regions, and
  whether a public telephone number is required.
- Approve governing law, venue, dispute-resolution language, and the final
  effective date.
- Approve the complete vendor and data-flow inventory, retention periods,
  processing regions, cross-border handling, and age policy.
- Review and approve the exact English and Spanish Privacy and Terms content as
  semantically equivalent publication versions.
- Identify the named approver, organization, and authority to bind the operator.

## Evidence required to close the gate

The restricted approval source must remain in an access-controlled system. The
repository may retain only a non-secret JSON envelope directly under
`docs/evidence/launch-gates/` that:

- identifies `legalPublication` and evidence kind `legal-review`;
- binds the reviewed repository commit and the restricted source bytes by
  SHA-256;
- records a canonical observation time no later than the approval time;
- confirms the operating entity, brand authority, both localized notices, data
  practices, and effective date; and
- contains no credential, private communication body, signature image, account
  detail, or other restricted legal material.

This repository revision cannot move the manifest gate from `holding`; the
code-level transition lock rejects every attempted approval. After a separate
reviewed lifecycle implementation is complete, the named legal-review authority
must approve the exact publication content and the machine validator must
accept the hash-bound evidence envelope before this contract may change to
`Satisfied`.
