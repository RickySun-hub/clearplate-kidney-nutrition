# Chart-first RD preview

Primary skill: UI UX Pro Max, official https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at 56ea9cf174ed86786187daa9de0e6247cb0747e4. Installed project-local .agents/skills/ui-ux-pro-max/SKILL.md, MIT LICENSE.txt, data/charts.csv, styles.csv, ux-guidelines.csv, references/quick-reference.md and pro-rules.md. Read as static text only; no upstream scripts, installer, CLI or global configuration executed. Existing Anthropic skill assists layout restraint. All source files pinned; SHA256 manifest accompanies this note.

Applied static recommendations: charts.csv Trend Over Time (line/point series with direct units and accessible values), compact threshold/bullet chart guidance (numeric amount and labelled marker), styles.csv Data-Dense Dashboard (efficient desktop grid, mobile flow), accessibility/empty-state/keyboard guidance. Overrode generic target-achievement green/red zones to honor medical semantics: upper limit is a ceiling, no encouragement to fill it. No third-party chart runtime added.

## Implementation and limits

RDCharts consumes existing reviewDays/nutrientCoverage, never creates nutrient values. One nutrient at a time; full-data points can connect only across consecutive known complete days. Partial known totals have hollow points and never bridge missing data. Missing dates/values remain null; explicit known zero plots at zero. Under four known dates shows points only, no inferred trend. Charts display at most the latest 31 selected calendar dates with visible actual dates; range totals still cover the entire selected range. Recorded-day coverage is not full-day intake confirmation.

Upper-limit comparison bars use actual configured maxima and a labelled tick, with values and status alongside. No limit means no invented comparison. Partial bars use dashes and a data qualifier; no within-limit claim for unknown totals. Lower bounds/ranges remain visible in detailed review according to the prior semantic rules. Separate coverage bars show known-item counts, not adequacy scores. Chart values are expandable HTML tables accessible by keyboard; no essential information requires hover. Trend points have native SVG titles but are not individual keyboard stops; the table is the keyboard equivalent.

Record summary and daily ledger are now collapsed secondary content. Profile, export, patient words and log remain available. Existing connection/account surfaces, permissions, Plan, allergy, time, serving calculations and voice design A are untouched. No production data, schema, deployment or push.

## Evidence

Four focused chart/limit tests passed. Existing multi-day RD browser test passed (CSV, invalid dates, unknown/zero, focus navigation and horizontal log containment). New browser test passed nutrient switching, gap/hollow markers, missing-day empty state, reduced-motion and 375/390/768/1440 widths. Build passed with existing bundle-size warning; diff check passed. Screenshots use seven synthetic food records across six recorded dates, including one missing calendar day and partial nutrition. No real patient data. Actual before/after components rendered against the same fixture and fixed LA date; before is 7e3fb46. Comparison images are browser-composed screenshots, not generated mockups.

| Image | Library ID |
| --- | --- |
| Current mobile | libfile_8981668088b48191a093f692ce36e5dd |
| Current desktop | libfile_6b1ade9323148191a5bb5972c124c04b |
| Mobile comparison | libfile_25b15127581881919fdf9effa6bcf252 |
| Desktop comparison | libfile_fb4dc735c7ec81918af8e7fcf0255d9a |

Rollback points: 7e3fb46 before design, ff71506 ledger checkpoint. All prior unpublished commits remain ancestors. This preview awaits user feedback; no publishing authorization implied.
