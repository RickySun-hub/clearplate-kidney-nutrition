import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareCloud } from './careCloud.js';
const config={url:'https://synthetic.supabase.co',publishableKey:'sb_publishable_test'};
const owner='11111111-1111-4111-8111-111111111111';
function harness(){
 const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let clock=Date.now(), refreshes=0, offline=false, revoked=false;
 const fetcher=async(url,options)=>{
  if(offline)throw Error('offline');
  if(url.includes('grant_type=refresh_token')){refreshes++;if(revoked)return Response.json({code:'refresh_token_not_found'},{status:400});return Response.json({access_token:'renewed',refresh_token:'rotated',expires_in:3600});}
  if(url.includes('/token?'))return Response.json({access_token:'initial',refresh_token:'original',expires_in:3600});
  if(url.endsWith('/user'))return Response.json({id:owner,email:'synthetic@example.test'});
  return Response.json([]);
 };
 const make=()=>createCareCloud(config,fetcher,{storage,now:()=>clock});
 return {data,make,get refreshes(){return refreshes;},expire(){clock+=3600001;},offline(v){offline=v;},revoke(){revoked=true;}};
}
test('sign-in survives a client restart and verifies the restored identity',async()=>{
 const h=harness();const first=h.make();await first.signIn('synthetic@example.test','synthetic-password');first.dispose();
 const reopened=h.make();assert.equal((await reopened.restoreSession?.())?.id,owner);
 assert.equal(reopened.account()?.id,owner);
});
test('expiry refreshes once for concurrent requests and persists rotation',async()=>{
 const h=harness(),client=h.make();await client.signIn('synthetic@example.test','password');h.expire();
 await Promise.all([client.shared(),client.shared()]);assert.equal(h.refreshes,1);assert.equal(client.accessToken(),'renewed');
 client.dispose();const next=h.make();await next.restoreSession();assert.equal(next.accessToken(),'renewed');
});
test('offline refresh keeps the recoverable session; revoked refresh removes it',async()=>{
 const h=harness(),client=h.make();await client.signIn('synthetic@example.test','password');h.expire();h.offline(true);
 await assert.rejects(()=>client.shared());assert.equal(h.data.size,1);h.offline(false);await client.shared();
 h.expire();h.revoke();await assert.rejects(()=>client.shared(),/sign in/);assert.equal(client.account(),null);assert.equal(h.data.size,0);
});
test('deliberate logout removes persistence immediately even offline',async()=>{
 const h=harness(),client=h.make();await client.signIn('synthetic@example.test','password');h.offline(true);
 await assert.rejects(()=>client.signOut());assert.equal(h.data.size,0);assert.equal(client.account(),null);
 h.offline(false);assert.equal(await h.make().restoreSession(),null);
});
test('blocked storage allows this-tab login without pretending persistence',async()=>{
 const client=createCareCloud(config,async url=>Response.json(url.endsWith('/user')?{id:owner}:{access_token:'initial',refresh_token:'original',expires_in:3600}),{storage:{getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}}});
 await client.signIn('synthetic@example.test','password');assert.equal(client.account().id,owner);assert.equal(client.sessionPersistenceAvailable(),false);
});
test('logout while refresh is pending cannot resurrect saved credentials',async()=>{
 const h=harness();let release;let refreshing;const started=new Promise(r=>refreshing=r);
 const client=createCareCloud(config,async url=>{
  if(url.includes('refresh_token')){refreshing();return new Promise(r=>release=r);}
  if(url.endsWith('/user'))return Response.json({id:owner});
  return Response.json({access_token:'initial',refresh_token:'original',expires_in:1});
 },{storage:{getItem:k=>h.data.get(k)||null,setItem:(k,v)=>h.data.set(k,v),removeItem:k=>h.data.delete(k)}});
 await client.signIn('synthetic@example.test','password');const pending=client.freshAccessToken();const rejected=assert.rejects(pending,/Account changed/);await started;
 await client.signOut();release(Response.json({access_token:'late',refresh_token:'late-refresh',expires_in:3600}));await rejected;
 assert.equal(h.data.size,0);assert.equal(client.account(),null);
});
test('rejected restored identity never exposes an account',async()=>{
 const h=harness();await h.make().signIn('synthetic@example.test','password');
 const client=createCareCloud(config,async()=>Response.json({id:'22222222-2222-4222-8222-222222222222'}),{storage:{getItem:k=>h.data.get(k)||null,setItem:(k,v)=>h.data.set(k,v),removeItem:k=>h.data.delete(k)}});
 await assert.rejects(()=>client.restoreSession(),/sign in/);assert.equal(client.account(),null);assert.equal(h.data.size,0);
});
test('same-account rotation in another tab does not spuriously sign out a valid session',async()=>{
 const h=harness();const a=h.make();await a.signIn('synthetic@example.test','password');const b=h.make();await b.restoreSession();h.expire();await b.freshAccessToken();
 await a.shared();assert.equal(a.account().id,owner);assert.equal(h.refreshes,1);
});
test('a reopened offline browser retains credentials for a later retry',async()=>{
 const h=harness();await h.make().signIn('synthetic@example.test','password');const b=h.make();h.offline(true);
 await assert.rejects(()=>b.restoreSession());assert.equal(b.account(),null);assert.equal(h.data.size,1);
 h.offline(false);assert.equal((await b.restoreSession()).id,owner);
});

