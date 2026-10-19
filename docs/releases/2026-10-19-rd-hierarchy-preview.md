# RD hierarchy preview — not released

Base: production 2412374b908bf829ccff9517e58c491c58d42f52. User requested screenshots first and local RD hierarchy improvements for review, with no deployment.

Changes are limited to RDDashboard JSX/CSS and its browser regression. A neutral blue Review first strip repeats only existing latest-recorded-day statuses for selected nutrients (Incomplete, Above saved limit, Below saved minimum), with a keyboard-focusable action to Daily review. Metric colors consistently identify nutrients, never clinical risk. Larger numbers, compact profile grid and whitespace separate profile, range totals and daily values. Unknowns, saved targets, source details and exports are retained. No backend, permission, authentication or calculation changes.

Actual Chromium screenshots use synthetic fixtures. Baseline screenshots were captured before editing production code; the preview is explicitly marked unpublished. No production authentication bypass or real patient data.

Library deliverables:
- Current RD Dashboard: libfile_60b904a4b0dc81918cc569e959bf3e5e
- Proposed RD Dashboard: libfile_f8ebb00aeadc819192c28e92a42f29a3
- Current connected/no-record RD state: libfile_f34c82cc09448191b291bd5efe7a105b
- Current patient voice mobile: libfile_abf1f3d1af088191bcc404aba2de750f

Focused browser check passes new review flags and focus action, date error recovery, 400 kcal range versus 120/280 daily totals, nutrient-specific zero/unknown, CSV, keyboard table access, and 390/1440 overflow checks. Ten nutrition tests and build pass; existing bundle-size warning remains. Existing voice harness also passed synthetic amplitude, intentional microphone start, mute/end, reduced motion and cleanup while capturing the production screenshot. Auth, WebRTC and backend mocked; synthetic oscillator audio only.

No push or deployment. Await screenshot feedback.
