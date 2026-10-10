// Provider boundary: care authorization and invitation data stay outside this module.
export function emailConfigured(env) {
 return (env.INVITATION_EMAIL_PROVIDER || 'resend') === 'resend' && Boolean(env.RESEND_API_KEY && env.INVITATION_FROM_EMAIL && env.APP_PUBLIC_URL);
}
export async function sendTransactionalEmail({env,fetchImpl=fetch,message,idempotencyKey}) {
 if (!emailConfigured(env)) throw new Error('Email provider unavailable');
 const response=await fetchImpl('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
  body:JSON.stringify({from:env.INVITATION_FROM_EMAIL,...message}),signal:AbortSignal.timeout(15000)
 });
 return {ok:response.ok};
}
