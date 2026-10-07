# RenalSync

RenalSync is an adult ADPKD nutrition-tracking prototype with user-saved sodium and protein targets. Care-team review is not verified by the app.

## Features

- Daily sodium and protein progress
- Multi-select recipe logging with remaining-limit warnings
- 94 recipes imported from the project workbook
- Recipe course and nutrition filters
- Packaged-food manual entry and original unpackaged-food estimates with user-set planning ranges
- Recorded energy, daily completeness confirmation, and source serving descriptions where available
- Target snapshots for confirmed days; changing logged food requires a new confirmation
- Daily food history and meal-combination planning
- Local browser storage for this MVP

New records start without demonstration meals. Existing saved meals remain intact. For older unpackaged-food records, original `baseEstimate` values are used instead of counting an added safety margin as food eaten. Estimate ranges are user assumptions, not measured confidence intervals. The planner uses upper intake bounds for nutrient ceilings and lower protein intake bounds when computing the gap to the minimum.

## Run locally

```bash
pnpm install
pnpm dev
```

Create a production build with:

```bash
pnpm build
```

## Medical boundary

This prototype does not diagnose kidney disease or replace a nephrologist or renal dietitian. Nutrient targets should be confirmed with the patient's kidney care team. Potassium, phosphorus, calcium, fluid, and other nutrient considerations must be individualized.
