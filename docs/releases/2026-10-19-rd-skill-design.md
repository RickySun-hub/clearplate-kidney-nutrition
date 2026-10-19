# RD design direction and skill provenance

Rollback before redesign: 7e3fb46 (includes corrected coverage/limit semantics).
Official source: https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design
Installed locally at .agents/skills/frontend-design/SKILL.md and LICENSE.txt. No pre-existing skill was found. Only those two upstream files downloaded, inspected as text, no scripts run or global settings changed. License: Apache 2.0. Source commit resolved with git ls-remote; GitHub REST endpoint was unavailable, raw pinned files succeeded.

## Plan before implementation

Audience/job: RD reviewing a patient's recorded foods, nutrition data coverage and saved bounds. Not a goal-achievement or adherence score.
Palette: paper #ffffff, ink #20354a, secondary #526478, action blue #174b89, quiet surface #f3f6f9, comparison amber #794600.
Type: locally available Segoe UI / system sans for compact clinical reading, tabular numbers for alignment. No new remote fonts or patient requests. 28px patient heading, 20px section headings, 14–16px records, 12–13px supporting context.
Layout: left-aligned clinical record sheet; identity and date controls first, compact summary, daily nutrient ledger, quiet range totals, expandable supporting records.
Desktop: [identity / date range] -> [record summary] -> [daily nutrient | amount | comparison/coverage] -> [range totals] -> [supporting disclosures].
Mobile: [identity] [date range] [summary] -> [nutrient / amount; comparison + coverage below] -> [range values] -> disclosures.
Principles: sources/coverage separate from saved-bound comparisons; no fill-to-target progress bars, invented trend charts, decorative hero, gradient or repeated boxed cards. Amber means an actual configured-bound comparison only.

Brief review: rejected generic equal-card metric kit in favor of aligned nutrient rows, because an RD compares status and coverage alongside each value. Range totals remain distinct, never compared to a daily bound. Keep outer care-directory/account controls intact and preserve existing permissions and actions.

## First implementation checkpoint

Implemented aligned daily nutrient ledger, compact neutral summary, date controls before review, quiet range totals and preserved disclosures. Replaced accumulated RD CSS overrides with one coherent component stylesheet. Inspected actual 390px/1440px rendering. Six semantic boundary/conversation tests, RD Chromium usability/CSV/keyboard/overflow check, build and diff check passed. Plan, source-serving, allergy, voice orb and time code untouched.

Skill SHA256: d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3
License SHA256: 0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594

User subsequently requested comparison of dashboard-specific skills and more useful charts. Paused additional visual changes pending the parent's final comparison. This is a preserved intermediate implementation, not completion of the newer chart request. No additional skill installed. Before images retained at output/rd-before-skill-{390,1440}.png; current actual images at output/rd-hierarchy-preview-{390,1440}.png.
