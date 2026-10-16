// Run against the local Vite server. All auth/data endpoints below are mocked.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { chromium }=createRequire(import.meta.url)('playwright');
const owner='11111111-1111-4111-8111-111111111111',rd='22222222-2222-4222-8222-222222222222';
const date=new Date().toISOString().slice(0,10),origin='https://synthetic.supabase.co';
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
  if(path==='/api/care-config')return route.fulfill({json:{url:origin,publishableKey:'sb_publishable_synthetic'}});
  if(path==='/api/voice-status')return route.fulfill({json:{available:false,message:'Synthetic demonstration; manual entry is available.'}});
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
 let page=await launch();await page.goto('http://127.0.0.1:5173/#signin');await signIn(page,'patient@example.test');await patientReady(page);
 await page.reload();await patientReady(page);assert.equal(logins,1);
 await context.close();page=await launch();await page.goto('http://127.0.0.1:5173/');await patientReady(page);assert.equal(logins,1,'browser reopen must not require another password');
 const expiryTab=await context.newPage();await expiryTab.goto('http://127.0.0.1:5173/');await patientReady(expiryTab);
 // Expire local access metadata to exercise the actual browser refresh path.
 await page.evaluate(origin=>{const key=`nepholio-auth:${origin}`,saved=JSON.parse(localStorage.getItem(key));saved.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(saved));},origin);
 await Promise.all([page.reload(),expiryTab.reload()]);await patientReady(page);await patientReady(expiryTab);assert.equal(refreshes,1,'Web Locks must serialize refresh across tabs');await expiryTab.close();
 await page.getByRole('button',{name:'Enter a food label',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Food & portion'});await dialog.getByLabel('Food name',{exact:true}).fill('Synthetic yogurt');await dialog.getByLabel('Servings eaten',{exact:true}).fill('1.5');
 await dialog.getByLabel(/^Calories/).fill('100');await dialog.getByLabel(/^Protein/).fill('6');await dialog.getByLabel(/^Sodium/).fill('40');
 await shot(page,'updated-portion-review',390);
 await dialog.getByRole('button',{name:'Confirm portion & save'}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(record.entries.length,2);assert.equal(record.entries[1].servings,1.5);assert.equal(record.entries[1].customFood.potassium,null);
 await page.getByRole('button',{name:'Speak or type a meal',exact:true}).click();
 await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Synthetic draft kept while sign-in renews');
 await page.evaluate(origin=>{const key=`nepholio-auth:${origin}`,saved=JSON.parse(localStorage.getItem(key));saved.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(saved));window.dispatchEvent(new Event('focus'));},origin);
 await page.waitForFunction(origin=>JSON.parse(localStorage.getItem(`nepholio-auth:${origin}`)).expiresAt>Date.now()+60000,origin);
 assert.equal(await page.locator('.voice-text-entry textarea').inputValue(),'Synthetic draft kept while sign-in renews');await page.getByRole('button',{name:'Close voice assistant',exact:true}).click();
 assert.equal(await page.getByText(/Known subtotal 0 mg/).count(),0,'all-unknown nutrients must not display a zero subtotal');
 for(const width of [390,1440])await shot(page,'updated-patient-today',width);
 await page.getByRole('heading',{name:'Today’s summary',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'output/updated-daily-summary-1440.png'});
 await page.getByRole('button',{name:'History',exact:true}).click();
 await page.evaluate(origin=>{const key=`nepholio-auth:${origin}`,saved=JSON.parse(localStorage.getItem(key));saved.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(saved));},origin);
 await page.reload();await page.locator('.app-shell').waitFor();await page.waitForFunction(()=>location.hash==='#patient/history');
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true}).click();await patientReady(page);
 const other=await context.newPage();await other.goto('http://127.0.0.1:5173/');await patientReady(other);
 await page.getByRole('button',{name:'Account & care sharing',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await other.getByRole('heading',{name:/Synthetic Alex/}).waitFor({state:'hidden'});
 await page.reload();assert.equal(await page.locator('.app-shell').count(),0);
 await page.goto('http://127.0.0.1:5173/#rd-signin');await signIn(page,'rd@example.test');
 await page.getByRole('button',{name:'Open patient Synthetic Alex',exact:true}).click();await page.getByRole('heading',{name:'Range totals · known amounts'}).waitFor();
 assert.equal(await page.locator('.rd-dashboard').getByText(/JSON/).count(),0);
 for(const width of [390,1440])await shot(page,'updated-rd-review',width);
 await page.getByRole('button',{name:'Food log',exact:true}).click();await page.waitForFunction(()=>document.activeElement.id==='rd-food-log');assert.equal(await page.locator('.rd-dashboard').count(),1);
 // New/private storage never inherits the persistent profile.
 const privateBrowser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const privateContext=await privateBrowser.newContext();await routes(privateContext);const privatePage=await privateContext.newPage();await privatePage.goto('http://127.0.0.1:5173/#signin');await privatePage.getByLabel('Email',{exact:true}).waitFor();assert.equal(await privatePage.locator('.app-shell').count(),0);await privateBrowser.close();
 revoked=true;await page.evaluate(origin=>{const key=`nepholio-auth:${origin}`,saved=JSON.parse(localStorage.getItem(key));saved.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(saved));},origin);await page.reload();await page.getByLabel('Email',{exact:true}).waitFor();assert.equal(await page.evaluate(origin=>localStorage.getItem(`nepholio-auth:${origin}`),origin),null);
 assert.deepEqual(errors,[]);console.log('PASS: real Chromium reload/restart, mocked refresh/revocation, logout across tabs, account switching, private context isolation, portion save, patient/RD screenshots, and no page overflow/errors.');
}finally{await context?.close();await rm(dir,{recursive:true,force:true});}
