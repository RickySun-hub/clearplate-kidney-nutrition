import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareCloud} from './careCloud.js';
const a='11111111-1111-4111-8111-111111111111',b='33333333-3333-4333-8333-333333333333',rd='22222222-2222-4222-8222-222222222222',other='55555555-5555-4555-8555-555555555555';
test('reader requests retain server-authorized patient scope; denied and pending records never become visible',async()=>{
  let current=rd,granted=true;const requests=[];
  const client=createCareCloud({url:'https://synthetic.example.test',publishableKey:'sb_publishable_test'},async(url,options)=>{
    requests.push({url,...options});const u=new URL(url);
    if(u.pathname.endsWith('/token')){current=JSON.parse(options.body).email==='other@example.test'?other:rd;return Response.json({access_token:'synthetic-'+current,expires_in:3600});}
    if(u.pathname.endsWith('/user'))return Response.json({id:current});
    if(u.pathname.endsWith('/care_records')){
      assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer synthetic-'+current);
      const filter=u.searchParams.get('owner_id');
      const visible=current===rd&&granted;
      if(filter.startsWith('neq.'))return Response.json(visible?[{owner_id:a,updated_at:'2026-10-10',profile:{name:'Synthetic'}}]:[]);
      return Response.json(visible&&filter==='eq.'+a?[{owner_id:a,updated_at:'2026-10-10',record:{profile:{name:'Synthetic'},entries:[],dayRecords:{}}}]:[]);
    }
    return Response.json([]);
  });
  await client.signIn('rd@example.test','synthetic-password');
  assert.equal((await client.shared()).length,1);assert.equal((await client.read(a)).owner_id,a);
  await assert.rejects(()=>client.read(b),/no longer shared/); // unrelated or pending invitation
  granted=false;assert.deepEqual(await client.shared(),[]);await assert.rejects(()=>client.read(a),/no longer shared/);
  client.clearSession();granted=true;await client.signIn('other@example.test','synthetic-password');
  assert.deepEqual(await client.shared(),[]);await assert.rejects(()=>client.read(a),/no longer shared/);
  assert.ok(requests.filter(r=>r.url.includes('/rest/')).every(r=>r.method==='GET'));
});

test('missing RD service explains setup failure without granting access',async()=>{
 const client=createCareCloud({url:'https://synthetic.example.test',publishableKey:'sb_publishable_test'},async(url)=>{
  if(url.includes('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
  if(url.includes('/user'))return Response.json({id:rd});
  return Response.json({code:'PGRST202'},{status:404});
 });
 await client.signIn('rd@example.test','synthetic-password');
 await assert.rejects(()=>client.rdAccess('status'),/service needs to be set up/);
});
