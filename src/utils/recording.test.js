import test from "node:test";
import assert from "node:assert/strict";
import { nutritionFor, mealTotalBounds } from "./nutrition.js";
import { daySignature, isDayComplete } from "./recording.js";
import { calculateRemainingBudget } from "../optimization/remaining.js";
import { readFileSync } from 'node:fs';
import { recipeRecordingBase, customizeRecipe } from './recipeRecording.js';
import { validateCareRecord } from './careCloud.js';

test("legacy outside-food margins do not inflate recorded point estimates", () => {
  const food = { method: "unpackaged", protein: 50, sodium: 125, baseEstimate: { protein: 40, sodium: 100, calories: 300 } };
  assert.equal(nutritionFor(food).protein, 40);
  assert.equal(nutritionFor(food, 2).sodium, 200);
});

test("planning uses lower intake for protein adequacy and upper intake for ceilings", () => {
  const result = calculateRemainingBudget({ protein: 40, sodium: 100, lower: { protein: 30 }, upper: { protein: 50, sodium: 125 } }, { sodiumMax: 2000, proteinMin: 50, proteinMax: 70 });
  assert.equal(result.proteinMin, 20);
  assert.equal(result.proteinMax, 20);
  assert.equal(result.sodiumMax, 1875);
});

test("estimate ranges scale with servings and do not change labeled foods", () => {
  const entries = [
    { source: "custom", servings: 2, customFood: { method: "unpackaged", protein: 40, sodium: 100, calories: 300, estimateRangePercent: 25 } },
    { source: "recipe", recipeId: "r", servings: 1 },
  ];
  const bounds = mealTotalBounds(entries, { r: { protein: 10, sodium: 20, calories: 100 } });
  assert.equal(bounds.lower.protein, 70);
  assert.equal(bounds.upper.protein, 110);
  assert.equal(bounds.lower.sodium, 170);
  assert.equal(bounds.upper.sodium, 270);
  assert.equal(bounds.estimatedCount, 1);
});

test("day confirmation survives reload but invalidates after a meal edit", () => {
  const date = "2026-09-06";
  const entries = [{ id: "1", date, servings: 1 }];
  const records = { [date]: { completedAt: "2026-09-06T20:00:00Z", signature: daySignature(entries, date) } };
  assert.equal(isDayComplete(JSON.parse(JSON.stringify(records)), entries, date), true);
  assert.equal(isDayComplete(records, [{ ...entries[0], servings: 2 }], date), false);
  assert.equal(isDayComplete(records, [], date), false);
  assert.equal(isDayComplete(records, [...entries, { id: "other", date: "2026-09-05" }], date), true);
});

test('compact confirmation detects time, meal, ingredient and ordering changes while preserving legacy confirmations', () => {
  const date = '2026-10-20';
  const entries = [{ id: 'first', date, time: '12:30', meal: 'Lunch', servings: 0.8, customFood: { recipeCustomization: { overrides: { 0: { amount: 80, unit: 'g' } } } } }, { id: 'second', date, servings: 1 }];
  const signature = daySignature(entries, date);
  const record = { [date]: { completedAt: date + 'T20:00:00Z', signature } };
  assert.match(signature, /^v2:\d+:[0-9a-f]{32}$/);
  assert.ok(signature.length < 60);
  assert.equal(isDayComplete(record, JSON.parse(JSON.stringify(entries)), date), true);
  const legacy = { [date]: { ...record[date], signature: JSON.stringify(entries) } };
  assert.equal(isDayComplete(legacy, entries, date), true);
  for (const patch of [{ time: '12:31' }, { meal: 'Brunch' }, { servings: 0.9 }, { customFood: { recipeCustomization: { overrides: { 0: { amount: 79, unit: 'g' } } } } }]) {
    const edited = [{ ...entries[0], ...patch }, entries[1]];
    assert.equal(isDayComplete(record, edited, date), false);
    assert.equal(isDayComplete(legacy, edited, date), false);
  }
  assert.equal(isDayComplete(record, [...entries].reverse(), date), false);
  assert.equal(isDayComplete(record, entries.slice(1), date), false);
  assert.equal(isDayComplete({ [date]: { completedAt: date, signature: null } }, entries, date), false);
});

test('three saved customized recipes can confirm a day without exceeding signature validation limits', () => {
  const data = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
  const recipes = data('recipes'), details = data('recipeDetails'), audits = data('usdaRecipeAudit'), foods = data('usdaFoods');
  const date = '2026-10-20';
  const entries = recipes.slice(0, 3).map((recipe, index) => {
    const base = recipeRecordingBase(recipe, details[recipe.id], audits[recipe.id], foods);
    const changedIndex = base.recipeCustomization.ingredients.findIndex(row => row.grams > 0);
    const customFood = customizeRecipe(base, { [changedIndex]: { amount: base.recipeCustomization.ingredients[changedIndex].grams * 0.8, unit: 'g' } });
    return { id: `fictional-${index}`, date, meal: 'Lunch', time: '12:30', timeSource: 'user-recorded', source: 'custom', recipeId: recipe.id, servings: 0.8, customFood };
  });
  assert.ok(JSON.stringify(entries).length > 10000, 'real ingredient snapshots exceed the old signature limit');
  const dayRecords = { [date]: { completedAt: date + 'T20:00:00Z', signature: daySignature(entries, date) } };
  const saved = validateCareRecord({ profile: { name: 'Fictional' }, entries, dayRecords });
  assert.equal(isDayComplete(saved.dayRecords, saved.entries, date), true);
  assert.ok(saved.dayRecords[date].signature.length < 60);
  const edited = saved.entries.map((entry, index) => index ? entry : { ...entry, time: '12:31' });
  assert.equal(isDayComplete(saved.dayRecords, edited, date), false);
});
