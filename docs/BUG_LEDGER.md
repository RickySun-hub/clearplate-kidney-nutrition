# Bug ledger — isolated phone UI review branch

This branch is based directly on deployed `d6f296e`. The broader debugging guide and historical ledger were read on `fix/session-restore-rotation-20261018` before this work. They remain on that separate review branch; its blocked session-restoration implementation (`78d961d`, review head `dff12e7`) is deliberately NOT included here. Reconcile ledger entries when combining reviewed branches; do not drop either history.

## AUTH-02 — unavailable phone panel promises an SMS

- Reproduction: open `#signin` or `#signup`, then Continue with phone while provider settings report phone unavailable. The baseline shows Coming soon/unavailable, but also a disabled phone field, Send code, and “We will text you a sign-in code.” Reported by native live browser QA and reproduced with synthetic provider responses locally.
- Root cause: `src/components/CareConnection.jsx` rendered the SMS form regardless of availability, disabling controls instead of removing the contradictory content.
- Fix: `bc43c4e33a467805aa98cbee70ce30e3697bf9a7`. Render SMS fields, promise and actions only when phone auth is available. Keep the unavailable explanation and Use email instead fallback. Guard form submission when unavailable. No provider, SMS, auth configuration, permissions or expiry changes.
- Regression: `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-phone-availability.mjs` against local Vite (`npm run dev`). Failed before the fix (phone input count 1 instead of 0), passed afterward. Covers both signup/signin, unavailable and available provider UI, email/password fallback, and zero auth/SMS mutations.
- Existing negative tests: `node --test src/utils/phoneAuth.test.js` — both pass, including disabled provider/malformed number refusal and invalid-code rejection.
- Verification: actual Chromium UI with intercepted synthetic config/provider responses; no real SMS, sign-in, invitations or records. Build and diff checks pass; existing bundle-size warning remains. Local fixture evidence does not verify live SMS service.
- Status: local review only; no push/deployment in this batch. Rollback base: `d6f296ed96a01d0e88883a25eee83a324600f17e`, retained deployment `dpl_9aYcgDg44ycJp4yvtuMEYxWuBZNr`. Revert the focused fix for code-only rollback.

## Unverified issue kept separate

The browser-restart login complaint is not explained by this copy fix. A candidate restoration race is documented on the separate session review branch, pending explicit deployment approval; no live authenticated validation is claimed here.
