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

export const formatAmount = (value, digits = 0) => {
  if (isUnknown(value)) return 'Unknown';
  const formatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: digits, minimumFractionDigits: 0});
  const threshold = 10 ** -digits;
  return Number(value) > 0 && Number(value) < threshold
    ? `<${formatter.format(threshold)}` : formatter.format(Number(value));
};

// Nonnegative contributions are summed in a deterministic order, without
// rounding intermediate values. This remains ordinary floating-point arithmetic.
const stableSum = values => values.includes(null) ? null : [...values].sort((a,b)=>a-b).reduce((sum,value)=>sum+value,0);

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
    .map((key) => [key, !validNutrientValue(values?.[key]) || !validNutrientValue(servings) || Number(servings) <= 0 ? null : Number(values[key]) * servings]));
};

export const detailedNutritionFor = (food, servings = 1) => {
  const values = food?.method === 'unpackaged' && food.baseEstimate ? food.baseEstimate : food;
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    validNutrientValue(values?.[key]) && validNutrientValue(servings) && Number(servings) > 0
      ? Number(values[key]) * Number(servings) : null]));
};

// Every recorded item counts in the denominator, including unresolved recipes.
export function nutrientCoverage(meals, recipesById = {}) {
  const result = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    { knownSubtotal: 0, knownCount: 0, itemCount: meals.length, total: null, complete: false }]));
  const contributions = Object.fromEntries(NUTRIENT_KEYS.map(key=>[key,[]]));
  for (const meal of meals) {
    const food = meal.source === 'custom' ? meal.customFood : recipesById[meal.recipeId];
    const amount = detailedNutritionFor(food, meal.servings);
    for (const key of NUTRIENT_KEYS) if (amount[key] !== null) {
      contributions[key].push(amount[key]);
      result[key].knownCount += 1;
    }
  }
  for (const key of NUTRIENT_KEYS) {
    result[key].knownSubtotal = stableSum(contributions[key]);
    result[key].complete = meals.length > 0 && result[key].knownCount === meals.length;
    result[key].total = result[key].complete ? result[key].knownSubtotal : null;
  }
  return result;
}

export function mealTotalBounds(meals, recipesById) {
  const lower = Object.fromEntries(['calories','protein','sodium','potassium','phosphorus'].map(key=>[key,[]]));
  const upper = Object.fromEntries(Object.keys(lower).map(key=>[key,[]]));
  let estimatedCount = 0;
  for (const meal of meals) {
    const food = meal.source === "custom" ? meal.customFood : recipesById[meal.recipeId];
    if (!food) {
      for (const key of Object.keys(lower)) { lower[key].push(null); upper[key].push(null); }
      continue;
    }
    const estimated = food.method === "unpackaged";
    const rawMargin = food.estimateRangePercent ?? food.uncertaintyMargin;
    const margin = estimated ? (validNutrientValue(rawMargin) && Number(rawMargin) <= 100 ? Number(rawMargin) / 100 : null) : 0;
    if (estimated || food.method === 'usda-estimate' || food.method === 'recipe-estimate') estimatedCount += 1;
    const nutrition = nutritionFor(food, meal.servings);
    for (const key of Object.keys(lower)) {
      lower[key].push( nutrition[key] === null || margin === null ? null : nutrition[key] * (1 - margin));
      upper[key].push( nutrition[key] === null || margin === null ? null : nutrition[key] * (1 + margin));
    }
  }
  return { lower: Object.fromEntries(Object.entries(lower).map(([key,values])=>[key,stableSum(values)])), upper: Object.fromEntries(Object.entries(upper).map(([key,values])=>[key,stableSum(values)])), estimatedCount };
}

export const mealTotals = (meals, recipesById = {}) => {
  const coverage = nutrientCoverage(meals, recipesById);
  return Object.fromEntries(['calories','protein','sodium','potassium','phosphorus'].map(key=>[key,meals.length ? coverage[key].total : 0]));
};

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
