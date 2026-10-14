# Nepholio browser bug packet — 2026-10-13

Repository: RickySun-hub/clearplate-kidney-nutrition. Local HEAD: a7ed10316ed003d0a10fdd6b2c267a189861cb74. Reported live baseline: 8e30558f689786775f19bb02d021d75c983fba8f. Existing RD and other uncommitted work must be retained. Sidebar project membership has not been confirmed.

## 1. Invitation emails use the old domain (confirmed, high priority)

- Reproduce: an invitation initiated on nepholio.com generates an email URL on the old custom domain.
- Evidence supplied by the cloud browser task: production APP_PUBLIC_URL=https://www.myrenalsync.com. server/careInvitationEmail.js builds links from that variable. Repository examples also still point to the Vercel alias.
- Impact: patients leave the intended Nepholio origin when opening invitations.
- Fix scope: current canonical example, strict public URL validation before claiming/sending, synthetic email tests. Production variable changes are a separate authorized operation.
- Acceptance: configured links use https://nepholio.com/#care-invite/<id>; obsolete or malformed configuration fails before consuming a send attempt; no real email is sent during local testing.

## 2. Google login leaves nepholio.com (confirmed symptom; root cause unconfirmed)

- Reproduce: start Google login on nepholio.com, select the personal account; browser attempts navigation to clearplate-kidney-nutrition.vercel.app and meets its authentication boundary.
- Evidence: all reported aliases point to the same latest production version. The alias is not evidence of old code. Vercel all_except_custom_domains SSO remains unchanged.
- Code evidence: redirect_to is computed from current origin; PKCE verifier is kept in that origin's sessionStorage. Another origin cannot access it.
- Hypothesis only: Supabase Site URL or redirect allowlist may cause fallback. No private Supabase configuration was read; read permission was denied. Do not bypass that denial.
- Impact: Google login remains unfinished; origin mismatch cannot safely exchange PKCE.
- Fix scope: preserve current-origin redirect, improve missing/mismatched state guidance, retain route hash through callbacks, prevent duplicate starts and stale starts after account changes/disposal. Do not transfer verifier across origins or broaden allowed origins.
- Acceptance: synthetic same-origin roundtrip passes; cancellation, expiry, wrong origin, repeated click, back/no callback and account switching remain safe. Cloud browser must verify the actual provider return after separately authorized configuration diagnosis.

## 3. Dietitian login uses patient disclosure (confirmed)

- Reproduce: open For dietitians login.
- Evidence: displays “You choose when to share your food record with your care team.”
- Impact: role and sharing responsibility are confusing.
- Fix: dietitian disclosure describes records patients choose to share; patient wording remains.
- Acceptance: RD and patient login each show their role-specific disclosure.

## Configuration actions requiring separate authorization

1. Set production APP_PUBLIC_URL=https://nepholio.com; review preview/development scopes separately. Changing the example does not update an existing production variable. A later deployment is needed to activate repository changes and environment changes.
2. Request read-only access to the specific Supabase project's Auth URL Configuration. Compare Site URL and exact redirect entries against https://nepholio.com/ and the redirect_to actually emitted. Record values before proposing edits. Investigate fallback only if the evidence supports it.
3. Check Google provider authorized callback against that Supabase project's callback URL, only with separately authorized access. Keep Vercel SSO and origin restrictions intact.

## Cloud acceptance still pending

Previously passed read-only UI: homepage, patient login/email registration, return home, independent RD login, return to patient login, email-to-password form transition.

Pending and not reported as bugs: actual patient records, invitation accept/revoke, account isolation and RD access boundaries. Also verify invitation URL destination and completed Google login on nepholio.com, plus RD/patient disclosure. The parent cloud browser performs live acceptance; this task uses no user browser, creates no accounts and changes no patient data, role, production configuration or deployment.
