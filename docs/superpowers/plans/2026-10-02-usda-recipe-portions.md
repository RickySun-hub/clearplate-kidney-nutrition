# USDA recipe normalization and portions implementation plan

**Goal:** Match the existing recipe ingredients to traceable USDA foods, calculate gram-based nutrition without inventing missing weights, fix recipe scaling, and improve recipe discovery.

**Architecture:** Retain React/Vite and the existing workbook nutrition and saved records. Add reproducible USDA snapshot ingestion, structured ingredient quantities, a separate recipe nutrition audit, server-side FDC search/details, and multi-dimensional library filters. Incomplete calculations must remain partial and must not replace workbook nutrition or imply clinical review.

**Spec:** User request in this chat, 2026-10-02: prioritize USDA ingredient/gram alignment and dataset/backend, recipe filters, and serving/scaling correctness.

**Constraints:** No new paid service, no credentials read, no push/deployment/commit. Use public USDA downloads. Preserve original recipes and browser data. No fabricated grams, pinch weights, food matches, nutrition, or preparation details. Keep all unresolved mappings visible.

## Tasks and ownership

- [x] USDA dataset/audit (primary): ingest official Foundation/SR Legacy snapshots; retain FDC IDs, descriptions, portions, nutrient units and release provenance. Map ingredients with explicit assumptions; generate all-recipe reports with null totals for incomplete nutrients. Own scripts/build-recipe-audit.mjs, src/data/usda*.json, src/utils/recipeAudit.js and tests, api/recipe-audit.js, documentation and integration.
- [x] Portions/scaling (agent): own src/utils/ingredients.js and tests and src/components/RecipeDetailView.jsx. Export parseIngredient(text) -> {original, quantity, quantityMax, unit, foodText, scalable, issue}; formatIngredient(text, factor) -> string. Scale embedded counts, ranges and parenthetical quantities; leave ambiguous pinch/to-taste visible. Separate cookServings from eaten servings; show per-serving and batch context.
- [x] Discovery (agent): own src/utils/recipeFilters.js and tests, src/data/recipeMetadata.json, src/components/RecipeLibrary.jsx. Preserve IDs; correct Other categories by recipe content; support category, ingredient/name search, diet, preparation, source completeness and numeric nutrient ceilings. Do not infer verified vegan/difficulty/medical labels from titles. Root integrates any shared style changes.
- [x] FDC backend (agent): own server/fdc.js, server/fdc.test.js, api/fdc-search.js, api/fdc-food.js. Fixed USDA host, bounded validated queries, protected runtime key, timeout, bounded cache, rate limiting and missing-as-null normalized nutrients and valid portions; do not print keys or read env files. Server-only key absent -> explicit unavailable response. No package changes.
- [x] Integration/verification (primary): expose audit source, gram quantities and completeness in recipe details; serve audit API and document local/server verification. Run affected unit tests, full suite, build, browser recipe/filter/mobile regressions and diff check. Verify scaling without changing eaten/history data.

## Verification focus

Embedded "Juice from 1 lemon" count and pinch ambiguity; 0.5/1/12 servings; alternatives/raw-vs-cooked ambiguity; missing nutrients never zero; gram vs ml distinction; numeric filters exclude unknown; invalid/overlong backend queries; API key never reaches client or errors; no historical nutrition replacement; source recipe missing ingredients remains uncalculable.

## Execution ledger

Ruling: Work directly in the clean existing checkout, with disjoint agent-owned files; user authorizes local development and does not authorize new branches, commits or publication. User global instructions override generic skill worktree/approval/commit rituals.

Ruling: Public bulk downloads provide real USDA data without requesting or consuming a private API key. Snapshot comparisons remain estimates and separate from the workbook until content/clinical review.

Completion evidence: 80/80 tests; production build; actual HTTP and browser API search/recalculation; desktop/390px mobile; 0.5/12 portions; source JSON content unchanged; deterministic exports. All 65 sourced recipes remain partial and 29 remain unavailable pending measured edible weights/content review. Snapshot fallback and stateless review overrides are implemented; no deployment or Git mutation.
