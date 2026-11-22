import test from 'node:test';import assert from 'node:assert/strict';
import {createMealTools,appendVoiceMeal,confirmsDraft} from './liveMealTools.js';
import {responseToolBridge} from './liveToolBridge.js';
const t=(role,content)=>({role,content,source:role==='user'?'voice':'assistant',at:new Date().toISOString()});
const draft={meal:'Breakfast',time:'08:30',foods:[{name:'Scrambled eggs',portion:'Quarter of six eggs shared by three people'}]};
test('an affirmative prefix cannot hide a changed quantity or additional food',()=>{
 for(const quote of ['Yes, half the bowl.','Yes, two more eggs.','Yes, and a cup of tea.']) {
  assert.equal(confirmsDraft(quote,[t('assistant','One bowl. Save?'),t('user',quote)],0),false);
  assert.equal(confirmsDraft('Yes',[t('assistant','One bowl. Save?'),t('user',quote),t('assistant','Save?'),t('user','Yes')],0),false);
 }
 for(const quote of ['Yes, save it.','Yes, please.','That is right.','Go ahead and save it.']) assert.equal(confirmsDraft(quote,[t('assistant','One bowl. Save?'),t('user',quote)],0),true);
});
test('voice save needs fresh matching confirmation, persists once and retains originals',async()=>{
 let turns=[t('user','I ate a quarter of the pan.')];const saved=[];
 const tools=createMealTools({getTurns:()=>turns,id:()=> 'a',onSave:b=>{saved.push(b);return true;}});
 await tools.run('p','prepare_meal',draft);
 assert.equal((await tools.run('early','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'})).status,'not_saved');
 turns.push(t('assistant','Should I save that?'),t('user','Yes, but I ate half.'));
 assert.equal((await tools.run('correction','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, but I ate half.'})).status,'not_saved');
 turns.push(t('assistant','A quarter, correct?'),t('user','Yes, save it.'));
 assert.equal((await tools.run('old','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'})).status,'not_saved');
 await tools.run('revised','prepare_meal',draft);
 turns.push(t('assistant','A quarter of the pan. Should I save that?'),t('user','Yes, save it.'));
 assert.equal((await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'})).status,'saved');
 await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'});
 await tools.run('c2','confirm_meal',{draft_id:'a',confirmation_quote:'Yes, save it.'});
 assert.equal(saved.length,1);assert.equal(saved[0].conversation.at(-1).content,'Yes, save it.');
 const entries=appendVoiceMeal([],saved[0],'2026-10-07');assert.equal(entries[0].time,'08:30');assert.equal(entries[0].customFood.method,'unmeasured');assert.equal(entries[0].customFood.sodium_mg,undefined);assert.equal(appendVoiceMeal(entries,saved[0],'2026-10-07'),entries);
});

test('voice needs an assistant readback after preparation and keeps unknown nutrients explicit',async()=>{
 let turns=[t('user','Some soup, amount unknown.')],saved;
 const tools=createMealTools({getTurns:()=>turns,id:()=> 'a',onSave:b=>{saved=b;return true;}});
 await tools.run('p','prepare_meal',{meal:'Lunch',time:null,foods:[{name:'Soup',portion:'unknown'}]});
 turns.push(t('user','Yes'));
 assert.equal((await tools.run('early','confirm_meal',{draft_id:'a',confirmation_quote:'Yes'})).status,'not_saved');
 turns.push(t('assistant','Soup, amount and nutrients unknown. Save?'),t('user','Yes'));
 assert.equal((await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes'})).status,'saved');
 const entry=appendVoiceMeal([],saved,'2026-11-04')[0];assert.equal(entry.customFood.protein,null);assert.equal(entry.customFood.sodium,null);assert.equal(entry.customFood.grams,null);
});

test('prepared voice source is a stable snapshot and its household portion survives readback text',async()=>{
 let turns=[t('user','I ate two eggs.')],saved;
 const source={name:'Egg, cooked',protein:12,method:'usda-estimate',servingDescription:'2 × 1 large egg (about 100 g)',portionSelection:{kind:'household',quantity:2,grams:100},sourceSnapshot:{fdcId:1},grams:100};
 const tools=createMealTools({getTurns:()=>turns,resolveSource:()=>source,id:()=> 'a',onSave:b=>{saved=b;return true;}});
 await tools.run('p','prepare_meal',{meal:'Lunch',time:null,foods:[{name:'Eggs',portion:'two eggs',source_ref:'retrieved'}]});source.protein=999;
 turns.push(t('assistant','Two cooked large eggs, using the USDA estimate. Save?'),t('user','Yes'));
 await tools.run('c','confirm_meal',{draft_id:'a',confirmation_quote:'Yes'});
 const entry=appendVoiceMeal([],saved,'2026-11-04')[0];assert.equal(entry.customFood.protein,12);assert.equal(entry.customFood.servingDescription,'2 × 1 large egg (about 100 g)');assert.equal(entry.customFood.reportedPortion,'two eggs');
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
