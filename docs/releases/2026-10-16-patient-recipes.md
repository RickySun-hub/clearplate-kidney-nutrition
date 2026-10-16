# Patient recipes and particle voice sphere release

Deployed application commit: `d196e83a462af769d32f5035365635ab29141f2a`.
Working branch: `codex/rd-dashboard-usability`; main remains `8e30558f689786775f19bb02d021d75c983fba8f`.
Earlier `b1787de` and current production fixes `ca6e431` are ancestors of this release.

Vercel reports READY for `dpl_AUPJ2fGsiD25vdz3kTBTWiPhBXUu`, and its alias lookup confirms https://nepholio.com points to this deployment.
Deployment URL: https://clearplate-kidney-nutrition-dldy6zkqm-rickysun-hubs-projects.vercel.app

Rollback reference: retained READY deployment `dpl_8hgZzFDbSQxMKh9P2X4HvWBQ2RJa`, commit `ca6e4310fddf113b68a3b76900892bb2f7aad3ca`, existing branch `release/nepholio-reviewed-20261014`.

## Verification

- 208 unit/server tests pass, including combined Google sign-in and invitation regression coverage.
- Production build passes; existing large-bundle warning remains.
- Patient recipe browser check uses real local HTTP USDA snapshot search/details (`mode: snapshot`, `live: false`), with synthetic patient/auth/storage data. It verifies food-specific portions, collapsed advanced review, save-and-log and repeat logging at mobile/desktop sizes.
- Separate deterministic recipe calculation browser check mocks USDA and auth/storage to exercise exact totals, missing nutrients, measured yield, version edits and immutable historical snapshots.
- Recipe search browser check uses actual bundled recipe ingredients and mocked auth/storage; no USDA or AI call.
- Particle sphere browser check uses real oscillator-generated synthetic audio streams; WebRTC, auth and backend are mocked. It passes intentional capture, mute/unmute, amplitude response, state transitions, reduced motion and end/unmount resource cleanup checks. No real microphone or patient data used.
- Mobile (390px) and desktop (1440px) screenshots inspected; no horizontal page overflow.
- Production control-plane verification confirms READY, exact commit and domain alias. Public live smoke could not complete: shell HTTP returned 403, web reader reported inaccessible, and normal Chromium navigation failed with ERR_TUNNEL_CONNECTION_FAILED. No protection bypass or setting changes attempted. Local browser checks are not live production end-to-end checks.

## Screenshot Library IDs

- Particle sphere mobile: `libfile_c5ea90cf919481918d8311ee841f99fb`
- Particle sphere desktop: `libfile_703118df99108191870369d90e64b152`
- Recipe confirmation mobile: `libfile_a3e8ddd480048191b01eca9e80fc49de`
- Recipe library desktop: `libfile_a57ebd8277948191878a7c43fa63f730`

REA remains pinned to registry package `rea-agents@6.5.0` in isolated `/workspace/tools/rea-cli`; see ../REA_PUBLIC_BEHAVIOR_REVIEW.md for public-source observations and browser access limits. No credentials, persistent MCP setup, schema migrations, security changes, main merge or patient data operations were performed.
