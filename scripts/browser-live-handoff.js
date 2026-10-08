async(page)=>{
 await page.unrouteAll({behavior:'wait'});
 await page.route('**/api/voice-status',r=>r.fulfill({json:{available:true}}));
 await page.route('**/api/voice-live',r=>r.fulfill({json:{sdp:'answer',model:'gpt-live-1'}}));
 await page.goto('http://127.0.0.1:5173/scripts/fixtures/conversation-rd.html');
 await page.evaluate(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();const d=c.createMediaStreamDestination();window.qaMic=d.stream;return d.stream;};
  class Peer{constructor(){this.iceGatheringState='complete';}addTrack(){}createDataChannel(){this.dc={readyState:'open',send:raw=>{const e=JSON.parse(raw);(window.qaSent||=[]).push(e);if(e.type==='session.close')setTimeout(()=>this.dc.onmessage({data:JSON.stringify({type:'session.closed'})}),10);},close(){}};window.qaEmit=e=>this.dc.onmessage({data:JSON.stringify(e)});return this.dc;}async createOffer(){return{type:'offer',sdp:'v=0\r\n'};}async setLocalDescription(o){this.localDescription=o;}async setRemoteDescription(){setTimeout(()=>window.qaEmit({type:'session.started'}),10);}close(){}}window.RTCPeerConnection=Peer;
 });
 await page.getByRole('button',{name:'Breakfast',exact:true}).click();
 await page.getByRole('button',{name:'Start live conversation',exact:true}).click();
 await page.getByRole('button',{name:'End conversation',exact:true}).waitFor();
 const caption=async(role,text,n)=>page.evaluate(({role,text,n})=>window.qaEmit({type:`session.${role}_transcript.delta`,event_id:'t'+n,start_ms:n*1000,delta:text}),{role,text,n});
 const call=async(id,name,args)=>{await page.evaluate(({id,name,args})=>{for(const event of [{type:'response.created',response:{id}},{type:'response.output_item.done',item:{type:'function_call',call_id:id,name,arguments:JSON.stringify(args)}},{type:'response.completed',response:{id,output:[]}}])window.qaEmit({type:'response.event',event});},{id,name,args});await page.waitForTimeout(150);return page.evaluate(id=>JSON.parse(window.qaSent.find(e=>e.item?.call_id===id).item.output),id);};
 await caption('input','I had one boiled egg and toast at 8:30.',1);
 const draft=await call('p','prepare_meal',{meal:'Breakfast',time:'08:30',foods:[{name:'Boiled egg',portion:'one egg'},{name:'Toast',portion:'one slice'}]});
 if((await page.evaluate(()=>window.qaEntries)).length)throw Error('Premature save');
 await caption('output','One boiled egg and one slice of toast at 8:30. Should I save that?',2);
 await caption('input','Yes, save it.',3);
 const saved=await call('s','confirm_meal',{draft_id:draft.draft_id,confirmation_quote:'Yes, save it.'});
 if(saved.status!=='saved')throw Error(JSON.stringify(saved));
 await caption('output','Saved breakfast. What did you have for lunch?',4);
 const entries=await page.evaluate(()=>window.qaEntries);
 if(entries.length!==2||!entries.every(e=>e.conversation.some(t=>t.content==='Yes, save it.')))throw Error('Missing originals/foods');
 if(await page.getByRole('button',{name:/Pause|Review unfinished/}).count())throw Error('Unwanted active controls');
 if(!await page.evaluate(()=>window.qaMic.getTracks().every(t=>t.readyState==='live')))throw Error('Call stopped after save');
 await page.getByRole('button',{name:'End conversation',exact:true}).click();await page.waitForTimeout(100);
 if(!await page.evaluate(()=>window.qaMic.getTracks().every(t=>t.readyState==='ended')))throw Error('Microphone still active');
 await page.setViewportSize({width:390,height:844});const width=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 return {saved,entries:entries.map(e=>({name:e.customFood.name,time:e.time,turns:e.conversation.length})),width};
}
