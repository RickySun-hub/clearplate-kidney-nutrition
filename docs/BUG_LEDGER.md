# Bug ledger

## AUTH-01 — restored tab mistakes same-session rotation for account change

- Status: fixed locally in `78d961d`; NOT pushed or deployed. Production baseline is `d6f296e`.
- Reproduction: begin restoring saved credentials; hold the `/user` response; another tab updates the same saved session with rotated tokens; release the original identity response. Baseline throws “Account changed in another tab” and leaves the restoring tab signed out. Persisted credentials usually survive, but an emitted null session clears the app's restored navigation. This can resemble logout on browser restart; it is not confirmed as the user's live root cause.
- Root cause: `assertCurrent` allowed rotation adoption only when `session.verified` was already true. A restoring session is deliberately unverified. Unconditionally emitting during adoption would also send a false sign-out while verification is pending.
- Affected code: `src/utils/careCloud.js` (`assertCurrent`, token notification, delayed authentication rejection).
- Fix: adopt only a newer unexpired rotation with the same saved user ID AND session ID; retain mandatory `/user` identity verification; notify only verified sessions. A delayed 401/403 for the old access token asks for retry instead of clearing the newer rotation. No automatic retry loop or expiry/security policy changes.
- Regression: `src/utils/sessionPersistence.test.js` tests named “restore survives same-session rotation…”, “pending restore rejects another session…” and “late rejection of the pre-rotation token…”. First test failed before the fix. Also checks no account exposure before verification, no false logout event, replaced session rejection, interrupted/disposed restore, credential preservation and verified retry.
- Verification: 36 focused session/cloud/Google tests passed; build and diff check passed. Existing bundle warning remains. Synthetic deferred HTTP/storage responses only. Earlier Chromium restart tests passed before this fix; they are not a browser reproduction of this race.
- Rollback: revert `78d961d` for code-only rollback. If this batch is later released, prior production is `d6f296ed96a01d0e88883a25eee83a324600f17e`, deployment `dpl_9aYcgDg44ycJp4yvtuMEYxWuBZNr`. No deployment performed in this batch.

## SEARCH-01 — `and` incorrectly becomes a required ingredient

- Reproduction: “banana yogurt” matches, “banana and yogurt” does not.
- Root cause/code: tokenized conjunction participates in all-term matching, `src/utils/recipeSearch.js`.
- Fix: `d6f296e` (deployed); treat `and` as a list separator, retain every substantive term and exact/fuzzy ranking.
- Regression: `src/utils/recipeSearch.test.js` ingredient-list test; `scripts/browser-recipe-search.mjs` tests “mango and cucumber” and an unmatched combination.
- Verified scope: synthetic unit data and actual UI with bundled recipes/mocked authentication; no live authenticated search proof.
- Rollback: `e80185c`, branch `release/nepholio-rollback-20261018`, deployment `dpl_9FB7A5TrTDhvjUg7XauWjLE3Nq5D`.

## FOOD-01 / NUM-01 — source identity, reuse scaling and tiny totals

- Reproduction: inspected USDA ID can differ from selected ID; fresh search can bypass inspection; same-name recent foods disappear; legacy `baseEstimate` and grams fail to scale consistently. Separately, 0.004 displays as zero and reordered 0.1/0.2/0.3 contributions produce different floating-point totals.
- Root causes/code: absent inspected-source eligibility and name-only dedupe in `foodGuide.js`; mixed canonical/scaled estimates; display rounding and order-dependent accumulation in `nutrition.js`.
- Fixes: `82cf5fb` source/portion integrity; `e80185c` tiny display and deterministic totals. Included in production `d6f296e`.
- Regressions: existing `foodGuide.test.js` source-ID/reuse tests and `nutrition.test.js` tiny-display/order tests. See [reconciliation](NUTRITION_RECONCILIATION_20261016.md) for before/after evidence and historical report limitations.
- Verified scope: synthetic data. Unknown remains null, explicit zero remains zero, source grams are never invented. Sorted floating-point sums are deterministic, not arbitrary decimal arithmetic.
- Rollback: release-level `d196e83`, branch `release/nepholio-rollback-20261017`, deployment `dpl_AUPJ2fGsiD25vdz3kTBTWiPhBXUu`. It predates these fixes, so rollback reintroduces their defects; prefer a targeted revert for an isolated future regression.

## Unverified reports / next evidence needed

- Browser-restart login complaint: AUTH-01 is a concrete candidate, not a confirmed explanation. Ordinary synthetic Chromium restart, token refresh, cross-tab logout and revocation passed. Native live QA has no valid signed-in session.
- Request only nonsecret observations: browser/version, OS, normal/private mode, exact site origin, login method (Google/email), route before closing and after reopening, approximate closed duration, whether other tabs/windows were open, whether site data is auto-cleared, exact visible error, and whether “Retry saved sign-in” recovers. If authorized authenticated QA becomes available, record only request path/status/timing and whether storage exists; never token values or clinical records.
- Interrupted network/provider refresh and device storage policy remain live investigation boundaries. No extension of expiry, disabling revocation, broadening grants, or speculative auth redesign is justified by this report.
- Patient/RD workspace mode is not clinician credential verification. Existing grant/consent logic passed mocked checks; live database enforcement was not retested. No production access-setting change is part of these fixes.

### AUTH-01 final review evidence

Final application diff versus `d6f296e` is limited to two guards in `careCloud.js`: same-user/same-session unexpired rotation adoption during restore (without emitting an unverified account), and preserving a newer token after an old token's delayed rejection. The `/user` identity comparison, expiry checks, refresh revocation handling, generation checks and sign-out clearing remain in force.

Focused command in DEBUGGING.md: 36 tests pass, including:
- `pending restore rejects expired rotations, account/session changes, logout and disposal` (five independent race scenarios).
- `late rejection of the pre-rotation token preserves the newer session for verified retry` (both 401 and 403 `/user` responses; account remains null until fresh verification).
- `offline refresh keeps the recoverable session; revoked refresh removes it`.
- `deliberate logout removes persistence immediately even offline`.
- `logout while refresh is pending cannot resurrect saved credentials`.
- `rejected restored identity never exposes an account`.
- `stale account response cannot return private records or clear a newer session`.
- `Missing, expired and wrong-origin verifier cannot exchange a callback code`.
- `A token response cannot authenticate an unverified user`.

These are synthetic responses, not authenticated live provider tests. Build passed for the application fix; subsequent changes are regression coverage and documentation only. Deployment remains paused. Dedicated review branch: `fix/session-restore-rotation-20261018`, based on released `d6f296e`; no unrelated application changes included.
