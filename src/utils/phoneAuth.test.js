import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareCloud} from './careCloud.js';
const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
test('phone login sends normalized SMS and verifies user before accepting session',async()=>{
 const calls=[];const client=createCareCloud(config,async(url,opts)=>{calls.push({url,...opts});return Response.json(url.endsWith('/settings')?{external:{phone:true}}:url.endsWith('/verify')?{access_token:'test',expires_in:3600}:url.endsWith('/user')?{id:'11111111-1111-4111-8111-111111111111',phone:'+15551234567'}:{});});
 await client.sendPhoneCode('+1 (555) 123-4567');assert.deepEqual(JSON.parse(calls[1].body),{phone:'+15551234567',channel:'sms',create_user:true});assert.equal(client.accessToken(),null);
 const user=await client.verifyPhoneCode('+15551234567','123456');assert.equal(user.phone,'+15551234567');assert.equal(client.accessToken(),'test');assert.equal(calls.at(-1).url,config.url+'/auth/v1/user');
});
test('disabled provider and malformed numbers never send SMS; invalid code never verifies',async()=>{
 const calls=[];const client=createCareCloud(config,async(url)=>{calls.push(url);return Response.json({external:{phone:false}});});
 await assert.rejects(()=>client.sendPhoneCode('5551234567'),/country code/);assert.equal(calls.length,0);
 await assert.rejects(()=>client.sendPhoneCode('+15551234567'),/not available/);assert.equal(calls.length,1);
 await assert.rejects(()=>client.verifyPhoneCode('+15551234567','123'),/six-digit/);assert.equal(calls.length,1);
});
