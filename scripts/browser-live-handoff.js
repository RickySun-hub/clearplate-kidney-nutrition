async(page)=>{
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/conversation-rd.html');
 await page.route('**/api/voice-status',r=>r.fulfill({json:{available:true}}));
 await page.route('**/api/voice',r=>{const body=r.request().postDataJSON();if(!body.conversation?.some(t=>t.content.includes('one boiled egg')))throw Error('Lost original speech');return r.fulfill({json:{transcript:body.transcript,reply:'One boiled egg at 8:30. Review below.',ready:true,mealTime:'08:30',draft:{intent:'food',recipeId:'egg',foodName:'Boiled egg',servings:1,meal:'Breakfast'}}});});
 await page.reload();
 await page.evaluate(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();const d=c.createMediaStreamDestination();window.qaMic=d.stream;return d.stream;};
  class Peer{constructor(){this.iceGatheringState='complete';}addTrack(){}createDataChannel(){this.dc={readyState:'open',send:raw=>{const e=JSON.parse(raw);if(e.type==='session.close')setTimeout(()=>this.dc.onmessage({data:JSON.stringify({type:'session.closed'})}),10);},close(){}};return this.dc;}async createOffer(){return{type:'offer',sdp:'v=0\r\n'};}async setLocalDescription(o){this.localDescription=o;}async setRemoteDescription(){setTimeout(()=>{for(const e of [{type:'session.started'},{type:'session.output_transcript.delta',event_id:'a',start_ms:0,delta:'What did you have?'},{type:'session.input_transcript.delta',event_id:'b',start_ms:1000,delta:'I ate one boiled egg at 8:30.'},{type:'session.output_transcript.delta',event_id:'c',start_ms:2000,delta:'Would you like to review that?'}])this.dc.onmessage({data:JSON.stringify(e)});},10);}close(){}}window.RTCPeerConnection=Peer;
 });
 await page.route('**/api/voice-live',r=>r.fulfill({json:{sdp:'answer',model:'gpt-live-1'}}));
 await page.getByRole('button',{name:'Breakfast',exact:true}).click();
 await page.getByRole('button',{name:'Start live conversation',exact:true}).click();
 await page.getByRole('button',{name:'Review food',exact:true}).click();
 await page.getByRole('heading',{name:'Confirm food draft'}).waitFor();
 if(await page.evaluate(()=>window.qaEntries.length)!==0)throw Error('Saved without confirmation');
 await page.getByRole('button',{name:'Confirm & save food',exact:true}).click();
 const entries=await page.evaluate(()=>window.qaEntries);
 if(entries.length!==1||entries[0].conversation.length!==4||entries[0].time!=='08:30')throw Error('Record handoff failed');
 if(!entries[0].conversation.some(t=>t.source==='voice'&&t.content.includes('one boiled egg')))throw Error('Missing original voice');
 if(!await page.evaluate(()=>window.qaMic.getTracks().every(t=>t.readyState==='ended')))throw Error('Microphone not released');
 await page.setViewportSize({width:390,height:844});const width=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 return {saved:entries[0],width};
}
