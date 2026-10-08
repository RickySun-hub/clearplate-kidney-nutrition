import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, ArrowUp } from 'lucide-react';
import { liveTurns, liveGreeting } from '../utils/liveVoice.js';
export default function LiveVoice({accessToken,meal,conversation=[],autoStart=false,disabled=false,onReview,onBusy}) {
  const [status,setStatus]=useState('Start a natural voice conversation.');
  const [greetingBlocked,setGreetingBlocked]=useState(false);
  const [phase,setPhase]=useState('idle'), [muted,setMuted]=useState(false),[turns,setTurns]=useState([]),[levels,setLevels]=useState(Array(36).fill(4));
  const resource=useRef(null), mounted=useRef(true),started=useRef(false),audio=useRef(null),turnRef=useRef([]), callbacks=useRef({onReview,onBusy});
  callbacks.current={onReview,onBusy};
  function release(r) {
    if(!r || r.released)return;r.released=true;clearTimeout(r.greetingTimer);clearTimeout(r.limit);clearTimeout(r.timeout);clearTimeout(r.closeTimer);cancelAnimationFrame(r.frame);
    r.greeting?.pause();r.abort.abort();r.stream?.getTracks().forEach(t=>t.stop());r.dc?.close();r.pc?.close();r.context?.close().catch(()=>{});
    if(resource.current===r){resource.current=null;if(audio.current)audio.current.srcObject=null;callbacks.current.onBusy?.(false);if(mounted.current){setPhase('idle');setMuted(false);setLevels(Array(36).fill(4));}}
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
    const prior=turnRef.current.length?turnRef.current:conversation;turnRef.current=[];setTurns([]);setGreetingBlocked(false);setPhase('connecting');setStatus('Connecting to OpenAI voice…');callbacks.current.onBusy?.(true);
    const r={abort:new AbortController(),fragments:[],seen:new Set(),startedAt:Date.now(),prior};resource.current=r;
    r.timeout=setTimeout(()=>{if(resource.current===r){setStatus('Connection timed out. Please try again.');release(r);}},35000);
    try {
      r.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(r.released){r.stream.getTracks().forEach(t=>t.stop());return;}
      r.pc=new RTCPeerConnection();r.pc.ontrack=e=>{if(r.released)return;audio.current.srcObject=e.streams[0]||new MediaStream([e.track]);audio.current.play().catch(()=>{if(mounted.current)setStatus('Tap Play audio below to hear the assistant.');});};
      r.stream.getAudioTracks().forEach(t=>r.pc.addTrack(t,r.stream));
      r.dc=r.pc.createDataChannel('oai-events');
      const send=x=>{if(r.dc.readyState==='open')r.dc.send(JSON.stringify(x));};
      r.dc.onmessage=({data})=>{
        if(r.released)return;let e;try{e=JSON.parse(data);}catch{return;}
        if(e.type==='session.started'){
          clearTimeout(r.timeout);r.ready=true;r.startedAt=Date.now();setPhase('live');setStatus('Listening. You can speak naturally and interrupt me.');
          const greeting=liveGreeting(meal,r.prior.length>0);
          const greetingFile=r.prior.length?'resume':meal.toLowerCase();
          r.prior=[...r.prior,{role:'assistant',content:greeting,source:'assistant',at:new Date().toISOString()}];
          turnRef.current=r.prior;setTurns(r.prior);
          r.greeting=new Audio(`/audio/hello-${greetingFile}.mp3`);
          r.greeting.play().catch(()=>{if(!r.released){setGreetingBlocked(true);setStatus('Tap Hear opening question below to enable audio.');}});
          r.limit=setTimeout(()=>{setStatus('Five-minute session complete. Review your food or reconnect.');void close();},300000);
        } else if(e.type==='session.input_transcript.delta'||e.type==='session.output_transcript.delta'){
          if(typeof e.delta!=='string'||!Number.isFinite(e.start_ms)||r.seen.has(e.event_id))return;
          if(e.type==='session.input_transcript.delta'){r.greeting?.pause();setGreetingBlocked(false);}
          if(e.event_id)r.seen.add(e.event_id);
          r.fragments.push({role:e.type.includes('input_')?'user':'assistant',text:e.delta,start:e.start_ms,order:r.fragments.length});
          const next=[...r.prior,...liveTurns(r.fragments,r.startedAt)];turnRef.current=next;setTurns(next);
          if(next.length>=34 || r.fragments.reduce((n,f)=>n+f.text.length,0)>24000){setStatus('Please review this conversation before continuing.');void close();}
        } else if(e.type==='session.delegation.created')send({type:'session.thinking.append',delegation_id:e.delegation.id,content:'No action has been taken. The user can select Review food to open the draft and confirm saving. Continue clarifying their own food and portion.'});
        else if(e.type==='session.closed'){setStatus('Conversation ended. Review your food before saving.');release(r);}
        else if(e.type==='error'){setStatus('Voice encountered a problem. Your transcript is kept below; reconnect or review it.');void close();}
      };
      r.dc.onclose=()=>{if(!r.released){setStatus('Disconnected. Your transcript is kept below.');release(r);}};
      r.pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(r.pc.connectionState)&&!r.released){setStatus('Connection interrupted. Your transcript is kept below.');release(r);}};
      await r.pc.setLocalDescription(await r.pc.createOffer());
      if(r.pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Network setup timed out. Please retry.')),10000);r.pc.addEventListener('icegatheringstatechange',()=>{if(r.pc.iceGatheringState==='complete'){clearTimeout(timeout);resolve();}});});
      if(r.released)return;
      const response=await fetch('/api/voice-live',{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:JSON.stringify({sdp:r.pc.localDescription.sdp,meal,conversation:prior}),signal:r.abort.signal});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Could not connect to live voice.');
      if(r.released)return;await r.pc.setRemoteDescription({type:'answer',sdp:result.sdp});
      try {r.context=new AudioContext();const analyser=r.context.createAnalyser();analyser.fftSize=128;r.context.createMediaStreamSource(r.stream).connect(analyser);const data=new Uint8Array(64);const draw=()=>{if(r.released)return;analyser.getByteFrequencyData(data);setLevels(Array.from({length:36},(_,i)=>Math.max(4,data[i+2]/255*50)));r.frame=requestAnimationFrame(draw);};draw();}catch{/* Audio is usable without a meter. */}
    }catch(error){if(!r.released){setStatus(error.name==='NotAllowedError'?'Allow microphone access to start, or use text below.':error.message||'Voice connection failed.');release(r);}}
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const r=resource.current;if(r?.dc?.readyState==='open')r.dc.send(JSON.stringify({type:'session.close'}));release(r);};},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(autoStart&&!started.current){started.current=true;void start();}},0);return()=>clearTimeout(timer);},[autoStart]);
  async function review(){await close();callbacks.current.onReview?.(turnRef.current);}
  const busy=phase!=='idle';
  return <div className="live-voice">
    <p role="status">{status}</p>
    <div className={`voice-composer ${muted?'is-paused':''}`}>
      <button type="button" className="voice-mic" aria-label="Start live conversation" disabled={busy||disabled} onClick={start}><Mic size={44}/></button>
      <div className="voice-recording-label"><strong>{phase==='connecting'?'Connecting…':phase==='closing'?'Finishing…':busy?muted?'Microphone paused':'Live conversation':'Talk with RenalSync'}</strong><span>OpenAI GPT-Live · English</span></div>
      <div className="voice-waveform" aria-hidden="true">{levels.map((h,i)=><span key={i} style={{height:h}}/>)}</div>
      {phase==='live'&&<div className="voice-record-controls"><button type="button" className="voice-round" aria-label={muted?'Resume microphone':'Pause microphone'} onClick={()=>{resource.current?.stream.getAudioTracks().forEach(t=>{t.enabled=muted;});setMuted(!muted);}}>{muted?<Play size={28}/>:<Pause size={28}/>}</button><button type="button" className="voice-round" aria-label="End conversation" onClick={()=>void close()}><Square size={25}/></button></div>}
    </div>
    {greetingBlocked&&<button type="button" onClick={()=>{const r=resource.current;if(r?.greeting)r.greeting.play().then(()=>setGreetingBlocked(false)).catch(()=>setStatus('Audio playback is blocked. Check your browser sound settings.'));}}>Hear opening question</button>}
    <audio ref={audio} autoPlay controls aria-label="Assistant audio" style={{height:32,maxWidth:'100%',marginTop:12}}/>
    <p className="voice-underbar">AI-generated voice. Audio streams to OpenAI while connected. Pausing mutes your microphone; End stops the call. Nothing is logged until you confirm.</p>
    {!!turns.length&&<details open><summary>Conversation</summary>{turns.map((t,i)=><p key={i}><strong>{t.role==='user'?'You':'RenalSync'}:</strong> {t.content}</p>)}</details>}
    <button type="button" className="voice-send" disabled={phase==='connecting'||phase==='closing'||!turns.some(t=>t.role==='user')} onClick={review}><ArrowUp size={20}/> Review food</button>
  </div>;
}
