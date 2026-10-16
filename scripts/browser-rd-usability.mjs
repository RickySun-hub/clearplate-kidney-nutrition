import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
await mkdir('output',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/rd-usability.html');
 await page.getByRole('heading',{name:'Profile',exact:true}).waitFor();
 assert.equal(await page.getByText(/JSON/).count(),0);
 const range=page.getByRole('region',{name:'Range totals · known amounts'});
 const sodium=range.locator('article').filter({has:page.getByText('Sodium',{exact:true})});
 assert.match(await sodium.innerText(),/0 mg/);assert.match(await sodium.innerText(),/1\/2 items known · Incomplete/);
 const potassium=range.locator('article').filter({has:page.getByText('Potassium',{exact:true})});
 assert.match(await potassium.innerText(),/Unknown mg/);assert.match(await potassium.innerText(),/0\/2 items known/);
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
  await page.screenshot({path:`output/rd-usability-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: synthetic profile, per-nutrient unknowns and zero, CSV, keyboard focus, mobile and desktop overflow; no browser errors.');
} finally {await browser.close();}
