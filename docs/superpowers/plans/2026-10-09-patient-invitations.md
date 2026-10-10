# Patient invitations implementation plan
Goal: exact-email invitations, explicit patient acceptance, QR handoff, and a polished RD directory.
Architecture: additive private invitation table and authenticated RPCs; existing care_grants remains the record access authority. Authenticated verified email checked against auth.users at acceptance. Local QR generation; no patient identifiers sent to external QR services. Resend server adapter, disabled until sender credentials are configured.
Constraints: no fabricated provider approval; inviter name is self-reported and verified account email is displayed. No automatic grants, no email-based user enumeration. Existing records/grants preserved. No real test emails.
Tasks:
- Add bounded create/list/respond/cancel/mail-claim RPCs, RLS, seven-day expiry, recipient checks and concurrency locks.
- Add invitation UI, pending list, exact-email form, QR, patient confirmation/inbox, OAuth return retention.
- Test wrong recipient, expiry, repeated acceptance, revoked grant, sender cancellation, email failures and mobile layout.
- Build, deploy additive migration only after review; push main and deploy UI once verified.
Rollback: revert application commit; revoke authenticated execution on new RPC wrappers. Leave invitation history and existing care_grants intact; do not drop patient data.
Mail dependency: production has no sender configuration. Never present provider acceptance as delivered, or a created invitation as sent.

Validation progress:
- Production migration applied; private table RLS enabled, anonymous RPC execution denied.
- User explicitly approved temporary synthetic production transaction tests after initial approval-review rejection. Wrong email, unverified email, no consent, expired/cancelled invitation, duplicate acceptance, revoked reacceptance tested successfully. Transactions rolled back; synthetic accounts remaining: 0.
- Browser mock flow passed: RD creates exact-email invite, QR renders, unconfigured email fails visibly, recipient accepts, accepted patient appears before first saved meal; mobile has no horizontal overflow.
- Sender config is still missing. Required Vercel variables: RESEND_API_KEY, INVITATION_FROM_EMAIL (verified sender), APP_PUBLIC_URL. No production invitation email sent.
- RD name is self-reported, verified account email is shown; this is not clinician credential verification.
- Final verification: 154 tests passed; Vite production build passed. Browser mock also verifies a valid direct invitation omitted from the recent-list window. Independent review found no authorization bypass; its direct-link pagination issue was fixed.
