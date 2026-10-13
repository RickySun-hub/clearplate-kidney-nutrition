import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareCloud} from './careCloud.js';
test('late invitation email result is rejected after account change',async()=>{
 let finish,token=0;
 const client=createCareCloud({url:'https://synthetic.example.test',publishableKey:'sb_publishable_test'},async(url)=>{
  if(url.includes('/token?'))return Response.json({access_token:'synthetic-'+(++token),expires_in:3600});
  if(url.endsWith('/user'))return Response.json({id:'11111111-1111-4111-8111-111111111111'});
  return {ok:true,json:()=>new Promise(resolve=>finish=resolve)};
 });
 await client.signIn('old@example.test','synthetic');
 const old=client.sendInvitationEmail('22222222-2222-4222-8222-222222222222');
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 client.clearSession();await client.signIn('new@example.test','synthetic');
 finish({message:'Old invitation sent'});
 await assert.rejects(old,/Account changed/);
 assert.equal(client.accessToken(),'synthetic-2');
});
