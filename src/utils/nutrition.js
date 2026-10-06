import { NUTRIENT_KEYS, validNutrientValue } from './nutrientCatalog.js';

export const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const isUnknown = (value) => value === null
  || value === undefined
  || !['string', 'number'].includes(typeof value)
  || (typeof value === "string" && value.trim() === "")
  || !Number.isFinite(Number(value));

export const formatAmount = (value, digits = 0) => isUnknown(value)
  ? "Unknown"
  : new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number(value));

export function parseNutrientValues(values = {}) {
  const result = {};
  for (const key of ["calories", "protein", "sodium"]) {
    if (!validNutrientValue(values[key])) return null;
    result[key] = Number(values[key]);
  }
  for (const key of ["potassium", "phosphorus"]) {
    if (values[key] === null || values[key] === undefined || String(values[key]).trim() === "") {
      result[key] = null;
    } else if (!validNutrientValue(values[key])) {
      return null;
    } else {
      result[key] = Number(values[key]);
    }
  }
  for (const key of NUTRIENT_KEYS.filter((key) => !['calories', 'protein', 'sodium', 'potassium', 'phosphorus'].includes(key))) {
    if (!(key in values)) continue;
    if (values[key] === null || values[key] === undefined || String(values[key]).trim() === '') result[key] = null;
    else if (!validNutrientValue(values[key])) return null;
    else result[key] = Number(values[key]);
  }
  return result;
}

export const nutritionFor = (recipe, servings = 1) => {
  // Older records stored an inflated estimate alongside the original values.
  const values = recipe?.method === "unpackaged" && recipe.baseEstimate ? recipe.baseEstimate : recipe;
  return Object.fromEntries(["calories", "protein", "sodium", "potassium", "phosphorus"]
    .map((key) => [key, !validNutrientValue(values?.[key]) || !validNutrientValue(servings) || Number(servings) <= 0 ? null : round(Number(values[key]) * servings, 2)]));
};

export const detailedNutritionFor = (food, servings = 1) => {
  const values = food?.method === 'unpackaged' && food.baseEstimate ? food.baseEstimate : food;
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    validNutrientValue(values?.[key]) && validNutrientValue(servings) && Number(servings) > 0
      ? round(Number(values[key]) * Number(servings), 2) : null]));
};

// Every recorded item counts in the denominator, including unresolved recipes.
export function nutrientCoverage(meals, recipesById = {}) {
  const result = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    { knownSubtotal: 0, knownCount: 0, itemCount: meals.length, total: null, complete: false }]));
  for (const meal of meals) {
    const food = meal.source === 'custom' ? meal.customFood : recipesById[meal.recipeId];
    const amount = detailedNutritionFor(food, meal.servings);
    for (const key of NUTRIENT_KEYS) if (amount[key] !== null) {
      result[key].knownSubtotal = round(result[key].knownSubtotal + amount[key], 2);
      result[key].knownCount += 1;
    }
  }
  for (const key of NUTRIENT_KEYS) {
    result[key].complete = meals.length > 0 && result[key].knownCount === meals.length;
    result[key].total = result[key].complete ? result[key].knownSubtotal : null;
  }
  return result;
}

const addNutritionValue = (current, amount) => current === null || amount === null
  ? null
  : round(current + amount, 1);

export function mealTotalBounds(meals, recipesById) {
  const lower = { calories: 0, protein: 0, sodium: 0, potassium: 0, phosphorus: 0 };
  const upper = { ...lower };
  let estimatedCount = 0;
  for (const meal of meals) {
    const food = meal.source === "custom" ? meal.customFood : recipesById[meal.recipeId];
    if (!food) {
      for (const key of Object.keys(lower)) { lower[key] = null; upper[key] = null; }
      continue;
    }
    const estimated = food.method === "unpackaged";
    const rawMargin = food.estimateRangePercent ?? food.uncertaintyMargin;
    const margin = estimated ? (validNutrientValue(rawMargin) && Number(rawMargin) <= 100 ? Number(rawMargin) / 100 : null) : 0;
    if (estimated || food.method === 'usda-estimate') estimatedCount += 1;
    const nutrition = nutritionFor(food, meal.servings);
    for (const key of Object.keys(lower)) {
      lower[key] = addNutritionValue(lower[key], nutrition[key] === null || margin === null ? null : nutrition[key] * (1 - margin));
      upper[key] = addNutritionValue(upper[key], nutrition[key] === null || margin === null ? null : nutrition[key] * (1 + margin));
    }
  }
  return { lower, upper, estimatedCount };
}

export const mealTotals = (meals, recipesById) =>
  meals.reduce(
    (totals, meal) => {
      const recipe = meal.source === "custom" ? meal.customFood : recipesById[meal.recipeId];
      if (!recipe) return Object.fromEntries(Object.keys(totals).map((key) => [key, null]));
      const amount = nutritionFor(recipe, meal.servings);
      return {
        calories: addNutritionValue(totals.calories, amount.calories),
        protein: addNutritionValue(totals.protein, amount.protein),
        sodium: addNutritionValue(totals.sodium, amount.sodium),
        potassium: addNutritionValue(totals.potassium, amount.potassium),
        phosphorus: addNutritionValue(totals.phosphorus, amount.phosphorus),
      };
    },
    { calories: 0, protein: 0, sodium: 0, potassium: 0, phosphorus: 0 },
  );

export const proteinRangeForWeight = (weightKg) => ({
  min: Math.round((Number(weightKg) || 0) * 0.8),
  max: Math.round(Number(weightKg) || 0),
});

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
