async(page)=>{
let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.unrouteAll();await page.route('**/api/voice-status',r=>r.fulfill({json:{available:true}}));
await page.route('**/api/voice',async r=>{calls++;const b=r.request().postDataJSON();if(calls===2 && !b.conversation.some(t=>t.content==='I ate eggs'))throw Error('Conversation lost');return r.fulfill({json:{transcript:b.audio?'yes':b.transcript,reply:calls===1?'How many eggs, and how were they cooked?':'One boiled egg. Please review.',ready:calls>1,draft:{intent:'food',recipeId:'egg',foodName:'Boiled egg',servings:1,meal:'Breakfast'}}});});
await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();const o=c.createOscillator();const d=c.createMediaStreamDestination();o.connect(d);o.start();return d.stream;};});
await page.goto('http://127.0.0.1:5173/scripts/fixtures/conversation-rd.html');
await page.getByRole('button',{name:'Breakfast',exact:true}).click();
await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('I ate eggs');await page.getByRole('button',{name:'Send message',exact:true}).click();
await page.getByText('How many eggs, and how were they cooked?',{exact:true}).waitFor();
if(await page.evaluate(()=>qaEntries.length)!==0)throw Error('Saved before confirmation');
await page.getByLabel('Message',{exact:true}).fill('One boiled egg.');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('heading',{name:'Confirm food draft'}).waitFor();
await page.getByLabel('Meal time (optional)').fill('08:30');await page.getByLabel('Message',{exact:true}).fill('yes');await page.getByRole('button',{name:'Send message',exact:true}).click();
await page.waitForFunction(()=>qaEntries.length===1);
const first=await page.evaluate(()=>qaEntries[0]);if(first.conversation.filter(t=>t.role==='user').length!==3 || first.time!=='08:30')throw Error('Original words or time lost');
await page.getByRole('button',{name:'Meal finished',exact:true}).click();await page.waitForFunction(()=>qaDays['2026-10-07'].mealReviews.Breakfast);
await page.getByRole('button',{name:'I did not eat this meal',exact:true}).click();await page.waitForFunction(()=>qaDays['2026-10-07'].mealReviews.Lunch?.status==='not-eaten');
await page.locator('.rd-originals summary').first().click();await page.locator('.rd-originals').getByText('I ate eggs',{exact:true}).waitFor();
await page.getByRole('button',{name:'Dinner',exact:true}).click();if(await page.getByRole('button',{name:'Type instead',exact:true}).isVisible())await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Homemade soup; I do not know the amount.');await page.getByRole('button',{name:'Confirm & save description · nutrition unknown',exact:true}).click();await page.waitForFunction(()=>qaEntries.length===2);
await page.setViewportSize({width:390,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
if(overflow || errors.length)throw Error(JSON.stringify({overflow,errors}));
await page.screenshot({path:'output/conversation-rd-mobile.png',fullPage:true});
return {calls,saved:await page.evaluate(()=>qaEntries.length),originalTurns:first.conversation.length,mealTime:first.time,mealStatus:await page.evaluate(()=>qaDays),overflow,errors};
}