test('restore survives same-session rotation while identity verification is pending',async()=>{
 const h=harness();await h.make().signIn('synthetic@example.test','password');
 let release,started;const entered=new Promise(resolve=>started=resolve);
 const storage={getItem:k=>h.data.get(k)||null,setItem:(k,v)=>h.data.set(k,v),removeItem:k=>h.data.delete(k)};
 const client=createCareCloud(config,async()=>{started();return new Promise(resolve=>release=resolve);},{storage});
 const events=[];client.onSessionChange(user=>events.push(user));
 const pending=client.restoreSession();await entered;
 assert.equal(client.account(),null,'identity must remain unverified');
 const [key,raw]=[...h.data][0];const saved=JSON.parse(raw);
 h.data.set(key,JSON.stringify({...saved,token:'rotated-access',refreshToken:'rotated-refresh',expiresAt:Date.now()+3600000}));
 release(Response.json({id:owner,email:'synthetic@example.test'}));
 assert.equal((await pending).id,owner);
 assert.equal(client.accessToken(),'rotated-access');
 assert.equal(JSON.parse(h.data.get(key)).refreshToken,'rotated-refresh');
 assert.deepEqual(events,[],'restoring must not emit a false sign-out');
});

test('pending restore rejects expired rotations, account/session changes, logout and disposal',async()=>{
 for(const action of ['replace','expired','account','logout','dispose']){
  const h=harness();await h.make().signIn('synthetic@example.test','password');
  let release,started;const entered=new Promise(resolve=>started=resolve);
  const storage={getItem:k=>h.data.get(k)||null,setItem:(k,v)=>h.data.set(k,v),removeItem:k=>h.data.delete(k)};
  const client=createCareCloud(config,async()=>{started();return new Promise(resolve=>release=resolve);},{storage});
  const pending=client.restoreSession();const rejected=assert.rejects(pending,/Account changed|closed/);await entered;
  const [key,raw]=[...h.data][0];
  if(action==='replace')h.data.set(key,JSON.stringify({...JSON.parse(raw),sessionId:'different-session'}));
  else if(action==='expired')h.data.set(key,JSON.stringify({...JSON.parse(raw),expiresAt:Date.now()-1}));
  else if(action==='account')h.data.set(key,JSON.stringify({...JSON.parse(raw),userId:'22222222-2222-4222-8222-222222222222'}));
  else if(action==='logout')h.data.delete(key);
  else client.dispose();
  const expected=h.data.get(key);release(Response.json({id:owner}));await rejected;
  assert.equal(client.account(),null);assert.equal(h.data.get(key),expected);
 }
});

test('late rejection of the pre-rotation token preserves the newer session for verified retry',async()=>{
 for(const status of [401,403]){
 const h=harness();await h.make().signIn('synthetic@example.test','password');
 let release,started,calls=0;const entered=new Promise(resolve=>started=resolve);
 const storage={getItem:k=>h.data.get(k)||null,setItem:(k,v)=>h.data.set(k,v),removeItem:k=>h.data.delete(k)};
 const client=createCareCloud(config,async()=>{if(++calls===1){started();return new Promise(resolve=>release=resolve);}return Response.json({id:owner});},{storage});
 const pending=client.restoreSession();const rejected=assert.rejects(pending,/renewed.*retry/);await entered;
 const [key,raw]=[...h.data][0];const rotated=JSON.stringify({...JSON.parse(raw),token:'new-access',refreshToken:'new-refresh',expiresAt:Date.now()+3600000});h.data.set(key,rotated);
 release(Response.json({}, {status}));await rejected;
 assert.equal(client.account(),null);assert.equal(h.data.get(key),rotated);
 assert.equal((await client.restoreSession()).id,owner);
 }
});
