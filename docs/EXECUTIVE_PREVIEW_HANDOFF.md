# CEO executive preview handoff

This runbook supports the approved private review of the two JavaScript
prototypes by CEO and Chairman John Ramo. It contains no passphrase, signing
secret, session cookie, bypass credential, or confidential demo payload. Never
add any of those values to this file, a ticket, calendar invitation, chat
transcript, screenshot, build log, or retained test artifact.

## Approved review boundary

- Fixed entry URL: `https://www.helpmath.ai/executive-preview`
- Named audience: CEO and Chairman John Ramo
- Purpose: internal review of the animation effects in `conversion-1-2` and
  `conversion-1-4`
- Absolute close: `2026-07-28T15:59:00Z` (`2026-07-28 23:59` China Standard
  Time)
- Maximum session: 12 hours, never beyond the absolute close

This review is not publication-rights approval, strict Flash fidelity
acceptance, product acceptance, classroom-use approval, or permission to
record, forward, download, republish, or present the prototypes as finished
HELP Math products. The public demo routes remain closed.

## Private delivery

Create or retrieve the existing high-entropy passphrase only in the approved
password manager. Send the fixed URL and the passphrase separately through an
approved private channel. Record only the channel name, sender, recipient, and
delivery time in the owner decision record—never the value itself.

The following facts still require the meeting owner to record in
`LAUNCH_DECISIONS.md`:

- the password manager or private-channel name used for delivery;
- confirmation that the recipient accepted the no-recording, no-forwarding,
  and no-republication boundary; and
- the named owner and selected post-meeting close action.

## Before the meeting

1. Confirm the meeting occurs before the absolute close above.
2. Open only the fixed entry URL. It must show the passphrase form and the exact
   UTC close time; never put the passphrase in the URL.
3. Confirm unauthenticated demo, runtime, and image requests still return
   private, non-indexable `404` responses.
4. Run one credentialed smoke and the one focused browser test from a private
   operator shell. Read the passphrase without echoing it, pass it only to the
   child processes, and remove it immediately afterward:

   ```zsh
   (
     set -e
     set +x
     read -rs 'EXEC_KEY?Executive preview key: '; printf '\n'
     PW_OUTPUT="$(mktemp -d /tmp/helpmath-executive-preview.XXXXXX)"
     cleanup_preview_check() {
       unset EXEC_KEY
       if [[ -n "${PW_OUTPUT:-}" ]]; then
         rm -rf -- "$PW_OUTPUT"
         unset PW_OUTPUT
       fi
     }
     trap cleanup_preview_check EXIT
     trap 'exit 130' HUP INT TERM

     EXPECT_EXECUTIVE_PREVIEW_STATE=login \
     EXPECT_EXECUTIVE_PREVIEW_EXPIRES_AT=2026-07-28T15:59:00.000Z \
     SMOKE_EXECUTIVE_PREVIEW_ACCESS_KEY="$EXEC_KEY" \
       npm run smoke:production

     PLAYWRIGHT_BASE_URL="https://www.helpmath.ai" \
     PLAYWRIGHT_EXECUTIVE_PREVIEW_ACCESS_KEY="$EXEC_KEY" \
       npx playwright test --output="$PW_OUTPUT" --grep \
       'executive preview grants a short-lived private session'
   )
   ```

   The parentheses create a disposable subshell, so the variable is removed
   as soon as the two checks finish or either check is interrupted. Playwright
   failures may capture a private demo screenshot; the exact `mktemp`
   directory is therefore removed by the same trap and must never be uploaded
   as an artifact.

5. Retain only the non-secret outcome: checked commit, GitHub/Vercel deployment
   references, UTC time, `executivePreviewState: "login"`, the exact
   `executivePreviewExpiresAt`, the expected demo/image/runtime counts,
   browser-test result, and `failures: []`. Do not retain a trace, browser
   state, cookie, or command output containing credentials.
6. Avoid repeated failed logins immediately before the meeting. The application
   and Vercel WAF intentionally rate-limit failures.

## During the meeting

1. Enter the passphrase on the fixed entry page.
2. Confirm the page shows exactly two private prototype cards.
3. Open `Conversion 1.2`, demonstrate Play, frame navigation, Replay, and the
   terminal state, then return to the executive preview.
4. Open `Conversion 1.4` and demonstrate the same controls and animation
   effect.
5. State that audio, strict visual validation, rights review, and product
   acceptance remain pending. Do not describe the prototypes as final.
6. Select **End private session** before closing the browser.

If the entry says the preview is unavailable, do not bypass it with a direct
demo or asset URL. Confirm the approved time window and contact the review
operator through the private channel. If a passphrase fails, stop repeated
attempts and have the operator verify the current review configuration.

## After the meeting

The default close action is to set the Production
`EXECUTIVE_PREVIEW_ENABLED=false` and redeploy. Rotating both the access
passphrase and session-signing secret is required instead when an earlier
session must be invalidated immediately or a new approved review window is
created. Never rotate only one credential and assume every earlier session is
closed.

After the close deployment:

1. Confirm both language entry routes show **Executive preview is
   unavailable**.
2. Rerun
   `EXPECT_EXECUTIVE_PREVIEW_STATE=unavailable npm run smoke:production` and
   confirm both entry routes report the unavailable state, all four localized
   demo paths, 12 image resources, and two runtime resources are closed with
   private/no-store/noindex boundaries, and `failures: []`.
3. When the signing secret was rotated, verify an earlier cookie no longer
   authorizes a demo, then discard the cookie without retaining it.
4. Record the owner, UTC completion time, non-secret Vercel change/deployment
   reference, verification result, and any exception in
   `LAUNCH_DECISIONS.md`.

Only a separately approved future review may set a new passphrase, independent
signing secret, and absolute close time. Executive review does not change the
public promotion requirements in `DEMO_PROMOTION.md`.
