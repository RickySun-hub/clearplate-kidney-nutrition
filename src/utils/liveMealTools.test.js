import test from 'node:test';import assert from 'node:assert/strict';
import {createMealTools,appendVoiceMeal} from './liveMealTools.js';
import {responseToolBridge} from './liveToolBridge.js';
const t=(role,content)=>({role,content,source:role==='user'?'voice':'assistant',at:new Date().toISOString()});
const draft={meal:'Breakfast',time:'08:30',foods:[{name:'Scrambled eggs',portion:'Quarter of six eggs shared by three people'}]};
test('voice save needs fresh matching confirmation, persists once and retains originals',async()=>{
 let turns=[t('user','I ate a quarter of the pan.')];const saved=[];
 const tools=createMealTools({getTurns:()=>turns,id:()=> 'a',onSave:b=>{saved.push(b);return true;}});
 await tools.run('p','prepare_meal',draft);
 assert.equal((await tools.run('early','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'})).status,'not_saved');
 turns.push(t('assistant','Should I save that?'),t('user','Yes, but I ate half.'));
 assert.equal((await tools.run('correction','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, but I ate half.'})).status,'not_saved');
 turns.push(t('assistant','A quarter, correct?'),t('user','Yes, save it.'));
 assert.equal((await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'})).status,'saved');
 await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'});
 await tools.run('c2','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'});
 assert.equal(saved.length,1);assert.equal(saved[0].conversation.at(-1).content,'Yes, save it.');
 const entries=appendVoiceMeal([],saved[0],'2026-10-07');assert.equal(entries[0].time,'08:30');assert.equal(entries[0].customFood.method,'unmeasured');assert.equal(entries[0].customFood.sodium_mg,undefined);assert.equal(appendVoiceMeal(entries,saved[0],'2026-10-07'),entries);
});
test('failed persistence never reports success and can retry with new call',async()=>{
 let turns=[t('user','An egg.')],ok=false;
 const tools=createMealTools({getTurns:()=>turns,id:()=> 'a',onSave:()=>ok});
 await tools.run('p','prepare_meal',draft);turns.push(t('assistant','Save?'),t('user','Yes.'));
 assert.equal((await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes.'})).status,'save_failed');ok=true;
 assert.equal((await tools.run('c2','confirm_meal',{draft_id:'a',confirmation_quote:'Yes.'})).status,'saved');
});
test('Responses bridge waits for completed calls, deduplicates completion and returns outputs before continuation',async()=>{
 const sent=[];let called=0;const bridge=responseToolBridge({send:e=>sent.push(e),run:async()=>{called++;return{status:'saved'};}});
 await bridge({event:{type:'response.created',response:{id:'r'}}});
 await bridge({event:{type:'response.function_call_arguments.delta',delta:'{}'}});assert.equal(called,0);
 await bridge({event:{type:'response.output_item.done',item:{type:'function_call',call_id:'c',name:'confirm_meal',arguments:'{}'}}});assert.equal(called,0);
 await bridge({event:{type:'response.completed',response:{id:'r',output:[]}}});
 await bridge({event:{type:'response.completed',response:{id:'r',output:[]}}});assert.equal(called,1);
 assert.deepEqual(sent.map(e=>e.type),['response.item.create','response.create']);
});
