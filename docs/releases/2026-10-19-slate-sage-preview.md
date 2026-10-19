# Slate / sage color preview — not deployed

Context correction: the earlier 854438a delivery mistakenly continued an older RD disclosure/status task. Its parent is f7be5e4, which descends through 354bfe2 from deployed 9706fce. It remains preserved on ui/rd-selective-status-review. This color-only branch starts at f7be5e4 and does not incorporate 854438a. No deployed changes were overwritten.

Read the pinned local frontend-design and UI UX Pro Max skills and static accessibility guidance. Keep layout, navigation dimensions, logo and business logic. This is an original slate/sage direction; reference services were cited for hierarchy, not claimed to use this palette.

Shared tokens live in src/slate-sage.css, imported after accessibility.css in main.jsx. Canvas #F5F8F7, surface #FFFFFF, primary #426B7A, selected #E8EFF2, sage #446B5B, sage pale #EDF3EF, text #263D43, secondary #5F7176, divider #DCE5E3, warning #946516/#FFF5DF, exceeded #A4473F/#FBEDEA. Legacy green aliases point to semantic tokens. Navigation-emphasis.css now reads tokens directly (with old-color fallbacks), preventing dynamic stylesheet ordering from restoring purple. Scoped overrides cover the Today entry, primary actions, record summary, RD directory, chart data and coverage. Cards stay white; pale fills identify only selected/important regions. No sphere changes or nutrition wording/logic changes.

Checks: build passed with existing bundle-size warning. Thirteen nutrition and RD review tests passed. The full-App synthetic browser check covers all five nav destinations, aria-current, 44px minimum controls, no clipping/overflow at 320/375/390/768/1440, mobile profile access, actual computed selected color, coverage background, original logo color and keyboard focus color. Actual Today and RD screenshots inspected at 390 and 1440. Text contrast: primary/white 5.81:1; sage/white 6.00:1; secondary/white 5.11:1; secondary/pale sage 4.54:1; warning/pale warning 4.69:1; exceeded/pale exceeded 5.18:1. Primary/selected surface 4.99:1. This is targeted verification, not a full WCAG audit.

Fresh Library mobile screenshots, clearly labeled synthetic and not deployed:
- Today: libfile_9f5c2fb1ca9481918764a107e5cfcd3c
- RD: libfile_4850fc67a07c8191b7af941cdbfab3a0

Desktop screenshots are local output/slate-sage-today-1440.png and output/slate-sage-rd-1440.png. Auth/cloud mocked; custom synthetic oatmeal only; no USDA lookup or real patient data. No push, merge, production deployment, schema or security changes.
