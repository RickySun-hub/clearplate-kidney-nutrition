import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareCloud, validateCareRecord, isAccountId } from './careCloud.js';
const owner = '11111111-1111-4111-8111-111111111111';
const reader = '22222222-2222-4222-8222-222222222222';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const record = { profile: { name: 'Example' }, entries: [], dayRecords: {} };
function fakeCloud() {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, ...options });
    if (url.includes('/token?')) return new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600, user: { id: owner } }));
    if (url.endsWith('/user')) return new Response(JSON.stringify({ id: owner, email: 'person@example.test' }));
    return new Response('[]');
  };
  return { client: createCareCloud(config, fetcher), calls };
}
test('cloud refuses nonpublishable or insecure config and malformed records', () => {
  assert.throws(() => createCareCloud({ ...config, url: 'http://example.test' }));
  assert.throws(() => createCareCloud({ ...config, publishableKey: 'service_role' }));
  assert.throws(() => validateCareRecord({ ...record, dayRecords: [] }));
  assert.throws(() => validateCareRecord({ ...record, profile: [] }));
  assert.equal(isAccountId('bad&id=anything'), false);
});
test('sign-in verifies the user, does not upload, and memory session clears', async () => {
  const { client, calls } = fakeCloud();
  await assert.rejects(() => client.upload(record), /sign in/);
  await client.signIn('person@example.test', 'example-password');
  assert.equal(calls.length, 2);
  assert.equal(client.account().id, owner);
  assert.equal(client.accessToken(), 'test-access-token');
  assert.equal(calls[1].headers.Authorization, 'Bearer test-access-token');
  assert.ok(calls.every((call) => call.cache === 'no-store' && call.credentials === 'omit'));
  client.clearSession();
  assert.equal(client.account(), null);
  assert.equal(client.accessToken(), null);
});
test('explicit upload uses authenticated owner and strips unrelated top-level data', async () => {
  const { client, calls } = fakeCloud();
  await client.signIn('person@example.test', 'example-password');
  await client.upload({ ...record, unrelated: 'excluded' });
  const upload = calls.at(-1);
  const body = JSON.parse(upload.body);
  assert.equal(body.owner_id, owner);
  assert.deepEqual(body.record, record);
  assert.equal(upload.method, 'POST');
  assert.match(upload.headers.Prefer, /merge-duplicates/);
});
test('sharing uses exact IDs and list avoids bulk private snapshot download', async () => {
  const { client, calls } = fakeCloud();
  await client.signIn('person@example.test', 'example-password');
  await assert.rejects(() => client.grant(owner), /RD/);
  await assert.rejects(() => client.grant('invalid'), /RD/);
  await client.grant(reader);
  assert.deepEqual(JSON.parse(calls.at(-1).body), { owner_id: owner, reader_id: reader });
  await client.revoke(reader);
  assert.equal(calls.at(-1).method, 'DELETE');
  await client.shared();
  assert.ok(!calls.at(-1).url.includes('select=owner_id,record'));
  await assert.rejects(() => client.read(reader), /no longer shared/);
});
test('provider errors never expose response details and logout clears after failure', async () => {
  let fail = false;
  const client = createCareCloud(config, async (url) => fail ? new Response('private-server-error', { status: 403 }) : new Response(JSON.stringify(url.includes('/token?') ? { access_token: 'test', user: { id: owner } } : { id: owner })));
  await client.signIn('person@example.test', 'example-password'); fail = true;
  await assert.rejects(() => client.shared(), (error) => !error.message.includes('private-server-error'));
  await assert.rejects(() => client.signOut());
  assert.equal(client.accessToken(), null);
});

test('closing a connection prevents a pending sign-in from restoring its session', async () => {
  let resolve;
  const client = createCareCloud(config, () => new Promise((done) => { resolve = done; }));
  const signin = client.signIn('person@example.test', 'example-password');
  client.dispose();
  resolve(new Response(JSON.stringify({ access_token: 'test', user: { id: owner } })));
  await assert.rejects(() => signin, /closed/);
  assert.equal(client.account(), null);
  assert.equal(client.accessToken(), null);
});

test('date-keyed daily records preserve their keys and malformed children are not invented', () => {
 const daily = { ...record, dayRecords: { '2026-10-04': { entries: [] } } };
 assert.deepEqual(validateCareRecord(daily), daily);
 assert.throws(() => validateCareRecord({ ...record, dayRecords: null }));
});

