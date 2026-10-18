import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
try {
 for(const available of [false,true])for(const route of ['signin','signup']){
  const context=await browser.newContext();let mutations=0;
  await context.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname==='/api/care-config'?{url:'https://phone.synthetic.supabase.co',publishableKey:'sb_publishable_test'}:{available:false}}));
  await context.route('https://phone.synthetic.supabase.co/**',r=>{
   if(r.request().method()!=='GET')mutations++;
   return r.fulfill({json:{external:{google:false,phone:available}}});
  });
  const page=await context.newPage();await page.goto(`http://127.0.0.1:5173/#${route}`);
  await page.getByRole('button',{name:/Continue with phone/}).click();
  if(!available){
   await page.getByRole('status').filter({hasText:'Phone sign-in is not available yet.'}).waitFor();
   assert.equal(await page.getByLabel('Mobile phone number').count(),0);
   assert.equal(await page.getByRole('button',{name:'Send code',exact:true}).count(),0);
   assert.equal(await page.getByText(/We will text you a sign-in code/).count(),0);
  }else{
   await page.getByLabel('Mobile phone number').waitFor();
   assert.equal(await page.getByLabel('Mobile phone number').isEnabled(),true);
   await page.getByRole('button',{name:'Send code',exact:true}).waitFor();
  }
  await page.getByRole('button',{name:'Use email instead',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('synthetic@example.test');
  if(await page.getByRole('button',{name:'Continue with email',exact:true}).count())await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).waitFor();
  assert.equal(mutations,0,'no SMS, sign-in or account creation requests');
  await context.close();
 }
 console.log('PASS: signin/signup unavailable phone copy omits SMS form/promise; enabled-provider UI retained; email fallback works; no auth/SMS mutations. Provider/config mocked.');
}finally{await browser.close();}
