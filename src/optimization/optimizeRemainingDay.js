import { addNutrition, calculateRemainingBudget, emptyNutrition, remainingAfterPlan, scaleNutrition } from "./remaining.js";

export const servingOptions = [0.5, 1, 1.5, 2];
export const mealOptions = ["Breakfast", "Lunch", "Dinner", "Snack"];

const excludedCategories = new Set(["Desserts", "Spices & Rubs", "sauce", "Other"]);
const upperLimitKeys = [
  ["sodium", "sodiumMax"],
  ["protein", "proteinMax"],
  ["potassium", "potassiumMax"],
  ["phosphorus", "phosphorusMax"],
];
const nutrientUnits = { sodium: "mg", protein: "g", potassium: "mg", phosphorus: "mg" };
const overageScales = { sodium: 100, protein: 5, potassium: 100, phosphorus: 100 };
const isNonnegativeNumber = (value) => (typeof value === "number"
  || (typeof value === "string" && value.trim() !== ""))
  && Number.isFinite(Number(value)) && Number(value) >= 0;

const compareText = (left, right) => left.localeCompare(right, "en", { sensitivity: "base" });
const ratio = (value, maximum) => (maximum > 0 ? value / maximum : value > 0 ? Number.POSITIVE_INFINITY : 0);
const stateSignature = (state) => {
  if (!state.signature) state.signature = state.items.map((item) => `${item.recipeId}:${item.servings}`).join("|");
  return state.signature;
};

function isValidRecipe(recipe, optionalLimits) {
  const required = ["calories", "protein", "sodium"];
  if (optionalLimits.potassiumMax !== null) required.push("potassium");
  if (optionalLimits.phosphorusMax !== null) required.push("phosphorus");
  return required.every((key) => isNonnegativeNumber(recipe[key]))
    && Number(recipe.calories) > 0
    && !excludedCategories.has(recipe.category);
}

function preparationSteps(recipeId, detailsById) {
  const count = detailsById?.[recipeId]?.steps?.length;
  return Number.isFinite(count) && count > 0 ? count : null;
}

function buildCandidateRecipes(recipes, remaining, calorieReference, detailsById, maximum = 48) {
  const optionalLimits = {
    potassiumMax: remaining.potassiumMax,
    phosphorusMax: remaining.phosphorusMax,
  };
  const requirePreparationDetails = Object.keys(detailsById || {}).length > 0;
  const usable = recipes
    .filter((recipe) => isValidRecipe(recipe, optionalLimits) && (!requirePreparationDetails || detailsById[recipe.id]?.steps?.length))
    .map((recipe) => ({ ...recipe, stepCount: preparationSteps(recipe.id, detailsById) }));

  const perDishCalories = Math.max(100, calorieReference / 2);
  const rankings = [
    (left, right) => left.sodium - right.sodium || compareText(left.name, right.name),
    (left, right) => (right.protein / (right.sodium + 25)) - (left.protein / (left.sodium + 25)) || compareText(left.name, right.name),
    (left, right) => right.protein - left.protein || left.sodium - right.sodium || compareText(left.name, right.name),
    (left, right) => Math.abs(left.calories - perDishCalories) - Math.abs(right.calories - perDishCalories) || compareText(left.name, right.name),
    (left, right) => (left.stepCount ?? 999) - (right.stepCount ?? 999) || left.sodium - right.sodium || compareText(left.name, right.name),
  ];

  const selected = new Map();
  const perRanking = Math.max(10, Math.ceil(maximum / rankings.length) + 3);
  for (const ranking of rankings) {
    for (const recipe of [...usable].sort(ranking).slice(0, perRanking)) selected.set(recipe.id, recipe);
  }

  return [...selected.values()]
    .sort((left, right) => compareText(left.name, right.name))
    .slice(0, maximum)
    .map((recipe, index) => ({ ...recipe, candidateIndex: index }));
}

function upperLimitViolations(totals, remaining) {
  return upperLimitKeys.flatMap(([nutrient, limitKey]) => {
    const maximum = remaining[limitKey];
    if (maximum === null || totals[nutrient] <= maximum) return [];
    return [{ nutrient, unit: nutrientUnits[nutrient], amount: Math.round((totals[nutrient] - maximum) * 10) / 10 }];
  });
}

