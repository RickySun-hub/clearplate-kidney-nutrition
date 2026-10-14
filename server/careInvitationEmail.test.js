import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvitationEmailHandler} from './careInvitationEmail.js';
const id='11111111-1111-4111-8111-111111111111';
const env={RESEND_API_KEY:'test-secret',INVITATION_FROM_EMAIL:'Care <care@example.test>',APP_PUBLIC_URL:'https://example.test',SUPABASE_URL:'https://qa.supabase.co',SUPABASE_ANON_KEY:'test-public'};
const req=()=>({method:'POST',headers:{origin:'https://example.test',host:'example.test',authorization:'Bearer synthetic-token'},body:{id,email:'attacker@example.test',readerName:'Forged'}});
function res(){return {statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test('invitation email uses only database recipient, fixed origin and plain text',async()=>{
 const calls=[];const handler=createInvitationEmailHandler({env,fetchImpl:async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify(calls.length===1?{id,recipient_email:'patient@example.test',reader_email:'rd@example.test',reader_name:'Jane',send_count:1}:{id:'provider-id'}));}});
 const response=res();await handler(req(),response);assert.equal(response.statusCode,200);assert.equal(response.body.status,'submitted');
 const mail=JSON.parse(calls[1].opts.body);assert.deepEqual(mail.to,['patient@example.test']);assert.match(mail.text,/https:\/\/example.test\/#care-invite\//);assert.ok(!JSON.stringify(mail).includes('attacker'));assert.ok(!JSON.stringify(response.body).includes('secret'));
});
test('missing sender config does not call provider or claim email was sent',async()=>{const response=res();await createInvitationEmailHandler({env:{},fetchImpl:()=>{throw Error('Must not call');}})(req(),response);assert.equal(response.statusCode,503);assert.match(response.body.error,/not configured/);});
test('cross-origin and unauthenticated email calls fail before sending',async()=>{const handler=createInvitationEmailHandler({env,fetchImpl:()=>{throw Error('Must not call');}});let response=res();await handler({...req(),headers:{...req().headers,origin:'https://evil.test'}},response);assert.equal(response.statusCode,403);response=res();await handler({...req(),headers:{origin:'https://example.test',host:'example.test'}},response);assert.equal(response.statusCode,401);});
test('database authorization failure cannot send mail; provider rejection stays failure',async()=>{let calls=0;let response=res();await createInvitationEmailHandler({env,fetchImpl:async()=>{calls++;return new Response('{}',{status:403});}})(req(),response);assert.equal(calls,1);assert.equal(response.statusCode,400);response=res();calls=0;await createInvitationEmailHandler({env,fetchImpl:async()=>++calls===1?new Response(JSON.stringify({id,recipient_email:'patient@example.test',reader_email:'rd@example.test',reader_name:'Jane',send_count:1})):new Response('sensitive detail',{status:500})})(req(),response);assert.equal(response.statusCode,502);assert.ok(!JSON.stringify(response.body).includes('sensitive'));});

test('unsupported provider fails closed without consuming an invitation send attempt',async()=>{const response=res();await createInvitationEmailHandler({env:{...env,INVITATION_EMAIL_PROVIDER:'ses'},fetchImpl:()=>{throw Error('Must not call');}})(req(),response);assert.equal(response.statusCode,503);assert.match(response.body.error,/not configured/);});

test('obsolete and ambiguous public URL config fails before claiming email',async()=>{
 for(const APP_PUBLIC_URL of ['https://www.myrenalsync.com','https://clearplate-kidney-nutrition.vercel.app','https://user:password@nepholio.com','https://nepholio.com/path','https://nepholio.com/?x=1','https://nepholio.com/#x','http://nepholio.com']){
  let calls=0;const response=res();await createInvitationEmailHandler({env:{...env,APP_PUBLIC_URL},fetchImpl:async()=>{calls++;throw Error();}})(req(),response);
  assert.equal(response.statusCode,503);assert.equal(calls,0,APP_PUBLIC_URL);assert.match(response.body.error,/configured/);
 }
});
test('canonical Nepholio config generates the canonical invitation destination',async()=>{
 const calls=[];const response=res();await createInvitationEmailHandler({env:{...env,APP_PUBLIC_URL:'https://nepholio.com'},fetchImpl:async(url,opts)=>{calls.push({url,opts});return Response.json(calls.length===1?{id,recipient_email:'patient@example.test',reader_email:'rd@example.test',reader_name:'Jane',send_count:1}:{id:'provider'});}})(req(),response);
 assert.equal(response.statusCode,200);assert.ok(JSON.parse(calls[1].opts.body).text.includes('https://nepholio.com/#care-invite/'+id));
});

test('local development requests can use a configured canonical HTTPS invitation destination',async()=>{
 for(const host of ['127.0.0.1:5173','localhost:5173']){
  const calls=[];const response=res();await createInvitationEmailHandler({env:{...env,APP_PUBLIC_URL:'https://nepholio.com'},fetchImpl:async(url,opts)=>{calls.push({url,opts});return Response.json(calls.length===1?{id,recipient_email:'patient@example.test',reader_email:'rd@example.test',reader_name:'Jane',send_count:1}:{id:'provider'});}})({...req(),headers:{...req().headers,host,origin:'http://'+host}},response);
  assert.equal(response.statusCode,200);assert.ok(JSON.parse(calls[1].opts.body).text.includes('https://nepholio.com/#care-invite/'+id));
 }
});
test('request origins and body URLs never select the invitation destination',async()=>{
 const calls=[];const response=res();await createInvitationEmailHandler({env:{...env,APP_PUBLIC_URL:'https://nepholio.com'},fetchImpl:async(url,opts)=>{calls.push({url,opts});return Response.json(calls.length===1?{id,recipient_email:'patient@example.test',reader_email:'rd@example.test',reader_name:'Jane',send_count:1}:{id:'provider'});}})({...req(),headers:{...req().headers,host:'untrusted.example',origin:'https://untrusted.example'},body:{...req().body,APP_PUBLIC_URL:'https://untrusted.example',origin:'https://untrusted.example'}},response);
 assert.equal(response.statusCode,200);const mail=JSON.parse(calls[1].opts.body);assert.ok(mail.text.includes('https://nepholio.com/#care-invite/'+id));assert.ok(!mail.text.includes('untrusted.example'));
});
test('HTTP public invitation destinations remain unsupported, including local loopback',async()=>{
 for(const APP_PUBLIC_URL of ['http://localhost:5173','http://127.0.0.1:5173']){
  let calls=0;const response=res();await createInvitationEmailHandler({env:{...env,APP_PUBLIC_URL},fetchImpl:async()=>{calls++;throw Error();}})(req(),response);
  assert.equal(response.statusCode,503);assert.equal(calls,0);
 }
});
