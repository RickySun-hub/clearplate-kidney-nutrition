export function audioLevel(samples) {
  if (!samples.length) return 0;
  const rms = Math.sqrt(samples.reduce((sum,value)=>sum+(Number.isFinite(value)?value*value:0),0)/samples.length);
  return Math.min(1,Math.max(0,(rms-0.008)*6));
}
export const smoothLevel = (previous,next) => previous + (next-previous)*(next>previous?0.35:0.12);
export function orbState({phase='idle',muted=false,processing=false,speaking=false,error=false}={}) {
  if(error)return 'error';
  if(phase==='connecting')return 'connecting';
  if(phase==='closing')return 'processing';
  if(speaking)return 'speaking';
  if(muted)return 'muted';
  if(processing)return 'processing';
  return phase==='live'?'listening':'idle';
}
// Observe an already-owned stream. Never requests a microphone or stops its tracks.
export function createStreamMeter(stream,onLevel,{AudioContextClass=globalThis.AudioContext || globalThis.webkitAudioContext,requestFrame=globalThis.requestAnimationFrame,cancelFrame=globalThis.cancelAnimationFrame}={}) {
  let context,source,analyser,frame,closed=false,level=0;
  const stop=()=>{if(closed)return;closed=true;if(frame!==undefined)cancelFrame?.(frame);source?.disconnect();analyser?.disconnect();context?.close().catch(()=>{});};
  if(!stream?.getAudioTracks?.().length || !AudioContextClass)return stop;
  try {
    context=new AudioContextClass();analyser=context.createAnalyser();analyser.fftSize=512;
    source=context.createMediaStreamSource(stream);source.connect(analyser);
    const values=new Float32Array(analyser.fftSize);
    const tick=()=>{if(closed)return;analyser.getFloatTimeDomainData(values);const enabled=stream.getAudioTracks().some(t=>t.enabled&&t.readyState==='live');level=smoothLevel(level,enabled&&context.state==='running'?audioLevel(values):0);onLevel(level);frame=requestFrame(tick);};
    context.resume().catch(()=>{});frame=requestFrame(tick);
  }catch{stop();}
  return stop;
}
