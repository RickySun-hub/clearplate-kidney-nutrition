import test from 'node:test';import assert from 'node:assert/strict';import {createFoodGuide} from './foodGuide.js';import {createMealTools,appendVoiceMeal} from './liveMealTools.js';import {validateCareRecord} from './careCloud.js';
const food={fdcId:1,description:'Egg, cooked',basis:'per100g',nutrients:{calories:150,protein:12,sodium:100,potassium:null},portions:[{amount:1,gramWeight:50,description:'large egg'}]};
const recipe={id:'eggs',name:'Eggs with tomato',calories:200,protein:15,sodium:180};const details={eggs:{servings:2,servingSize:'half the recipe',ingredients:['2 eggs','1 tomato'],steps:['Cook eggs with tomato.']}};
const fetcher=async url=>({ok:true,json:async()=>url.includes('fdc-search')?{foods:[food]}:{food}});
test('food matching uses source portions, refuses invented references, and carries nutrients through care validation',async()=>{
 const guide=createFoodGuide({fetcher});assert.equal((await guide.run('match_food',{fdc_id:1,grams:50})).status,'needs_clarification');await guide.run('search_foods',{query:'egg'});await guide.run('inspect_food',{fdc_id:1});
 const match=await guide.run('match_food',{fdc_id:1,grams:null,portion_index:0,quantity:2});const source=guide.resolve(match.source_ref);assert.equal(source.protein,12);assert.equal(source.potassium,null);
 let turns=[{role:'user',content:'I ate two eggs',source:'voice',at:new Date().toISOString()}];let batch;const recorder=createMealTools({getTurns:()=>turns,resolveSource:guide.resolve,onSave:x=>{batch=x;return true;}});
 const draft=await recorder.run('p','prepare_meal',{meal:'Lunch',time:'12:00',foods:[{name:'Eggs',portion:'two large eggs',source_ref:match.source_ref}]});
 turns.push({role:'assistant',content:'Two large eggs. Save?',source:'assistant',at:new Date().toISOString()},{role:'user',content:'Yes',source:'voice',at:new Date().toISOString()});assert.equal((await recorder.run('c','confirm_meal',{draft_id:draft.draft_id,confirmation_quote:'Yes'})).status,'saved');
 const entries=appendVoiceMeal([],batch,'2026-10-07');validateCareRecord({profile:{},entries,dayRecords:{}});assert.equal(entries[0].customFood.protein,12);assert.equal(entries[0].customFood.potassium,null);assert.equal(entries[0].conversation[0].content,'I ate two eggs');
});
test('cooking retrieves real source steps, rejects planned and modified recipe nutrition',async()=>{
 const guide=createFoodGuide({recipes:[recipe],details});assert.equal((await guide.run('find_recipes',{query:'tomato'})).recipes[0].id,'eggs');assert.equal((await guide.run('find_recipes',{query:'unicorn'})).recipes.length,0);
 assert.equal((await guide.run('open_recipe',{recipe_id:'eggs'})).steps[0],details.eggs.steps[0]);for(const args of [{eaten:false,modified:false},{eaten:true,modified:true}])assert.equal((await guide.run('recipe_portion',{recipe_id:'eggs',servings:1,...args})).status,'needs_clarification');
 const match=await guide.run('recipe_portion',{recipe_id:'eggs',servings:0.5,eaten:true,modified:false});assert.equal(guide.resolve(match.source_ref).calories,100);assert.equal(guide.resolve(match.source_ref).potassium,null);
});
test('usual foods scale previous servings and keep missing nutrients unknown',async()=>{const guide=createFoodGuide({recipes:[recipe],getContext:()=>({entries:[{source:'recipe',recipeId:'eggs',servings:2,meal:'Dinner'}]})});const result=await guide.run('usual_foods',{});assert.equal(guide.resolve(result.foods[0].source_ref).protein,30);assert.equal(guide.resolve(result.foods[0].source_ref).potassium,null);});

