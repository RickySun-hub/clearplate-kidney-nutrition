import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRecipeAllergies, normalizeFoodAllergies } from './recipeAllergies.js';
const screen = (ingredients, foodAllergies, otherFoodAllergies = '') => assessRecipeAllergies({}, { ingredients }, { foodAllergies, otherFoodAllergies });
test('ingredient aliases and compound ingredients are excluded without title inference', () => {
  for (const [ingredient, allergy] of [['whey powder','milk'],['tahini','sesame'],['tofu','soy'],['mayonnaise','egg'],['pesto','tree-nut'],['wonton sheets','wheat'],['Worcestershire sauce','fish'],['prawns','shellfish'],['groundnuts','peanut']]) {
    assert.equal(screen([ingredient], [allergy]).status, 'blocked', ingredient);
  }
  assert.equal(assessRecipeAllergies({name:'Milk pudding'}, {ingredients:['rice','water']}, {foodAllergies:['milk']}).status, 'no-match');
});
test('missing, partial and unspecified compound ingredients are unknown and excluded', () => {
  for (const ingredients of [undefined, [], [''], [{name:'rice'},{}], ['salad dressing'], ['vegetable broth'], ['milk or oat milk']]) {
    const result = screen(ingredients, ['sesame']);
    assert.equal(result.status, 'unknown'); assert.equal(result.eligible, false);
  }
});
test('custom and unfamiliar stored allergies remain unknown unless visibly matched', () => {
  assert.equal(screen(['rice'], [], 'kiwi').status, 'unknown');
  assert.equal(screen(['kiwifruit'], [], 'kiwi').status, 'blocked');
  assert.equal(screen(['rice'], ['unrecognized']).status, 'unknown');
});
test('no-match is not a safety guarantee and old profiles remain usable', () => {
  assert.equal(screen(['rice','water'], ['milk']).eligible, true);
  assert.match(screen(['rice'], ['milk']).message, /not a safety guarantee/);
  assert.equal(assessRecipeAllergies({}, undefined, {}).status, 'not-filtered');
  assert.deepEqual(normalizeFoodAllergies({}), {foodAllergies:[],otherFoodAllergies:''});
});
test('ingredient objects and current profile changes are evaluated on each use', () => {
  const ingredients = [{name:'tofu'}, {food:{description:'rice'}}];
  assert.equal(screen(ingredients, ['soy']).eligible, false);
  assert.equal(screen(ingredients, []).eligible, true);
  assert.equal(screen(['butternut squash'], ['milk']).status, 'no-match');
});

test('voice recipe discovery uses local allergy screening without transmitting the profile', async () => {
  const {createFoodGuide} = await import('./foodGuide.js');
  const recipes = [{id:'a',name:'Rice with tofu'},{id:'b',name:'Rice with water'},{id:'c',name:'Rice with sauce'}];
  const details = {a:{ingredients:['rice','tofu']},b:{ingredients:['rice','water']},c:{ingredients:['rice','sauce']}};
  const guide = createFoodGuide({recipes,details,getContext:()=>({profile:{foodAllergies:['soy']}}),fetcher:()=>{throw Error('No network expected');}});
  const result = await guide.run('find_recipes',{query:'rice'});
  assert.deepEqual(result.recipes.map(r=>r.id), ['b']);
  assert.equal(result.allergyFilterApplied,true);
  assert.equal(JSON.stringify(result).includes('foodAllergies'),false);
});

test('prepared foods without formulations cannot clear hidden allergens', () => {
  for (const ingredient of ['bread', 'pasta', 'noodles', 'sausage', 'bacon', 'ham', 'pastry', 'cake', 'cookies', 'crackers', 'tortilla', 'cereal', 'granola']) {
    const result = screen([ingredient], ['milk']);
    assert.equal(result.status, 'unknown', ingredient);
    assert.equal(result.eligible, false, ingredient);
  }
  assert.equal(screen(['pasta'], ['egg']).status, 'unknown');
  assert.equal(screen(['bread with whey'], ['milk']).status, 'blocked');
});