function metricsFor(state, context) {
  if (state.metrics) return state.metrics;
  const proteinGap = Math.max(0, context.remaining.proteinMin - state.totals.protein);
  const calorieGap = Math.max(0, context.calorieFloor - state.totals.calories);
  const calorieDistance = Math.abs(state.totals.calories - context.calorieReference) / Math.max(1, context.calorieReference);
  const sodiumUse = ratio(state.totals.sodium, Math.max(0, context.remaining.sodiumMax));
  const violations = upperLimitViolations(state.totals, context.remaining);
  const violationScore = violations.reduce((total, item) => {
    const maximum = context.remaining[`${item.nutrient}Max`];
    const scale = maximum > 0 ? maximum : overageScales[item.nutrient];
    return total + item.amount / scale;
  }, 0);
  const knownSteps = state.items.reduce((total, item) => total + (item.stepCount ?? 30), 0);
  const unknownPreparation = state.items.filter((item) => item.stepCount === null).length;
  state.metrics = { proteinGap, calorieGap, calorieDistance, sodiumUse, violations, violationScore, knownSteps, unknownPreparation };
  return state.metrics;
}

function compareBalanced(left, right, context) {
  const a = metricsFor(left, context);
  const b = metricsFor(right, context);
  return a.violations.length - b.violations.length
    || a.violationScore - b.violationScore
    || a.proteinGap - b.proteinGap
    || a.calorieDistance - b.calorieDistance
    || a.sodiumUse - b.sodiumUse
    || compareText(stateSignature(left), stateSignature(right));
}

function compareLowestSodium(left, right, context) {
  const a = metricsFor(left, context);
  const b = metricsFor(right, context);
  return a.violations.length - b.violations.length
    || a.violationScore - b.violationScore
    || a.proteinGap - b.proteinGap
    || a.calorieGap - b.calorieGap
    || left.totals.sodium - right.totals.sodium
    || compareText(stateSignature(left), stateSignature(right));
}

function compareSimplest(left, right, context) {
  const a = metricsFor(left, context);
  const b = metricsFor(right, context);
  return a.violations.length - b.violations.length
    || a.violationScore - b.violationScore
    || a.proteinGap - b.proteinGap
    || a.calorieGap - b.calorieGap
    || a.unknownPreparation - b.unknownPreparation
    || a.knownSteps - b.knownSteps
    || left.totals.sodium - right.totals.sodium
    || compareText(stateSignature(left), stateSignature(right));
}

function selectBeam(states, context, width = 600) {
  if (states.length <= width) return states;
  const perObjective = Math.floor(width / 3);
  const selected = new Map();
  const comparators = [compareBalanced, compareLowestSodium, compareSimplest];
  for (const comparator of comparators) {
    for (const state of [...states].sort((left, right) => comparator(left, right, context)).slice(0, perObjective)) {
      selected.set(stateSignature(state), state);
    }
  }
  return [...selected.values()];
}

function searchStates(candidates, context, minimumItems, maximumItems, allowOverLimit) {
  let frontier = [{ items: [], totals: emptyNutrition(), lastIndex: -1 }];
  const finalStates = [];
  let evaluatedStates = 0;

  for (let depth = 1; depth <= maximumItems; depth += 1) {
    const expanded = [];
    for (const state of frontier) {
      for (let index = state.lastIndex + 1; index < candidates.length; index += 1) {
        const recipe = candidates[index];
        for (const servings of servingOptions) {
          const nutrition = scaleNutrition(recipe, servings);
          const totals = addNutrition(state.totals, nutrition);
          evaluatedStates += 1;
          if (!allowOverLimit && upperLimitViolations(totals, context.remaining).length) continue;
          expanded.push({
            items: [...state.items, { recipeId: recipe.id, servings, stepCount: recipe.stepCount, nutrition }],
            totals,
            lastIndex: index,
          });
        }
      }
    }
    frontier = selectBeam(expanded, context);
    if (depth >= minimumItems) finalStates.push(...frontier);
    if (!frontier.length) break;
  }

  return { states: finalStates, evaluatedStates };
}

function reasonFor(objective, plan, metrics) {
  const gapText = metrics.proteinGap > 0 ? ` ${metrics.proteinGap} g protein remains to reach today’s range.` : " Protein reaches today’s range.";
  if (metrics.violations.length) {
    return `Closest available option; it exceeds ${metrics.violations.map((item) => `${item.nutrient} by ${item.amount} ${item.unit}`).join(" and ")}.`;
  }
  if (objective === "lowest-sodium") return `Lowest-sodium option among the strongest nutrition-compatible candidates.${gapText}`;
  if (objective === "simplest") return `Uses the fewest known preparation steps among strong candidates.${gapText}`;
  return `Balances the protein gap, calorie reference, and sodium use.${gapText}`;
}

