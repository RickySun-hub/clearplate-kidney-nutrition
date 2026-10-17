# Nutrition repair reconciliation — not deployed

Read the complete October 14 report `Nepholio-Nutrition-Repair-Report-192-Tests-20261014.md`, Library ID `libfile_252e85f850488191a607ab01328335f3`. It names branch `fix/nutrition-integrity-20261014`, based on `ca6e431`, and explicitly says no push or deployment occurred. It does not identify a repair commit. That branch is absent from the available local/remote refs. The report verifies the earlier author's reported work, not that those changes reached this repository or production. Original task thread was not accessible through an exposed thread-reading tool.

## Actual findings

- Current `b1787de` independently retains full-precision nutrient scaling and accumulation. It does not establish preservation of the old repair.
- The old source-identity defect means requested USDA ID A can accept returned details for ID B. The whole B record, including nutrition and ID, can then be resolved under the selected A candidate. Also, matching can bypass inspection, or use a fresh search result after old inspection. This is a real selection/provenance association risk, not merely a list presentation issue.
- Recent-food name-only deduplication is a separate suggestion defect: different sources or portions with the same label disappear. Each retained opaque reference still resolves to its own complete record; deduplication alone does not combine A's nutrients with B's provenance. Hiding alternatives can nevertheless steer a user toward the wrong previous food.
- Legacy unpackaged reuse scales inflated top-level nutrients but leaves the canonical `baseEstimate` unscaled. Downstream nutrition uses `baseEstimate`, so the displayed/reused amount can disagree with calculated totals. Stored gram weight also failed to follow the serving multiplier.

## Focused follow-up

`foodGuide.js` now requires successful inspection whose returned FDC ID matches the requested candidate. Searches invalidate inspection for replaced candidates, failed inspection revokes eligibility, and an in-flight result cannot replace a newer candidate. Previously issued references remain intact.

Recent suggestions deduplicate identical source snapshots plus servings, including source type and recipe ID, with stable object-key ordering. Distinct FDC records, revisions, nutrient completeness or portions remain distinct. Canonical nutrients, optional legacy `baseEstimate`, and known gram weights scale once; the description states the multiplier. Missing nutrients remain null and no gram weights are invented. Existing records are not mutated.

Three added regression tests failed before the fix and passed after it. They cover same-name alternatives and source/nutrient resolution, failed/mismatched/missing/replaced inspection, legacy estimate reuse and subsequent reuse, gram scaling, null versus zero, and source immutability. Focused food-guide/meal-tools/nutrition suite: 18 passed. Build and `git diff --check` passed; existing bundle-size warning remains. All fixtures are synthetic. No browser or live USDA behavior is claimed for these unit checks.

## Still outstanding from the old report

- `formatAmount(0.004, 2)` still displays `0`, rather than `<0.01`.
- Totals still depend on input-order floating-point accumulation; they do not sort nonnegative contributions or derive all patient totals from the RD coverage calculation. A synthetic arithmetic stress probe confirms the order dependence; it is not a clinical magnitude estimate.

These two gaps are documented, not silently counted as repaired by this focused source/reuse patch. No deployment, UI change, schema/security change, or production write was performed for this follow-up. Production remains the prior `d196e83` release.

## October 17 release follow-up

Recovered clean branch at `67f4fd4`. Both previously outstanding issues reproduced with new regressions: `formatAmount(0.004,2)` displayed zero, and permutations of 0.1/0.2/0.3 changed floating-point totals. Formatting now labels positive values below display precision as `<threshold`, retaining exact zero and unknown separately. Coverage and bounds sort nonnegative contributions before summation; patient totals derive from coverage. Empty patient totals retain the previous zero behavior. No stored records are rewritten. This is deterministic ordinary floating-point arithmetic, not arbitrary decimal precision.

The new regressions fail before and pass after the fix. Twenty focused nutrition/source-identity/daily-review tests and the production build pass. Existing large-bundle warning remains. Production rollback retained: `dpl_AUPJ2fGsiD25vdz3kTBTWiPhBXUu`, application commit `d196e83a462af769d32f5035365635ab29141f2a`. Remote main was still `8e30558`; remote working branch was `940e57f`, with no intervening work found.
