import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
await mkdir('output',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/rd-usability.html');
 await page.getByRole('heading',{name:'Synthetic QA',exact:true}).waitFor();
 assert.equal(await page.locator('#rd-profile').evaluate(el=>el.open),false);
 assert.equal(await page.locator('#rd-food-log').evaluate(el=>el.open),false);
 for(const [label,id] of [['Profile','rd-profile'],['Daily review','rd-daily-review'],['Food log','rd-food-log']]){
  await page.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),id);
 }
 await page.getByText('Record access & export notes',{exact:true}).click();
 const from=page.getByLabel('From',{exact:true});const original=await from.inputValue();
 await from.fill('2099-01-01');
 await page.getByRole('alert').filter({hasText:'Choose an end date'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Export CSV for Excel'}).isDisabled(),true);
 await from.fill(original);
 assert.equal(await page.getByRole('button',{name:'Export CSV for Excel'}).isEnabled(),true);
 const review=page.getByRole('region',{name:'Review first',exact:true});
 assert.equal(await review.locator('li').count(),3);
 assert.match(await review.innerText(),/Protein[\s\S]*Above saved limit/);
 assert.match(await review.innerText(),/Potassium[\s\S]*Incomplete/);
 assert.equal(await review.getByText('Energy',{exact:true}).count(),0);
 await review.getByRole('button',{name:'Review daily values →',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'rd-daily-review');
 assert.equal(await page.getByText(/JSON/).count(),0);
 const range=page.getByRole('region',{name:'Range totals · known amounts'});
 const sodium=range.locator('article').filter({has:page.getByText('Sodium',{exact:true})});
 assert.match(await sodium.innerText(),/0 mg/);assert.match(await sodium.innerText(),/2\/3 items known · Incomplete/);
 const potassium=range.locator('article').filter({has:page.getByText('Potassium',{exact:true})});
 assert.match(await potassium.innerText(),/Unknown mg/);assert.match(await potassium.innerText(),/0\/3 items known/);
 assert.match(await range.innerText(),/400 kcal/);
 const daily=page.locator('.rd-daily');assert.match(await daily.innerText(),/280 kcal/);
 assert.match(await daily.innerText(),/Above saved limit/);
 assert.equal(await page.getByText('Record access & export notes',{exact:true}).count(),1);
 await daily.locator('summary').filter({hasText:'2026-10-15'}).click();
 assert.match(await daily.innerText(),/120 kcal/);
 await daily.locator('summary').filter({hasText:'2026-10-15'}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV for Excel'}).click();const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/\.csv$/);const csv=await readFile(await download.path(),'utf8');
 assert.match(csv,/Sodium \(mg\)/);assert.match(csv,/Unknown/);assert.match(csv,/Known items \/ recorded items/);assert.ok(csv.startsWith('\uFEFF'));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Page overflow at ${width}`);
  const table=page.getByRole('region',{name:'Food record table, scroll horizontally'});
  await table.focus();assert.equal(await table.evaluate(el=>el===document.activeElement),true);
  if(width===390){assert.ok(await table.evaluate(el=>el.scrollWidth>el.clientWidth));await table.press('ArrowRight');}
  await table.evaluate(el=>{el.scrollLeft=0;});
  await page.locator('#rd-profile').evaluate(el=>{el.open=false;});
  await page.locator('#rd-food-log').evaluate(el=>{el.open=false;});
  await page.getByText('Record access & export notes',{exact:true}).evaluate(el=>{el.parentElement.open=false;});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`output/rd-hierarchy-preview-${width}.png`,fullPage:true});
  await page.locator('#rd-food-log').evaluate(el=>{el.open=true;});
 }
 assert.deepEqual(errors,[]);console.log('PASS: synthetic profile, per-nutrient unknowns and zero, CSV, keyboard focus, mobile and desktop overflow; no browser errors.');
} finally {await browser.close();}