function createPlan(objective, state, context, selectedMeals, recipesById) {
  const metrics = metricsFor(state, context);
  const items = state.items.map((item, index) => ({
    ...item,
    meal: selectedMeals[index % selectedMeals.length],
    recipe: recipesById[item.recipeId],
  }));
  return {
    id: objective,
    objective,
    items,
    totals: state.totals,
    remainingAfter: remainingAfterPlan(context.remaining, state.totals),
    withinUpperLimits: metrics.violations.length === 0,
    proteinGap: metrics.proteinGap,
    violations: metrics.violations,
    reason: reasonFor(objective, state, metrics),
    signature: stateSignature(state),
  };
}

function pickPlan(states, comparator, context, usedSignatures) {
  const ranked = [...states].sort((left, right) => comparator(left, right, context));
  return ranked.find((state) => !usedSignatures.has(stateSignature(state))) || ranked[0] || null;
}

export function optimizeRemainingDay({
  recipes,
  detailsById = {},
  loggedTotals = emptyNutrition(),
  targets,
  selectedMeals = ["Lunch"],
  calorieReference = 600,
  maxRecipes = 4,
}) {
  const meals = mealOptions.filter((meal) => selectedMeals.includes(meal));
  if (!meals.length) return { status: "invalid", message: "Choose at least one meal to plan.", plans: [] };
  const requiredTargets = [targets?.sodiumMax, targets?.proteinMin, targets?.proteinMax];
  if (requiredTargets.some((value) => !isNonnegativeNumber(value)) || Number(requiredTargets[1]) > Number(requiredTargets[2])) {
    return { status: "invalid", message: "Review the sodium and protein targets saved in your profile.", plans: [] };
  }

  const unknownRequired = [['sodium', 'upper'], ['protein', 'lower'], ['protein', 'upper']]
    .find(([nutrient, bound]) => {
      const values = loggedTotals?.[bound];
      const value = values && Object.hasOwn(values, nutrient) ? values[nutrient] : loggedTotals?.[nutrient];
      return !isNonnegativeNumber(value);
    });
  if (unknownRequired) {
    return { status: 'invalid', message: `The logged ${unknownRequired[0]} amount is unknown, so remaining targets cannot be checked.`, plans: [] };
  }

  const remaining = calculateRemainingBudget(loggedTotals, targets);
  const unknownOptional = [
    ["potassium", "potassiumMax"],
    ["phosphorus", "phosphorusMax"],
  ].find(([, limitKey]) => targets?.[limitKey] !== null
    && targets?.[limitKey] !== undefined
    && String(targets[limitKey]).trim() !== ""
    && remaining[limitKey] === null);
  if (unknownOptional) {
    return {
      status: "invalid",
      message: `The logged ${unknownOptional[0]} amount is unknown, so this enabled upper limit cannot be checked.`,
      plans: [],
    };
  }
  const context = {
    remaining,
    calorieReference: Math.max(100, Number(calorieReference) || 600),
    calorieFloor: Math.max(100 * meals.length, (Number(calorieReference) || 600) * 0.6),
  };
  const candidates = buildCandidateRecipes(recipes, remaining, context.calorieReference, detailsById, 40);
  const minimumItems = Math.min(meals.length, maxRecipes);
  const maximumItems = Math.max(minimumItems, Math.min(maxRecipes, 4));
  let search = searchStates(candidates, context, minimumItems, maximumItems, false);
  let status = "compatible";

  if (!search.states.length) {
    search = searchStates(candidates, context, minimumItems, maximumItems, true);
    status = search.states.length ? "over-limit" : "empty";
  }

  if (!search.states.length) {
    return {
      status,
      message: "No usable recipe combination is available for the selected meals.",
      remainingBefore: remaining,
      plans: [],
      diagnostics: { recipeCount: recipes.length, candidateCount: candidates.length, evaluatedStates: search.evaluatedStates },
    };
  }

  const recipesById = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe]));
  const used = new Set();
  const definitions = [
    ["balanced", compareBalanced],
    ["lowest-sodium", compareLowestSodium],
    ["simplest", compareSimplest],
  ];
  const plans = definitions.map(([objective, comparator]) => {
    const state = pickPlan(search.states, comparator, context, used);
    used.add(stateSignature(state));
    return createPlan(objective, state, context, meals, recipesById);
  });

  return {
    status,
    remainingBefore: remaining,
    plans,
    bindingConstraints: status === "over-limit" ? plans[0].violations.map((item) => item.nutrient) : [],
    diagnostics: { recipeCount: recipes.length, candidateCount: candidates.length, evaluatedStates: search.evaluatedStates },
  };
}
