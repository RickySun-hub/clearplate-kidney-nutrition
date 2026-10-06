import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredient, formatIngredient, formatHouseholdIngredient } from './ingredients.js';

test('embedded lemon count scales from the full source recipe', () => {
  const parsed = parseIngredient('Juice from 1 lemon');
  assert.equal(parsed.quantity, 1);
  assert.equal(parsed.unit, 'count');
  assert.equal(parsed.foodText, 'lemon');
  assert.equal(parsed.scalable, true);
  assert.equal(formatIngredient(parsed.original, 0.5), 'Juice from ½ lemon');
  assert.equal(formatIngredient(parsed.original, 12), 'Juice from 12 lemon');
});

test('mixed fractions and ranges preserve calculation precision', () => {
  assert.equal(parseIngredient('2 ½ quarts water').quantity, 2.5);
  assert.equal(parseIngredient('⅓ cup rice').quantity, 1 / 3);
  assert.equal(formatIngredient('⅓ cup rice', 3), '1 cup rice');
  const parsed = parseIngredient('2 - 2 1/2 cups chicken stock');
  assert.equal(parsed.quantity, 2);
  assert.equal(parsed.quantityMax, 2.5);
  assert.equal(parsed.unit, 'cup');
  assert.equal(formatIngredient(parsed.original, 0.5), '1 - 1 ¼ cups chicken stock');
  assert.equal(formatIngredient('2 to 3 tablespoons fresh lime juice', 0.5), '1 to 1 ½ tablespoons fresh lime juice');
});

test('alternate quantities and embedded constituent counts scale together', () => {
  assert.equal(formatIngredient('4 cups cooked orzo (about 1 2/3 cup dried orzo)', 0.5), '2 cups cooked orzo (about ⅚ cup dried orzo)');
  assert.equal(formatIngredient('2/3 cup dry or 1 1/2 cups cooked garbanzo beans', 2), '1 ⅓ cup dry or 3 cups cooked garbanzo beans');
  assert.equal(formatIngredient('15 ounces ricotta cheese Juice and zest of 1 medium lemon', 2), '30 ounces ricotta cheese Juice and zest of 2 medium lemon');
  assert.equal(formatIngredient('6 cups cooked white rice (1 cup mixed in; 5 cups for serving)', 0.5), '3 cups cooked white rice (½ cup mixed in; 2 ½ cups for serving)');
});

test('package sizes, piece sizes and source references are not batch quantities', () => {
  assert.equal(formatIngredient('1 can (8 ounces) water chestnuts', 2), '2 can (8 ounces) water chestnuts');
  assert.equal(formatIngredient('4 4-ounce flat iron steaks (see page 105)', 0.5), '2 4-ounce flat iron steaks (see page 105)');
  assert.equal(formatIngredient('2 large (11 to 12 inches) stalks celery', 2), '4 large (11 to 12 inches) stalks celery');
  assert.equal(formatIngredient('8 cups (2 5-ounce packages) spinach', 0.5), '4 cups (1 5-ounce packages) spinach');
});

test('unmeasured and invalid quantities never become fabricated numeric amounts', () => {
  for (const text of ['Pinch of salt', 'Salt and pepper to taste', 'Vegetable oil cooking spray', 'A pinch or two of sugar']) {
    const parsed = parseIngredient(text);
    assert.equal(parsed.quantity, null);
    assert.equal(parsed.scalable, false);
    assert.ok(parsed.issue);
    assert.equal(formatIngredient(text, 12), text);
  }
  assert.ok(parseIngredient('1 teaspoon hot sauce (or to taste)').issue);
  assert.equal(parseIngredient('1/0 cup rice').quantity, null);
  assert.equal(formatIngredient('1/0 cup rice', 2), '1/0 cup rice');
  assert.equal(formatIngredient('1 cup rice', NaN), '1 cup rice');
  assert.equal(formatIngredient('1 cup rice', -1), '1 cup rice');
});

test('source text and unresolved preparation choices remain visible', () => {
  const original = '2/3 cup dry or 1 1/2 cups cooked garbanzo beans';
  assert.equal(parseIngredient(original).original, original);
  assert.ok(parseIngredient(original).issue);
  assert.equal(formatIngredient(original, 1), '⅔ cup dry or 1 ½ cups cooked garbanzo beans');
  assert.equal(parseIngredient('Dressing:').quantity, null);
  assert.ok(parseIngredient('24 large fresh shrimp (about').issue);
  assert.equal(parseIngredient('100 g carrots').unit, 'g');
  assert.equal(parseIngredient('100 ml milk').unit, 'ml');
});


test('display quantities round to two decimal places without changing parsed precision', () => {
  assert.equal(formatIngredient('1 cup rice', 0.123456), '0.12 cup rice');
  assert.equal(formatIngredient('0.123456 cup rice', 1), '0.12 cup rice');
  assert.equal(parseIngredient('0.123456 cup rice').quantity, 0.123456);
});

test('household display uses volume equivalence without inventing density or pinches', () => {
  assert.equal(formatHouseholdIngredient('1 tablespoon oil', 12), '¾ cup oil');
  assert.equal(formatHouseholdIngredient('1 teaspoon vanilla', 6), '2 tbsp vanilla');
  assert.equal(formatHouseholdIngredient('2 to 4 tablespoons lime juice', 2), '4 to 8 tablespoons lime juice');
  assert.equal(formatHouseholdIngredient('Pinch of salt', 12), 'Pinch of salt');
  assert.equal(formatHouseholdIngredient('100 g flour', 2), '200 g flour');
  assert.equal(formatHouseholdIngredient('1 can (8 ounces) water chestnuts', 2), '2 can (8 ounces) water chestnuts');
});
