import test from 'node:test';
import assert from 'node:assert/strict';
import * as nutrition from './nutrition.js';
import { NUTRIENTS } from './nutrientCatalog.js';
import { optimizeRemainingDay } from '../optimization/optimizeRemainingDay.js';

const entry = (customFood) => ({ source: 'custom', servings: 1, customFood });

test('mixed known and missing nutrients display the known subtotal and an explicit incomplete label', () => {
  const coverage = nutrition.nutrientCoverage([entry({ sodium: 120, fiber: 2.5 }), entry({ sodium: null, fiber: null })]);
  assert.equal(nutrition.formatNutrientCoverage(coverage.sodium, 'mg'), '120 mg subtotal · incomplete');
  assert.equal(nutrition.formatNutrientCoverage(coverage.fiber, 'g'), '2.5 g subtotal · incomplete');
  assert.equal(coverage.sodium.total, null);
});

test('all missing, an explicit zero, an empty log and a tiny known amount remain distinct', () => {
  const missing = nutrition.nutrientCoverage([entry({ sodium: null }), entry({})]);
  const zero = nutrition.nutrientCoverage([entry({ sodium: 0 })]);
  const partialZero = nutrition.nutrientCoverage([entry({ sodium: 0 }), entry({ sodium: null })]);
  assert.equal(nutrition.formatNutrientCoverage(missing.sodium, 'mg'), 'Unknown');
  assert.equal(nutrition.formatNutrientCoverage(zero.sodium, 'mg'), '0 mg');
  assert.equal(nutrition.formatNutrientCoverage(partialZero.sodium, 'mg'), '0 mg subtotal · incomplete');
  assert.equal(nutrition.formatNutrientCoverage(nutrition.nutrientCoverage([]).sodium, 'mg'), '—');
  assert.equal(nutrition.formatNutrientCoverage(nutrition.nutrientCoverage([entry({ vitaminB12: 0.002 })]).vitaminB12, 'µg', 2), '<0.01 µg');
});

test('a confirmed day cannot turn a partial subtotal below a maximum or inside a range into success', () => {
  const coverage = nutrition.nutrientCoverage([entry({ sodium: 500, protein: 60 }), entry({ sodium: null, protein: null })]);
  const sodium = nutrition.nutrientProgressState({ coverage: coverage.sodium, type: 'sodium', target: 2000, complete: true });
  const protein = nutrition.nutrientProgressState({ coverage: coverage.protein, type: 'protein', range: { min: 56, max: 70 }, complete: true });
  assert.equal(sodium.numericValue, 500);
  assert.equal(sodium.ratio, 25);
  assert.equal(sodium.tone, 'neutral');
  assert.equal(protein.tone, 'neutral');
  assert.match(sodium.status, /incomplete/i);
  assert.match(protein.status, /incomplete/i);
});

test('known subtotal above a maximum still warns, while all missing data has no numeric progress', () => {
  const coverage = nutrition.nutrientCoverage([entry({ sodium: 2100 }), entry({ sodium: null })]);
  const high = nutrition.nutrientProgressState({ coverage: coverage.sodium, type: 'sodium', target: 2000, complete: true });
  assert.equal(high.tone, 'danger');
  assert.match(high.status, /subtotal.*over.*incomplete/i);
  const unknown = nutrition.nutrientProgressState({ coverage: coverage.protein, type: 'protein', range: { min: 56, max: 70 }, complete: true });
  assert.equal(unknown.numericValue, null);
  assert.equal(unknown.ratio, null);
  assert.equal(unknown.tone, 'neutral');
});

test('complete nutrients preserve explicit zero and recording confirmation remains separate from coverage', () => {
  const coverage = nutrition.nutrientCoverage([entry({ sodium: 0 })]);
  assert.equal(nutrition.nutrientProgressState({ coverage: coverage.sodium, type: 'sodium', target: 2000, complete: true }).tone, 'good');
  assert.equal(nutrition.nutrientProgressState({ coverage: coverage.sodium, type: 'sodium', target: 2000, complete: false }).status, 'Recording in progress');
  assert.equal(nutrition.nutrientProgressState({ value: null, type: 'sodium', target: 2000, complete: true }).numericValue, null);
});

test('display subtotals do not become complete optimizer totals', () => {
  const rows = [entry({ calories: 300, sodium: 100, protein: 20 }), entry({ calories: 50, sodium: null, protein: 1 })];
  const totals = nutrition.mealTotals(rows, {});
  assert.equal(nutrition.formatNutrientCoverage(nutrition.nutrientCoverage(rows).sodium, 'mg'), '100 mg subtotal · incomplete');
  assert.equal(totals.sodium, null);
  const result = optimizeRemainingDay({ recipes: [], loggedTotals: totals, targets: { sodiumMax: 2000, proteinMin: 56, proteinMax: 70, potassiumMax: null, phosphorusMax: null } });
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.plans, []);
});

test('the nutrient catalog uses Dietary fiber without changing its stored key', () => {
  assert.equal(NUTRIENTS.find(nutrient => nutrient.key === 'fiber').label, 'Dietary fiber');
});
