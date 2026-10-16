# Session persistence and recording workflow verification

## Reproduced causes

The former client retained only an access token in memory, discarded the refresh token, and cleared authentication at access-token expiry. Reloading or closing the browser therefore always lost sign-in, independent of the identity provider's session lifetime. No application auth cookies were used (`credentials: 'omit'`). React StrictMode cleanup also cleared the History URL before restoration could complete.

The updated client stores the provider-issued access/refresh pair, expiry, verified account ID and a local session identity in browser localStorage, scoped to the configured auth origin. Passwords and provider OAuth tokens are not persisted. It verifies `/auth/v1/user` before exposing a restored account, refreshes near access-token expiry, saves rotated refresh credentials, and serializes refreshes using Web Locks where available. Token renewal updates voice request credentials without resetting the current draft. Disposal is distinct from deliberate logout.

Logout removes saved credentials immediately, notifies other tabs, and requests provider logout. Account switching and delayed responses cannot restore a signed-out session. Transient refresh/network errors retain credentials for retry; rejected or revoked sessions require sign-in. The app does not change provider scopes, access-token lifetimes, server session limits, database permissions or production configuration. Existing API authorization and record validation remain in place.

A normal browser profile can restore sign-in after reopening. Private sessions, cleared site data, unavailable browser storage, provider revocation, and configured provider session limits can still require sign-in. Storage failure is disclosed as this-tab-only sign-in. Production lifetime settings were neither inspected nor changed.

## Workflow changes

- Patient: choose/describe food, check the portion, review recorded meals, then the daily summary. The existing label form explicitly confirms portions before saving. Opening the speak/type assistant does not automatically request the microphone.
- Patient missing data: no zero subtotal when all values for a nutrient are unknown; unrecorded meals have no numeric intake totals or invented meal time.
- RD: navigation comes before the patient directory on mobile; in-file controls move keyboard focus to Profile, Daily review or Food log without changing app routes. Range coverage precedes detailed daily review; original conversations remain available below the food log.
- Simplified flat nutrient sections and removed the Today page's cookbook promotion. No cookbook images were used in these captures; the actual UI uses existing vector icons and synthetic custom foods.

## Verification scope

`npm test`: 183 tests passed, including 9 session regression tests. `npm run build`: passes with the existing large-bundle warning.

`CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-session-workflows.mjs` exercises the real app in Chromium with mocked auth/data endpoints and a temporary persistent browser profile:

- Password login, page reload, full browser close/relaunch, and restore without another password.
- Concurrent tabs renewing an expired token, refreshed History navigation, and retention of an unsent typed meal draft.
- Deliberate logout including clearing another tab; patient-to-RD account switching; isolated private context; rejected refresh removing saved credentials.
- Label entry, 1.5-serving confirmation/save, and missing potassium preserved as null.
- Patient and RD mobile/desktop layouts without document overflow or browser exceptions.

`CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-rd-usability.mjs` checks nutrient-specific coverage, explicit zero versus unknown, CSV download and keyboard-accessible table scrolling.

These are real browser lifecycle/UI checks with mocked provider responses, not live Supabase login, provider-cookie, email, microphone, or production security-setting verification. No real patient data or external messages were used.

Screenshots are generated under `output/`: updated patient Today (390/1440), portion review (390), daily summary (1440), and RD review (390/1440). Their synthetic names and foods are intentional. Full-page captures support review; portion and daily-summary captures are viewport-sized for presentation use.
