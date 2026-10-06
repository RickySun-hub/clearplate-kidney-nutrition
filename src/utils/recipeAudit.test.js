import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecipeAudit, scaleAudit, gramsForQuantity } from './recipeAudit.js';

const food = { fdcId: 1, basis: 'per100g', nutrients: { calories: 200, protein: 10, sodium: 50, potassium: 300, phosphorus: 100, carbs: 20, fat: 5, fiber: 2, calcium: 40 } };
test('USDA grams calculate batch and per-serving independently', () => {
  const audit = calculateRecipeAudit({ id: 'fixture', servings: 4 }, [{ grams: 200, gramsMax: 200, fdcId: 1 }], { 1: food });
  assert.equal(audit.batch.sodium, 100);
  assert.equal(audit.perServing.sodium, 25);
  assert.equal(audit.perServing.calories, 100);
  assert.equal(scaleAudit(audit, 12).sodium, 300);
});
test('missing ingredient weight cannot masquerade as complete zero', () => {
  const audit = calculateRecipeAudit({ servings: 2 }, [{ grams: 100, fdcId: 1 }, { grams: null, fdcId: 1 }], { 1: food });
  assert.equal(audit.perServing.sodium, null);
  assert.equal(audit.knownPerServing.sodium, 25);
  assert.equal(audit.missingByNutrient.sodium, 1);
  assert.equal(audit.status, 'partial');
});
test('missing phosphorus preserves complete sodium but not phosphorus', () => {
  const audit = calculateRecipeAudit({ servings: 1 }, [{ grams: 50, fdcId: 1 }], { 1: { ...food, nutrients: { ...food.nutrients, phosphorus: null } } });
  assert.equal(audit.perServing.sodium, 25);
  assert.equal(audit.perServing.phosphorus, null);
});
test('quantity range yields a range, never a silently chosen point', () => {
  const audit = calculateRecipeAudit({ servings: 2 }, [{ grams: 100, gramsMax: 200, fdcId: 1 }], { 1: food });
  assert.equal(audit.perServing.sodium, null);
  assert.deepEqual(audit.perServingBounds.sodium, { min: 25, max: 50 });
  assert.equal(audit.status, 'range');
});
test('no ingredients and milliliter basis stay uncalculable', () => {
  assert.equal(calculateRecipeAudit({ servings: 1 }, [], {}).status, 'unavailable');
  const audit = calculateRecipeAudit({ servings: 1 }, [{ grams: 100, fdcId: 1 }], { 1: { ...food, basis: 'per100ml' } });
  assert.equal(audit.perServing.calories, null);
});
test('weight units are exact and household conversions are food-specific', () => {
  assert.equal(gramsForQuantity(1, 'lb', []), 453.59237);
  assert.equal(gramsForQuantity(2, 'tbsp', [{ unit: 'tbsp', amount: 1, gramWeight: 14 }]), 28);
  assert.equal(gramsForQuantity(1, 'cup', []), null);
  assert.equal(gramsForQuantity(1, 'ml', []), null);
  assert.equal(gramsForQuantity(null, 'g', []), null);
});
test('invalid recipe yield and negative quantities do not produce nutrition', () => {
  assert.equal(gramsForQuantity(-1, 'g', []), null);
  assert.equal(calculateRecipeAudit({ servings: 0 }, [{ grams: 100, fdcId: 1 }], { 1: food }).status, 'unavailable');
});
