# Release records

This directory keeps append-only, non-secret evidence for completed HELP Math
application releases. A record describes the commit and deployment that were
already promoted; it is not rewritten to pretend that a later documentation
commit was part of that earlier artifact.

The pull request for each new candidate remains the live release record until
that candidate has been merged and promoted. After promotion, the next
reviewed documentation batch may add its immutable record here. This avoids a
circular process in which recording a deployment creates another deployment
whose identifier cannot appear in its own commit.

Every record follows [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) and must
state gaps and diagnostic conditions explicitly. A Vercel `READY` state or a
successful page load does not substitute for commit identity, Quality results,
or the deployment contract.

Alias evidence uses `vercel-production-alias-YYYY-MM-DD.json` for the first
legacy observation on a date and `vercel-production-alias-YYYY-MM-DD-prNN.json`
for additional same-day releases. Never rename or overwrite an earlier
observation merely to make the latest filename sort last; release-evidence
validation orders the optional PR suffix numerically and binds it to the
matching release record.
