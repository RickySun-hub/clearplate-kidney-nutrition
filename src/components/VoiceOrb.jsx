import {useEffect,useState,useRef} from 'react';
import {Mic,MicOff,Square} from 'lucide-react';
import {createStreamMeter,orbState} from '../utils/voiceMeter.js';
import './VoiceOrb.css';
const labels={idle:'Ready to talk',connecting:'Connecting',listening:'Listening',processing:'Processing',speaking:'Speaking',muted:'Microphone muted',error:'Voice unavailable'};
export default function VoiceOrb({inputStream,outputStream,phase='idle',muted=false,processing=false,speaking=false,error=false,disabled=false,label,onStart,onMute,onEnd,onActivity}) {
 const activity=useRef(onActivity);activity.current=onActivity;
 const [input,setInput]=useState(0),[output,setOutput]=useState(0),[reduced,setReduced]=useState(()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
 useEffect(()=>{setInput(0);return createStreamMeter(inputStream,setInput);},[inputStream]);
 useEffect(()=>{setOutput(0);return createStreamMeter(outputStream,setOutput);},[outputStream]);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);return ()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{activity.current?.({input:muted?0:input,output});},[input,output,muted]);
 const state=orbState({phase,muted,processing,speaking:speaking||output>.025,error});
 const active=phase!=='idle';const volume=Math.max(muted?0:input,output);
 return <div className="voice-orb-stage" data-voice-state={state}>
   <div className="voice-orb-space" aria-hidden="true"><div className="voice-orb" style={{transform:`scale(${reduced?1:1+volume*.18})`}}><span className="voice-orb-glass" /></div></div>
   <p className="voice-orb-label" role="status" aria-live="polite">{label || labels[state]}{state==='speaking'&&muted?' · mic muted':''}</p>
   <div className="voice-orb-controls">
     {active?<><button type="button" disabled={disabled||phase!=='live'} onClick={onMute} aria-label={muted?'Unmute microphone':'Mute microphone'} aria-pressed={muted}>{muted?<MicOff size={24}/>:<Mic size={24}/>}</button><button type="button" onClick={onEnd} aria-label="End conversation"><Square size={20}/></button></>:<button type="button" disabled={disabled} onClick={onStart} aria-label="Start microphone"><Mic size={26}/></button>}
   </div>
 </div>;
}
