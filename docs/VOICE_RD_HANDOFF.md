# ClearPlate release status — 2026-10-04

- Git checkout: existing main branch; no commit or push performed. Existing unrelated changes preserved.
- Dedicated Supabase project: izbchwumzlowpprbdsyc (us-west-1); never shares ProofRound patient storage.
- Applied care records/grants RLS and voice quota migrations. Care SQL regression transaction passed and rolled back all synthetic fixtures.
- Server environment configured for Vercel preview: SUPABASE_URL, SUPABASE_ANON_KEY, VOICE_ENABLED. Values are not documented here.
- 2026-10-05: OpenAI Platform reconnected; Codex key created securely and saved to ignored .env.local, then configured as server-only OPENAI_API_KEY for Vercel preview. Live synthetic text interpretation succeeded (food intent).

## Implemented

Opt-in voice UI and authenticated, quota-limited server pipeline; source-step cooking navigation; manual fallback; USDA food selection and weights; missing food placeholder; category/diet/source/snack filters; practical household quantities and max two decimal formatting; editable URL/JSON-LD recipe imports with local persistence and unknown nutrition; 28-nutrient RD report with timestamps, date filters, provenance, coverage, exports and patient-controlled cloud snapshot sharing/revocation.

USDA is an 8,156-food public Foundation/SR Legacy snapshot when no live FDC key is configured. It is not a live Branded/FNDDS feed. Barcode scanning and a dedicated clinician review queue are not implemented. RD cloud sharing uploads an explicit snapshot; it is not automatic real-time synchronization. Imported recipes remain local and nutrition unknown until reviewed. Voice cooking currently navigates source steps, not arbitrary free-form cooking advice.

## Validation

- npm test: 125/125 passed.
- npm run build: passed; bundle-size warning remains.
- Browser: USDA match + 118g + 08:15 persists; unmeasured food makes totals Unknown; RD timeline/source verified; Hummus batch 12 scales lemon to 1 1/2; imported synthetic recipe survives reload; 390px mobile viewport has no document overflow; missing key status shown accurately.
- Voice provider unit tests use mocks, 13/13 passed. A live synthetic text request passed on 2026-10-05; microphone-to-OpenAI audio has not been tested live.
- Cloud RLS tests are real SQL; patient/RD account email signup and cross-device UI were not exercised with real users.
- Deployment target is Vercel preview with Vercel authentication protection. Production domain has not been replaced.

No real patient data was uploaded. SQL fixtures are transaction-rolled back. Browser QA records are isolated synthetic local records.

## Final cloud verification

Voice verified-account RPC migration applied; voice_quota.sql transaction passed and rolled back. Confirmed email/phone, unverified/anonymous rejection, cooldown, user/global budget and private table access checks passed.

Preview READY: https://clearplate-kidney-nutrition-8j0vcd32h-rickysun-hubs-projects.vercel.app
Deployment ID: dpl_7FrjP3HbcFR5LZkELXyqFwr1eh3m. Vercel authentication protection remains enabled. Build passed remotely. No live HTTP smoke test of deployed endpoints was run.

## 2026-10-05 UI and account entry correction

Voice entry is now a large purple feature banner; meal selections use solid blue/checkmarks; nutrient selection uses consistent bordered cards with explicit tracking status; Smoothies appears in Plan and Recipes as coming soon with no invented nutrition.

Supabase clearplate ACTIVE_HEALTHY verified. Email/password auth enabled, signup enabled, confirmation required. Added direct Sign in/Create account entry and a voice-to-account action. Errors distinguish unconfirmed email, invalid credentials, and email delivery configuration/rate limits. Existing cloud snapshot upload remains explicit and patient-controlled.

Live synthetic verified account: real REST password sign-in, /user validation, record upload/readback and logout passed. Browser sign-in enabled Start microphone. Temporary account, session, record and local fixture removed after testing. Actual signup confirmation email delivery was not tested. No real patient data accessed.

Targeted care/recipe tests passed; added three auth-error code cases (care suite 12/12). Build passed. Desktop 1440px and mobile 390px Plan, Smoothies empty state, profile selector and account entry checked with Playwright. No document horizontal overflow.
