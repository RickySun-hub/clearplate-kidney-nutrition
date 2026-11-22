import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionFor, detailedNutritionFor, mealTotals, mealTotalBounds, nutrientCoverage, formatAmount } from './nutrition.js';
import { reviewDays } from './rdReview.js';
import { createFoodGuide } from './foodGuide.js';
import { normalizeFdcFood } from '../../server/fdc.js';

const entry = (customFood, servings = 1) => ({ source: 'custom', customFood, servings, date: '2026-10-14', meal: 'Lunch' });

test('patient totals, RD review and estimate bounds preserve small amounts until display', () => {
  const rows = Array.from({ length: 3 }, () => entry({ protein: 0.04, sodium: 0, calories: 0, method: 'unpackaged', estimateRangePercent: 0 }));
  assert.equal(mealTotals(rows, {}).protein, 0.12);
  assert.equal(nutrientCoverage(rows).protein.total, 0.12);
  assert.equal(reviewDays(rows, {}, {}, {}, '2026-10-14', '2026-10-14')[0].nutrients.protein.total, 0.12);
  assert.equal(mealTotalBounds(rows, {}).lower.protein, 0.12);
  assert.equal(formatAmount(mealTotals(rows, {}).protein, 1), '0.1');
});

test('nutrient summation is independent of entry order', () => {
  const rows = [100000000, 0.00000001, 0.00000001].map(protein => entry({ protein }));
  const reversed = [...rows].reverse();
  assert.equal(mealTotals(rows, {}).protein, 100000000 + 0.00000002);
  assert.equal(mealTotals(rows, {}).protein, mealTotals(reversed, {}).protein);
  assert.equal(nutrientCoverage(rows).protein.total, nutrientCoverage(reversed).protein.total);
  assert.equal(mealTotalBounds(rows, {}).upper.protein, mealTotalBounds(reversed, {}).upper.protein);
});

test('USDA gram matching carries exact units, source identity, release and unknowns to both summaries', async () => {
  const food = normalizeFdcFood({ fdcId: 123, description: 'Synthetic cooked food', dataType: 'Foundation', foodNutrients: [
    { nutrient: { id: 1003, unitName: 'g' }, amount: 12.3456 },
    { nutrient: { id: 1093, unitName: 'mg' }, amount: 0 },
    { nutrient: { id: 1092, unitName: 'g' }, amount: 7 },
  ] });
  food.release = 'synthetic-test-release';
  food.sourceUrl = 'https://fdc.nal.usda.gov/food-details/123/nutrients';
  const guide = createFoodGuide({ fetcher: async url => ({ ok: true, json: async () => url.includes('fdc-search') ? { foods: [food] } : { food } }) });
  await guide.run('search_foods', { query: 'synthetic' });
  await guide.run('inspect_food', { fdc_id: 123 });
  assert.equal((await guide.run('match_food', { fdc_id: 123, grams: null, portion_index: 0, quantity: 1 })).status, 'needs_clarification');
  const match = await guide.run('match_food', { fdc_id: 123, grams: 25 });
  const source = guide.resolve(match.source_ref);
  assert.equal(source.protein, 3.0864);
  assert.equal(source.fdcId, 123);
  assert.equal(source.sourceRelease, 'synthetic-test-release');
  assert.equal(source.sourceBasis, 'per100g');
  assert.equal(source.name, 'Synthetic cooked food');
  const rows = [entry(source, 2)];
  assert.equal(mealTotals(rows, {}).protein, 6.1728);
  assert.equal(nutrientCoverage(rows).protein.total, 6.1728);
  assert.equal(mealTotals(rows, {}).sodium, 0);
  assert.equal(mealTotals(rows, {}).potassium, null);
  assert.equal(mealTotals(rows, {}).phosphorus, null);
});

test('recipe source servings scale a confirmed personal portion without changing the cooking yield', async () => {
  const recipe = { id: 'synthetic-recipe', name: 'Synthetic recipe', protein: 10.12345, phosphorus: null };
  const details = { [recipe.id]: { servings: 4, servingSize: 'one quarter batch', steps: ['Synthetic step'], ingredients: ['Synthetic ingredient'] } };
  const guide = createFoodGuide({ recipes: [recipe], details });
  await guide.run('open_recipe', { recipe_id: recipe.id });
  const match = await guide.run('recipe_portion', { recipe_id: recipe.id, servings: 0.5, eaten: true, modified: false });
  const source = guide.resolve(match.source_ref);
  assert.equal(source.protein, 5.061725);
  assert.equal(mealTotals([entry(source)], {}).protein, 5.061725);
  assert.equal(source.phosphorus, null);
  assert.equal(details[recipe.id].servings, 4);
  assert.equal(recipe.protein, 10.12345);
});

