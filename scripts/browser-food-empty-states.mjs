import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const food={fdcId:1,description:'Synthetic food',basis:'per100g',nutrients:{calories:100,protein:2,sodium:0,potassium:null,phosphorus:null},portions:[]};
try{
 if(!process.argv.includes('--rd-only')){
  const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:r.request().url().includes('fdc-search')?{foods:[food]}:{food}}));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/food-empty-states.html');
  await page.getByLabel('Food name',{exact:true}).fill('Synthetic food');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.locator('.usda-search-results button').click();await page.getByLabel('Amount eaten (grams)').waitFor();
  for(const amount of ['', '-1', '0', '10001']){
   await page.getByLabel('Amount eaten (grams)').fill(amount);
   assert.match(await page.locator('.usda-food-amount').innerText(),/calories: Unknown kcal/,'invalid amount must not preview zero or negative intake');
   await page.getByRole('button',{name:'Confirm and save food',exact:true}).click();
   await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>qa.entries.length),0);
  }
  await page.getByLabel('Amount eaten (grams)').fill('50');
  assert.match(await page.locator('.usda-food-amount').innerText(),/calories: 50 kcal/);
  await page.getByRole('button',{name:'Confirm and save food',exact:true}).click();
  const entry=await page.evaluate(()=>qa.entries[0]);assert.equal(entry.customFood.calories,50);assert.equal(entry.customFood.sodium,0);assert.equal(entry.customFood.potassium,null);await page.close();
 }
 for(const connected of [true,false]){
  const context=await browser.newContext();const page=await context.newPage();
  await context.route('**/api/**',r=>r.fulfill({json:{url:'https://empty.synthetic.supabase.co',publishableKey:'sb_publishable_synthetic'}}));
  await context.route('https://empty.synthetic.supabase.co/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path.endsWith('/settings'))return r.fulfill({json:{external:{google:false,phone:false}}});
   if(path.endsWith('/token'))return r.fulfill({json:{access_token:'synthetic-only',expires_in:3600}});
   if(path.endsWith('/user'))return r.fulfill({json:{id:'11111111-1111-4111-8111-111111111111',email:'rd@example.test'}});
   if(path.endsWith('/care_invitation_action'))return r.fulfill({json:connected?[{id:'33333333-3333-4333-8333-333333333333',reader_id:'11111111-1111-4111-8111-111111111111',owner_id:'22222222-2222-4222-8222-222222222222',recipient_email:'patient@example.test',patient_name:'Synthetic patient',status:'accepted',active:true,created_at:'2026-10-19',responded_at:'2026-10-19'}]:[]});
   return r.fulfill({json:[]});
  });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/food-empty-states.html?rd');
  await page.getByLabel('Email',{exact:true}).fill('rd@example.test');await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Patient directory',exact:true}).waitFor();
  if(connected){
   await page.getByText('Connected · waiting for first saved record',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Open patient Synthetic patient'}).isDisabled(),true);
   assert.equal(await page.getByRole('heading',{name:'Waiting for a saved record',exact:true}).count(),1);
   assert.equal(await page.locator('.rd-file-empty').getByText(/Use Add patient/).count(),0);
  }else{
   await page.getByText(/No connected patients yet/).waitFor();
   assert.equal(await page.locator('.rd-file-empty').getByText(/Use Add patient/).count(),1);
  }
  await context.close();
 }
 console.log('PASS: invalid USDA amount preview stays unknown, invalid saves blocked, corrected half portion preserves zero/unknown; connected-without-record and no-patient RD states distinct. Synthetic data/provider only.');
}finally{await browser.close();}
