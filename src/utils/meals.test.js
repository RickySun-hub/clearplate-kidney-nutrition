import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedMeal, updateMealTime, validateMealMoment, reorderMealEntries, mealLabel } from './meals.js';
test('meal suggestions respect exact local-time boundaries',()=>{
  for(const [time,meal] of Object.entries({'04:59':'Snack','05:00':'Breakfast','10:59':'Breakfast','11:00':'Lunch','14:59':'Lunch','15:00':'Snack','16:59':'Snack','17:00':'Dinner','21:59':'Dinner','22:00':'Snack'})) assert.equal(suggestedMeal(time),meal);
});
test('manual Brunch selection stays selected while automatic suggestions follow time',()=>{
  assert.equal(updateMealTime({meal:'Breakfast',mealManuallyChosen:false},'12:30').meal,'Lunch');
  assert.equal(updateMealTime({meal:'Brunch',mealManuallyChosen:true},'12:30').meal,'Brunch');
});
test('actual eaten date/time is validated and reorder never overwrites recorded time',()=>{
  const moment={date:'2026-10-20',time:'10:38',meal:'Brunch'};
  assert.doesNotThrow(()=>validateMealMoment(moment,'2026-10-20'));
  for(const patch of [{date:'2026-02-30'},{date:'2026-10-21'},{time:'25:00'},{meal:'Other'}]) assert.throws(()=>validateMealMoment({...moment,...patch},'2026-10-20'));
  const entry={...moment,id:'one',source:'recipe',recipeId:'example',servings:1,timeSource:'user-recorded'};
  const reordered=reorderMealEntries([entry],moment.date,{entryId:'one',targetMeal:'Lunch'});
  assert.equal(reordered[0].meal,'Lunch');assert.equal(reordered[0].time,'10:38');assert.equal(reordered[0].timeSource,'user-recorded');
  assert.equal(mealLabel({meal:'Old custom label'}),'Other meals');assert.equal(mealLabel({}),'Other meals');
});
