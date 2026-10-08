async(page)=>{
 await page.unrouteAll({behavior:'wait'});
 const results={}; const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/live-voice.html');
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();const o=c.createOscillator();const g=c.createGain();g.gain.value=0.0001;const dest=c.createMediaStreamDestination();o.connect(g);g.connect(dest);o.start();window.qaMic=dest.stream;window.qaContext=c;window.qaDest=dest;return dest.stream;};});
 await page.getByRole('button',{name:'Voice Assistant',exact:true}).click();
 await page.getByRole('button',{name:'End conversation',exact:true}).waitFor({timeout:35000});
 await page.waitForTimeout(9000);
 results.greeting=await page.locator('body').innerText();
 async function say(name){await page.evaluate(async(name)=>{const b=await(await fetch('/output/qa-'+name+'.wav')).arrayBuffer();const c=window.qaContext;const audio=await c.decodeAudioData(b);const source=c.createBufferSource();source.buffer=audio;source.connect(window.qaDest);source.start();},name);await page.waitForTimeout(17000);}
 await say('shared');results.shared=await page.locator('details').innerText();
 await say('portion');results.portion=await page.locator('details').innerText();
 results.audio=await page.locator('audio').evaluate(a=>({currentTime:a.currentTime,paused:a.paused,readyState:a.readyState}));
 await page.getByRole('button',{name:'Pause microphone',exact:true}).click();results.pause=await page.evaluate(()=>window.qaMic.getTracks().every(t=>!t.enabled));
 await page.getByRole('button',{name:'Review food',exact:true}).click();await page.waitForTimeout(4500);
 results.review=await page.evaluate(()=>({turns:window.qaTurns,mic:window.qaMic.getTracks().map(t=>t.readyState),busy:window.qaBusy}));
 await page.setViewportSize({width:390,height:844});results.mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 results.errors=errors;return results;
}
