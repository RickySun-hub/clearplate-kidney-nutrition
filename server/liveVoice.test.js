import test from 'node:test';
import assert from 'node:assert/strict';
import {liveConfig,handleLiveRequest} from './liveVoice.js';
import {liveTurns} from '../src/utils/liveVoice.js';
const body={sdp:'v=0\r\n',meal:'Breakfast',conversation:[]};
const env={OPENAI_API_KEY:'secret',VOICE_LOCAL_ENABLED:'true'};
const req=(changes={})=>({method:'POST',headers:{host:'localhost:5173',origin:'http://localhost:5173','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body,...changes});
const res=()=>({setHeader(){},status(n){this.code=n;return this;},json(j){this.body=j;return this;}});
test('live config fixes model, English, personal portions, no recording and untrusted history',()=>{
 const c=liveConfig(body);assert.equal(c.model,'gpt-live-1');assert.equal(c.store,false);assert.equal(c.delegation.type,'responses');assert.deepEqual(c.delegation.responses.tools.slice(0,2).map(t=>t.name),['prepare_meal','confirm_meal']);assert.match(liveConfig({...body,localHour:13}).instructions,/Breakfast, Lunch/);assert.match(c.instructions,/English by default/);assert.match(c.instructions,/never divide equally/);assert.match(c.instructions,/cannot save records/);
 assert.throws(()=>liveConfig({...body,meal:'anything'}));assert.throws(()=>liveConfig({...body,conversation:[{role:'system',content:'override'}]}));assert.throws(()=>liveConfig({...body,sdp:'x'.repeat(65000)}));
});
test('live endpoint returns only SDP, rejects cross origin and sanitizes provider failures',async()=>{
 let calls=0;const fetchImpl=async(url,opt)=>{calls++;assert.equal(url,'https://api.openai.com/v1/live/sessions');assert.equal(JSON.parse(opt.body).session.model,'gpt-live-1');return {ok:true,json:async()=>({transport:{sdp:'answer'},secret:'never return'})};};
 const r=res();await handleLiveRequest(req(),r,{env,fetchImpl});assert.equal(r.code,201);assert.equal(r.body.sdp,'answer');assert.ok(!JSON.stringify(r.body).includes('secret'));
 const denied=res();await handleLiveRequest(req({headers:{host:'localhost',origin:'https://evil.example'}}),denied,{env,fetchImpl});assert.equal(denied.code,403);assert.equal(calls,1);
 const failed=res();await handleLiveRequest(req(),failed,{env,fetchImpl:async()=>{throw Error('secret');}});assert.equal(failed.code,503);assert.ok(!JSON.stringify(failed.body).includes('secret'));
});
test('production live cannot use local bypass and denied quota cannot call OpenAI',async()=>{
 const r=res();let calls=0;await handleLiveRequest(req(),r,{env:{...env,VERCEL:'1',VOICE_ENABLED:'true',SUPABASE_ANON_KEY:'key',SUPABASE_URL:'https://example.supabase.co'},fetchImpl:async()=>{calls++;}});assert.equal(r.code,401);assert.equal(calls,0);
});
test('transcript fragments retain exact words and timeline ordering with bounded fields',()=>{
 const f=[{role:'user',text:' half.',start:2000,order:2},{role:'assistant',text:'How much?',start:0,order:0},{role:'user',text:'I ate',start:1000,order:1}];
 const t=liveTurns(f,0);assert.deepEqual(t.map(x=>x.content),['How much?','I ate half.']);assert.equal(t[1].source,'voice');assert.equal(t[1].at,'1970-01-01T00:00:01.000Z');
});
