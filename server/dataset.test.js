import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import auditHandler from '../api/recipe-audit.js';
const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const recipes = read('../src/data/recipes.json');
const details = read('../src/data/recipeDetails.json');
const audits = read('../src/data/usdaRecipeAudit.json');
const foods = read('../src/data/usdaFoods.json');
test('all source recipes retain ingredient ordering, workbook values and missing sources', () => {
  assert.equal(recipes.length, 94);
  for (const recipe of recipes) {
    const entry = audits[recipe.id];
    assert.deepEqual(entry.ingredients.map((i) => i.original), details[recipe.id]?.ingredients || []);
    assert.equal(entry.workbook.sodium, recipe.sodium);
    assert.equal(entry.audit.yieldServings, details[recipe.id]?.servings ?? null);
    if (!details[recipe.id]) assert.equal(entry.audit.status, 'unavailable');
    for (const row of entry.ingredients) {
      if (row.fdcId) assert.equal(foods[row.fdcId].sourceUrl, row.sourceUrl);
      if (row.grams !== null) assert.ok(Number.isFinite(row.grams) && row.grams >= 0);
    }
  }
});
test('real USDA household denominator and incomplete hummus remain traceable', () => {
  const juice = audits.hummus.ingredients.find((i) => i.original === 'Juice from 1 lemon');
  assert.equal(juice.fdcId, 167747); assert.equal(juice.grams, 48);
  assert.equal(juice.portionId, '81889');
  assert.equal(audits.hummus.audit.perServing.sodium, null);
  assert.ok(audits.hummus.audit.missingByNutrient.sodium > 0);
  assert.ok(foods[167747].nutrientIds.sodium === 1093);
});
test('audit HTTP handler rejects traversal/methods and returns traceable unavailable source', () => {
  const call = (method, query) => {
    const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } };
    auditHandler({ method, query }, res); return res;
  };
  assert.equal(call('POST', { id: 'hummus' }).statusCode, 405);
  assert.equal(call('GET', { id: '../hummus' }).statusCode, 400);
  assert.equal(call('GET', { id: 'missing' }).statusCode, 404);
  assert.equal(call('GET', { id: 'constructor' }).statusCode, 404);
  assert.equal(call('GET', { id: 'hummus' }).data.provenance.live, false);
  assert.equal(call('GET', { id: 'ginger-roasted-chicken-breast' }).data.audit.status, 'unavailable');
});
