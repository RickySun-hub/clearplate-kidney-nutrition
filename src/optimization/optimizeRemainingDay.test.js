import test from "node:test";
import assert from "node:assert/strict";
import { calculateRemainingBudget } from "./remaining.js";
import { optimizeRemainingDay } from "./optimizeRemainingDay.js";

const recipe = (id, nutrition, steps = 3) => ({
  id,
  name: id,
  category: "Entrees",
  calories: nutrition.calories,
  protein: nutrition.protein,
  sodium: nutrition.sodium,
  potassium: nutrition.potassium ?? 100,
  phosphorus: nutrition.phosphorus ?? 50,
  steps,
});

const details = (recipes) => Object.fromEntries(recipes.map((item) => [item.id, { steps: Array.from({ length: item.steps }, (_, index) => `Step ${index + 1}`) }]));
const baseTargets = { sodiumMax: 2000, proteinMin: 56, proteinMax: 70, potassiumMax: null, phosphorusMax: null };

test("missing required targets are not interpreted as zero", () => {
  for (const value of [null, "", " ", false]) {
    const result = optimizeRemainingDay({ recipes: [], targets: { ...baseTargets, proteinMin: value } });
    assert.equal(result.status, "invalid", `target ${JSON.stringify(value)} must be rejected`);
  }
});

test("recipes with missing or negative constrained nutrients are excluded", () => {
  for (const value of [null, "", -10]) {
    const result = optimizeRemainingDay({
      recipes: [recipe("invalid", { calories: 300, protein: 20, sodium: value })],
      targets: baseTargets,
    });
    assert.equal(result.status, "empty", `sodium ${JSON.stringify(value)} must not produce a plan`);
  }
});

test("remaining budget subtracts food already logged today", () => {
  assert.deepEqual(calculateRemainingBudget(
    { calories: 500, protein: 40, sodium: 600, potassium: 0, phosphorus: 0 },
    { ...baseTargets, calorieTarget: 1800 },
  ), {
    calories: 1300,
    sodiumMax: 1400,
    proteinMin: 16,
    proteinMax: 30,
    potassiumMax: null,
    phosphorusMax: null,
  });
});

test("plans use supported servings, unique recipes, and no more than four dishes", () => {
  const recipes = [
    recipe("a", { calories: 300, protein: 12, sodium: 100 }),
    recipe("b", { calories: 250, protein: 10, sodium: 80 }),
    recipe("c", { calories: 200, protein: 8, sodium: 60 }),
    recipe("d", { calories: 180, protein: 7, sodium: 50 }),
    recipe("e", { calories: 160, protein: 6, sodium: 40 }),
  ];
  const result = optimizeRemainingDay({ recipes, detailsById: details(recipes), targets: baseTargets, selectedMeals: ["Lunch", "Dinner"], calorieReference: 900 });
  for (const plan of result.plans) {
    assert.ok(plan.items.length >= 2 && plan.items.length <= 4);
    assert.equal(new Set(plan.items.map((item) => item.recipeId)).size, plan.items.length);
    assert.ok(plan.items.every((item) => [0.5, 1, 1.5, 2].includes(item.servings)));
  }
});

test("an upper-compatible plan may transparently leave a protein gap", () => {
  const recipes = [recipe("low", { calories: 300, protein: 5, sodium: 40 })];
  const result = optimizeRemainingDay({ recipes, detailsById: details(recipes), targets: baseTargets, selectedMeals: ["Dinner"], calorieReference: 400 });
  assert.equal(result.status, "compatible");
  assert.equal(result.plans[0].withinUpperLimits, true);
  assert.ok(result.plans[0].proteinGap > 0);
  assert.match(result.plans[0].reason, /remains to reach/);
});

test("when every nonzero option exceeds an upper limit, plans are labeled over-limit", () => {
  const recipes = [recipe("only", { calories: 200, protein: 4, sodium: 10 })];
  const result = optimizeRemainingDay({
    recipes,
    detailsById: details(recipes),
    loggedTotals: { calories: 1000, protein: 70, sodium: 1999, potassium: 0, phosphorus: 0 },
    targets: baseTargets,
    selectedMeals: ["Snack"],
  });
  assert.equal(result.status, "over-limit");
  assert.equal(result.plans[0].withinUpperLimits, false);
  assert.ok(result.plans[0].violations.some((item) => item.nutrient === "protein"));
});

