// Same-origin mail delivery; recipient and sender identity come only from the database.
import { assertOrigin, readVoiceBody } from './voice.js';
import { emailConfigured, sendTransactionalEmail } from './transactionalEmail.js';
export function createInvitationEmailHandler({env=process.env,fetchImpl=fetch}={}) {
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  try {
   assertOrigin(req);
   const token=req.headers?.authorization;
   if(!/^Bearer [A-Za-z0-9_.-]+$/.test(token||''))return res.status(401).json({error:'Sign in again.'});
   const body=await readVoiceBody(req);
   if(!/^[0-9a-f-]{36}$/i.test(body?.id||''))return res.status(400).json({error:'Invalid invitation.'});
   if(!emailConfigured(env))return res.status(503).json({error:'Email delivery is not configured. Your invitation is saved; use its QR code or copy its link.'});
   const base=new URL(env.APP_PUBLIC_URL);if(base.protocol!=='https:')throw Error();
   if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL||''))throw Error();
   const r=await fetchImpl(env.SUPABASE_URL+'/rest/v1/rpc/care_invitation_action',{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:token,'Content-Type':'application/json'},body:JSON.stringify({action:'claim_email',payload:{id:body.id}}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)return res.status(r.status===401?401:400).json({error:'Invitation cannot be sent. Check access, expiration, or wait a minute before retrying.'});
   const inv=await r.json();
   if(inv.id!==body.id||typeof inv.recipient_email!=='string'||typeof inv.reader_email!=='string')throw Error();
   const link=base.origin+'/#care-invite/'+encodeURIComponent(inv.id);
   const delivery=await sendTransactionalEmail({env,fetchImpl,idempotencyKey:'care-invite-'+inv.id+'-'+inv.send_count,message:{to:[inv.recipient_email],subject:'Review your RenalSync care invitation',text:`${inv.reader_name} (${inv.reader_email}) has invited you to share your RenalSync food record.\n\nOnly accept if you recognize this person as your dietitian. Sign in with the email receiving this invitation, then review and accept:\n${link}\n\nAccepting shares your saved food records, nutrition profile, and saved conversation text, including future updates. You can revoke access in Account & care sharing. This invitation expires in 7 days.\n\nIf you do not recognize this invitation, ignore it or decline it. No records are shared without your acceptance.`}});
   if(!delivery.ok)return res.status(502).json({error:'The email provider did not confirm sending. Your invitation is saved. Use the QR code or try again later.'});
   return res.status(200).json({status:'submitted',message:'Invitation submitted to the email provider. Delivery is not yet confirmed.'});
  }catch(error){return res.status(error.status===403?403:503).json({error:error.status===403?'Use this website to send invitations.':'Could not confirm email sending. Your invitation remains saved.'});}
 };
}
