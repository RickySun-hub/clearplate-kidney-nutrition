import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMealIdeas, recipeRestrictionStatus, savedIdeaCeilings } from './mealIdeas.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const recipes = read('recipes');
const recipeDetails = read('recipeDetails');
const metadataById = read('recipeMetadata');
const profile = { allergiesStatus: 'none', allergies: [], intolerancesStatus: 'none', intolerances: [] };
const detail = (ingredients) => ({ ingredients, steps: ['Prepare the ingredients and serve.'] });
const recipe = (id, category, values = {}) => ({ id, name: id, category, calories: 200, protein: 10, sodium: 100, ...values });

test('allergies and intolerances both exclude ingredient matches, including hidden common ingredients', () => {
  assert.equal(recipeRestrictionStatus(detail(['1 tbsp tahini']), { ...profile, allergiesStatus: 'listed', allergies: ['Sesame'] }), 'excluded');
  assert.equal(recipeRestrictionStatus(detail(['1 tbsp mayonnaise']), { ...profile, allergiesStatus: 'listed', allergies: ['Egg'] }), 'excluded');
  assert.equal(recipeRestrictionStatus(detail(['1 cup yogurt']), { ...profile, intolerancesStatus: 'listed', intolerances: ['Lactose'] }), 'excluded');
  assert.equal(recipeRestrictionStatus(detail(['1 cup farro']), { ...profile, intolerancesStatus: 'listed', intolerances: ['Gluten'] }), 'excluded');
  assert.equal(recipeRestrictionStatus(detail(['1 carrot', '1 tbsp olive oil']), { ...profile, allergiesStatus: 'listed', allergies: ['Milk'] }), 'clear');
});

test('unknown preferences, custom restrictions, incomplete and compound ingredients do not silently pass', () => {
  for (const preferences of [{}, { ...profile, allergiesStatus: 'unknown' }, { ...profile, allergiesStatus: 'listed', allergies: ['Kiwi'] }, { ...profile, intolerancesStatus: 'listed', intolerances: ['Histamine'] }]) {
    assert.equal(getMealIdeas({ recipes, recipeDetails, profile: preferences }).status, 'needs-preferences');
  }
  assert.equal(recipeRestrictionStatus({}, profile), 'unknown');
  assert.equal(recipeRestrictionStatus(detail(['1 cup broth']), { ...profile, allergiesStatus: 'listed', allergies: ['Soy'] }), 'unknown');
  assert.equal(recipeRestrictionStatus(detail(['1 carrot']), { ...profile, intolerancesStatus: 'listed', intolerances: [] }), 'unknown');
});

test('saved ceilings exclude unknown nutrition, preserve true zero and never calculate a remaining-day budget', () => {
  const foods = [recipe('zero', 'Entrees', { sodium: 0 }), recipe('unknown', 'Grains', { sodium: null }), recipe('over', 'Sides', { sodium: 101 }), recipe('within', 'Grains', { sodium: 90 })];
  const details = Object.fromEntries(foods.map((food) => [food.id, detail(['1 cup rice'])]));
  const result = getMealIdeas({ recipes: foods, recipeDetails: details, profile: { ...profile, sodiumTargetMg: 100 } });
  assert.deepEqual(result.recipes.map((food) => food.id), ['zero', 'within']);
  assert.equal(result.targetCount, 1);
  assert.deepEqual(savedIdeaCeilings({ sodiumTargetMg: 2000, nutrientTargets: { sodium: { max: 1500 }, protein: { max: 70 } }, proteinMaxG: 60 }), { sodium: 1500, protein: 60 });
  assert.equal(getMealIdeas({ recipes: foods, recipeDetails: details, profile: { ...profile, nutrientTargets: { potassium: { max: 300 } } } }).status, 'empty');
});

test('ideas keep original recipe identity, do not mutate catalog/profile and vary categories', () => {
  const originalRecipes = JSON.stringify(recipes);
  const originalProfile = JSON.stringify(profile);
  const result = getMealIdeas({ recipes, recipeDetails, metadataById, profile });
  assert.equal(result.status, 'ready');
  assert.equal(result.recipes.length, 3);
  assert.equal(new Set(result.recipes.map((food) => metadataById[food.id]?.category || food.category)).size, 3);
  assert.ok(result.recipes.every((food) => recipes.includes(food)));
  assert.equal(JSON.stringify(recipes), originalRecipes);
  assert.equal(JSON.stringify(profile), originalProfile);
  assert.ok(result.recipes.every((food) => recipeDetails[food.id].ingredients.length && recipeDetails[food.id].steps.length));
});

test('explicit vegetarian preferences require inspected ingredient metadata and the result stays at three', () => {
  const result = getMealIdeas({ recipes, recipeDetails, metadataById, profile: { ...profile, dietPreference: 'vegetarian' }, limit: 50 });
  assert.equal(result.recipes.length, 3);
  assert.ok(result.recipes.every((food) => ['vegetarian', 'vegan'].includes(metadataById[food.id]?.diet)));
  assert.equal(getMealIdeas({ recipes, recipeDetails, profile, limit: 0 }).recipes.length, 0);
});
