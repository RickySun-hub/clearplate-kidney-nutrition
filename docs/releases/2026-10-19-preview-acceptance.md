# Preview acceptance follow-up

No product code changed. No push, deployment or production data changes.

## Time verification

`browser-plan-timezones.mjs` uses the actual App with synthetic auth/cloud and fixed browser time 2026-10-20T06:12Z. It passes independently in America/Los_Angeles (2026-10-19 23:12) and Asia/Tokyo (2026-10-20 15:12). Both backdate a plan item to 2026-10-18 23:55, verify stored date/time/timeZone/timeSource, reload and verify displayed 23:55, then exercise undo/reload and profile filtering. It also asserts that 2026-10-19T18:12Z is 11:12 in LA (03:12 next day in Tokyo).

Original screenshot context did not specify timezoneId. The 06:12 PM field is not evidence of LA time correctness. Defaults use browser local timezone, not a saved patient timezone. Entries store wall-clock date, HH:mm and IANA timeZone, with UTC recordedAt/confirmedAt separately. Display preserves recorded wall time, without viewer-zone conversion. No timezone selector or historical timezone inference exists. Blank time remains unknown; scheduled/creation time is not promoted to eaten time. Inputs initialize when the component opens and do not advance continuously while it remains mounted. App today date does refresh at midnight, but an already-open editable field can remain on its initial date/time. Cross-zone travel, DST repeated-hour resolution and a long-open midnight form are not established by these tests.

## Portion semantics

Source recipeDetails for mango-salsa-wontons explicitly has servings=24 and servingSize="1 wonton". Source stored nutrition is 40 kcal per serving. 1.5 servings = 1.5 wontons = 60 kcal, 1.5 g protein, 9 mg sodium; whole batch = 24 servings = 960 kcal. No extra factor of 24 is applied to 1.5. This is a source serving, not a personalized meal-size recommendation. The Plan phrase "personal portion" and lack of visible "1 wonton" remain a usability gap. Calculated recipes use user-declared equal yield, not an inferred diner count. Missing yield blocks whole-batch resolution; missing grams remain unknown. Default add/log amount is one; optimizer suggestions can differ (e.g. 1.5 or 2).

## Allergy acceptance

Shared assessRecipeAllergies is used in App recipe lists/picker, Plan generation/additions and local voice find_recipes. Plan also rechecks saved snapshots before marking eaten. Existing logs remain intact. Browser integration verifies a newly saved milk/custom-unknown profile disables saved-plan marking and excludes subsequent suggestions.

Passed negative cases: whey→milk; tahini→sesame; tofu→soy; mayonnaise→egg; pesto→tree nut; wonton sheets→wheat; Worcestershire→fish; prawns→shellfish; groundnuts→peanut. Missing lists, blank/partial ingredient objects, dressing, broth and alternative ingredients return unknown/excluded. Bread, pasta, noodles, sausage, bacon, ham, pastry, cake, cookies, crackers, tortilla, cereal and granola without formulation are excluded as unknown for milk. Pasta is unknown for egg; bread with whey is blocked for milk. Kiwi custom allergy with rice stays unknown/excluded; kiwifruit blocks. Unrecognized stored allergy IDs stay unknown. Local voice discovery returns rice/water but excludes rice/tofu and rice/sauce under soy allergy, with no network call or raw profile in response. Negative-control butternut squash does not match butter/milk; recipe title alone does not define ingredients.

Limits: finite English alias/compound vocabulary, not comprehensive allergen detection or cross-contact certification. Compound words remain conservative even when a formulation is included. Calculated recipes whose ingredients exist only under calculation.ingredients currently become unknown rather than being analyzed through that nested shape. Custom unknown allergies conservatively remove all automatic suggestions. USDA search, manual eaten-food logs and raw legacy server interpretation are not globally allergy-filtered; server interpretation receives no allergy profile. No claim that every provider answer or direct tool pathway is comprehensively filtered.

## Remaining scope

Plan idempotence tested within one app session and after reload: stable linked ID, duplicate-click guard, planning creates no intake, undo preserves independent logs. Cross-device simultaneous writes and production failures not tested. Move-to-meal copies label/time, preserving separate foods; it is not recipe merging. New plan does not delete old intake; original plan snapshot remains until replaced.

RD distinguishes daily and range totals, preserves coverage/statuses, and collapses secondary sections. Synthetic multi-day fixture has 400 range kcal versus daily 280/120; unknown nutrients are not zero. The ambiguous top boxes remain pending identification. No real patient, live provider, actual microphone or production service acceptance was performed in this follow-up.

Verification: two browser timezone runs plus 13 focused portion/allergy/plan unit tests passed. Earlier build/UI checks remain applicable because this follow-up adds tests/documentation only.
