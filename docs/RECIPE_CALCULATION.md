# Ingredient-based recipe calculation

Entry point: **Recipes → Create recipe from ingredients**. Select full USDA food records, enter grams or a multiplier of one listed food-specific measure, review the preparation state, set equal servings and optionally confirm measured finished weight, then save. Reopen a calculated recipe from the library to edit or log equal servings / grams. The existing cookbook audit remains separate; this feature does not relabel its unreviewed matches as reviewed.

## Calculation contract

- Each ingredient keeps the selected full food record (FDC ID, description, data type, release when supplied, nutrient basis, nutrients and portions), quantity, measure selection, and user-reviewed preparation state. Selecting Raw/Cooked annotates the chosen record; it does not convert it. A different state requires a different database match.
- Supported records use nutrients per 100 g. A selected household measure multiplies its specific `gramWeight`; the displayed measure includes its source amount. There is no generic volume/density conversion. Unsupported records or missing weights remain unresolved. Search uses the existing USDA API and its existing local public-download fallback; no credentials were added.
- Batch nutrient = sum of ingredient grams × database nutrient / 100. Calculations retain numeric precision; display formatting is the only rounding step. This also removes intermediate rounding from existing meal aggregation helpers.
- Equal serving = batch / number of servings. Per 100 g = batch × 100 / yield grams. Gram portion = batch × portion grams / yield grams.
- Yield is confirmed measured finished weight, or the complete sum of ingredient grams explicitly labeled estimated/pre-cooking. An unconfirmed measured yield blocks weight-based amounts. Ingredient edits invalidate its confirmation. Yield changes never change batch non-water nutrients. No retention, drained-liquid, or edible-yield corrections are inferred.
- Any missing contributing value makes the nutrient total and derived portions null. Review shows nutrient-specific ingredient coverage and the incomplete known batch subtotal. All-unknown subtotals remain null, including phosphorus and potassium. Unknown nutrients are excluded from numeric library ceilings.

## Persistence and history

Uses the existing `customRecipes` / `customRecipeDetails` care-record fields; no database migration or permission change. Saves create immutable recipe IDs. Earlier versions remain in the stored catalog for historical references and are retired from new recipe selection. Their nutrition is not overwritten. New recipe meal entries snapshot their nutrition and calculation provenance. Ingredient changes are drafts until explicitly saved; navigating away discards unsaved edits. Existing record-size / recipe-count limits still apply and produce the existing save error.

Measured and unmeasured recipes can contain unknown nutrients or unresolved ingredients; saving does not make them complete. Weight-based logging is unavailable when yield is unresolved. Only the current user's authorized record is written. Existing RD views remain read-only.

## Verification

- `npm test`: 189 passing tests, including six new recipe calculation tests.
- Required sodium examples: 1,000 mg / 800 g = 125 mg per 100 g; 200 g = 250 mg; four equal servings = 250 mg each. Changing yield to 1,000 g preserves batch/serving totals and gives 100 mg per 100 g. Doubling ingredients and yield preserves concentration.
- Missing phosphorus, all-unknown potassium, unsupported volume basis, missing weights, food-specific portions, precision, measured-yield reconfirmation, record validation and immutable snapshots tested.
- `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-recipe-calculation.mjs`: actual app with synthetic auth/food/data endpoints. Creates, saves, logs a gram portion, edits a new version, verifies earlier log unchanged, reloads source/state/quantity, and checks unresolved weights. Desktop 1440 px and mobile 390 px: no horizontal page overflow or browser errors.
- Playwright used because this workspace exposes local Chromium. Screenshots are actual rendered app screens with synthetic records, not a standalone fixture.
- Visual inspection against the existing app design: existing navigation and typography retained; background palette retained; headings and separators replace nested panels; source and numeric labels remain readable; mobile fields and nutrient reviews stack without clipping. No external recipe text, images, or new visual assets copied. No separate concept image was requested.

## Public behavioral references

Only general recipe/yield concepts are used; no Cronometer proprietary food data or code:
- https://support.cronometer.com/hc/en-us/articles/360018510311-Create-Custom-Recipe
- https://support.cronometer.com/hc/en-us/articles/4406291608724-Set-Cooked-Recipe-Weight

Limitations: selected USDA values are estimates and require a suitable food/preparation match. Per-100-ml records and unweighted portions are not converted. Recipe nutrient retention and discarded-liquid adjustments are not modeled. Saves require the existing signed-in care connection. Database completeness is never a clinical safety judgment.

## Patient experience redesign

The default Recipes page now starts with the existing speak/type description flow and a short reusable-recipe list. Cookbook browsing and source import are optional disclosures. Reusable recipes open to a portion and Save meal; editing is optional. A new recipe can be saved and logged in one action, or kept for later.

Food matching still requires review. Ingredient quantities start at one explicitly displayed, food-specific household measure when available; no-measure foods start with a blank gram amount, never an invented 100 g. New recipes default to one whole-recipe portion, stated beside logging. Sources, conversion weights, preparation annotations, yield, and nutrient tables are in Advanced review & editing. Important missing-nutrient and unconfirmed-yield warnings remain outside it. Meal/time editing is collapsible. Calculations, source snapshots, retired versions, and RD detail are preserved.

Focused verification: 36 tests passed (calculation, nutrition, recipe filters, care records), production build passed with the existing bundle warning, and both browser scripts passed at 390/1440 px. Visual inspection checked navigation, readable labels, primary save placement, collapsed detail, visible uncertainty and no horizontal overflow. The existing design system was retained; no external visual assets were copied.

### What browser testing actually used

- The original b1787de browser test and `browser-recipe-calculation.mjs` use **mocked USDA food records**, auth and storage. These deterministic inputs verify 1,000 mg sodium calculations, missing phosphorus, changed yield, immutable logs, and saved version reload.
- `browser-patient-recipes.mjs` uses **real local HTTP USDA search and food-detail handlers backed by the repository's public USDA snapshot**, with `USDA_FDC_API_KEY` unset. It asserts `provenance.live === false` and `mode === 'snapshot'`, selects Bananas, raw, uses an actual returned household portion, saves/logs and repeats that saved recipe. Only auth/storage are mocked. This is not a live USDA API test.
- The describe-food button and text-entry path are tested. No live AI/audio inference or real cloud account was used. If the existing assistant backend is unavailable, existing manual/unknown-nutrition paths remain available.
