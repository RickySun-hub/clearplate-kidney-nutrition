import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrigin, createVoiceService, readVoiceBody, voiceAllowed } from './voice.js';
const request = { headers: { host: 'localhost:5173', origin: 'http://localhost:5173' }, socket: { remoteAddress: '127.0.0.1' } };
test('voice requires explicit opt-in and actual local socket; forged host is insufficient', () => {
  assert.equal(voiceAllowed(request, {}), false);
  assert.equal(voiceAllowed(request, { VOICE_LOCAL_ENABLED: 'true' }), true);
  assert.equal(voiceAllowed({ ...request, socket: { remoteAddress: '203.0.113.3' } }, { VOICE_LOCAL_ENABLED: 'true' }), false);
  assert.equal(voiceAllowed({ ...request, headers: { host: 'example.com' } }, { VOICE_LOCAL_ENABLED: 'true' }), false);
});
test('origin is required and must match browser host', () => {
  assert.doesNotThrow(() => assertOrigin(request));
  assert.throws(() => assertOrigin({ headers: { host: 'localhost:5173' } }), { code: 'origin_required' });
  assert.throws(() => assertOrigin({ headers: { host: 'localhost:5173', origin: 'https://attacker.example' } }), { code: 'origin_denied' });
});
test('body parsing bounds input and rejects malformed JSON', async () => {
  assert.deepEqual(await readVoiceBody({ body: '{"transcript":"apple"}' }), { transcript: 'apple' });
  await assert.rejects(readVoiceBody({ body: '{' }), { code: 'invalid_request' });
  await assert.rejects(readVoiceBody({ body: { audio: 'a'.repeat(2800001) } }), { code: 'too_large' });
});
test('no key and invalid audio never call paid upstream', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; };
  await assert.rejects(createVoiceService({ fetchImpl }).process({ transcript: 'apple' }), { code: 'voice_unavailable' });
  await assert.rejects(createVoiceService({ apiKey: 'mock', fetchImpl }).process({ audio: 'AAAA', mimeType: 'audio/webm', duration: 61 }), { code: 'invalid_audio' });
  assert.equal(calls, 0);
});
test('model output is allowlisted, nutrition discarded, and requests throttled', async () => {
  let calls = 0;
  const service = createVoiceService({ apiKey: 'mock', recipes: [{ id: 'apple', name: 'Apple' }], fetchImpl: async (_url, options) => {
    calls++; assert.equal(JSON.parse(options.body).model, 'gpt-4.1');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ intent: 'food', recipeId: 'fake-id', foodName: 'apple', servings: 100, meal: 'fake', calories: 100 }) } }] }) };
  } });
  const result = await service.process({ transcript: 'apple' });
  assert.equal(result.draft.recipeId, null); assert.equal(result.draft.servings, 1); assert.equal(result.draft.meal, 'Snack'); assert.equal('calories' in result.draft, false);
  await assert.rejects(service.process({ transcript: 'apple' }), { code: 'voice_rate_limited' }); assert.equal(calls, 1);
});
test('audio transcribes then interprets, never returns provider audio or secrets', async () => {
  const calls = [];
  const service = createVoiceService({ apiKey: 'mock', fetchImpl: async (url, options) => {
    calls.push(url);
    if (url.endsWith('transcriptions')) { assert.equal(options.body.get('model'), 'gpt-4o-transcribe'); assert.equal(options.body.get('language'),'en'); return { ok: true, json: async () => ({ text: 'next step' }) }; }
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"intent":"cooking","command":"next"}' } }] }) };
  } });
  const result = await service.process({ audio: 'AAAA', mimeType: 'audio/webm', duration: 2 });
  assert.equal(result.transcript, 'next step'); assert.equal(result.draft.command, 'next'); assert.equal(calls.length, 2);
});
test('invalid upstream output and failures produce safe actionable errors', async () => {
  const service = createVoiceService({ apiKey: 'mock', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }) });
  await assert.rejects(service.process({ transcript: 'apple' }), { code: 'invalid_response' });
  const failed = createVoiceService({ apiKey: 'mock', fetchImpl: async () => { throw new Error('provider private detail'); } });
  await assert.rejects(failed.process({ transcript: 'apple' }), error => error.code === 'voice_unavailable' && !error.message.includes('private'));
});
import { authenticateVoice, productionVoiceConfigured, validateWav } from './voice.js';
test('production requires explicit enablement and secure configured Supabase', () => {
  assert.equal(productionVoiceConfigured({ VOICE_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'mock',OPENAI_API_KEY:'mock' }),true);
  assert.equal(productionVoiceConfigured({ VOICE_ENABLED:'true',SUPABASE_URL:'http://example.supabase.co',SUPABASE_ANON_KEY:'mock',OPENAI_API_KEY:'mock' }),false);
});
const productionEnv = { VOICE_ENABLED:'true', SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:'mock', OPENAI_API_KEY:'mock' };
const signedRequest = { headers:{ authorization:`Bearer ${'a'.repeat(25)}` } };
test('verified server identity then atomic authenticated quota with no client identity parameters',async()=>{
  const urls=[];
  const auth = await authenticateVoice(signedRequest,{env:productionEnv,consume:true,fetchImpl:async(url,options)=>{
    urls.push(url); assert.equal(options.headers.Authorization,signedRequest.headers.authorization);
    if(url.endsWith('/user')) return {ok:true,json:async()=>({id:'verified-user',email_confirmed_at:'2026-01-01'})};
    assert.equal(options.body,'{}'); return {ok:true,json:async()=>({allowed:true,maxAudioSeconds:60,remaining:29})};
  }});
  assert.equal(auth.userId,'verified-user');assert.equal(auth.remaining,29);assert.equal(urls.length,2);
});
test('missing token, forged session, unverified/anonymous account, denied quota fail closed',async()=>{
  await assert.rejects(authenticateVoice({headers:{}},{env:productionEnv}),{code:'sign_in_required'});
  await assert.rejects(authenticateVoice(signedRequest,{env:productionEnv,fetchImpl:async()=>({ok:false})}),{code:'session_invalid'});
  await assert.rejects(authenticateVoice(signedRequest,{env:productionEnv,fetchImpl:async()=>({ok:true,json:async()=>({id:'x',is_anonymous:true})})}),{code:'verified_account_required'});
  await assert.rejects(authenticateVoice(signedRequest,{env:productionEnv,consume:true,fetchImpl:async(url)=>({ok:true,json:async()=>url.endsWith('/user')?{id:'x',email_confirmed_at:'now'}:{allowed:false,maxAudioSeconds:60}})}),{code:'voice_quota_exceeded'});
});
function wav(seconds=1) {
  const bytes=Buffer.alloc(44+32000*seconds);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);return bytes;
}
test('server computes true PCM duration; spoofed long/wrong format/trailing data is rejected',()=>{
  assert.equal(validateWav(wav(1)),1);
  assert.throws(()=>validateWav(wav(61)),{code:'invalid_audio'});
  assert.throws(()=>validateWav(wav(2),1),{code:'invalid_audio'});
  const wrong=wav();wrong.writeUInt32LE(1,24);assert.throws(()=>validateWav(wrong),{code:'invalid_audio'});
  assert.throws(()=>validateWav(Buffer.concat([wav(),Buffer.from('junk')])),{code:'invalid_audio'});
});
test('local flag cannot bypass production or Vercel authorization',()=>{
  assert.equal(voiceAllowed(request,{VOICE_LOCAL_ENABLED:'true',NODE_ENV:'production'}),false);
  assert.equal(voiceAllowed(request,{VOICE_LOCAL_ENABLED:'true',VERCEL:'1'}),false);
});
test('unknown interpretation remains unknown instead of becoming a food log',async()=>{
  const service=createVoiceService({apiKey:'mock',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"intent":"conversation","foodName":"invented food"}'}}]})})});
  const result=await service.process({transcript:'hello'});assert.equal(result.draft.intent,'unknown');
});

test('conversation passes corrections as history but strips model nutrients and invalid times',async()=>{
 let sent;
 const service=createVoiceService({apiKey:'mock',throttle:false,fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({intent:'food',foodName:'egg',ready:true,reply:'One boiled egg. Please review.',mealTime:'99:99',sodium:5000})}}]})};}});
 const history=[{role:'user',content:'Two eggs',source:'voice',at:'2026-10-07T20:00:00Z'}];
 const result=await service.process({transcript:'Actually one boiled egg.',conversation:history,meal:'Breakfast'});
 assert.equal(result.ready,true);assert.equal(result.mealTime,null);assert.equal(result.draft.sodium,undefined);
 assert.ok(sent.messages.some(m=>m.content==='Two eggs'));
 await assert.rejects(service.process({transcript:'hello',conversation:[{...history[0],role:'system'}]}),{code:'invalid_conversation'});
});
