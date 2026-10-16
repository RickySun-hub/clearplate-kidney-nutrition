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
  if(path==='/api/fdc-search')return route.fulfill({json:{foods:[ingredientFood,unknownFood]}});
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
 await page.goto('http://127.0.0.1:5173/#patient/recipes');
 await page.getByRole('button',{name:'Create a recipe'}).click();
 await page.getByLabel('Recipe name',{exact:true}).fill('Synthetic grain and vegetables');
 await page.getByLabel('Describe an ingredient').fill('grain');await page.getByRole('button',{name:'Find food',exact:true}).click();
 await page.getByRole('button',{name:/Synthetic grain, raw/}).click();await page.getByRole('button',{name:'Use this food',exact:true}).click();
 await page.getByLabel('Ingredient 1 measure').selectOption('portion:0');await page.getByLabel('Ingredient 1 quantity').fill('4');await page.getByText('Advanced review & editing',{exact:true}).click();await page.getByLabel('Ingredient 1 preparation').selectOption('raw');
 await page.getByLabel('Describe an ingredient').fill('vegetables');await page.getByRole('button',{name:'Find food',exact:true}).click();
 await page.getByRole('button',{name:/Synthetic vegetables, cooked/}).click();await page.getByRole('button',{name:'Use this food',exact:true}).click();await page.getByLabel('Ingredient 2 quantity').fill('100');await page.getByLabel('Ingredient 2 preparation').selectOption('cooked');await page.getByLabel('Number of equal servings').fill('4');
 await page.getByLabel('Measured finished weight (g, optional)',{exact:true}).fill('800');await page.getByLabel('I confirm this finished weight').check();
 const sodium=page.getByRole('article',{name:'Sodium calculation',exact:true});
 assert.match(await sodium.innerText(),/1,000 mg/);assert.match(await sodium.innerText(),/250 mg/);assert.match(await sodium.innerText(),/125 mg/);
 const phosphorus=page.getByRole('article',{name:'Phosphorus calculation',exact:true});assert.match(await phosphorus.innerText(),/Unknown/);assert.match(await phosphorus.innerText(),/1\/2 ingredients with data · Incomplete · Known subtotal: 160 mg/);
 await page.getByRole('button',{name:'Keep recipe for later',exact:true}).click();await page.getByText('Saved in your recipes.').waitFor();
 assert.equal(record.customRecipes.length,1);assert.equal(record.customRecipes[0].sodium,250);assert.equal(record.customRecipes[0].phosphorus,null);
 await page.getByLabel('Portion measure',{exact:true}).selectOption('grams');await page.getByLabel('Portion amount').fill('200');
 await page.getByText('Advanced review & editing',{exact:true}).click();
 assert.equal(await page.getByRole('article',{name:'Sodium calculation',exact:true}).isVisible(),false);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`output/patient-recipe-simple-${width}.png`,fullPage:true});

 }
 await page.getByRole('button',{name:'Save meal',exact:true}).click();await patientReady(page);
 const logged=structuredClone(record.entries.at(-1));assert.equal(logged.customFood.sodium,250);assert.equal(logged.customFood.phosphorus,null);assert.equal(logged.customFood.grams,200);
 await page.goto('http://127.0.0.1:5173/#patient/recipes');await page.getByRole('button',{name:'View Synthetic grain and vegetables recipe'}).click();
 await page.getByText('Edit recipe',{exact:true}).click();await page.getByText('Advanced review & editing',{exact:true}).click();await page.getByLabel('Ingredient 1 quantity').fill('5');assert.equal(await page.getByLabel('I confirm this finished weight').isChecked(),false);
 assert.match(await sodium.innerText(),/1,250 mg/);assert.match(await sodium.innerText(),/Unknown/);
 await page.getByRole('button',{name:'Save recipe changes only',exact:true}).click();await page.getByRole('alert').filter({hasText:'Confirm a positive measured'}).waitFor();
 await page.getByLabel('Measured finished weight (g, optional)',{exact:true}).fill('1000');await page.getByLabel('I confirm this finished weight').check();
 await page.getByRole('button',{name:'Save recipe changes only',exact:true}).click();await page.getByText('Saved in your recipes.').waitFor();
 assert.equal(record.customRecipes.length,2);assert.equal(record.customRecipes[0].retired,true);assert.equal(record.customRecipes[0].sodium,250);assert.equal(record.customRecipes[1].sodium,312.5);assert.deepEqual(record.entries.at(-1),logged);
 await page.reload();await page.getByRole('button',{name:'View Synthetic grain and vegetables recipe'}).click();await page.getByText('Edit recipe',{exact:true}).click();await page.getByText('Advanced review & editing',{exact:true}).click();assert.equal(await page.getByLabel('Ingredient 1 quantity').inputValue(),'5');assert.equal(await page.getByLabel('Ingredient 1 preparation').inputValue(),'raw');
 await page.getByLabel('Ingredient 2 quantity').fill('');await page.getByLabel('Measured finished weight (g, optional)',{exact:true}).fill('');
 await page.getByText('Amount unknown. Enter a measured amount').waitFor();assert.match(await sodium.innerText(),/Unknown/);
 assert.deepEqual(errors,[]);console.log('PASS: actual app recipe creation, food-specific portions, state/source persistence, measured yield, nutrient incompleteness, saving, gram logging, immutable history, version edits, reload and mobile/desktop layout.');
}finally{await context?.close();await rm(dir,{recursive:true,force:true});}
