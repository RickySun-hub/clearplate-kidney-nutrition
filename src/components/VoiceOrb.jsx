import {useEffect,useState,useRef} from 'react';
import {Mic,MicOff,Square} from 'lucide-react';
import {createStreamMeter,orbState} from '../utils/voiceMeter.js';
import './VoiceOrb.css';
const labels={idle:'Ready to talk',connecting:'Connecting',listening:'Listening',processing:'Processing',speaking:'Speaking',muted:'Microphone muted',error:'Voice unavailable'};
// A fixed Fibonacci sphere: depth changes dot size and opacity, without an
// animation loop, random rerenders, canvas, or a 3D runtime.
const particles=Array.from({length:260},(_,index)=>{
 const y=1-2*(index+.5)/260,radius=Math.sqrt(1-y*y),angle=index*Math.PI*(3-Math.sqrt(5));
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,depth=(z+1)/2;
 return {x:100+x*78,y:100+y*78,z,r:.65+depth*1.25,opacity:.16+depth*.72};
}).sort((a,b)=>a.z-b.z);
const sphere=<svg viewBox="0 0 200 200" focusable="false" className="voice-orb-particles">{particles.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={p.r} opacity={p.opacity} fill={p.z>.25?'#34786f':'#8aa7b2'}/>)}</svg>;
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
   <div className="voice-orb-space" aria-hidden="true"><div className="voice-orb" style={{transform:`scale(${reduced?1:1+volume*.18})`}}>{sphere}</div></div>
   <p className="voice-orb-label" role="status" aria-live="polite">{label || labels[state]}{state==='speaking'&&muted?' · mic muted':''}</p>
   <div className="voice-orb-controls">
     {active?<><button type="button" disabled={disabled||phase!=='live'} onClick={onMute} aria-label={muted?'Unmute microphone':'Mute microphone'} aria-pressed={muted}>{muted?<MicOff size={24}/>:<Mic size={24}/>}</button><button type="button" onClick={onEnd} aria-label="End conversation"><Square size={20}/></button></>:<button type="button" disabled={disabled} onClick={onStart} aria-label="Start microphone"><Mic size={26}/></button>}
   </div>
 </div>;
}
