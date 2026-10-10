# Invitation email setup

Decision (2026-10-10): Resend Free for the current RD invitation pilot. Keep Free; do not enable paid overages. Free limits are account-wide, not per RD: 100/day and 3,000/month at time of review. Per-RD invitation limits do not guarantee capacity for every RD; provider quota errors remain visible, and QR/link invitation acceptance remains available.

Production configuration still required:
1. Sign in to the project's Resend account, select Free.
2. Add a domain controlled by the owner, preferably a dedicated sending subdomain. Add the DNS records Resend returns; wait for verification. A vercel.app hostname cannot be used as an owned sending domain.
3. Keep click/open tracking disabled for care invitation links.
4. Create a sending-only API key scoped to the sending domain. Store in Vercel as RESEND_API_KEY; never in source, chat, or VITE_ variables.
5. Configure INVITATION_FROM_EMAIL with the verified sender; APP_PUBLIC_URL=https://clearplate-kidney-nutrition.vercel.app; INVITATION_EMAIL_PROVIDER=resend. Redeploy after changing environment variables.
6. With the owner's explicit test recipient approval, send one invitation, inspect provider delivery/bounce status, then confirm the matching patient can accept. API submission alone is not proof of delivery.

Current code does not implement delivery webhooks or a durable retry queue. Quota errors do not trigger automatic retries or paid upgrades. No real email was sent during mock tests. Domain registration, account verification, DNS, and sender credentials are not complete yet.

Changing to SES later:
- Implement SES transport in server/transactionalEmail.js with scoped credentials. Selecting 'ses' is currently rejected; SES is not implemented yet.
- Verify the sender/domain in SES and obtain production access in the chosen region.
- Configure bounce/complaint handling and suppression; validate quota and costs.
- Switch provider after controlled delivery tests; retain Resend configuration for rollback.
- Supabase invitations, patient grants, QR URLs, and patient records need no migration.

References: https://resend.com/pricing ; https://resend.com/docs/dashboard/domains/introduction ; https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
