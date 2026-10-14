# Invitation email setup

## Release order and rollback (2026-10-13 review)

**Do not deploy the new URL validation alone while production APP_PUBLIC_URL remains https://www.myrenalsync.com. Every configured invitation-email request would return 503 before the database send claim or email-provider call. Invitations remain saved; this is a real sending outage, not merely a warning.**

Treat the variable correction and code release as one approved change:

1. Identify and retain the known production deployment/version and its environment scope for rollback. Prepare a release containing only reviewed work; the current working tree also contains unrelated RD changes.
2. An authorized operator updates the project's **Production** APP_PUBLIC_URL to https://nepholio.com first. Check the exact scope and value before starting the release. Existing deployments may retain their environment snapshot; saving a variable alone is not proof the live server changed.
3. Create the reviewed production deployment with that environment value, verify its effective configuration and static/synthetic checks, then activate it. Do not promote a prebuilt deployment that captured the old value.
4. Perform separately authorized cloud acceptance of the invitation destination. Real sending requires explicit test-recipient authorization.

If a deployment with new validation and the old variable is accidentally activated, restore the previous known production deployment promptly, or create and verify a corrected deployment with the new variable. Do not merely save the variable and assume the active deployment changed. The previous version can send to the old domain, so rollback restores former behavior, not the corrected destination.

If the new deployment fails for another reason, restore the known previous production deployment; retain the corrected project variable for a subsequent deployment unless an authorized operator identifies a reason to restore it. If restoring the old variable is required, first restore code that accepts it, then restore the variable and deploy that compatible pair. Never put the old variable into a running deployment of the new validation. No invitations or patient records need deletion or migration; failures before claim consume no send attempts.

## Environment and trust boundary

Local development browser requests from http://localhost:5173 or http://127.0.0.1:5173 remain accepted by the existing same-origin request check. The mail destination still comes from server-only APP_PUBLIC_URL, not the request Origin, Host or body. With a configured HTTPS destination, local requests can use the handler. With missing sender settings, the existing 503 plus QR/link fallback remains.

Using an HTTP loopback address as APP_PUBLIC_URL was already unsupported by the previous HTTPS check and remains unsupported. Local QR/copied links use the browser origin separately; local browser tests mock email sending. Synthetic https://example.test remains supported by the unit suite.

The validator rejects retired/ambiguous destinations, but is **not a universal domain allowlist**: other bare HTTPS values in the trusted server environment are accepted. An untrusted request cannot choose that environment value or become the email destination. Production configuration must therefore be controlled and verified as https://nepholio.com; this patch must not be described as rejecting every arbitrary operator-configured HTTPS domain. This review does not change the existing request-origin authorization model.

Decision (2026-10-10): Resend Free for the current RD invitation pilot. Keep Free; do not enable paid overages. Free limits are account-wide, not per RD: 100/day and 3,000/month at time of review. Per-RD invitation limits do not guarantee capacity for every RD; provider quota errors remain visible, and QR/link invitation acceptance remains available.

Production configuration still required:
1. Sign in to the project's Resend account, select Free.
2. Add a domain controlled by the owner, preferably a dedicated sending subdomain. Add the DNS records Resend returns; wait for verification. A vercel.app hostname cannot be used as an owned sending domain.
3. Keep click/open tracking disabled for care invitation links.
4. Create a sending-only API key scoped to the sending domain. Store in Vercel as RESEND_API_KEY; never in source, chat, or VITE_ variables.
5. Configure INVITATION_FROM_EMAIL with the verified sender; APP_PUBLIC_URL=https://nepholio.com; INVITATION_EMAIL_PROVIDER=resend. Use the bare HTTPS origin without credentials, a path, query, or fragment. Retired MyRenalSync and project Vercel alias destinations fail closed before claiming a send attempt. Existing production variables must be updated separately by an authorized operator. Redeploy after approved environment changes.
6. With the owner's explicit test recipient approval, send one invitation, inspect provider delivery/bounce status, then confirm the matching patient can accept. API submission alone is not proof of delivery.

Current code does not implement delivery webhooks or a durable retry queue. Quota errors do not trigger automatic retries or paid upgrades. No real email was sent during mock tests. Domain registration, account verification, DNS, and sender credentials are not complete yet.

Changing to SES later:
- Implement SES transport in server/transactionalEmail.js with scoped credentials. Selecting 'ses' is currently rejected; SES is not implemented yet.
- Verify the sender/domain in SES and obtain production access in the chosen region.
- Configure bounce/complaint handling and suppression; validate quota and costs.
- Switch provider after controlled delivery tests; retain Resend configuration for rollback.
- Supabase invitations, patient grants, QR URLs, and patient records need no migration.

References: https://resend.com/pricing ; https://resend.com/docs/dashboard/domains/introduction ; https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
