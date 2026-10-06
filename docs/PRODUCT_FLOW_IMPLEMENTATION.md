# ClearPlate implementation roadmap

This change delivers the How it works page. The following phases are proposals, not activated backend features. No paid services or patient migrations were created.

## Existing capabilities checked

- CareConnection/careCloud: verified Supabase authentication, explicit snapshot upload, patient-controlled RD account-ID read grants. No practice roster or automatic sync.
- VoiceAssistant/server/voice: short recording or text to food draft, explicit confirmation to save; source-step next/previous/repeat and browser speech. No continuous conversation or pantry recipe search.
- Planner/profile/nutrient catalog: saved targets, food totals, portion-aware planning, missing-value coverage. Diagnosis alone must not choose restrictive targets.
- Phone client exists; SMS provider is inactive. Primary region is US/Canada (+1). Google remains in Testing pending public-release setup.
- No subscription entitlement or practice-sponsored billing exists.

## 1. Account ownership, invitations, and patient records

First scope device storage to authenticated user IDs. Offer an explicit import of old local records; never silently attach them to the next signed-in account. Add normalized cloud meals with owner ID, actual occurrence timestamp, timezone, recipe/version, amount, units, nutrient snapshot, source, uncertainty and missing-data coverage. Use idempotent save IDs and version checks to prevent duplicates/conflicts.

Proposed tables: practices, practice_members, patient_invitations, practice_patients, patient_consents, nutrition_target_versions, meals, meal_items, audit_events. Keep practice membership, record consent and payer separate.

An RD invites a verified email or E.164 phone number. Use expiring single-use invitation tokens stored as hashes, rate limits and no account-existence disclosures. The patient signs into their own account, verifies the intended contact, reviews the practice and accepts sharing. Bind the relationship to auth.uid(), not a phone string (numbers can change/recycle). Never give an RD the patient's password. Revoking sharing must preserve the patient's food history.

RLS tests using synthetic data: two practices cannot see each other's patients; wrong-contact/expired/replayed invites fail; revocation takes effect; switching accounts never exposes the previous user's local meals. Audit access changes without logging private record payloads.

## 2. Personal subscription and RD-sponsored access

Use hosted checkout and verified, idempotent payment webhooks. Proposed tables: billing_accounts, subscriptions, practice_seats, entitlements, billing_events. Do not grant access from a checkout success URL or store card data.

Access can come from a personal subscription or active sponsored seat. RD sponsorship covers the patient's included access under agreed practice terms. Prevent unnecessary simultaneous personal charges; make transitions explicit. Define seat limits, grace periods, cancellation, sponsorship end, export and read-only history access before launch. Enforce entitlements and AI quotas on the server, not only through hidden buttons.

Business decisions needed before activating charges: personal price/currency/interval, practice seat price, included voice use, spending cap, sponsorship transition and refund policy. Do not hard-code invented prices or start live billing from this roadmap.

## 3. Ingredient-first meal recommendations

Parse speech into structured ingredients, preferences, exclusions, portion and meal-time intents. Search the existing recipe library with normalized ingredients. Compute portions and nutrition from source data. Apply deterministic target/coverage filters before the model explains or ranks candidates; never invent recipe IDs or nutrient values.

Show ingredients still needed, known nutrients, unknown values and proposed portions. Saved maximum minus recorded intake gives remaining upper allowance, floored at zero; missing data remains incomplete, not zero. Minimum targets are gaps, not upper limits. Do not label a food medically safe/forbidden. Targets come from the individual care plan.

Selecting or cooking a recipe does not log consumption. Ask what was actually eaten, allow time/portion/ingredient edits, recalculate, then save on explicit confirmation. Store planned meals separately. Acceptance: a changed portion updates totals; unknown phosphorus never appears as complete coverage; repeated confirmation creates only one meal; exclusions cannot be overridden by model text.

## 4. Cooking dialogue

Begin with push-to-talk through the current transcription/text pipeline and browser speech. Maintain recipe version, scaled ingredients, current step, substitutions and unresolved quantities. Support interrupt, stop, repeat, next and previous. Pause playback while listening. Use source instructions; proposed ingredient changes require review and recalculation. Cooking alone never marks food eaten.

Evaluate continuous streaming separately for latency, cost and privacy. Request microphone consent explicitly; age must not automatically activate recording.

## 5. RD daily dashboard

After phase 1, query patient-consented cloud meals rather than occasional snapshots. Show day/week timeline, patient-local meal times, food/portion edits, nutrient totals/ranges, coverage, targets and their versions. Clinician-selected views can emphasize sodium, protein, potassium, phosphorus, carbohydrate, energy, fiber, fluid and other supported metrics.

Show missing records and missing nutrients: low recorded intake does not prove low actual intake. Add patient filters, last-sync status, audited exports and revocation. Avoid automatic disease-based prescriptions.

## Rollout and acceptance

Phase 1 precedes payment entitlements and replacing snapshot sharing. Develop recommendations with synthetic data while preparing billing. Continuous conversation follows a reliable confirm-and-save flow. Pilot with a test practice behind feature flags. Preserve old snapshots during migration, prepare tested backup/rollback, and obtain specific authorization before live patient-storage migration. The explanation page labels planned functionality and has no pretend checkout or invite buttons.
