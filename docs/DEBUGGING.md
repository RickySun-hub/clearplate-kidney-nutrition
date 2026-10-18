# Debugging and regression workflow

Read this guide and [BUG_LEDGER.md](BUG_LEDGER.md) before changing an affected workflow. Older reports are historical evidence; their test counts and outstanding lists are not the current release state.

1. Establish the baseline: `git status --short --branch`, recent commits, and relevant diffs. Preserve unrelated edits. Before an authorized release, compare remote refs and the actual deployment commit; retain the old commit/deployment as rollback.
2. Pick one concrete symptom. Record exact steps, expected/actual behavior, route, synthetic input and affected code. Separate a reproduced failure from a user report or mock assumption.
3. Add a focused regression that fails on the baseline. Fix the cause without weakening identity checks, expiry, patient grants, unknown-nutrient handling or immutable historical records.
4. Run the relevant test command below and `git diff --check`. Run `npm run build` for application changes. Use actual browser checks for interaction/layout changes. Broaden testing only for new changes or unresolved failures.
5. Update the ledger with root cause, commit, verification limits and rollback. Never record credentials, tokens, real patient records, private email addresses or raw authentication/storage dumps. Log status/timing and whether expected fields exist, not their values.
6. Stop at the authorized boundary. A local fix is not a deployed fix. Record exact deployed SHA, deployment ID and rollback after an authorized release; distinguish deployment READY from a successful live authenticated smoke test.

## Focused checks (repository root)

- Restore/refresh/navigation: `node --test src/utils/sessionPersistence.test.js src/utils/careCloud.test.js src/utils/googleAuth.test.js`
- Real Chromium restart with mocked services: `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-session-workflows.mjs`
- Recipe search: `node --test src/utils/recipeSearch.test.js`; `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-recipe-search.mjs`
- Nutrition/source identity: `node --test src/utils/nutrition.test.js src/utils/foodGuide.test.js src/utils/mealConversation.test.js`
- Voice lifecycle: `node --test src/utils/voiceMeter.test.js`; `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-voice-orb.mjs`
- RD multi-day layout/CSV: `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-rd-usability.mjs`

Browser scripts need `npm run dev` on 127.0.0.1:5173. Only recipe snapshot checks also require `env -u USDA_FDC_API_KEY npm run dev:api` on 8787. Browser records are synthetic. Do not point mock-based scripts at production or treat them as proof of live access enforcement.
