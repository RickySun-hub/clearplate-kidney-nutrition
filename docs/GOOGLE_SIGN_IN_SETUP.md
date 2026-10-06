# ClearPlate Google authentication status

Updated 2026-10-05 (America/Los_Angeles).

## Configured and verified

- Google Cloud project: ClearPlate (`alien-outrider-510800-i4`).
- Web OAuth client: ClearPlate Web; public client ID `41224369218-a6v4b1h45gqp5kt3a8tkd8h1ddhq3hfc.apps.googleusercontent.com`.
- Google callback: `https://izbchwumzlowpprbdsyc.supabase.co/auth/v1/callback`.
- Client secret transferred directly from Google's creation dialog into the ClearPlate Supabase Google provider form. It was not written to code, this document, or chat. The creation dialog is now closed.
- Supabase project `izbchwumzlowpprbdsyc`: Google provider enabled. Public `/auth/v1/settings` returned HTTP 200 and `external.google: true`.
- Site URL: `https://clearplate-kidney-nutrition-hvcyy4jjo-rickysun-hubs-projects.vercel.app/`.
- Redirect allow list contains four separate entries: hvcyy4jjo, nsblafegs and qw0yap0rf preview origins (trailing slash), plus `http://127.0.0.1:5173/`.
- Actual owner Google account completed authorization -> Supabase callback -> PKCE exchange -> local ClearPlate dashboard. Sign-out returned to public navigation. This was a real Google login, not a mock. No food or patient record was uploaded during this check. The created Google account remains in ClearPlate Auth.
- Existing code tests: 16 passed; mock browser and build passed in prior implementation turn. No frontend changes in this configuration turn.
- ProofRound OAuth configuration unchanged.

## Remaining limitations

Google Audience still shows Testing. Owner account was added as a test user. Publish app is disabled, with Google explicitly requiring completion of Branding. Do not describe login as open to all users yet. Branding currently has app name, support/contact email and the preview homepage, but no public privacy policy or terms URL. A stable public website and accurate policy pages are needed before completing public release; do not substitute ProofRound policies or invent URLs.

Preview remains Vercel-protected. The end-to-end test used the local application against real Google and the real ClearPlate Supabase project; the protected deployed page was not independently tested end-to-end in this turn.

Sessions still live in memory: refreshing signs out, as with the existing email flow. The short-lived PKCE verifier lives in sessionStorage only until callback. Google login requests basic profile and email, not Gmail mailbox access. Future preview deployments need their exact return URL added to the Supabase allow list.

## Compact login UI and phone preparation

The compact login UI is deployed to preview `https://clearplate-kidney-nutrition-nsblafegs-rickysun-hubs-projects.vercel.app/` (READY). Email remains password-based after entering the email address; it is not an email OTP flow. Phone entry defaults to +1 for the user's US/Canada audience. Sending and verifying SMS codes are implemented using Supabase Auth, with provider detection and resend cooldown. The SMS provider is not configured or activated: the UI shows Coming soon and does not send messages. No paid SMS resources were created. Real SMS delivery is unverified.

Validation: 18 targeted auth tests passed, Vite build passed; local desktop/mobile UI checked. The apparent right-side blank area in the headed test browser was caused by a fixed emulated viewport. Device metrics overrides were cleared; the 1920px view is centered without a CSS workaround.
