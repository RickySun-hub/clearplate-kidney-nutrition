import test from 'node:test';
import assert from 'node:assert/strict';
import { transcriptAfterInterpretation } from './voiceTranscript.js';
test('unrecognized recipe speech is retained in the editable input',()=>{
 assert.equal(transcriptAfterInterpretation({recipe:true,intent:'unknown',recognized:'Synthetic unclear food',audio:true,existing:''}),'Synthetic unclear food');
});
test('unrecognized speech preserves an existing unsent text draft',()=>{
 assert.equal(transcriptAfterInterpretation({recipe:true,intent:'unknown',recognized:'with rice',audio:true,existing:'One egg'}),'One egg\nwith rice');
});
test('typed recovery keeps the original text without duplicating the response',()=>{
 assert.equal(transcriptAfterInterpretation({recipe:true,intent:'unknown',recognized:'One egg',audio:false,existing:'One egg'}),'One egg');
});
test('handled recipe commands and recorded conversation turns do not remain queued',()=>{
 for(const input of [{recipe:true,intent:'cooking'},{recipe:true,intent:'food'},{recipe:false,intent:'unknown'}])
 assert.equal(transcriptAfterInterpretation({...input,recognized:'next',audio:true,existing:''}),'');
});