test('relaxed search discloses differences and caps repeated lookups',async()=>{
 let queries=[];const guide=createFoodGuide({fetcher:async url=>{const q=new URL(url,'http://localhost').searchParams.get('q');queries.push(q);return{ok:true,json:async()=>({foods:q==='egg'?[food]:[]})};}});
 const result=await guide.run('search_foods',{query:'plain egg without salt'});assert.equal(result.relaxed,true);assert.equal(result.foods.length,1);assert.deepEqual(queries,['plain egg without salt','egg']);
 for(let i=0;i<10;i++)await guide.run('search_foods',{query:'missing'});assert.equal(queries.length,8);assert.match((await guide.run('search_foods',{query:'egg'})).instruction,/limit reached/);
});

test('recent suggestions retain same-name source and portion alternatives without mixing their nutrition',async()=>{
 const first={name:'Rice',fdcId:10,method:'usda-estimate',sourceRelease:'A',grams:100,servingDescription:'1 cup',protein:2,potassium:null};
 const second={...first,fdcId:20,sourceRelease:'B',protein:4,potassium:0};
 const entries=[{source:'custom',customFood:first,servings:1},{source:'custom',customFood:second,servings:1},{source:'custom',customFood:second,servings:2},{source:'custom',customFood:{...second},servings:2}];
 const guide=createFoodGuide({getContext:()=>({entries})});const result=await guide.run('usual_foods',{});
 assert.equal(result.foods.length,3);
 const resolved=result.foods.map(f=>guide.resolve(f.source_ref));
 assert.deepEqual(resolved.map(f=>[f.fdcId,f.sourceRelease,f.protein,f.potassium]),[[20,'B',8,0],[20,'B',4,0],[10,'A',2,null]]);
 assert.equal(resolved[0].grams,200);assert.match(result.foods[0].portion,/2 × 1 cup/);
 assert.equal(first.grams,100);assert.equal(second.protein,4);
});

test('USDA matching requires successful identity-checked inspection and fresh searches invalidate inspection',async()=>{
 let returned=food;let ok=true;
 const guide=createFoodGuide({fetcher:async url=>({ok,json:async()=>url.includes('fdc-search')?{foods:[food]}:{food:returned}})});
 const match=()=>guide.run('match_food',{fdc_id:1,grams:50});
 await guide.run('search_foods',{query:'egg'});assert.equal((await match()).status,'needs_clarification');
 returned={...food,fdcId:2};assert.equal((await guide.run('inspect_food',{fdc_id:1})).status,'needs_clarification');assert.equal((await match()).status,'needs_clarification');
 returned=food;await guide.run('inspect_food',{fdc_id:1});const valid=await match();assert.equal(guide.resolve(valid.source_ref).fdcId,1);
 await guide.run('search_foods',{query:'egg'});assert.equal((await match()).status,'needs_clarification');
 await guide.run('inspect_food',{fdc_id:1});ok=false;await guide.run('inspect_food',{fdc_id:1});assert.equal((await match()).status,'needs_clarification');
 assert.equal(guide.resolve(valid.source_ref).fdcId,1,'previously confirmed reference remains intact');
});

test('legacy estimate reuse scales canonical nutrients and grams once, including subsequent reuse',async()=>{
 const raw={name:'Soup',method:'unpackaged',protein:12,baseEstimate:{protein:10,potassium:null},grams:100,servingDescription:'1 bowl'};
 let entries=[{source:'custom',customFood:raw,servings:2}];const guide=createFoodGuide({getContext:()=>({entries})});
 const reused=guide.resolve((await guide.run('usual_foods',{})).foods[0].source_ref);
 assert.equal(reused.protein,20);assert.equal(reused.baseEstimate.protein,20);assert.equal(reused.grams,200);assert.equal(reused.potassium,null);
 entries=[{source:'custom',customFood:reused,servings:.5}];const again=guide.resolve((await guide.run('usual_foods',{})).foods[0].source_ref);
 assert.equal(again.protein,10);assert.equal(again.baseEstimate.protein,10);assert.equal(again.grams,100);assert.equal(raw.baseEstimate.protein,10);
});