test('malformed cloud fields cannot crash record review or become invented nutrition', () => {
 const valid = { profile: { name: 'Example', trackedNutrients: ['sodium'] }, entries: [{ id: 'example', date: '2026-10-04', servings: 1, source: 'custom', customFood: { name: 'Apple', sodium: null, protein: 0 } }], dayRecords: {} };
 assert.deepEqual(validateCareRecord(valid), valid);
 for (const change of [
   { entries: [null] },
   { entries: [{ ...valid.entries[0], meal: {} }] },
   { entries: [{ ...valid.entries[0], date: '2026-02-30' }] },
   { entries: [{ ...valid.entries[0], servings: null }] },
   { entries: [{ ...valid.entries[0], customFood: { name: {} } }] },
   { entries: [{ ...valid.entries[0], customFood: { sodium: {} } }] },
   { profile: { trackedNutrients: {} } },
   { profile: { name: {} } },
   { dayRecords: { '2026-10-04': { signature: {} } } },
 ]) assert.throws(() => validateCareRecord({ ...valid, ...change }), /invalid/);
});
test('stale account response cannot return private records or clear a newer session', async () => {
 let finish;
 const client = createCareCloud(config, async (url) => {
  if (url.includes('/token?')) return new Response(JSON.stringify({ access_token: 'test', user: { id: owner } }));
  if (url.endsWith('/user')) return new Response(JSON.stringify({ id: owner }));
  return new Promise((resolve) => { finish = resolve; });
 });
 await client.signIn('person@example.test','example-password');
 const previous = client.shared();
 client.clearSession();
 await client.signIn('person@example.test','example-password');
 finish(new Response('private-detail', { status: 401 }));
 await assert.rejects(() => previous, /Account changed/);
 assert.equal(client.account().id, owner);
});
test('malformed cloud list rejects before reaching UI rendering', async () => {
 const client = createCareCloud(config, async (url) => new Response(JSON.stringify(url.includes('/token?') ? {access_token:'test',user:{id:owner}} : url.endsWith('/user') ? {id:owner} : [{owner_id:{},updated_at:'today'}])));
 await client.signIn('person@example.test','example-password');
 await assert.rejects(() => client.shared(), /unexpected patient list/);
 await assert.rejects(() => client.grants(), /unexpected access list/);
});

test('signout clears bearer token immediately even when cloud logout is pending', async () => {
 let finish;
 const client = createCareCloud(config, async (url) => {
  if (url.endsWith('/logout')) return new Promise((resolve) => { finish = resolve; });
  return new Response(JSON.stringify(url.includes('/token?') ? { access_token: 'test', user: { id: owner } } : {id:owner}));
 });
 await client.signIn('person@example.test','example-password');
 const logout = client.signOut();
 assert.equal(client.accessToken(), null);
 assert.equal(client.account(), null);
 finish(new Response('',{status:200}));
 await logout;
});

test('auth errors distinguish unconfirmed email, bad credentials and delivery setup without leaking provider text', async () => {
  for (const [code, expected] of [['email_not_confirmed',/Confirm your email/],['invalid_credentials',/Create account first/],['email_address_not_authorized',/email service needs configuration/]]) {
    const client=createCareCloud(config, async()=>new Response(JSON.stringify({code,message:'private-provider-detail'}),{status:400}));
    await assert.rejects(()=>client.signIn('person@example.test','test-password'), expected);
    assert.equal(client.accessToken(),null);
  }
});

test('cloud save uses compare-and-swap and detects stale revisions',async()=>{
 let row=null;const client=createCareCloud(config,async(url,o)=>{if(url.includes('/token?'))return Response.json({access_token:'test',expires_in:3600});if(url.endsWith('/user'))return Response.json({id:owner});if(o.method==='POST'){if(row)return Response.json([]);row=JSON.parse(o.body);return Response.json([row]);}if(o.method==='PATCH'){if(new URL(url).searchParams.get('updated_at')!=='eq.'+row.updated_at)return Response.json([]);row={...row,...JSON.parse(o.body)};return Response.json([row]);}return Response.json(row?[row]:[]);});
 await client.signIn('x@example.test','test');assert.equal(await client.own(),null);const first=await client.save(record,null);assert.ok(first.updated_at);const newer=await client.save({...record,profile:{name:'Changed'}},first.updated_at);await assert.rejects(()=>client.save(record,first.updated_at),/Another device/);assert.equal((await client.own()).record.profile.name,'Changed');assert.equal((await client.save(newer.record,first.updated_at)).updated_at,newer.updated_at);
});

test('patient directory returns profile summaries without loading food records', async () => {
  let directoryUrl;
  const client=createCareCloud(config,async(url)=>{
    if(url.includes('/token?'))return new Response(JSON.stringify({access_token:'test-access-token',expires_in:3600}));
    if(url.endsWith('/user'))return new Response(JSON.stringify({id:owner}));
    directoryUrl=url;
    return new Response(JSON.stringify([{owner_id:reader,updated_at:'2026-10-09T12:00:00Z',profile:{name:' Jane ',condition:'CKD',stage:'3',treatment:'',privateExtra:'not returned'},record:{entries:['not returned']}}]));
  });
  await client.signIn('rd@example.test','test-password');
  const rows=await client.shared();
  assert.match(directoryUrl,/profile:record->profile/);
  assert.equal(rows[0].profile.name,'Jane');
  assert.deepEqual(Object.keys(rows[0].profile),['name','condition','stage','treatment']);
  assert.equal(rows[0].record,undefined);
});
