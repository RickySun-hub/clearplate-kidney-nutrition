import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIngredientWeight } from './usdaPortions.js';
const food = (portions) => ({ basis: 'per100g', portions });
test('USDA quantity denominator and same-food household volume conversion', () => {
  const basil = food([{ amount: 2, gramWeight: 5.3, description: 'tbsp, chopped', sourcePortionId: 'b' }]);
  assert.equal(resolveIngredientWeight('4 tablespoons chopped basil', basil, { portionId: 'b' }).grams, 10.6);
  assert.equal(resolveIngredientWeight('1 teaspoon chopped basil', basil, { portionId: 'b' }).grams, 5.3 / 6);
});
test('embedded lemon yield scales by count, not whole fruit', () => {
  const juice = food([{ amount: 1, gramWeight: 48, description: 'lemon yields', sourcePortionId: 'l' }]);
  assert.equal(resolveIngredientWeight('Juice from 1 lemon', juice, { portionId: 'l' }).grams, 48);
  assert.equal(resolveIngredientWeight('Juice from 1 lemon', juice).grams, null);
});
test('range preserved; ambiguous preparation, size, packages and pinch unresolved', () => {
  const oil = food([{ amount: 1, gramWeight: 13.5, description: 'tablespoon' }]);
  const range = resolveIngredientWeight('2 to 3 tablespoons olive oil', oil);
  assert.equal(range.grams, 27); assert.equal(range.gramsMax, 40.5);
  for (const text of ['Pinch of salt', '1 can (8 ounces) beans', '1 large garlic clove', '1 cup dry or cooked beans']) {
    assert.equal(resolveIngredientWeight(text, oil).grams, null, text);
  }
  const onion = food([{ amount: 1, gramWeight: 100, description: 'cup, chopped' }, { amount: 1, gramWeight: 80, description: 'cup, sliced' }]);
  assert.equal(resolveIngredientWeight('1 cup onions', onion).grams, null);
  assert.equal(resolveIngredientWeight('1 cup chopped onions', onion).grams, 100);
});
test('mass conversion unrounded; liquid density never assumed', () => {
  assert.equal(resolveIngredientWeight('2 pounds flour', food([])).grams, 907.18474);
  assert.equal(resolveIngredientWeight('100 ml milk', food([])).grams, null);
  assert.equal(resolveIngredientWeight('1 cup oil', { basis: 'per100ml', portions: [] }).grams, null);
});
test('review regressions: chopped is not sliced, extra sprigs not omitted, pint stage unknown', () => {
  const portions = food([{ amount: 1, gramWeight: 90, description: 'cup, sliced' }, { amount: 1, gramWeight: 6, description: 'tablespoon' }]);
  for (const text of ['1 teaspoon pepper, minced', '1 cup apple cut into pieces', '1/4 teaspoon rosemary chopped plus 1 to 2 additional springs', '1 pint strawberries, sliced']) {
    assert.equal(resolveIngredientWeight(text, portions).grams, null, text);
  }
  assert.equal(resolveIngredientWeight('4 4-ounce chicken breasts, skinless', food([])).grams, 453.59237);
  assert.equal(resolveIngredientWeight('2 pork tenderloins (1 pound each), trimmed', food([])).grams, 907.18474);
  assert.equal(resolveIngredientWeight('2 peppers', food([{ amount: 1, gramWeight: 30, description: 'RACC', sourcePortionId: 'r' }]), { portionId: 'r' }).grams, null);
});