test("closest fallback minimizes upper-limit overage before trying to close the protein gap", () => {
  const recipes = [
    recipe("lower-overage", { calories: 100, protein: 1, sodium: 6 }),
    recipe("higher-protein", { calories: 100, protein: 20, sodium: 40 }),
  ];
  const result = optimizeRemainingDay({
    recipes,
    detailsById: details(recipes),
    loggedTotals: { protein: 0, sodium: 9 },
    targets: { sodiumMax: 10, proteinMin: 20, proteinMax: 60 },
    selectedMeals: ["Dinner"],
    calorieReference: 100,
    maxRecipes: 1,
  });

  assert.equal(result.status, "over-limit");
  assert.equal(result.plans[0].items[0].recipeId, "lower-overage");
  assert.equal(result.plans[0].violations[0].unit, "mg");
});

test("invalid care-team targets fail closed", () => {
  const recipes = [recipe("valid", { calories: 200, protein: 10, sodium: 20 })];
  const result = optimizeRemainingDay({
    recipes,
    targets: { sodiumMax: 2000, proteinMin: 80, proteinMax: 60 },
    selectedMeals: ["Lunch"],
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.plans.length, 0);
});

test("optional potassium limits are ignored until explicitly provided", () => {
  const recipes = [
    recipe("high-k", { calories: 400, protein: 20, sodium: 50, potassium: 900 }),
    recipe("low-k", { calories: 350, protein: 18, sodium: 70, potassium: 100 }),
  ];
  const withoutLimit = optimizeRemainingDay({ recipes, detailsById: details(recipes), targets: baseTargets, selectedMeals: ["Dinner"] });
  assert.ok(withoutLimit.plans.some((plan) => plan.items.some((item) => item.recipeId === "high-k")));

  const withLimit = optimizeRemainingDay({ recipes, detailsById: details(recipes), targets: { ...baseTargets, potassiumMax: 200 }, selectedMeals: ["Dinner"] });
  assert.ok(withLimit.plans.every((plan) => plan.totals.potassium <= 200));
});

test("an enabled optional limit rejects a log with unknown intake", () => {
  const recipes = [recipe("known", { calories: 400, protein: 20, sodium: 50, potassium: 100 })];
  const result = optimizeRemainingDay({
    recipes,
    loggedTotals: {
      calories: 300,
      protein: 15,
      sodium: 200,
      potassium: null,
      phosphorus: null,
      lower: { protein: 15, potassium: null },
      upper: { protein: 15, sodium: 200, potassium: null },
    },
    targets: { ...baseTargets, potassiumMax: 2000 },
    selectedMeals: ["Dinner"],
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.plans.length, 0);
  assert.match(result.message, /potassium.*unknown/i);
});

test("lowest-sodium does not exceed the balanced plan sodium and results are deterministic", () => {
  const recipes = [
    recipe("a", { calories: 500, protein: 25, sodium: 300 }, 5),
    recipe("b", { calories: 450, protein: 22, sodium: 120 }, 2),
    recipe("c", { calories: 350, protein: 18, sodium: 60 }, 4),
    recipe("d", { calories: 300, protein: 15, sodium: 40 }, 3),
  ];
  const input = { recipes, detailsById: details(recipes), targets: baseTargets, selectedMeals: ["Lunch", "Dinner"], calorieReference: 900 };
  const first = optimizeRemainingDay(input);
  const second = optimizeRemainingDay(input);
  const balanced = first.plans.find((plan) => plan.objective === "balanced");
  const lowest = first.plans.find((plan) => plan.objective === "lowest-sodium");
  assert.ok(lowest.totals.sodium <= balanced.totals.sodium);
  assert.deepEqual(first.plans.map((plan) => plan.signature), second.plans.map((plan) => plan.signature));
});

test("unknown required logged intake or explicit bounds cannot produce compatible plans", () => {
  for (const loggedTotals of [
    { sodium: null, protein: 20 },
    { sodium: 200, protein: null },
    { sodium: '', protein: 20 },
    { sodium: 200, protein: 20, upper: { sodium: null } },
    { sodium: 200, protein: 20, lower: { protein: null } },
    { sodium: 200, protein: 20, upper: { protein: null } },
  ]) {
    const result = optimizeRemainingDay({
      recipes: [recipe('known', { calories: 300, protein: 20, sodium: 100 })],
      targets: baseTargets,
      loggedTotals,
    });
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.plans, []);
    assert.match(result.message, /unknown/);
  }
});
