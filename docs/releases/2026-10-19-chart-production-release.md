# Production release: reviewed chart-first combination

User authorized the reviewed version on 2026-10-19 after seeing actual chart screenshots. Released exact SHA 4078ce48e7eae47df77d532805dc5495c70edce4, not main. Includes source-serving/whole-recipe disambiguation, conservative allergy filtering, editable local dates/times, persistent Plan Mark eaten/Undo, RD coverage/limit semantics and chart-first design. All earlier source identity and voice design A commits remain ancestors. dff12e7 is not an ancestor. No production database migration, permissions/environment configuration or main merge.

## Deployment

- Project: clearplate-kidney-nutrition / prj_6VIb4kU7jvAyQ2F9ZdeMr8y9eCpi
- Team: RickySun-hub's projects / team_zUcrWa40PNF7hGX7UNnwDNsf
- Target: production
- Deployment: dpl_DbTiyoxKo6nVQAADMuZwTTgsRn99
- URL: https://clearplate-kidney-nutrition-9gkjw90z0-rickysun-hubs-projects.vercel.app
- State: READY, aliasError null; Git metadata confirms exact release SHA.
- Domain: nepholio.com verified on this project; deployment and alias-list API both confirm it is assigned to this deployment. Existing legacy project aliases were also reassigned by Vercel's normal production deployment behavior; none manually edited.
- Build timestamps: buildingAt 1792435130074; ready 1792435143135 (~13 seconds). Vercel build log reports completed, then outputs deployed.

## Verification

67 targeted unit tests passed. Browser checks passed Plan save/mark/double-click/reload/undo, source-serving clarification, LA and Tokyo defaults/cross-day backdating, RD charts/empty/gap/partial states, RD CSV/keyboard/mobile overflow. Local production build passed; only existing bundle-size warning. Working tree was clean at release. Remote branch feature/patient-plan-allergy-preview-20261019 points to exact release SHA; main remains 8e30558f689786775f19bb02d021d75c983fba8f.

Post-release runtime error/fatal log counts scoped to the deployment over 10 minutes returned no groups. This is a brief observation, not a guarantee of all runtime paths. Public HTTP/browser smoke was not completed: Node DNS returned EAI_AGAIN, curl returned 403 from the execution path, and web fetch reported inaccessible. Did not change security or create bypass links to work around that. READY and domain assignment are verified via authenticated Vercel control-plane tools, not a claim that authenticated patient/RD flows were tested on production. No real patient account/data used.

## Rollback preserved

Previous production SHA: 2412374b908bf829ccff9517e58c491c58d42f52
Previous READY production deployment: dpl_84S4w5K35A1EXk576KfTFDSAMrx3
Previous URL: https://clearplate-kidney-nutrition-bzqljtxfh-rickysun-hubs-projects.vercel.app
Remote rollback branch: release/nepholio-before-chart-release-20261019 -> 2412374b908bf829ccff9517e58c491c58d42f52

If rollback is requested, restore that prior production deployment through Vercel, or redeploy the preserved exact SHA to the same project. No rollback performed. No new refactor started after release.