test('fractional servings retain source precision and micronutrients remain positive on display', () => {
  const food = { protein: 0.04123, vitaminB12: 0.004, potassium: null, phosphorus: 0 };
  assert.equal(nutritionFor(food, 0.5).protein, 0.020615);
  assert.equal(detailedNutritionFor(food, 0.5).vitaminB12, 0.002);
  assert.equal(formatAmount(detailedNutritionFor(food).vitaminB12, 2), '<0.01');
  assert.equal(formatAmount(0, 2), '0');
  assert.equal(formatAmount(null, 2), 'Unknown');
  const rows = [entry(food, 0.5), entry({ protein: 0.04, potassium: 5, phosphorus: 0 })];
  assert.equal(mealTotals(rows, {}).potassium, null);
  assert.equal(nutrientCoverage(rows).potassium.knownSubtotal, 5);
  assert.equal(nutrientCoverage(rows).potassium.complete, false);
  assert.equal(nutrientCoverage(rows).phosphorus.total, 0);
});

test('usual unpackaged foods scale canonical base estimates once, including subsequent reuse', async () => {
  for (const raw of [
    { name: 'Synthetic legacy food', method: 'unpackaged', protein: 12.5, potassium: 99, baseEstimate: { protein: 10, potassium: null, phosphorus: 0 }, uncertaintyMargin: 25 },
    { name: 'Synthetic current food', method: 'unpackaged', protein: 10, potassium: null, phosphorus: 0, estimateRangePercent: 25 },
  ]) {
    let entries = [entry(raw, 2)];
    const guide = createFoodGuide({ getContext: () => ({ entries }) });
    const first = await guide.run('usual_foods', {});
    const food = guide.resolve(first.foods[0].source_ref);
    assert.equal(nutritionFor(food).protein, 20);
    assert.equal(food.protein, 20);
    assert.equal(detailedNutritionFor(food).potassium, null);
    assert.equal(detailedNutritionFor(food).phosphorus, 0);
    assert.equal(mealTotalBounds([entry(food)], {}).upper.protein, 25);
    entries = [entry(food, 0.5)];
    const next = await guide.run('usual_foods', {});
    assert.equal(nutritionFor(guide.resolve(next.foods[0].source_ref)).protein, 10);
    assert.equal(raw.protein, raw.baseEstimate ? 12.5 : 10);
  }
});

test('voice rejects mismatched USDA identity and cannot create a source reference afterwards', async () => {
  const candidate = { fdcId: 1, description: 'Synthetic raw food', basis: 'per100g', nutrients: { protein: 10 }, portions: [] };
  const guide = createFoodGuide({ fetcher: async url => ({ ok: true, json: async () => url.includes('fdc-search') ? { foods: [candidate] } : { food: { ...candidate, fdcId: 2 } } }) });
  await guide.run('search_foods', { query: 'synthetic' });
  const inspection = await guide.run('inspect_food', { fdc_id: 1 });
  assert.equal(inspection.status, 'needs_clarification');
  const match = await guide.run('match_food', { fdc_id: 1, grams: 100 });
  assert.equal(match.status, 'needs_clarification');
  assert.equal(match.source_ref, undefined);
});

test('voice search summaries and malformed details cannot bypass inspection', async () => {
  const candidate = { fdcId: 1, description: 'Synthetic food', basis: 'per100g', nutrients: { protein: 10 }, portions: [] };
  let detail = candidate;
  const guide = createFoodGuide({ fetcher: async url => ({ ok: true, json: async () => url.includes('fdc-search') ? { foods: [candidate] } : { food: detail } }) });
  await guide.run('search_foods', { query: 'synthetic' });
  assert.equal((await guide.run('match_food', { fdc_id: 1, grams: 100 })).status, 'needs_clarification');
  await guide.run('inspect_food', { fdc_id: 1 });
  assert.ok((await guide.run('match_food', { fdc_id: 1, grams: 100 })).source_ref);
  await guide.run('search_foods', { query: 'synthetic again' });
  assert.equal((await guide.run('match_food', { fdc_id: 1, grams: 100 })).status, 'needs_clarification');
  detail = { ...candidate, portions: undefined };
  assert.equal((await guide.run('inspect_food', { fdc_id: 1 })).status, 'needs_clarification');
  assert.equal((await guide.run('match_food', { fdc_id: 1, grams: 100 })).source_ref, undefined);
});
