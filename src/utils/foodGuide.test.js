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
