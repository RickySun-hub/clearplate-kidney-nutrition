import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeRecordingBase, customizeRecipe, ingredientAmount } from './recipeRecording.js';
import { detailedNutritionFor, mealTotals } from './nutrition.js';
import { editFoodEntry } from './entryEditing.js';
import { validateCareRecord } from './careCloud.js';
const recipe = { id: 'example', name: 'Carrot bowl', calories: 100, protein: 2, sodium: 30, potassium: null, phosphorus: 0 };
const details = { servings: 2, servingSize: '1 bowl' };
const audit = { ingredients: [{ kind: 'heading', original: 'For the bowl:' }, { original: '200 g carrots', quantity: 200, unit: 'g', grams: 200, fdcId: 1 }, { original: '2 tbsp oil', quantity: 2, unit: 'tbsp', grams: 20, fdcId: 2 }] };
const foods = { 1: { basis: 'per100g', nutrients: { calories: 40, protein: 1, sodium: 20, potassium: null, phosphorus: 0 } }, 2: { basis: 'per100g', nutrients: { calories: 900, protein: 0, sodium: 0, potassium: 0, phosphorus: 0 } } };

test('decimal servings scale only once and per-record adjustments never mutate source recipes', () => {
  const baseline = JSON.stringify({recipe, details, audit, foods});
  const base = recipeRecordingBase(recipe, details, audit, foods);
  assert.equal(base.calories, 100);
  const adjusted = customizeRecipe(base, {0:{amount:80, unit:'g'}});
  assert.equal(adjusted.calories, 122);
  assert.equal(adjusted.protein, 0.8);
  assert.equal(detailedNutritionFor(adjusted, 0.8).calories, 97.60000000000001);
  assert.equal(adjusted.potassium, null);
  assert.equal(adjusted.phosphorus, 0);
  assert.deepEqual(ingredientAmount(adjusted.recipeCustomization.ingredients[0], adjusted.recipeCustomization.overrides[0], 0.8), {unit:'g',amount:64});
  assert.equal(JSON.stringify({recipe, details, audit, foods}), baseline);
  assert.equal(base.calories, 100);
});
test('household amount changes use the matched ingredient conversion and reset restores the source', () => {
  const base=recipeRecordingBase(recipe, details, audit, foods);
  const adjusted=customizeRecipe(base, {1:{amount:0.5,unit:'tbsp'}});
  assert.equal(adjusted.calories,85);
  const reset=customizeRecipe(adjusted,{});
  assert.equal(reset.calories,100);
  assert.equal(reset.grams,undefined);
  assert.equal(reset.recipeCustomization.nutritionStatus,'original');
});
test('unmeasured ingredients and ambiguous ranges do not create false complete nutrient totals', () => {
  const incomplete={ingredients:[...audit.ingredients,{original:'Salt to taste', quantity:null, unit:null, grams:null, fdcId:3}]};
  const base=recipeRecordingBase(recipe,details,incomplete,foods);
  const adjusted=customizeRecipe(base,{0:{amount:80,unit:'g'}});
  assert.equal(adjusted.calories,null);
  assert.equal(adjusted.sodium,null);
  assert.equal(adjusted.recipeCustomization.nutritionStatus,'incomplete');
  const absent=customizeRecipe(base,{0:{amount:80,unit:'g'},2:{amount:0,unit:'g'}});
  assert.equal(absent.calories,122);
  assert.throws(()=>customizeRecipe(base,{0:{amount:-1,unit:'g'}}));
  assert.throws(()=>customizeRecipe(base,{0:{amount:1,unit:'cups'}}));
});
test('saved customized entries survive validation, cookbook changes and another portion edit', () => {
  const food=customizeRecipe(recipeRecordingBase(recipe,details,audit,foods),{0:{amount:80,unit:'g'}});
  const entry={id:'test',date:'2026-10-20',meal:'Brunch',time:'10:30',timeSource:'user-recorded',source:'custom',recipeId:recipe.id,servings:0.8,customFood:food};
  const saved=validateCareRecord({profile:{name:'Fictional'},entries:[entry],dayRecords:{}}).entries[0];
  assert.equal(mealTotals([saved],{example:{...recipe,calories:999}}).calories,97.60000000000001);
  const edited=editFoodEntry(saved,{date:entry.date,meal:'Brunch',time:'10:30',amount:0.5,unit:'servings',customFood:customizeRecipe(saved.customFood,{0:{amount:60,unit:'g'}})}, {}, entry.date);
  assert.equal(edited.customFood.calories,114);
  assert.equal(mealTotals([edited],{}).calories,57);
  assert.equal(saved.customFood.calories,122);
});
test('imported recipe ingredients remain editable without inventing nutrient matches', () => {
  const base=recipeRecordingBase({id:'imported',name:'Imported bowl',calories:null},{servings:2,ingredients:['200 g carrots','1 cup rice']},null,{});
  assert.equal(base.recipeCustomization.ingredients.length,2);
  assert.equal(base.recipeCustomization.ingredients[0].grams,100);
  assert.equal(base.recipeCustomization.ingredients[1].grams,null);
  const adjusted=customizeRecipe(base,{0:{amount:80,unit:'g'},1:{amount:50,unit:'g'}});
  assert.equal(adjusted.calories,null);
  assert.equal(adjusted.grams,130);
});
