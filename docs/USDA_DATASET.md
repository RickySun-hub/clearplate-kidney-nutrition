# USDA ingredient dataset and local nutrition backend

This implementation preserves the 94 original workbook recipes and browser meal records. It adds ingredient-level gram calculations and an independent, unreviewed USDA audit. It does not replace workbook nutrition or claim clinical validation.

## Run locally

Run `npm run dev:api` in one terminal and `npm run dev` in another. Open http://127.0.0.1:5173. The API binds to 127.0.0.1:8787; Vite proxies `/api` locally. No database or paid service is needed. The local API does not automatically read private `.env` files.

Without a server key, search/detail use the bundled public snapshot. An approved server process may set `USDA_FDC_API_KEY` from its secret store to enable live search/detail. Never use a `VITE_` key or put a private key in client code. This change has not been deployed.

## Data lineage and limits

The catalog contains 8,156 records from official USDA downloads: [Foundation April 2026](https://fdc.nal.usda.gov/download-datasets/) and final SR Legacy April 2018. The release age is retained per food. Archive URLs and SHA-256 checksums are in `public/data/usda-manifest.json`. Household portion averages often require SR Legacy; newer Foundation records are not assumed to contain every nutrient or household measure.

The dataset has 377 computational food correspondences for unique source ingredient strings, selecting 135 foods. These are draft correspondences, with approximations and unresolved items recorded explicitly. Among 614 source ingredient rows, 327 currently have usable original-batch gram weights. All 65 recipes with source ingredients remain **partial**; 29 workbook-only recipes remain **unavailable**. No recipe is currently represented as a complete verified USDA calculation.

`src/data/usdaIngredientMatches.json` stores exact original ingredient text, FDC ID, optional USDA portion ID and assumptions. `src/data/usdaFoods.json` retains selected nutrient amounts and actual nutrient IDs. `src/data/usdaRecipeAudit.json` stores all rows, source yields, per-nutrient missing counts, complete bounds where possible, and known partial lower subtotals. `server/data/usdaCatalog.json` supports offline backend searching.

Public, reviewable exports:

- `/data/usda-ingredient-review.csv`: food matches, units, portions, gram weights, issues and source links.
- `/data/usda-workbook-comparison.csv`: retained workbook values, USDA complete values, known lower subtotals and missing counts.
- `/data/usda-recipe-audit.json`: full audit dataset.
- `/data/usda-manifest.json`: dataset counts, releases and archive checksums.

For each nutrient: `batch = sum(ingredient grams × USDA amount per100g / 100)`; `per serving = batch / original recipe yield`; `selected cooking batch = per serving × cooking servings`. Arithmetic stays unrounded until display. Ranges retain lower/upper bounds. Missing weights, food matches or nutrient values leave the relevant total `null`, never zero. Known subtotals are separate and cannot be treated as totals.

Mass units convert exactly. Volume-to-mass conversions require a compatible food-specific USDA portion, including its amount denominator. ml is never assumed to equal grams. Size-specific counts, preparation differences, packages/draining, dry/cooked alternatives, additional unquantified ingredients and pinch/to-taste amounts require review. No cooking retention, moisture/yield changes or waste correction is applied. The source recipe's serving fraction is retained; a physical serving weight remains unknown unless independently measured.

## Backend contract

| Endpoint | Input | Result |
| --- | --- | --- |
| GET `/api/fdc-search` | `q`, optional `pageSize` (1–50), `dataTypes` | Normalized USDA foods, source mode, releases |
| GET `/api/fdc-food` | `fdcId` | Normalized per-100g food, household portions, nutrient IDs, source |
| GET `/api/recipe-audit` | `id` | Generated source audit, including unavailable recipes |
| POST `/api/recipe-calculate` | JSON below | Stateless recalculated audit and selected batch |

```json
{
  "recipeId": "hummus",
  "cookingServings": 12,
  "overrides": [{ "index": 1, "grams": 48, "fdcId": 167747 }]
}
```

An override weight is **edible grams for the full original recipe**, not selected cooking grams. Index refers to the original source ingredient array, including headings; headings cannot be overridden. The original recipe yield remains the divisor. Overrides are cloned in memory and never written to disk, meals or a third party. Payloads are bounded to 20 KB and IDs, indices, duplicate rows, grams and servings are validated. Unknown IDs and missing recipe sources are rejected.

The calculation endpoint uses the bundled snapshot even if search/detail are live. A live-only food ID cannot be calculated until its reviewed record is added to the snapshot. Live search/detail use a fixed USDA host, an 8-second timeout, bounded responses, caching and per-instance quotas. These quotas are not a global multi-instance deployment limit. [USDA API documentation](https://fdc.nal.usda.gov/api-guide/) describes authentication and upstream limits.

The recipe detail audit provides food search, measured-gram edits and backend recalculation. Edits affect the displayed draft and ingredient grams; download its JSON to retain review evidence. They are discarded when leaving the recipe. Cooking servings change ingredient quantities and batch estimates independently of the eaten meal portion. Source instruction text retains its original quantities, so the page points cooks to the scaled ingredient list.

## Reproduce

Download and extract the two exact public archives listed in the manifest under `output/usda/raw`. Then run:

```powershell
python scripts/import-usda.py --raw output/usda/raw --out output/usda/catalog.json
node scripts/build-recipe-audit.mjs
Copy-Item -LiteralPath output/usda/catalog.json -Destination server/data/usdaCatalog.json
npm test
npm run build
```

The importer preserves missing values and nutrient IDs, checks expected units, and uses energy 1008, then 2048, then 2047. Source archive checksums make a refresh reviewable. After changing the catalog or audit, restart `dev:api` because its read-only services cache source data in memory.

## Verification recorded for this change

Two genuine public USDA `DEMO_KEY` requests succeeded (lemon juice search and FDC 167747 detail). No private credentials were read. The downloaded API detail normalizes to the same nutrient values and IDs as the bundled lemon record. The USDA household portion is 48 g for one lemon's juice yield; the meeting's 47 g was not imposed on this record.

Unit and API checks cover missing-as-null, food-specific portions, embedded lemon scaling, ranges, exact piece mass, malformed parameters, timeouts, cache behavior, oversized bodies and stateless overrides. Browser checks cover category/diet/sodium filtering, 0.5/12 cooking servings, unchanged workbook/eaten values, backend gram editing, and a 390px mobile layout. Clinical/content review and private-key deployment operation remain unverified.
