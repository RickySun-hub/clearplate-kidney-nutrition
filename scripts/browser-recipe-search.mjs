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
 const page=await launch();await page.goto('http://127.0.0.1:5173/#signin');await signIn(page,'patient@example.test');await patientReady(page);
 await page.goto('http://127.0.0.1:5173/#patient/recipes');const search=page.getByPlaceholder('Search recipes or ingredients');
 await search.fill('cucumber');await page.getByText(/Ingredient:.*cucumber/i).first().waitFor();assert.ok(await page.getByRole('button',{name:'View Mango Salsa Wontons recipe'}).count() || await page.locator('.recipe-search-hint').count());
 await search.fill('mango and cucumber');await page.getByRole('button',{name:'Log Mango Salsa Wontons',exact:true}).waitFor();
 await search.fill('mango and quartz');await page.getByRole('status').filter({hasText:'No recipes match.'}).waitFor();
 await search.fill('cucmber');await page.getByText(/Possible ingredient match:.*cucumber/i).first().waitFor();
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`output/recipe-ingredient-search-${width}.png`,fullPage:true});}
 await search.fill('zzzzquartz');await page.getByRole('status').filter({hasText:'No recipes match.'}).waitFor();assert.equal(await page.locator('.patient-recipe-list li').count(),0);
 await search.fill('mang');assert.ok(await page.locator('.patient-recipe-list li').count());
 await search.fill('');await page.getByText('Browse cookbook recipes (94)',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: actual recipe UI with bundled ingredient text, partial and typo queries, visible ingredient hints, clear no-results, restored minimal default, mobile/desktop overflow. Auth/storage mocked; no USDA or AI request needed.');
}finally{await context?.close();await rm(dir,{recursive:true,force:true});}
