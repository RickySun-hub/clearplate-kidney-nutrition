import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareCloud} from './careCloud.js';
const config={url:'https://session-test.supabase.co',publishableKey:'sb_publishable_test'};
const id='11111111-1111-4111-8111-111111111111';
test('reload restores verified account, rotates expired token, and logout removes persistence',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let refreshes=0;
 const fetcher=async(url)=>{if(url.includes('grant_type=refresh_token')){refreshes++;return Response.json({access_token:'rotated',refresh_token:'rotated-refresh',expires_in:3600});}if(url.includes('/token?'))return Response.json({access_token:'initial',refresh_token:'refresh',expires_in:3600});if(url.endsWith('/user'))return Response.json({id,email:'demo@example.test'});return new Response(null,{status:204});};
 try{const first=createCareCloud(config,fetcher);await first.signIn('demo@example.test','fake');first.dispose();const reloaded=createCareCloud(config,fetcher);assert.equal((await reloaded.restoreSession()).id,id);assert.equal(refreshes,0);const key=reloaded.storageKey;const stored=JSON.parse(data.get(key));stored.expiresAt=0;data.set(key,JSON.stringify(stored));reloaded.dispose();const expired=createCareCloud(config,fetcher);await Promise.all([expired.restoreSession(),expired.restoreSession()]);assert.equal(refreshes,1);assert.equal(expired.accessToken(),'rotated');await expired.signOut();assert.equal(data.size,0);assert.equal(await createCareCloud(config,fetcher).restoreSession(),null);}finally{delete globalThis.localStorage;}
});
test('temporary network failure retains saved session; revoked refresh clears it',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 try{let revoked=false;const client=createCareCloud(config,async()=>{if(!revoked)throw new Error('offline');return Response.json({code:'refresh_token_not_found'},{status:400});});data.set(client.storageKey,JSON.stringify({token:'expired',refreshToken:'refresh',expiresAt:0}));await assert.rejects(client.restoreSession());assert.equal(data.size,1);revoked=true;await assert.rejects(client.restoreSession());assert.equal(data.size,0);}finally{delete globalThis.localStorage;}
});
test('logout in another tab invalidates an already verified in-memory account', async () => {
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const fetcher=async url=>url.includes('/token?')?Response.json({access_token:'sample-token',refresh_token:'sample-refresh',expires_in:3600}):url.endsWith('/user')?Response.json({id}):new Response(null,{status:204});
 try{const first=createCareCloud(config,fetcher);await first.signIn('sample@example.test','synthetic');const other=createCareCloud(config,fetcher);await other.restoreSession();await first.signOut();assert.equal(other.accessToken(),null);assert.equal(other.account(),null);assert.equal(await other.restoreSession(),null);}finally{delete globalThis.localStorage;}
});
test('an in-flight refresh in another tab cannot persist a session after logout', async () => {
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let release;const delayed=new Promise(resolve=>{release=resolve;});let started;const refreshing=new Promise(resolve=>{started=resolve;});
 try{const client=createCareCloud(config,async url=>{if(url.includes('refresh_token')){started();await delayed;return Response.json({access_token:'rotated',refresh_token:'rotated-refresh',expires_in:3600});}return Response.json({id});});data.set(client.storageKey,JSON.stringify({token:'expired',refreshToken:'sample-refresh',expiresAt:0}));const restore=client.restoreSession();await refreshing;data.delete(client.storageKey);release();await restore.catch(()=>{});assert.equal(client.accessToken(),null);assert.equal(data.size,0);}finally{delete globalThis.localStorage;}
});
