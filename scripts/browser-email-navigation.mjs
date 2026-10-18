import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
try{
 for(const route of ['signin','rd-signin','signup']){
  const context=await browser.newContext();let mutations=0;
  await context.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname==='/api/care-config'?{url:'https://email.synthetic.supabase.co',publishableKey:'sb_publishable_test'}:{available:false}}));
  await context.route('https://email.synthetic.supabase.co/**',r=>{if(r.request().method()!=='GET')mutations++;return r.fulfill({json:{external:{google:false,phone:false}}});});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:5173/#${route}`);
  await page.getByLabel('Email',{exact:true}).fill('synthetic@example.test');
  if(route!=='signup')await page.getByRole('button',{name:'New here? Create an email account',exact:true}).click();
  else await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only-password');
  await page.getByRole('button',{name:'Already have an account? Sign in',exact:true}).click();
  assert.equal(await page.getByLabel('Password',{exact:true}).count(),0,'return from signup restores email entry');
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'','clear password when changing mode');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only-password');
  await page.getByRole('button',{name:'Back to email entry',exact:true}).click();
  assert.equal(await page.getByLabel('Password',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'synthetic@example.test');
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
  assert.equal(new URL(page.url()).hash,`#${route}`,'do not change patient/RD destination');
  if(route==='rd-signin')await page.getByText('Use your Google account or work email. Patient access is managed separately.',{exact:true}).waitFor();
  assert.equal(mutations,0,'no authentication or real email requests');await context.close();
 }
 console.log('PASS: signup/signin round trip and explicit email-step back navigation, cleared password, retained email and patient/RD route. Mocked config/provider; zero auth/email mutations.');
}finally{await browser.close();}
