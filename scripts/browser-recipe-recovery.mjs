import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const food={fdcId:1,description:'Synthetic grain',basis:'per100g',nutrients:{calories:100,sodium:0,potassium:null},portions:[{amount:1,gramWeight:200,description:'cup'}]};
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let searches=0,details=0;
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/fdc-search')return route.fulfill(++searches===1?{status:503,json:{}}:{json:{foods:[food]}});
  if(path==='/api/fdc-food')return route.fulfill({json:{food:{...food,fdcId:++details===1?2:1}}});
  return route.abort();
 });
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/recipe-recovery.html');
 await page.getByLabel('Recipe name',{exact:true}).fill('Synthetic recovery recipe');
 await page.getByLabel('Describe an ingredient').fill('grain');
 await page.getByRole('button',{name:'Find food',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Food search unavailable'}).waitFor();
 await page.getByRole('button',{name:'Find food',exact:true}).click();
 await page.getByRole('button',{name:'Synthetic grain',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Could not load USDA food details'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Use this food',exact:true}).count(),0);
 await page.getByRole('button',{name:'Synthetic grain',exact:true}).click();
 await page.getByRole('button',{name:'Use this food',exact:true}).click();
 for(const amount of ['', '0', '-1']){
  await page.getByLabel('Portion amount',{exact:true}).fill(amount);
  await page.getByRole('button',{name:'Save recipe & log portion',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Enter a positive portion'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[qa.saves.length,qa.logs.length,qa.closed]),[0,0,0],'invalid portion must not save a recipe or meal');
 }
 await page.getByLabel('Portion amount',{exact:true}).fill('0.5');
 await page.evaluate(()=>qa.failSave=true);
 await page.getByRole('button',{name:'Save recipe & log portion',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Save failed'}).waitFor();
 assert.equal(await page.evaluate(()=>qa.logs.length),0);
 await page.evaluate(()=>{qa.failSave=false;qa.failLog=true;});
 await page.getByRole('button',{name:'Save recipe & log portion',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Meal not saved'}).waitFor();
 assert.equal(await page.evaluate(()=>qa.closed),0);
 await page.evaluate(()=>qa.failLog=false);
 await page.getByRole('button',{name:'Save meal',exact:true}).click();
 await page.waitForFunction(()=>qa.closed===1);
 const final=await page.evaluate(()=>({saves:qa.saves.length,entry:qa.logs.at(-1)}));
 assert.equal(final.saves,2,'retry meal without saving another recipe revision');
 assert.equal(final.entry.customFood.calories,100);assert.equal(final.entry.customFood.grams,100);
 assert.equal(final.entry.customFood.sodium,0);assert.equal(final.entry.customFood.potassium,null);
 assert.deepEqual(errors,[]);
 console.log('PASS: search failure/retry, mismatched source refusal/retry, invalid portion has no writes, recipe/meal storage failure recovery, exact half portion and unknown/zero preservation. Synthetic callbacks and USDA responses only.');
}finally{await browser.close();}
