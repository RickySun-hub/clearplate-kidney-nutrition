// Run against the local Vite server. All auth/data endpoints below are mocked.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { chromium }=createRequire(import.meta.url)('playwright');
const owner='11111111-1111-4111-8111-111111111111',rd='22222222-2222-4222-8222-222222222222';
const date=new Date().toISOString().slice(0,10),origin='https://synthetic.supabase.co';
const ingredientFood={fdcId:1,description:'Synthetic grain, raw',dataType:'SR Legacy',release:'Synthetic QA only',basis:'per100g',nutrients:{calories:100,protein:2,sodium:125,potassium:10,phosphorus:20},portions:[{amount:1,description:'cup',gramWeight:200}]};
const unknownFood={...ingredientFood,fdcId:2,description:'Synthetic vegetables, cooked',nutrients:{calories:50,protein:1,sodium:0,potassium:null,phosphorus:null},portions:[]};
let refreshes=0,logins=0,revoked=false;
const tokens=new Map(),refreshTokens=new Map();
function issue(id){const token=`synthetic-access-${tokens.size}`,refresh=`synthetic-refresh-${tokens.size}`;tokens.set(token,id);refreshTokens.set(refresh,id);return {access_token:token,refresh_token:refresh,expires_in:3600};}
const profile={name:'Synthetic Alex',condition:'Adult ADPKD',stage:'G2',weightKg:70,heightCm:175,treatment:'not-dialysis',sodiumTargetMg:2000,proteinMinG:56,proteinMaxG:70,useGuidelineProteinRange:false,trackedNutrients:['calories','protein','sodium','potassium']};
let record={profile,entries:[{id:'synthetic-oats',date,source:'custom',meal:'Breakfast',time:'08:30',timeSource:'user-recorded',servings:1,customFood:{name:'Synthetic oatmeal',calories:150,protein:5,sodium:0,potassium:null,method:'packaged',methodLabel:'Synthetic label'}}],dayRecords:{}};
let updated='2026-10-16T08:30:00.000Z';
const errors=[];
async function routes(context){
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/fdc-search'||path==='/api/fdc-food')return route.continue();
  if(path==='/api/fdc-food')return route.fulfill({json:{food:new URL(route.request().url()).searchParams.get('fdcId')==='1'?ingredientFood:unknownFood}});
  if(path==='/api/care-config')return route.fulfill({json:{url:origin,publishableKey:'sb_publishable_synthetic'}});
  if(path==='/api/voice-status')return route.fulfill({json:{available:true}});
  if(path==='/api/voice-live')return route.fulfill({json:{sdp:'synthetic-answer'}});
  return route.fulfill({status:503,json:{error:{message:'Not used in this synthetic test'}}});
 });
 await context.route(origin+'/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON(),id=tokens.get((req.headers().authorization||'').replace('Bearer ',''));
  if(url.pathname.endsWith('/settings'))return route.fulfill({json:{external:{google:false,phone:false}}});
  if(url.pathname.endsWith('/token')){
   if(url.searchParams.get('grant_type')==='refresh_token'){
    refreshes++;const who=refreshTokens.get(body.refresh_token);
    if(revoked||!who)return route.fulfill({status:400,json:{code:'refresh_token_not_found'}});
    refreshTokens.delete(body.refresh_token);return route.fulfill({json:issue(who)});
   }
   logins++;return route.fulfill({json:issue(body.email==='rd@example.test'?rd:owner)});
  }
  if(!id)return route.fulfill({status:401,json:{}});
  if(url.pathname.endsWith('/user'))return route.fulfill({json:{id,email:id===owner?'patient@example.test':'rd@example.test'}});
  if(url.pathname.endsWith('/logout')){for(const [key,who]of refreshTokens)if(who===id)refreshTokens.delete(key);return route.fulfill({json:{}});}
  if(url.pathname.includes('care_invitation_action')||url.pathname.includes('care_grants'))return route.fulfill({json:[]});
  if(url.pathname.includes('care_records')){
   if(req.method()==='PATCH'||req.method()==='POST'){assert.equal(id,owner);record=body.record;updated=body.updated_at;return route.fulfill({json:[{owner_id:owner,record,updated_at:updated}]});}
   if(url.searchParams.get('owner_id')?.startsWith('neq.'))return route.fulfill({json:id===rd?[{owner_id:owner,profile,updated_at:updated}]:[]});
   const target=url.searchParams.get('owner_id');
   if(target===`eq.${owner}`)return route.fulfill({json:[{owner_id:owner,record,updated_at:updated}]});
   return route.fulfill({json:[]});
  }
  return route.fulfill({status:404,json:{}});
 });
}
const dir=await mkdtemp(join(tmpdir(),'nepholio-browser-'));
await mkdir('output',{recursive:true});let context;
async function launch(){context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,viewport:{width:1440,height:1000}});await routes(context);return await context.newPage();}
async function signIn(page,email){await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.locator('.care-connection').getByRole('button',{name:'Sign in',exact:true}).click();}
async function patientReady(page){await page.getByRole('heading',{name:/Synthetic Alex/}).waitFor();}
async function shot(page,name,width){await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`overflow ${name}`);await page.screenshot({path:`output/${name}-${width}.png`,fullPage:!name.includes('portion')});}
try{
 const page=await launch();await page.addInitScript(()=>{
  window.audioQA={requests:0,contexts:[],frames:new Set()};const Native=window.AudioContext;
  const NativeAudio=window.Audio;window.Audio=function(...args){const audio=new NativeAudio(...args);audio.addEventListener('ended',()=>{audioQA.greetingEnded=true;});return audio;};
  window.AudioContext=class extends Native {constructor(...args){super(...args);window.audioQA.contexts.push(this);}};
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>{const id=request(time=>{window.audioQA.frames.delete(id);callback(time);});window.audioQA.frames.add(id);return id;};window.cancelAnimationFrame=id=>{window.audioQA.frames.delete(id);cancel(id);};
  function signal(){const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),dest=context.createMediaStreamDestination();gain.gain.value=0;osc.connect(gain);gain.connect(dest);osc.start();context.resume();return {context,gain,stream:dest.stream};}
  navigator.mediaDevices.getUserMedia=async()=>{window.audioQA.requests++;if(window.audioQA.reject)throw new DOMException('Denied','NotAllowedError');window.audioQA.mic=signal();return window.audioQA.mic.stream;};
  window.RTCPeerConnection=class {iceGatheringState='complete';connectionState='connected';addTrack(){}createDataChannel(){this.dc={readyState:'open',send:message=>{if(JSON.parse(message).type==='session.close')setTimeout(()=>this.emit({type:'session.closed'}),0);},close(){this.readyState='closed';}};window.audioQA.pc=this;return this.dc;}emit(event){this.dc.onmessage?.({data:JSON.stringify(event)});}async createOffer(){return {type:'offer',sdp:'synthetic-offer'};}async setLocalDescription(sdp){this.localDescription=sdp;}async setRemoteDescription(){window.audioQA.remote=signal();this.ontrack?.({streams:[window.audioQA.remote.stream]});setTimeout(()=>this.emit({type:'session.started'}),100);}close(){this.connectionState='closed';window.audioQA.remote?.stream.getTracks().forEach(t=>t.stop());}};
 });
 // Silent valid greeting; microphone/playback amplitude comes only from our synthetic oscillators.
 const wav=Buffer.alloc(32044);wav.write('RIFF',0);wav.writeUInt32LE(32036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
 await context.route('**/audio/**',route=>route.fulfill({contentType:'audio/wav',body:wav}));
 await page.goto('http://127.0.0.1:5173/#signin');await signIn(page,'patient@example.test');await patientReady(page);await page.getByRole('button',{name:'Speak or type a meal',exact:true}).click();
 await page.getByRole('button',{name:'Start microphone',exact:true}).waitFor();assert.equal(await page.evaluate(()=>audioQA.requests),0);
 await page.getByText('Conversation options',{exact:true}).click();await page.getByLabel('What would you like to do?').selectOption('log');assert.equal(await page.evaluate(()=>audioQA.requests),0);await page.getByText('Conversation options',{exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Find a USDA food',exact:true}).isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Account & care sharing',exact:true}).isVisible(),false);
 const orb=page.locator('.voice-orb');const stage=page.locator('.voice-orb-stage');
 assert.equal(await orb.evaluate(el=>el.style.transform),'scale(1)');
 await page.getByRole('button',{name:'Start microphone',exact:true}).click();await page.getByRole('button',{name:'Mute microphone',exact:true}).waitFor();
 await page.waitForFunction(()=>audioQA.greetingEnded);await page.waitForFunction(()=>document.querySelector('.voice-orb-stage')?.dataset.voiceState==='listening');assert.equal(await page.evaluate(()=>audioQA.requests),1);
 await page.evaluate(()=>audioQA.mic.gain.gain.value=.15);await page.waitForFunction(()=>Number(document.querySelector('.voice-orb').style.transform.match(/[\d.]+/)[0])>1.05);
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await stage.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`output/voice-orb-listening-${width}.png`});}
 await page.getByRole('button',{name:'Mute microphone',exact:true}).click();assert.equal(await page.evaluate(()=>audioQA.mic.stream.getAudioTracks()[0].enabled),false);assert.equal(await stage.getAttribute('data-voice-state'),'muted');
 await page.getByRole('button',{name:'Unmute microphone',exact:true}).click();assert.equal(await page.evaluate(()=>audioQA.requests),1);
 await page.evaluate(()=>{audioQA.mic.gain.gain.value=0;});await page.waitForTimeout(600);
 await page.evaluate(()=>audioQA.pc.emit({type:'session.input_transcript.delta',delta:'A synthetic snack',start_ms:1,event_id:'qa-input'}));await page.waitForFunction(()=>document.querySelector('.voice-orb-stage').dataset.voiceState==='processing');
 await page.evaluate(()=>audioQA.remote.gain.gain.value=.2);await page.waitForFunction(()=>document.querySelector('.voice-orb-stage').dataset.voiceState==='speaking');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.voice-orb')).transform==='none');assert.equal(await orb.evaluate(el=>getComputedStyle(el).transform),'none');
 await page.getByRole('button',{name:'End conversation',exact:true}).click();await page.getByRole('button',{name:'Start microphone',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>audioQA.mic.stream.getTracks().every(t=>t.readyState==='ended')),true);await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>audioQA.contexts.filter(c=>c!==audioQA.mic.context&&c!==audioQA.remote.context).every(c=>c.state==='closed')),true);
 assert.equal(await page.evaluate(()=>audioQA.frames.size),0);
 await page.evaluate(()=>{audioQA.reject=true;});await page.getByRole('button',{name:'Start microphone',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.voice-orb-stage').dataset.voiceState==='error');
 await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.locator('.voice-text-entry textarea').fill('Synthetic food description');
 await page.getByRole('button',{name:'Confirm & save description · nutrition unknown',exact:true}).click();await page.getByText('Description saved after your confirmation.',{exact:true}).waitFor();assert.equal(record.entries.at(-1).customFood.method,'unmeasured');
 await page.evaluate(()=>{audioQA.reject=false;});await page.getByRole('button',{name:'Start microphone',exact:true}).click();await page.getByRole('button',{name:'Mute microphone',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close voice assistant',exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>audioQA.mic.stream.getTracks().every(t=>t.readyState==='ended')),true);assert.equal(await page.evaluate(()=>audioQA.frames.size),0);
 await page.getByRole('button',{name:'Find a USDA food',exact:true}).waitFor();
 await page.getByRole('button',{name:'Account & care sharing',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: actual app UI, intentional mic start, no duplicate stream, synthetic microphone and playback amplitude, listen/mute/process/speak/error states, reduced motion, end/unmount cleanup, preserved typed confirmation. WebRTC/auth/backend mocked; audio is real oscillator-generated synthetic MediaStream.');
}finally{await context?.close();await rm(dir,{recursive:true,force:true});}
