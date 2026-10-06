export const auditNutrients = ['calories', 'protein', 'sodium', 'potassium', 'phosphorus', 'carbs', 'fat', 'fiber', 'calcium'];
export const auditUnits = { calories: 'kcal', protein: 'g', sodium: 'mg', potassium: 'mg', phosphorus: 'mg', carbs: 'g', fat: 'g', fiber: 'g', calcium: 'mg' };
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const empty = (value) => Object.fromEntries(auditNutrients.map((key) => [key, value]));

export function gramsForQuantity(quantity, unit, portions = []) {
  if (!finite(quantity)) return null;
  const weights = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
  if (weights[unit]) return quantity * weights[unit];
  const matches = portions.filter((p) => p.unit === unit && finite(p.gramWeight) && p.gramWeight > 0 && finite(p.amount) && p.amount > 0);
  // Multiple preparation/size variants require an explicit selection upstream.
  if (matches.length !== 1) return null;
  return quantity * matches[0].gramWeight / matches[0].amount;
}

export function calculateRecipeAudit(recipe, ingredients, foods) {
  const yieldServings = recipe?.servings;
  const available = finite(yieldServings) && yieldServings > 0 && Array.isArray(ingredients) && ingredients.length > 0;
  const result = {
    status: 'unavailable', yieldServings: available ? yieldServings : null,
    ingredientCount: ingredients?.length || 0, weightedIngredientCount: 0,
    batch: empty(null), perServing: empty(null), knownPerServing: empty(null),
    missingByNutrient: empty(available ? 0 : 1), perServingBounds: empty(null),
    method: 'USDA ingredient sum; original recipe yield; no cooking retention adjustment',
    reviewStatus: 'needs-review',
  };
  if (!available) return result;
  const lower = empty(0), upper = empty(0);
  for (const ingredient of ingredients) {
    const food = foods[ingredient.fdcId];
    const minGrams = ingredient.grams;
    const maxGrams = ingredient.gramsMax === undefined ? minGrams : ingredient.gramsMax;
    const validWeight = finite(minGrams) && finite(maxGrams) && maxGrams >= minGrams;
    if (validWeight && food?.basis === 'per100g') result.weightedIngredientCount++;
    for (const nutrient of auditNutrients) {
      const value = food?.nutrients?.[nutrient];
      if (!validWeight || food?.basis !== 'per100g' || !finite(value)) {
        result.missingByNutrient[nutrient]++;
      } else {
        lower[nutrient] += value * minGrams / 100;
        upper[nutrient] += value * maxGrams / 100;
      }
    }
  }
  for (const nutrient of auditNutrients) {
    result.knownPerServing[nutrient] = lower[nutrient] / yieldServings;
    if (result.missingByNutrient[nutrient] === 0) {
      result.perServingBounds[nutrient] = { min: lower[nutrient] / yieldServings, max: upper[nutrient] / yieldServings };
      if (Math.abs(upper[nutrient] - lower[nutrient]) < 1e-10) {
        result.batch[nutrient] = lower[nutrient];
        result.perServing[nutrient] = lower[nutrient] / yieldServings;
      }
    }
  }
  result.status = Object.values(result.missingByNutrient).some((n) => n > 0) ? 'partial'
    : Object.values(result.perServing).some((value) => value === null) ? 'range' : 'calculated';
  return result;
}

export function scaleAudit(audit, servings) {
  if (!finite(servings)) return empty(null);
  return Object.fromEntries(auditNutrients.map((key) => [key, finite(audit?.perServing?.[key]) ? audit.perServing[key] * servings : null]));
}
