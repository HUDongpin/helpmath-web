# Legal publication review contract

**Gate:** `legalPublication`
**Status:** Pending
**Required evidence kind:** `legal-review`

This document is the canonical blocker contract for publishing the English and
Spanish Privacy and Terms notices. It records what must be decided and approved;
it is not legal advice and does not itself approve publication.

## Schema-v3 lifecycle path

The checked-in manifest remains schema version 2 with
`legalPublication=holding`, and this contract remains `Pending`. Schema v2
cannot leave `holding`. A separately adopted schema-v3 manifest may append a
`candidate` targeting only `approved`, binding the exact reviewed repository
commit, with a window of no more than seven days. The candidate itself contains
no approval or evidence.

Only the actual `legal-review-authority` may resolve that exact, still-valid
candidate. The `legal-review` envelope must bind the code-defined legal subject
scope and digest, candidate and decision IDs, authority identity, restricted
source record, required checks, and validity. The maximum evidence validity is
365 days, but the decision cannot outlive its evidence. Code, CI, Codex, a
Markdown name, or a hash cannot establish the approver's authority.

At expiry the decision becomes ineffective and legal publication must fail
closed. A renewal must be appended before expiry and use newly observed
evidence. An expired resolved decision must first receive an explicit
revocation with `gate-revocation` evidence, after which the revoked gate may be
reopened through a new candidate. Preserve the prior history. None of this
changes the current `holding`/`Pending` state.

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

The current schema-v2 manifest cannot move the gate from `holding`; its
code-level contract rejects every attempted approval. Only after a separately
reviewed schema-v3 adoption, a real decision by the named legal-review
authority, and successful validation of the exact hash-bound evidence may this
contract change to `Satisfied`.
