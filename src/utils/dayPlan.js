import { NUTRIENT_KEYS, validNutrientValue } from './nutrientCatalog.js';
import { localDateKey } from './nutrition.js';
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export function createDayPlan(items,recipesById,detailsById={},id=crypto.randomUUID()){
 if(!Array.isArray(items)||!items.length||items.length>30)throw Error('Choose 1–30 foods for the plan.');
 return {id,items:items.map((item,index)=>{
  const recipe=recipesById[item.recipeId||item.id];
  if(!recipe||!positive(Number(item.servings??1)))throw Error('Check the food and portion.');
  return {id:`${id}-${index}`,recipeId:recipe.id,recipe:structuredClone(recipe),details:structuredClone(detailsById[recipe.id]||{}),servings:Number(item.servings??1),meal:item.meal||'',time:item.time||''};
 })};
}
export const planEntryId=item=>`plan-eaten-${item.id}`;
export function markPlanItem(entries,item,date,time='',meal=item.meal){
 if(entries.some(e=>e.id===planEntryId(item)))return entries;
 if(!positive(item.servings)||!item.recipe)throw Error('Check the planned portion.');
 return [...entries,{id:planEntryId(item),planItemId:item.id,date:date||localDateKey(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,source:'custom',recipeId:item.recipeId,customFood:structuredClone(item.recipe),servings:item.servings,meal:meal||'',time,timeSource:time?'user-recorded':'unknown',recordedAt:new Date().toISOString(),confirmedAt:new Date().toISOString()}];
}
export function undoPlanItem(entries,item){return entries.filter(e=>!(e.id===planEntryId(item)&&e.planItemId===item.id));}

export function validStoredPlan(plan){
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 return plan===null||(plan&&text(plan.id,160)&&Array.isArray(plan.items)&&plan.items.length<=30&&new Set(plan.items.map(i=>i?.id)).size===plan.items.length&&plan.items.every(i=>i&&text(i.id,180)&&text(i.recipeId,160)&&positive(i.servings)&&text(i.meal,80)&&text(i.time,5)&&(!i.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time))&&i.recipe&&text(i.recipe.name,200)&&NUTRIENT_KEYS.every(k=>i.recipe[k]==null||validNutrientValue(i.recipe[k]))));
}
