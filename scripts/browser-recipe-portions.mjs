import {createRequire} from 'node:module';import assert from 'node:assert/strict';const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
try{const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.abort());
await page.goto('http://127.0.0.1:5173/scripts/fixtures/recipe-portions.html');
await page.getByText('Whole recipe makes 6 recipe servings.',{exact:false}).waitFor();
assert.equal(await page.getByLabel('Portion amount',{exact:true}).inputValue(),'1');
await page.getByLabel('Date eaten').fill('2026-10-17');await page.getByLabel('Time eaten').fill('10:35');await page.getByLabel('Meal label (optional)').fill('Brunch');
await page.getByRole('button',{name:'Save meal',exact:true}).click();
let entry=await page.evaluate(()=>qa.logs.at(-1));assert.equal(entry.customFood.calories,100);assert.equal(entry.customFood.grams,100);assert.equal(entry.date,'2026-10-17');assert.equal(entry.time,'10:35');assert.equal(entry.meal,'Brunch');assert.equal(entry.timeSource,'user-recorded');assert.equal(entry.customFood.potassium,null);
await page.getByRole('button',{name:'Whole recipe · 6 servings',exact:true}).click();await page.getByRole('button',{name:'Save meal',exact:true}).click();entry=await page.evaluate(()=>qa.logs.at(-1));assert.equal(entry.customFood.calories,600);assert.equal(entry.customFood.grams,600);assert.equal(entry.servings,1);
await page.getByRole('button',{name:'0.5 servings',exact:true}).click();await page.getByRole('button',{name:'Save meal',exact:true}).click();entry=await page.evaluate(()=>qa.logs.at(-1));assert.equal(entry.customFood.calories,50);assert.equal(entry.customFood.grams,50);assert.deepEqual(errors,[]);console.log('Personal/default, whole-batch, half serving, unknown nutrients and editable actual date/time pass.');
}finally{await browser.close();}
