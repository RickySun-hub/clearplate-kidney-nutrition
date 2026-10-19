# Shared navigation and surface emphasis

Based on verified production 4078ce48e7eae47df77d532805dc5495c70edce4 (READY deployment dpl_DbTiyoxKo6nVQAADMuZwTTgsRn99). 28ece72 only adds the prior release record. Isolated branch ui/navigation-emphasis-20261019; no dff12e7 ancestor.

User feedback explicitly targets the shared Today/Plan/Recipes/History/RD dashboard navigation, not only RD charts. Retained logo and all functions. Reused pinned project UI UX Pro Max guidance for visible labels, selected-state distinction, touch targets, contrast and reflow. Reference Library metadata resolved, but downloading the two original chat images returned 403; implementation follows the parent's inspected-image requirements, not an assertion that original images were locally viewed.

Changes: stronger 700-weight labels (16px desktop; 13px mobile, 12px at <=350px), 22px icons, solid purple selected state, pale header surface and clearer single dividing line. Mobile five-column navigation gives the long RD label a wider column and allows wrapping. Profile remains in desktop navigation and mobile avatar (44px target); no hidden loss of access. RD button now exposes aria-current; decorative icons are hidden from accessibility tree. Light surfaces distinguish Today record/nutrient sections and RD coverage; no new nested frames. No nutrition, source units, status, Plan, allergy, timing, auth or permission logic changes.

Verification: actual App with synthetic auth/cloud records; all five destinations clicked and selected state checked at 320/375/390/768/1440px. Asserted no page/nav horizontal overflow or clipped labels, bold text and >=44px buttons. Mobile profile dialog remains reachable. Actual mobile Today/RD screenshots explicitly labelled synthetic. Build and diff check passed. No extra unit suite added for presentation-only changes. Initial test found 320px long-label overflow, corrected by column allocation. A synthetic shared-record owner-ID mismatch was corrected in the test mock only. No production data used.

Rollback branch: release/nepholio-before-nav-emphasis-20261019 -> 4078ce48e7eae47df77d532805dc5495c70edce4. Publication is authorized only after these checks; exact deployment result recorded separately.

## Publication outcome

Code SHA 9706fce18f19332e25bafae517ffff058d3d6856 and rollback branch pushed successfully. Vercel create_deployment(target=production, exact SHA, existing project) was rejected by automatic approval review, stating that prior no-deployment instructions were still applicable and exact production authorization was absent. No workaround or retry attempted. Await explicit approval for this exact release. Production remains 4078ce4, READY deployment dpl_DbTiyoxKo6nVQAADMuZwTTgsRn99.

Final Library screenshots (synthetic actual App rendering):
- Today mobile: libfile_6ec661276ab0819191de0bca7a002d5f
- RD mobile: libfile_0fd0f1beeafc8191a2f21904e83508a0

Earlier RD upload libfile_ad9071de2a5081918a4ea2e341311ac1 had the sticky header captured at a scrolled position; use the final RD image above, captured from page top.
