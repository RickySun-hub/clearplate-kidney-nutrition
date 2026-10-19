# RD and Plan local preview — 2026-10-19

Unpublished branch: feature/patient-plan-allergy-preview-20261019. No push, deployment, main merge, database migration, security or permission changes. Prior RD preview 1e93c6b is retained. Ancestors b1787de, 82cf5fb (source identity), and 2c8b14c (voice design A) were checked. Blocked session candidate dff12e7 is not included.

## Implementation

Patient preview is isolated in 96ac327: personal serving versus whole-recipe yield, optional editable local date/time and meal label, conservative ingredient allergy screening, saved plan snapshots with idempotent Mark eaten/Undo. Plan storage uses existing serialized day-record fields; old records remain compatible. Allergy screening cannot establish cross-contact safety; missing ingredients and unknown custom allergies require review. No raw allergy profile is added to third-party requests.

RD uses clear daily values followed by quieter range totals, labelled nutrient colors and existing status labels. Profile, export notes, meal recording status and food logs are expandable. CSV remains actual Excel-compatible CSV; no JSON editor/import/export is exposed. Unknown nutrient coverage remains nutrient-specific and explicit zero remains zero. Navigation opens collapsed destinations and respects reduced motion. The ambiguous top two boxes received no additional changes in this final follow-up; their identification remains pending.

## Verification

- Earlier combined focused suite: 58 tests passed (portions, allergies, plans, calculations, food guide, live meal tools, conversation, nutrition and voice parsing).
- Final focused run: 16 tests passed in dayPlan, nutrition and rdReport.
- Actual Chromium RD browser check passed: two recorded dates, range 400 kcal versus daily 280 and 120 kcal, distinct nutrient missingness, explicit sodium zero, CSV, invalid date range, keyboard focus and contained mobile food-table scrolling. No browser errors.
- Actual App Plan browser check passed: saving a plan adds no intake; double click adds once; refresh preserves eaten state; undo and refresh remove only linked plan intake; profile allergy changes exclude unsafe/unknown suggestions.
- Portion browser fixture passed earlier: default one, whole six, half serving, editable date/time, unknown potassium preserved.
- Build and git diff --check passed. Existing bundle-size warning remains.
- Screenshots inspected at 390 and 1440 px. Browser data/auth/cloud are synthetic; recipe portion fixture is synthetic with API calls blocked. This is not a real USDA online lookup test. No production service, real microphone or live voice provider was re-tested for this RD-only follow-up.

## Library screenshots

| Preview | library_file_id |
| --- | --- |
| RD mobile | libfile_4e65554ec2d881918f208d510fa4602f |
| RD desktop | libfile_28c4e27677a08191947cc0e078f99631 |
| Plan mobile | libfile_bbc8064cb884819190de64d50bd34b1b |
| Plan desktop | libfile_431954490cf48191b4e8bdd9f0451ca5 |

Local files: output/rd-hierarchy-preview-{390,1440}.png and output/plan-hierarchy-preview-{390,1440}.png. Library version attributes applied to originals. No environment blocker remains for this preview. Await screenshot feedback before any publishing request; the ambiguous boxes are still out of scope.
