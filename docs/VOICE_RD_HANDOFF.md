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


## 2026-10-07 conversational recall and dietitian dashboard

- Voice uses bounded multi-turn history, one follow-up at a time, browser spoken replies, meal selection based on local time and existing records, explicit food confirmation and separate meal review statuses.
- Outside-food source/weight still require review. Users can explicitly save a description with unknown nutrients. No AI-generated nutrient values enter the record. This is turn-based voice input, not continuous realtime listening.
- Confirmed entries retain timestamped user transcripts, assistant questions, input method and confirmation time. Spoken text is automatic transcription, not original audio. Audio is not persisted. Skipping a meal prompt is distinct from reporting that a meal was not eaten.
- RD dashboard adds patient context, daily saved-target comparison across the existing 28-nutrient catalog, food details, original conversation and transcript CSV/JSON export/import. Daily targets are never compared against multi-day totals. Logging timestamps are distinguished from user-recorded meal times.
- Existing patient-controlled snapshot upload and RLS grants are reused; no schema migration or automatic patient upload. Patients must upload again to share new entries. Older records have no retroactively invented transcripts.
- Verification: unit tests cover history bounds, original-text round trip, daily totals/unknown values and model response sanitation. Browser regression uses synthetic audio plus mocked AI responses to test multi-turn context, no pre-confirmation write, spoken confirmation, meal review, RD originals, unknown-food save and 390px layout. Actual OpenAI two-turn text recall returned a clarification followed by a reviewable boiled-egg draft and 08:30 time.
- Live Supabase transaction: synthetic owner and RD, original text round trip, authorized read, denied RD write and denied read after revocation all passed; rolled back all fixtures. No real patient records were accessed.
- Browser reproduction: start `npm run dev`, open a Playwright CLI browser named `conversationqa`, then run `playwright-cli -s=conversationqa run-code --filename scripts/browser-conversation-rd.js`. Fixture is development-only and not part of the production bundle.

## Native voice update — 2026-10-07
- Main meal recall now uses OpenAI `gpt-live-1` over WebRTC (project model list and a real session verified). Default English, one question at a time, individual share rather than assuming equal portions. Browser TTS is no longer used for meal replies.
- Fixed opening clips use OpenAI `gpt-4o-mini-tts`, voice `marin` (the official dedicated TTS model); live conversation uses `gpt-live-1`, also `marin`. Pre-rendered clips make greeting deterministic even when the live model waits for caller speech. No claim of identical internal ChatGPT model configuration.
- Server-only key; same-origin and verified Supabase account + existing atomic quota before session creation. No audio recording (`store:false`); browser closes calls at five minutes, on End, logout or unmount. Five-minute timer is a client UX limit, not a server-enforced billing cap; existing project spend limits remain important. Pause mutes the mic but leaves a billed session active, as disclosed in UI.
- Review food ends the call, preserves exact original transcript fragments in timeline order, and uses the existing editable draft/confirmation flow. Only one source-matched food is drafted at a time; additional foods remain in the original conversation for review. Model speech cannot directly write patient records.
- Dedicated upload fallback now uses `gpt-4o-transcribe` with `language:en`; text interpretation uses `gpt-4.1` with explicit default English and shared-portion clarification.
- Actual WebRTC synthetic-English test: six eggs shared by three prompted a question about the user's own share; quarter-pan and 08:30 retained; assistant then asked about drinks. Output audio played; pause disabled microphone; review ended tracks; 390px had no overflow. This does not establish accuracy for all accents or medical use.
- Browser mock handoff verifies no save before confirmation and exact voice transcript + meal time reach records. Unit tests cover origin/auth rejection, secret-safe errors, config validation and transcript order. No real patient data used.
