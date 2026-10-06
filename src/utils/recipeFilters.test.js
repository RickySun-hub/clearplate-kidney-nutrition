import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enrichRecipe, filterRecipes, DEFAULT_FILTERS } from './recipeFilters.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const recipes = read('recipes');
const details = read('recipeDetails');
const metadata = read('recipeMetadata');
const enriched = recipes.map((recipe) => enrichRecipe(recipe, details[recipe.id], metadata[recipe.id]));

test('filters intersect category, actual ingredients, diet, preparation and nutrient ceilings', () => {
  const result = filterRecipes(enriched, { category: 'Soups & Salads', search: 'cucumber', diet: 'vegan', preparation: 'no-cook', source: 'full', maxSodium: '100', maxProtein: '10', maxPotassium: '500' });
  assert.deepEqual(result.map((recipe) => recipe.id), ['mexican-vegetable-salad']);
});

test('a vegetable title cannot override meat ingredients or missing source', () => {
  assert.equal(enriched.find((recipe) => recipe.id === 'eggplant-vegetable-soup').diet, 'unknown');
  for (const id of ['chicken-seitan', 'chicken-seitan-tacos', 'andouille-vegan-sausage']) {
    const recipe = enriched.find((item) => item.id === id);
    assert.equal(recipe.diet, 'unknown');
    assert.equal(recipe.sourceCompleteness, 'nutrition-only');
  }
});

test('unknown, blank, negative and non-finite nutrients never pass an active ceiling', () => {
  const input = [null, undefined, '', -1, NaN, Infinity, 0, 10].map((sodium, index) => ({ id: `${index}`, name: `${index}`, sodium }));
  assert.deepEqual(filterRecipes(input, { maxSodium: '10' }).map((item) => item.sodium), [0, 10]);
  assert.equal(filterRecipes(input, { maxSodium: 'invalid' }).length, 0);
});

test('sorting is numeric, missing values last, and does not mutate the input', () => {
  const input = [{ name: 'C', sodium: null }, { name: 'B', sodium: 10 }, { name: 'A', sodium: 2 }];
  assert.deepEqual(filterRecipes(input, { sort: 'sodium' }).map((item) => item.name), ['A', 'B', 'C']);
  assert.deepEqual(input.map((item) => item.name), ['C', 'B', 'A']);
});

test('metadata preserves all IDs, corrects Other and Sauce, and keeps drafts explicit', () => {
  assert.equal(enriched.length, 94);
  assert.ok(Object.keys(metadata).every((id) => recipes.some((recipe) => recipe.id === id)));
  assert.ok(enriched.every((recipe) => recipe.category !== 'Other' && recipe.category !== 'sauce'));
  assert.equal(enriched.find((recipe) => recipe.id === 'ginger-roasted-chicken-breast').category, 'Entrees');
  assert.equal(enriched.find((recipe) => recipe.id === 'bulgur-salad-with-carrots-and-almonds').category, 'Soups & Salads');
  assert.equal(enriched.find((recipe) => recipe.id === 'warm-farro-with-lemon-and-herbs').category, 'Grains');
  assert.ok(enriched.filter((recipe) => recipe.diet !== 'unknown').every((recipe) => recipe.dietStatus === 'draft-unreviewed' && recipe.sourceCompleteness === 'full'));
  assert.equal(enriched.find((recipe) => recipe.id === 'hummus').preparation, 'unknown');
  assert.equal(filterRecipes(enriched, DEFAULT_FILTERS).length, 94);
  assert.equal(filterRecipes(enriched, { source: 'full' }).length, 65);
  assert.equal(filterRecipes(enriched, { source: 'nutrition-only' }).length, 29);
});

test('diet and preparation cases follow the ingredient list rather than dish names', () => {
  const veganIds = filterRecipes(enriched, { diet: 'vegan' }).map((item) => item.id);
  assert.ok(veganIds.includes('hummus'));
  assert.ok(veganIds.includes('quinoa-with-black-beans-and-avocado'));
  assert.ok(!veganIds.includes('strawberry-spinach-salad')); // Honey is explicitly listed.
  assert.ok(!veganIds.includes('mushroom-and-broccoli-risotto')); // Chicken stock is listed.
  assert.ok(!veganIds.includes('roasted-brussels-sprouts')); // Optional Parmesan is unresolved.
  const noCookIds = filterRecipes(enriched, { preparation: 'no-cook' }).map((item) => item.id);
  assert.ok(noCookIds.includes('chipotle-chicken-salad')); // Assembly with already cooked chicken.
  assert.ok(!noCookIds.includes('hummus')); // Source gives dry-bean cooking instructions.
  assert.ok(!noCookIds.includes('homemade-mayonnaise')); // Egg handling needs review.
});

test('incomplete details cannot substantiate diet or no-cook and search uses all terms', () => {
  const recipe = enrichRecipe({ id: 'fixture', name: 'Plant dish', category: 'Sides' }, { ingredients: ['rice'] }, { diet: 'vegan', preparation: 'no-cook' });
  assert.equal(recipe.diet, 'unknown');
  assert.equal(recipe.preparation, 'unknown');
  assert.equal(filterRecipes(enriched, { search: 'zucchini vinegar' }).some((item) => item.id === 'zucchini-ribbon-salad'), true);
});
