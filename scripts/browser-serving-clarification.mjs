import {createRequire} from 'node:module';import assert from 'node:assert/strict';const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
try{for(const [query,count,label] of [['',24,'Whole recipe = 24 wontons'],['?six',6,'Whole recipe = 6 recipe servings']]){
 const page=await browser.newPage({timezoneId:'America/Los_Angeles'});
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/voice-status'?{available:true}:{transcript:'我吃了整份',ready:false,reply:'One recipe serving or the whole recipe?',draft:{intent:'unknown',recipeId:'test',foodName:'Test dish',servings:null,portionBasis:'unknown',meal:''}}}));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/serving-clarification.html'+query);
 await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('我吃了整份');await page.getByRole('button',{name:'Send message',exact:true}).click();
 const choice=page.getByRole('group',{name:'Clarify recipe amount'});await choice.waitFor();assert.equal(await page.evaluate(()=>logs.length),0);
 assert.equal(await choice.getByRole('button').count(),2);
 await choice.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.getByLabel('Recipe servings',{exact:true}).inputValue(),String(count));assert.equal(await page.evaluate(()=>logs.length),0);
 await page.getByRole('button',{name:'Confirm & save food',exact:true}).click();assert.equal(await page.evaluate(()=>logs[0].servings),count);await page.close();
}console.log('PASS: ambiguous whole amount requires source-serving/batch choice for 24 wontons and six-serving dish; choosing does not save; confirmation preserves source serving multiplier.');}finally{await browser.close();}
