import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalculationService, getCalculationService, readCalculationBody } from './calculation.js';
const input = () => ({ recipes: [{ id: 'example' }, { id: 'only-nutrition' }],
  details: { example: { servings: 2, ingredients: ['100 g rice', 'Pinch salt'], source: { title: 'Source' } } },
  audits: { example: { ingredients: [{ original: '100 g rice', grams: 100, fdcId: 123 }, { original: 'Pinch salt', grams: null, fdcId: null }] } },
  foods: { 123: { fdcId: 123, description: 'Rice', basis: 'per100g', sourceUrl: 'https://fdc.nal.usda.gov/food-details/123/nutrients', nutrients: { calories: 200, protein: 4 } } } });

test('calculates overrides against original yield and scales cooking batch without persisting', () => {
  const data = input();
  const before = JSON.stringify(data);
  const service = createCalculationService(data);
  const result = service.calculate({ recipeId: 'example', cookingServings: 12, overrides: [{ index: 1, grams: 50, fdcId: 123 }] });
  assert.equal(result.audit.perServing.calories, 150);
  assert.equal(result.audit.yieldServings, 2);
  assert.equal(result.batchForCooking.calories, 1800);
  assert.equal(result.ingredients[1].original, 'Pinch salt');
  assert.equal(result.ingredients[1].grams, 50);
  assert.equal(result.ingredients[1].sourceUrl, data.foods[123].sourceUrl);
  assert.equal(result.reviewStatus, 'needs-review');
  assert.equal(JSON.stringify(data), before);
  const next = service.calculate({ recipeId: 'example', cookingServings: 0.5 });
  assert.equal(next.audit.perServing.calories, null);
  assert.equal(next.audit.missingByNutrient.calories, 1);
});

test('rejects unsupported recipe, missing source, duplicates, invalid indices and weights', () => {
  const data = input();
  const service = createCalculationService(data);
  for (const body of [null, {}, { recipeId: 'example', cookingServings: 0 }, { recipeId: 'example', cookingServings: '1' },
    { recipeId: 'example', cookingServings: 101 }, { recipeId: 'example', cookingServings: 1, overrides: [{ index: 3, grams: 10 }] },
    { recipeId: 'example', cookingServings: 1, overrides: [{ index: 0, grams: -1 }] },
    { recipeId: 'example', cookingServings: 1, overrides: [{ index: 0, grams: Infinity }] },
    { recipeId: 'example', cookingServings: 1, overrides: [{ index: 0, grams: 1 }, { index: 0, grams: 2 }] }]) {
    assert.throws(() => service.calculate(body), { status: 400 });
  }
  assert.throws(() => service.calculate({ recipeId: 'unknown', cookingServings: 1 }), { status: 404 });
  assert.throws(() => service.calculate({ recipeId: 'example', cookingServings: 1, overrides: [{ index: 0, grams: 1, fdcId: 999 }] }), { status: 404 });
  assert.throws(() => service.calculate({ recipeId: 'only-nutrition', cookingServings: 1 }), { status: 422 });
  data.details.example.source = null;
  assert.throws(() => service.calculate({ recipeId: 'example', cookingServings: 1 }), { status: 422 });
});

test('headings retain source indices but are excluded from nutrient audit; zero grams is valid', () => {
  const data = input();
  data.details.example.ingredients.unshift('Dressing:');
  data.audits.example.ingredients.unshift({ original: 'Dressing:', kind: 'heading', grams: null });
  const result = createCalculationService(data).calculate({ recipeId: 'example', cookingServings: 1, overrides: [{ index: 2, grams: 0, fdcId: 123 }] });
  assert.equal(result.ingredients.length, 3);
  assert.equal(result.ingredients[0].original, 'Dressing:');
  assert.equal(result.ingredients[2].resolvedWeight, true);
  assert.equal(result.ingredients[2].weightNote, 'User supplied original-batch grams; unreviewed');
  assert.equal(result.audit.ingredientCount, 2);
  assert.equal(result.audit.perServing.calories, 100);
});

test('POST reader bounds both parsed and streamed payloads and rejects malformed JSON', async () => {
  assert.deepEqual(await readCalculationBody({ body: { recipeId: 'example' } }), { recipeId: 'example' });
  await assert.rejects(readCalculationBody({ body: 'x'.repeat(20481) }), { status: 413 });
  await assert.rejects(readCalculationBody({ body: '{bad' }), { status: 400 });
  const stream = async function* () { yield Buffer.from('x'.repeat(20481)); };
  await assert.rejects(readCalculationBody({ headers: {}, [Symbol.asyncIterator]: stream }), { status: 413 });
});

test('bundled recipes calculate without overwriting source audit missing values', () => {
  const service = getCalculationService();
  const result = service.calculate({ recipeId: 'mango-salsa-wontons', cookingServings: 12 });
  assert.equal(result.audit.yieldServings, 24);
  assert.equal(result.audit.status, 'partial');
  assert.equal(result.batchForCooking.calories, null);
});
