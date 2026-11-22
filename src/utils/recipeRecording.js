import { NUTRIENT_KEYS } from './nutrientCatalog.js';
import { recipeSnapshot } from './entryEditing.js';
import { parseIngredient } from './ingredients.js';
import { gramsForQuantity } from './recipeAudit.js';

const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const clone = value => JSON.parse(JSON.stringify(value));

// Ingredient data and source nutrition travel with the record. Future cookbook
// edits cannot change either its totals or the basis for a later correction.
export function recipeRecordingBase(recipe, details, audit, foods = {}) {
  if (recipe.recipeCustomization?.version === 1) return clone(recipe);
  const yieldServings = Number(details?.servings || audit?.audit?.yieldServings);
  const sourceRows = audit?.ingredients || (details?.ingredients || []).map(text => { const parsed = parseIngredient(text); return { ...parsed, grams: parsed.quantityMax == null ? gramsForQuantity(parsed.quantity, parsed.unit) : null, kind: text.trim().endsWith(':') ? 'heading' : 'ingredient' }; });
  const ingredients = yieldServings > 0 ? sourceRows.filter(row => row.kind !== 'heading').map(row => ({
    text: row.foodText || parseIngredient(row.original).foodText || row.original,
    sourceText: row.original,
    quantity: known(row.quantity) && row.quantityMax == null ? row.quantity / yieldServings : null,
    unit: row.unit || 'g',
    grams: known(row.grams) && (row.gramsMax == null || row.gramsMax === row.grams) ? row.grams / yieldServings : null,
    nutrients: foods[row.fdcId]?.basis === 'per100g' ? clone(foods[row.fdcId].nutrients) : {},
    fdcId: row.fdcId || null, sourceUrl: row.sourceUrl || null,
    sourceDescription: row.foodDescription || null, matchNote: row.matchNote || null,
  })) : [];
  return { ...recipeSnapshot(recipe, details?.servingSize), recipeCustomization: {
    version: 1, original: clone(recipe), ingredients, overrides: {}, nutritionStatus: 'original',
  } };
}

export function ingredientAmount(row, override, servings = 1) {
  const unit = override?.unit || (known(row.quantity) ? row.unit : 'g');
  const amount = override ? override.amount : unit === 'g' ? row.grams : row.quantity;
  return { unit, amount: known(amount) ? amount * servings : null };
}

function ingredientGrams(row, override) {
  if (!override) return row.grams;
  if (!known(override.amount)) return null;
  if (override.amount === 0) return 0;
  if (override.unit === 'g') return override.amount;
  if (override.unit === row.unit && known(row.grams) && known(row.quantity) && row.quantity > 0) return override.amount * row.grams / row.quantity;
  return null;
}

export function customizeRecipe(base, overrides = {}) {
  const model = base.recipeCustomization;
  if (!model) throw Error('This recipe has no saved ingredient information.');
  for (const [index, edit] of Object.entries(overrides)) {
    const row = model.ingredients[index];
    if (!row || !known(edit.amount) || edit.amount > 100000 || !['g', row.unit].includes(edit.unit)) throw Error('Enter a valid ingredient amount.');
  }
  const snapshot = clone(base);
  snapshot.recipeCustomization.overrides = clone(overrides);
  const adjusted = Object.keys(overrides).length > 0;
  if (!adjusted) {
    for (const key of NUTRIENT_KEYS) snapshot[key] = known(model.original[key]) ? model.original[key] : null;
    if (model.original.grams !== undefined) snapshot.grams = model.original.grams;
    else delete snapshot.grams;
    snapshot.methodLabel = 'Recipe estimate · saved when logged';
    snapshot.sourceLabel = 'Recipe estimate · saved when logged';
    snapshot.recipeCustomization.nutritionStatus = 'original';
    return snapshot;
  }
  const weights = model.ingredients.map((row, index) => ingredientGrams(row, overrides[index]));
  for (const key of NUTRIENT_KEYS) {
    let total = 0, complete = model.ingredients.length > 0;
    model.ingredients.forEach((row, index) => {
      const grams = weights[index];
      if (grams === 0) return;
      if (!known(grams) || !known(row.nutrients[key])) complete = false;
      else total += grams * row.nutrients[key] / 100;
    });
    snapshot[key] = complete ? total : null;
  }
  snapshot.grams = weights.every(known) && weights.length ? weights.reduce((a, b) => a + b, 0) : null;
  snapshot.recipeCustomization.nutritionStatus = ['calories', 'protein', 'sodium'].every(key => known(snapshot[key])) ? 'estimated' : 'incomplete';
  snapshot.method = 'recipe-estimate';
  snapshot.methodLabel = 'Adjusted recipe · ingredient estimate';
  snapshot.sourceLabel = 'Saved ingredient estimate; food matches and preparation may differ';
  return snapshot;
}
