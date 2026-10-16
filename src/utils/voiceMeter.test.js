import test from 'node:test';import assert from 'node:assert/strict';
import {audioLevel,smoothLevel,orbState,createStreamMeter} from './voiceMeter.js';
test('silence stays still and amplitude is smooth and bounded',()=>{assert.equal(audioLevel([0,0]),0);assert.equal(audioLevel([1,-1]),1);assert.ok(audioLevel([.1,-.1])>audioLevel([.02,-.02]));assert.ok(smoothLevel(0,1)>0&&smoothLevel(0,1)<1);assert.ok(smoothLevel(1,0)>0&&smoothLevel(1,0)<1);});
test('states distinguish actual connection, mute, processing, playback and errors',()=>{for(const [args,state]of [[{},'idle'],[{phase:'connecting'},'connecting'],[{phase:'live'},'listening'],[{phase:'live',muted:true},'muted'],[{processing:true},'processing'],[{speaking:true},'speaking'],[{phase:'live',error:true},'error']])assert.equal(orbState(args),state);});
test('meter reuses stream, cancels frames and closes its context once without stopping tracks',()=>{
 let closed=0,disconnected=0,cancelled=0,stopped=0,callback;
 const stream={getAudioTracks:()=>[{enabled:true,readyState:'live',stop:()=>stopped++}]};
 class Context {state='running';createAnalyser(){return {fftSize:0,getFloatTimeDomainData:data=>data.fill(.1),disconnect:()=>disconnected++};}createMediaStreamSource(s){assert.equal(s,stream);return {connect(){},disconnect:()=>disconnected++};}resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}}
 let level=0;const stop=createStreamMeter(stream,value=>level=value,{AudioContextClass:Context,requestFrame:fn=>{callback=fn;return 1;},cancelFrame:()=>cancelled++});callback();assert.ok(level>0);stop();stop();assert.equal(closed,1);assert.equal(disconnected,2);assert.equal(cancelled,1);assert.equal(stopped,0);
});
test('missing streams never construct contexts or fake levels',()=>{let created=0,called=0;createStreamMeter(null,()=>called++,{AudioContextClass:class{constructor(){created++;}}})();assert.equal(created,0);assert.equal(called,0);});
