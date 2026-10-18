# Bug ledger

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

## October 18 follow-up baseline

AUTH-02 was released as `c355827a4b958a0d0affa6a8590ba3121a498692`, deployment `dpl_BiMPJZxMuuBHtmxRGXdy5Ck6Ej66`, READY and assigned to nepholio.com. This is the rollback baseline for the following ordinary UI fixes. Session branch `dff12e7` remains excluded and blocked. No auth configuration, permissions, schema or real patient data changes.

## AUTH-03 — returning from signup leaves email flow on password step

- Reproduction: on signin or RD signin, choose New here, then Already have an account. The password step remains visible with no explicit way back to the initial email step. Baseline browser assertion failed (one password field instead of zero).
- Clarification: Continue with email is the first step of existing email/password authentication, not email OTP. There is no email OTP/password-recovery implementation to restore. Do not invent or enable it as a UI fix.
- Fix: `4ec7303`. Returning from signup resets the email step; add Back to email entry, clear the in-memory password on these transitions, retain email and patient/RD route. Explain that email sign-in uses a password. Existing provider verification remains unchanged.
- Regression: `node scripts/browser-email-navigation.mjs` passes signin, signup and rd-signin round trips, back navigation, cleared password, retained email and destination. `node scripts/browser-phone-availability.mjs` also passes. All provider/config responses mocked; no email/auth mutations.

## RECIPE-01 — invalid log portion saves a recipe before validation

- Reproduction: new recipe with a valid synthetic ingredient, blank portion, Save recipe & log portion. Baseline calls onSave once before showing the invalid-portion error; no meal is logged. Regression failed on the unexpected save.
- Fix: `f965d29`. Move existing portion validation ahead of recipe saving. No calculation, source identity or snapshot format changes.
- Regression: `node scripts/browser-recipe-recovery.mjs` passes blank, zero and negative portions without recipe/meal writes; failed search retry; mismatched USDA detail rejection/retry; failed recipe save; failed meal save and retry without another revision; half portion is exactly 100 g / 100 kcal, sodium zero and potassium unknown. Synthetic callbacks and mocked USDA HTTP responses only; this run does not use a live USDA service or the local USDA snapshot.

## Focused verification for AUTH-03 / RECIPE-01

- Actual Chromium: email navigation, phone availability, recipe recovery, recipe search and RD usability scripts pass. Recipe search uses bundled ingredient text. RD checks section focus, invalid date/export disabling and correction, distinct two-day totals, CSV, keyboard table access and mobile/desktop overflow. No new RD defect found; dashboard implementation unchanged.
- `node --test src/utils/recipeSearch.test.js src/utils/recipeCalculation.test.js src/utils/usdaSelection.test.js src/utils/rdReview.test.js src/utils/phoneAuth.test.js`: 22 tests pass.
- `npm run build` and `git diff --check` pass; existing bundle-size warning remains.
- Release scope: these two proven UI/order defects only. Rollback commit is c355827, retained separately before release. No main merge; report exact deployment status and domain after release.
