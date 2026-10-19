import test from 'node:test';import assert from 'node:assert/strict';
import {createDayPlan,markPlanItem,undoPlanItem} from './dayPlan.js';import {nutrientCoverage} from './nutrition.js';import {validateCareRecord} from './careCloud.js';
const recipes={six:{id:'six',name:'Six-portion recipe',calories:100,protein:2,sodium:0,potassium:null}};
test('planning is not intake; stable linkage survives reload, retries and undo without deleting independent logs',()=>{
 const plan=createDayPlan([{recipeId:'six',servings:2,meal:'Brunch'}],recipes,{six:{servings:6}},'test');
 const record=validateCareRecord({profile:{},entries:[],dayRecords:{'2026-10-19':{plan}}});assert.equal(record.entries.length,0);
 const item=record.dayRecords['2026-10-19'].plan.items[0];let entries=markPlanItem([],item,'2026-10-18','11:35','Brunch');
 assert.equal(markPlanItem(entries,item,'2026-10-19','12:00'),entries);assert.equal(entries[0].date,'2026-10-18');assert.equal(entries[0].timeSource,'user-recorded');
 assert.equal(nutrientCoverage(entries).calories.total,200);assert.equal(nutrientCoverage(entries).potassium.total,null);
 const restored=JSON.parse(JSON.stringify(entries));assert.equal(markPlanItem(restored,item,'2026-10-19').length,1);
 const independent={...entries[0],id:'manual',planItemId:undefined};entries.push(independent);assert.deepEqual(undoPlanItem(entries,item),[independent]);
 recipes.six.calories=999;assert.equal(item.recipe.calories,100);recipes.six.calories=100;
});
test('new plan/allergy fields round-trip without changing old records; malformed fields rejected',()=>{
 const profile={foodAllergies:['milk'],otherFoodAllergies:'Synthetic example'};
 const plan=createDayPlan([{recipeId:'six',servings:1}],recipes,{},'safe');
 const record={profile,entries:[],dayRecords:{'2026-10-19':{plan}}};assert.deepEqual(validateCareRecord(record),record);
 assert.throws(()=>validateCareRecord({...record,profile:{foodAllergies:'milk'}}));
 assert.throws(()=>validateCareRecord({...record,dayRecords:{'2026-10-19':{plan:{...plan,items:[{...plan.items[0],servings:-1}]}}}}));
 assert.deepEqual(validateCareRecord({profile:{},entries:[],dayRecords:{}}),{profile:{},entries:[],dayRecords:{}});
});
