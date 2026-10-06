import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareCloud } from './careCloud.js';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'example@example.test' };
function browser(href = 'https://clearplate.example/') {
  const values = new Map();
  return { location: { href, assign(url) { this.assigned = url; } }, history: { replaceState(a,b,path) { this.path=path; } }, sessionStorage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }, values };
}
test('Google PKCE roundtrip validates the account without persisting tokens or requesting Gmail access', async () => {
  const calls=[];
  const client=createCareCloud(config, async (url,opts) => {
    calls.push({url,...opts});
    return Response.json(url.endsWith('/settings') ? {external:{google:true}} : url.endsWith('/user') ? user : {access_token:'synthetic-token',expires_in:3600});
  });
  const tab=browser();await client.signInWithGoogle(tab);
  const authorize=new URL(tab.location.assigned);
  assert.equal(authorize.origin,config.url);
  assert.equal(authorize.searchParams.get('redirect_to'),'https://clearplate.example/');
  assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
  assert.equal(authorize.searchParams.has('scope'),false);
  const saved=JSON.parse(tab.values.get('clearplate-google-pkce'));
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(saved.verifier))).toString('base64url');
  assert.equal(authorize.searchParams.get('code_challenge'),digest);
  tab.location.href='https://clearplate.example/?code=synthetic-code';
  assert.deepEqual(await client.finishGoogleSignIn(tab),user);
  assert.equal(tab.values.size,0);
  assert.equal(tab.history.path,'/');
  assert.equal(client.accessToken(),'synthetic-token');
  assert.deepEqual(JSON.parse(calls[1].body),{auth_code:'synthetic-code',code_verifier:saved.verifier});
  assert.ok(calls.every(c=>!c.url.includes('/rest/')));
});
test('Missing, expired and wrong-origin verifier cannot exchange a callback code',async()=>{
  for(const pending of [null,{verifier:'a'.repeat(64),createdAt:Date.now()-600001,origin:'https://clearplate.example'},{verifier:'a'.repeat(64),createdAt:Date.now(),origin:'https://other.example'}]){
    let called=false;const client=createCareCloud(config,async()=>{called=true;});const tab=browser('https://clearplate.example/?code=untrusted');
    if(pending)tab.values.set('clearplate-google-pkce',JSON.stringify(pending));
    await assert.rejects(()=>client.finishGoogleSignIn(tab),/expired/);assert.equal(called,false);assert.equal(client.accessToken(),null);assert.equal(tab.values.size,0);
  }
});
test('Disabled Google and declined consent leave no authenticated session',async()=>{
  const client=createCareCloud(config,async()=>Response.json({external:{google:false}}));const tab=browser();
  await assert.rejects(()=>client.signInWithGoogle(tab),/being set up/);assert.equal(tab.location.assigned,undefined);
  tab.location.href='https://clearplate.example/?error=access_denied&error_description=untrusted';
  await assert.rejects(()=>client.finishGoogleSignIn(tab),/not completed/);assert.equal(tab.history.path,'/');assert.equal(client.accessToken(),null);
});
test('A token response cannot authenticate an unverified user',async()=>{
  const client=createCareCloud(config,async(url)=>Response.json(url.endsWith('/user')?{id:'invalid'}:{access_token:'synthetic',expires_in:3600}));const tab=browser('https://clearplate.example/?code=example');
  tab.values.set('clearplate-google-pkce',JSON.stringify({verifier:'a'.repeat(64),createdAt:Date.now(),origin:'https://clearplate.example'}));
  await assert.rejects(()=>client.finishGoogleSignIn(tab),/verified/);assert.equal(client.accessToken(),null);
});
