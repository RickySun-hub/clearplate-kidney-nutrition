# Source-serving clarification preview

This focused follow-up replaces patient-facing "personal serving/portion" with source-defined recipe servings. When servingSize exists it is shown (e.g. 1 serving = 1 wonton). Explicit single-item source units permit batch count display (Whole recipe = 24 wontons). Other source sizes remain verbatim alongside recipe-serving yield; missing units do not acquire inferred grams or diner counts. Unknown yield remains unknown and cannot resolve a whole batch.

Plan, recipe picker/detail/builder and typed voice draft use the corrected wording. Presets remain multiples of one source serving; nutrition calculations, original units and serialization are unchanged. The legacy interpretation endpoint treats all of it / whole plate / whole dish / whole portion / 整份 as ambiguous even if model output claims whole. It asks "One recipe serving or the whole recipe?". The typed/recorded interpretation UI offers source-labelled choices; choosing produces an unsaved draft and still requires confirmation. Live voice instructions request the same concise spoken clarification; actual live provider compliance was not tested here.

Focused verification: 20 portion/voice tests passed, including source 24-wonton fixture (1.5 = 60 kcal, whole = 960) and six-serving dish (1.5 = 150 kcal, whole = 600), unknown nutrients and yields. Actual browser checks passed for both clarification choices through confirmed saving, Plan persistence/labels, and calculated six-serving recipe logging. Build and diff check passed. No broad suite rerun.

New actual Plan mobile screenshot uses Playwright timezoneId America/Los_Angeles and fixed instant 2026-10-19T18:12Z: default time 11:12 AM, synthetic eaten example 11:05. Banner states timezone, synthetic and unpublished. Screenshot inspected. This supersedes earlier 06:12 PM Plan mobile preview for review.

Library: libfile_ec9f0a2ff78881919d968586ca0fc5bc
Local: output/plan-hierarchy-preview-390.png

No push, deployment, production data, permissions or schema changes. Existing travel/DST/cross-device limitations remain as documented in preview acceptance; not expanded in this change.
