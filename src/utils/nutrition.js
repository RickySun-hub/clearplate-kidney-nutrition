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
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  const number = Number(value);
  // A positive amount below display precision must not look like an explicit zero.
  if (number > 0 && number < 10 ** -digits) return `<${formatter.format(10 ** -digits)}`;
  return formatter.format(number);
};

const CORE_NUTRIENTS = ['calories', 'protein', 'sodium', 'potassium', 'phosphorus'];
// Sort nonnegative contributions for reproducible totals regardless of entry order.
// Keep source precision throughout calculation; formatting belongs to the UI.
const sumAmounts = (amounts) => [...amounts].sort((a, b) => a - b).reduce((sum, amount) => sum + amount, 0);

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
  const amounts = detailedNutritionFor(recipe, servings);
  return Object.fromEntries(CORE_NUTRIENTS.map(key => [key, amounts[key]]));
};

export const detailedNutritionFor = (food, servings = 1) => {
  const values = food?.method === 'unpackaged' && food.baseEstimate ? food.baseEstimate : food;
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    validNutrientValue(values?.[key]) && validNutrientValue(servings) && Number(servings) > 0
      ? Number(values[key]) * Number(servings) : null]));
};

// Every recorded item counts in the denominator, including unresolved recipes.
export function nutrientCoverage(meals, recipesById = {}) {
  const contributions = Object.fromEntries(NUTRIENT_KEYS.map(key => [key, []]));
  const result = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key,
    { knownSubtotal: 0, knownCount: 0, itemCount: meals.length, total: null, complete: false }]));
  for (const meal of meals) {
    const food = meal.source === 'custom' ? meal.customFood : recipesById[meal.recipeId];
    const amount = detailedNutritionFor(food, meal.servings);
    for (const key of NUTRIENT_KEYS) if (amount[key] !== null) {
      contributions[key].push(amount[key]);
      result[key].knownCount += 1;
    }
  }
  for (const key of NUTRIENT_KEYS) {
    result[key].knownSubtotal = sumAmounts(contributions[key]);
    result[key].complete = meals.length > 0 && result[key].knownCount === meals.length;
    result[key].total = result[key].complete ? result[key].knownSubtotal : null;
  }
  return result;
}

// Display-only access to known contributions. Calculation callers must keep using
// coverage.total / mealTotals, where incomplete totals remain null.
export function nutrientDisplay(coverage) {
  const empty = coverage?.itemCount === 0;
  const known = !empty && coverage?.knownCount > 0 && validNutrientValue(coverage.knownSubtotal);
  const complete = Boolean(known && coverage.complete && validNutrientValue(coverage.total));
  return {
    value: known ? Number(complete ? coverage.total : coverage.knownSubtotal) : null,
    empty,
    complete,
    partial: Boolean(known && !complete),
    note: empty ? 'No foods recorded' : !known ? 'No nutrient data for recorded foods'
      : !complete ? `Incomplete nutrient data · ${coverage.knownCount}/${coverage.itemCount} items have data`
        : 'Recorded foods only',
  };
}

export function formatNutrientCoverage(coverage, unit = '', digits = 1) {
  const display = nutrientDisplay(coverage);
  if (display.empty) return '—';
  if (display.value === null) return 'Unknown';
  return `${formatAmount(display.value, digits)}${unit ? ` ${unit}` : ''}${display.partial ? ' subtotal · incomplete' : ''}`;
}

export function nutrientProgressState({ type, value, coverage, target, range, complete = false, empty = false }) {
  const isSodium = type === 'sodium';
  const display = coverage ? nutrientDisplay(coverage) : {
    value: validNutrientValue(value) ? Number(value) : null,
    complete: validNutrientValue(value),
    partial: false,
    empty,
  };
  const numericValue = display.value;
  const hasValidTarget = isSodium
    ? validNutrientValue(target) && Number(target) > 0
    : validNutrientValue(range?.min) && Number(range.min) > 0
      && validNutrientValue(range?.max) && Number(range.max) >= Number(range.min);
  const maximum = hasValidTarget ? Number(isSodium ? target : range.max) : null;
  const ratio = maximum > 0 && numericValue !== null ? Math.max(0, Math.min(numericValue / maximum * 100, 100)) : null;
  let status = 'No target saved';
  let tone = 'neutral';

  if (numericValue === null) status = 'Unknown nutrient data';
  else if (hasValidTarget && numericValue > maximum) {
    status = display.partial ? 'Known subtotal over limit · incomplete nutrient data' : isSodium ? 'Over target' : 'Over range';
    tone = 'danger';
  } else if (!display.complete) status = 'Incomplete nutrient data';
  else if (hasValidTarget && !complete) status = 'Recording in progress';
  else if (hasValidTarget) {
    status = isSodium ? 'Below saved limit' : 'Within saved range';
    tone = 'good';
    if (isSodium && numericValue > maximum * 0.8) {
      status = 'Near limit'; tone = 'warning';
    } else if (!isSodium && numericValue < Number(range.min)) {
      status = 'Below range'; tone = 'warning';
    }
  }
  if (empty || display.empty) { status = 'No food recorded yet'; tone = 'neutral'; }
  return { numericValue, hasValidTarget, maximum, ratio, status, tone, partial: display.partial };
}

export function mealTotalBounds(meals, recipesById) {
  const lower = Object.fromEntries(CORE_NUTRIENTS.map(key => [key, []]));
  const upper = Object.fromEntries(CORE_NUTRIENTS.map(key => [key, []]));
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
    if (estimated || food.method === 'usda-estimate' || food.method === 'recipe-estimate') estimatedCount += 1;
    const nutrition = nutritionFor(food, meal.servings);
    for (const key of Object.keys(lower)) {
      if (nutrition[key] === null || margin === null) { lower[key] = null; upper[key] = null; }
      else if (lower[key] !== null) {
        lower[key].push(nutrition[key] * (1 - margin));
        upper[key].push(nutrition[key] * (1 + margin));
      }
    }
  }
  const totals = bounds => Object.fromEntries(CORE_NUTRIENTS.map(key => [key, bounds[key] === null ? null : sumAmounts(bounds[key])]));
  return { lower: totals(lower), upper: totals(upper), estimatedCount };
}

export const mealTotals = (meals, recipesById) => {
  const coverage = nutrientCoverage(meals, recipesById);
  return Object.fromEntries(CORE_NUTRIENTS.map(key => [key, meals.length ? coverage[key].total : 0]));
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
