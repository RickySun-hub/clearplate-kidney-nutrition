import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageSquare, Check } from 'lucide-react';
import VoiceOrb from './VoiceOrb';
import { liveTurns, liveGreeting } from '../utils/liveVoice.js';
import { createFoodGuide } from '../utils/foodGuide.js';
import { createMealTools } from '../utils/liveMealTools.js';
import { responseToolBridge } from '../utils/liveToolBridge.js';
export default function LiveVoice({accessToken,getAccessToken,meal,mode='log',recipes=[],recipeDetails={},entries=[],date,profile={},conversation=[],autoStart=false,disabled=false,onReview,onBusy,onSaveMeal}) {
  const context=useRef({entries,date,profile});context.current={entries,date,profile};
  const [cooking,setCooking]=useState(null);
  const [manualSaving,setManualSaving]=useState(false);
  const manualLock=useRef(false);
  async function savePending(){if(!pending||manualLock.current)return;manualLock.current=true;setManualSaving(true);try{const ok=await callbacks.current.onSaveMeal?.({...pending,conversation:turnRef.current});if(ok===false||ok===undefined){setStatus('Meal was not saved. Check the cloud message above and retry.');return;}setSaved(old=>[...old,{...pending,draft_id:pending.id}]);setPending(null);setStatus('Meal saved to your record and today’s meals.');}catch{setStatus('Meal was not saved. Your draft is still here. Please retry.');}finally{manualLock.current=false;setManualSaving(false);}}
  const [status,setStatus]=useState('Start a natural voice conversation.');
  const [greetingBlocked,setGreetingBlocked]=useState(false);
  const [phase,setPhase]=useState('idle'), [pending,setPending]=useState(null), [saved,setSaved]=useState([]),[turns,setTurns]=useState([]);
  const [inputStream,setInputStream]=useState(null),[outputStream,setOutputStream]=useState(null),[muted,setMuted]=useState(false),[processing,setProcessing]=useState(false),[speaking,setSpeaking]=useState(false),[voiceError,setVoiceError]=useState(false);
  const resource=useRef(null), mounted=useRef(true),audio=useRef(null),turnRef=useRef([]), callbacks=useRef({onReview,onBusy,onSaveMeal});
  callbacks.current={onReview,onBusy,onSaveMeal};
  function release(r) {
    if(!r || r.released)return;r.released=true;clearInterval(r.followup);clearTimeout(r.greetingTimer);clearTimeout(r.limit);clearTimeout(r.timeout);clearTimeout(r.closeTimer);
    if(r.greeting){r.greeting.onplaying=null;r.greeting.onpause=null;r.greeting.onended=null;r.greeting.pause();r.greeting.src='';}r.greetingStream?.getTracks().forEach(t=>t.stop());r.abort.abort();r.stream?.getTracks().forEach(t=>t.stop());r.dc?.close();r.pc?.close();
    if(resource.current===r){resource.current=null;if(audio.current)audio.current.srcObject=null;callbacks.current.onBusy?.(false);if(mounted.current){setPhase('idle');setInputStream(null);setOutputStream(null);setMuted(false);setProcessing(false);setSpeaking(false);}}
    r.resolveClose?.();
  }
  function close() {
    const r=resource.current;if(!r)return Promise.resolve();if(r.closing)return r.closing;
    r.closing=new Promise(resolve=>{r.resolveClose=resolve;});
    r.stream?.getTracks().forEach(t=>{t.enabled=false;});
    if(mounted.current){setPhase('closing');setStatus('Finishing your conversation…');}
    if(r.dc?.readyState==='open' && r.ready){r.dc.send(JSON.stringify({type:'session.close'}));r.closeTimer=setTimeout(()=>release(r),4000);}else release(r);
    return r.closing;
  }
  async function start() {
    if(resource.current||disabled)return;
    const prior=turnRef.current.length?turnRef.current:conversation;turnRef.current=[];setTurns([]);setGreetingBlocked(false);setVoiceError(false);setMuted(false);setProcessing(false);setPhase('connecting');setStatus('Connecting to OpenAI voice…');callbacks.current.onBusy?.(true);
    const r={abort:new AbortController(),fragments:[],seen:new Set(),startedAt:Date.now(),prior};resource.current=r;
    r.timeout=setTimeout(()=>{if(resource.current===r){setVoiceError(true);setStatus('Connection timed out. Please try again.');release(r);}},35000);
    try {
      r.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(r.released){r.stream.getTracks().forEach(t=>t.stop());return;}
      setInputStream(r.stream);
      r.pc=new RTCPeerConnection();r.pc.ontrack=e=>{if(r.released)return;r.remoteStream=e.streams[0]||new MediaStream([e.track]);setOutputStream(r.remoteStream);audio.current.srcObject=r.remoteStream;audio.current.play().catch(()=>{if(mounted.current){setGreetingBlocked(true);setStatus('Tap Enable audio below to hear the assistant.');}});};
      r.stream.getAudioTracks().forEach(t=>r.pc.addTrack(t,r.stream));
      r.dc=r.pc.createDataChannel('oai-events');
      const send=x=>{if(!r.released && r.dc.readyState==='open')r.dc.send(JSON.stringify({event_id:crypto.randomUUID(),...x}));};
      r.send=send;
      const guide=createFoodGuide({recipes,details:recipeDetails,getContext:()=>context.current,onRecipe:setCooking});
      const recorder=createMealTools({resolveSource:guide.resolve,getTurns:()=>turnRef.current,onSave:batch=>{
        if(r.released||!mounted.current)return false;
        return callbacks.current.onSaveMeal?.(batch) ?? false;
      },onDraft:d=>{if(r.released)return;setPending(d);if(d){
        const foods=d.foods.map(f=>`${f.matchedFood?.name||f.name}: ${f.portion}${f.matchedFood?" (source-based estimate)":" (nutrients unknown)"}`).join('; ');
        send({type:'session.commentary.append',delegation_id:null,content:`Draft ready, not saved. For ${d.meal}${d.time?' at '+d.time:''}: ${foods}. Should I save that?`});
      }},onSaved:result=>{
        if(r.released)return;send({type:'session.commentary.append',delegation_id:null,content:`Your ${result.meal.toLowerCase()} was saved successfully. What else did you eat today?`});setSaved(old=>[...old,result]);setStatus(`${result.meal} saved. Keep talking — I'm listening.`);
        // Saved entries retain the full transcript. Start a fresh bounded record for the next meal.
        r.prior=[];r.fragments=[];turnRef.current=[];setTurns([]);
      }});
      const bridge=responseToolBridge({send,run:async(callId,name,args)=>(await guide.run(name,args))??recorder.run(callId,name,args),isActive:()=>!r.released&&!r.closing,onError:()=>{setStatus('I could not finish organizing that meal. Please ask me to try again.');send({type:'session.commentary.append',delegation_id:null,content:'I could not finish organizing that meal. Nothing new was saved. Would you like me to try again?'});}});
      r.dc.onmessage=({data})=>{
        if(r.released)return;let e;try{e=JSON.parse(data);}catch{return;}
        if(e.type==='session.started'){
          clearTimeout(r.timeout);r.ready=true;r.startedAt=Date.now();setPhase('live');setStatus('Listening. You can speak naturally and interrupt me.');
          const greeting=liveGreeting(meal,r.prior.length>0,mode);
          const greetingFile=r.prior.length?'resume':mode==='choose'?'choose':mode==='cook'?'cook':meal.toLowerCase();
          r.prior=[...r.prior,{role:'assistant',content:greeting,source:'assistant',at:new Date().toISOString()}];
          turnRef.current=r.prior;setTurns(r.prior);
          r.greeting=new Audio(`/audio/hello-${greetingFile}.mp3`);
          r.greeting.onplaying=()=>{if(r.released)return;setSpeaking(true);setProcessing(false);try{r.greetingStream=r.greeting.captureStream?.();if(r.greetingStream?.getAudioTracks().length)setOutputStream(r.greetingStream);}catch{}};
          r.greeting.onpause=r.greeting.onended=()=>{if(r.released)return;setSpeaking(false);setOutputStream(r.remoteStream||null);};
          r.greeting.play().catch(()=>{if(!r.released){setGreetingBlocked(true);setStatus('Tap Enable audio below to hear the opening question.');}});
          r.limit=setTimeout(()=>{void close();},300000);
          r.followup=setInterval(()=>{
            const last=turnRef.current.at(-1);
            if(!r.closing && last?.role==='user' && r.lastUserAt && Date.now()-r.lastUserAt>7000 && Date.now()-(r.lastSoundAt||0)>2000 && r.prompted!==r.lastUserAt){
              r.prompted=r.lastUserAt;send({type:'session.instructions.append',delegation_id:null,content:'The user has finished their answer. Respond now and ask the next useful food-recall question, or delegate the meal preparation/confirmation if appropriate. Do not wait for a button.'});
            }
          },1000);
        } else if(e.type==='session.input_transcript.delta'||e.type==='session.output_transcript.delta'){
          if(typeof e.delta!=='string'||!Number.isFinite(e.start_ms)||r.seen.has(e.event_id))return;
          if(e.type==='session.input_transcript.delta'){r.greeting?.pause();setGreetingBlocked(false);r.lastUserAt=Date.now();setProcessing(true);}
          if(e.event_id)r.seen.add(e.event_id);
          r.fragments.push({role:e.type.includes('input_')?'user':'assistant',text:e.delta,start:e.start_ms,order:r.fragments.length});
          const next=[...r.prior,...liveTurns(r.fragments,r.startedAt)];turnRef.current=next;setTurns(next);
          if(next.length>=150 || r.fragments.reduce((n,f)=>n+f.text.length,0)>24000){setStatus('Please review this conversation before continuing.');void close();}
        } else if(e.type==='response.event'){setProcessing(true);void bridge(e).catch(()=>setStatus('Could not finish that record. Please ask me to try again.')).finally(()=>{if(!r.released)setProcessing(false);});}
        else if(e.type==='session.closed'){setStatus('Conversation ended. Check the save status above; unfinished details are kept below.');release(r);}
        else if(e.type==='error'){setVoiceError(true);setStatus('Voice encountered a problem. Your transcript is kept below; reconnect or review it.');void close();}
      };
      r.dc.onclose=()=>{if(!r.released){setVoiceError(true);setStatus('Disconnected. Your transcript is kept below.');release(r);}};
      r.pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(r.pc.connectionState)&&!r.released){setVoiceError(true);setStatus('Connection interrupted. Your transcript is kept below.');release(r);}};
      await r.pc.setLocalDescription(await r.pc.createOffer());
      if(r.pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Network setup timed out. Please retry.')),10000);r.pc.addEventListener('icegatheringstatechange',()=>{if(r.pc.iceGatheringState==='complete'){clearTimeout(timeout);resolve();}});});
      if(r.released)return;
      const token=getAccessToken ? await getAccessToken() : accessToken;
      if(r.released)return;
      const response=await fetch('/api/voice-live',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({sdp:r.pc.localDescription.sdp,meal,mode,conversation:prior,localHour:new Date().getHours()}),signal:r.abort.signal});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Could not connect to live voice.');
      if(r.released)return;await r.pc.setRemoteDescription({type:'answer',sdp:result.sdp});

    }catch(error){if(!r.released){setVoiceError(true);setStatus(error.name==='NotAllowedError'?'Allow microphone access to start, or use text below.':error.message||'Voice connection failed.');release(r);}}
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const r=resource.current;if(r?.dc?.readyState==='open')r.dc.send(JSON.stringify({type:'session.close'}));release(r);};},[]);

  useEffect(()=>{const r=resource.current;if(!r?.ready)return;r.send?.({type:'session.instructions.append',delegation_id:null,content:mode==='cook'?'The user chose Find something to cook. Ask about their ingredients and use recipe tools. Do not record planned meals.':'The user chose Log what I ate. Ask what they actually ate and use food matching tools.'});},[mode]);
  async function review(){await close();callbacks.current.onReview?.(turnRef.current);}
  const busy=phase!=='idle';
  return <div className="live-voice">
    <p className="voice-live-detail" role="status" hidden={!voiceError&&!greetingBlocked}>{status}</p>
    <VoiceOrb inputStream={inputStream} outputStream={outputStream} phase={phase} muted={muted} processing={processing} speaking={speaking} error={voiceError} disabled={disabled} onStart={start} onEnd={()=>void close()} onMute={()=>{const r=resource.current;if(!r)return;const next=!muted;r.stream?.getAudioTracks().forEach(t=>{t.enabled=!next;});setMuted(next);}} onActivity={({input,output})=>{const r=resource.current;if(!r)return;if(input>.025){r.lastSoundAt=Date.now();setProcessing(false);}if(output>.025)setProcessing(false);}} />
    {greetingBlocked&&<button type="button" onClick={async()=>{try{await audio.current?.play();await resource.current?.greeting?.play();setGreetingBlocked(false);}catch{setStatus('Audio playback is blocked. Check your browser sound settings.');}}}>Enable audio</button>}
    <audio ref={audio} autoPlay aria-label="Assistant audio" hidden/>
    <p className="voice-underbar">Confirm by voice to save. End stops the microphone. Up to five minutes per call.</p>
    {!!saved.length&&<div role="status">{saved.map(s=><p key={s.draft_id}><Check size={18} aria-hidden="true"/> {s.meal} saved: {s.foods.map(f=>`${f.name} (${f.portion})`).join(', ')}</p>)}</div>}
    {pending&&<p>Ready to confirm: {pending.foods.map(f=>`${f.name} (${f.portion})`).join(', ')}. Tell me if this is right.</p>}
    {pending&&!busy&&<button type="button" className="voice-send" disabled={manualSaving} onClick={savePending}>{manualSaving?'Saving…':'Confirm & save meal'}</button>}
    {cooking&&<article className="voice-recipe"><span>Cooking together · not logged</span><h3>{cooking.name}</h3><p>{cooking.servingSize} · Recipe makes {cooking.servings} servings</p><details><summary>Ingredients & steps</summary><ul>{cooking.ingredients?.map((x,i)=><li key={i}>{x}</li>)}</ul><ol>{cooking.steps?.map((x,i)=><li key={i}>{x}</li>)}</ol></details><p>Tell me when you've eaten, and how much. Changes to ingredients affect the nutrition estimate.</p></article>}
    {turns.filter(t=>t.role==='assistant').at(-1)?.content&&<p className="voice-current-question">{turns.filter(t=>t.role==='assistant').at(-1).content}</p>}
    {!!turns.length&&<details className="voice-transcript"><summary><MessageSquare size={20} aria-hidden="true"/> Conversation <span>{turns.length} messages</span></summary>{turns.map((t,i)=><p key={i}><strong>{t.role==='user'?'You':'Nepholio'}:</strong> {t.content}</p>)}</details>}
    {!busy&&turns.some(t=>t.role==='user')&&<button type="button" className="voice-send" disabled={phase==='connecting'||phase==='closing'||!turns.some(t=>t.role==='user')} onClick={review}><ArrowUp size={20}/> Review unfinished food</button>}
  </div>;
}
