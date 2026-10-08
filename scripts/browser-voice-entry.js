async(page)=>{
 await page.unrouteAll({behavior:'wait'});await page.route('**/api/voice-status',r=>r.fulfill({json:{available:true}}));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/conversation-rd.html');await page.getByRole('button',{name:'Log what I ate',exact:false}).waitFor();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'output/voice-entry-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/voice-entry-mobile.png'});
 return {buttons:await page.getByRole('button').allTextContents(),width:await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}))};
}
