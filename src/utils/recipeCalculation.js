import { NUTRIENT_KEYS } from './nutrientCatalog.js';
const positive = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Quantity is a multiplier of the selected, food-specific portion, not a generic cup/ml.
export function ingredientGrams({food,quantity,unit} = {}) {
  if (food?.basis !== 'per100g' || !positive(quantity)) return null;
  let grams = null;
  if (unit === 'g') grams = Number(quantity);
  else if (/^portion:\d+$/.test(unit || '')) {
    const portion = food.portions?.[Number(unit.split(':')[1])];
    if (positive(portion?.gramWeight) && positive(portion?.amount)) grams = Number(quantity) * Number(portion.gramWeight);
  }
  return positive(grams) ? grams : null;
}
export function editRecipeIngredients(draft, ingredients) {
  return {...draft,ingredients,yieldConfirmed: false};
}
export function calculateRecipe(draft = {}) {
  const ingredients = Array.isArray(draft.ingredients) ? draft.ingredients : [];
  const weights = ingredients.map(ingredientGrams);
  const completeWeight = weights.length > 0 && weights.every(positive);
  const ingredientWeight = completeWeight ? weights.reduce((sum, grams) => sum + grams, 0) : null;
  const hasMeasured = String(draft.finishedGrams ?? '').trim() !== '';
  const weightGrams = hasMeasured ? (draft.yieldConfirmed && positive(draft.finishedGrams) ? Number(draft.finishedGrams) : null) : ingredientWeight;
  const servings = positive(draft.servings) ? Number(draft.servings) : null;
  const nutrients = Object.fromEntries(NUTRIENT_KEYS.map(key => {
    let sum = 0, knownCount = 0;
    ingredients.forEach((row,index) => {
      const value = row.food?.nutrients?.[key];
      if (weights[index] !== null && known(value)) { sum += value * weights[index] / 100; knownCount++; }
    });
    const complete = ingredients.length > 0 && knownCount === ingredients.length && Number.isFinite(sum);
    const total = complete ? sum : null;
    return [key,{total,knownSubtotal:knownCount && Number.isFinite(sum) ? sum : null,knownCount,itemCount:ingredients.length,complete,
      perServing:total !== null && servings ? total / servings : null,
      per100g:total !== null && positive(weightGrams) ? total * 100 / weightGrams : null}];
  }));
  return {nutrients,weights,ingredientWeight,weightGrams:positive(weightGrams)?weightGrams:null,servings,
    weightBasis:hasMeasured ? (draft.yieldConfirmed ? 'Measured finished weight' : 'Measured weight needs reconfirmation') : 'Estimated ingredient weight (pre-cooking)'};
}
export function recipePortion(draft, basis, quantity) {
  const result = calculateRecipe(draft);
  const factor = !positive(quantity) ? null : basis === 'grams' ? (result.weightGrams ? Number(quantity) / result.weightGrams : null) : basis === 'servings' && result.servings ? Number(quantity) / result.servings : null;
  return Object.fromEntries(NUTRIENT_KEYS.map(key => [key,result.nutrients[key].total !== null && factor !== null ? result.nutrients[key].total * factor : null]));
}
export function buildCalculatedRecipe(draft, id = `calculated-${crypto.randomUUID()}`) {
  const calculation = structuredClone(draft);
  return {id,name:draft.name.trim(),category:'My calculated recipes',calculated:true,calculation,
    ...recipePortion(calculation,'servings',1),method:'recipe-estimate',methodLabel:'Ingredient calculation · database estimate',
    sourceLabel:'Selected USDA food records',servingDescription:`1 of ${draft.servings} equal servings`};
}
