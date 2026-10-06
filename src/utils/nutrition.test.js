import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAmount,
  mealTotalBounds,
  mealTotals,
  nutritionFor,
  parseNutrientValues,
} from "./nutrition.js";

test("required custom nutrients reject blanks while explicit zero remains valid", () => {
  assert.equal(parseNutrientValues({ calories: "", protein: "0", sodium: "0", potassium: "", phosphorus: "" }), null);
  assert.equal(parseNutrientValues({ calories: "   ", protein: "0", sodium: "0", potassium: "", phosphorus: "" }), null);
  assert.deepEqual(parseNutrientValues({ calories: "0", protein: "0", sodium: "0", potassium: "", phosphorus: "" }), {
    calories: 0,
    protein: 0,
    sodium: 0,
    potassium: null,
    phosphorus: null,
  });
});

test("custom nutrient parsing rejects negative and nonnumeric values", () => {
  assert.equal(parseNutrientValues({ calories: "1", protein: "-1", sodium: "2" }), null);
  assert.equal(parseNutrientValues({ calories: "1", protein: "2", sodium: "invalid" }), null);
  assert.equal(parseNutrientValues({ calories: "1", protein: "2", sodium: "3", potassium: "invalid" }), null);
});

test("optional unknown nutrients stay unknown when scaled, totaled, and formatted", () => {
  const customFood = {
    calories: 120,
    protein: 5,
    sodium: 75,
    potassium: null,
    phosphorus: null,
  };
  assert.deepEqual(nutritionFor(customFood, 2), {
    calories: 240,
    protein: 10,
    sodium: 150,
    potassium: null,
    phosphorus: null,
  });
  assert.equal(formatAmount(null), "Unknown");
  assert.equal(formatAmount(0), "0");

  const entries = [{ source: "custom", servings: 2, customFood }];
  assert.deepEqual(mealTotals(entries, {}), {
    calories: 240,
    protein: 10,
    sodium: 150,
    potassium: null,
    phosphorus: null,
  });
  assert.deepEqual(mealTotalBounds(entries, {}), {
    lower: { calories: 240, protein: 10, sodium: 150, potassium: null, phosphorus: null },
    upper: { calories: 240, protein: 10, sodium: 150, potassium: null, phosphorus: null },
    estimatedCount: 0,
  });
});

test("one unknown nutrient makes a mixed meal total unknown", () => {
  const entries = [
    { source: "custom", servings: 1, customFood: { calories: 10, protein: 1, sodium: 2, potassium: 5, phosphorus: 6 } },
    { source: "custom", servings: 1, customFood: { calories: 20, protein: 2, sodium: 3, potassium: null, phosphorus: 7 } },
  ];
  assert.equal(mealTotals(entries, {}).potassium, null);
  assert.equal(mealTotals(entries, {}).phosphorus, 13);
});

test('expanded nutrient coverage preserves unknowns and unresolved items', async () => {
  const { detailedNutritionFor, nutrientCoverage } = await import('./nutrition.js');
  assert.equal(detailedNutritionFor({ carbs: 12, vitaminD: null }, 2).carbs, 24);
  assert.equal(detailedNutritionFor({ carbs: 12, vitaminD: null }, 2).vitaminD, null);
  assert.equal(detailedNutritionFor({ carbs: false }, 1).carbs, null);
  const rows = [{ source: 'custom', servings: 1, customFood: { carbs: 10, iron: 0 } }, { recipeId: 'missing', servings: 1 }];
  const result = nutrientCoverage(rows, {});
  assert.deepEqual(result.carbs, { knownSubtotal: 10, knownCount: 1, itemCount: 2, total: null, complete: false });
  assert.equal(result.iron.knownCount, 1);
  assert.equal(nutrientCoverage([], {}).calories.total, null);
});

test('unresolved recorded recipes make legacy totals and bounds unknown', () => {
  const entries = [{ recipeId: 'missing', servings: 1 }];
  assert.equal(mealTotals(entries, {}).calories, null);
  assert.equal(mealTotalBounds(entries, {}).lower.calories, null);
});
test('USDA estimates count as estimates without inventing a percentage interval', () => {
  const food = { method: 'usda-estimate', calories: 40, protein: 1, sodium: 2, potassium: 3, phosphorus: 4 };
  const result = mealTotalBounds([{ source: 'custom', servings: 1, customFood: food }], {});
  assert.equal(result.estimatedCount, 1);
  assert.equal(result.lower.calories, 40);
  assert.equal(result.upper.calories, 40);
});

test('missing or invalid estimate ranges remain unknown rather than zero uncertainty', () => {
  for (const margin of [undefined, '', 'bad', -5, 101]) {
    const food = { method: 'unpackaged', calories: 50, protein: 5, sodium: 10, estimateRangePercent: margin };
    const result = mealTotalBounds([{ source: 'custom', servings: 1, customFood: food }], {});
    assert.equal(result.lower.protein, null);
    assert.equal(result.upper.sodium, null);
    assert.equal(nutritionFor(food).protein, 5);
  }
  assert.equal(nutritionFor(undefined).calories, null);
});
