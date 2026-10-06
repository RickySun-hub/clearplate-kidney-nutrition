import { readFileSync } from 'node:fs';
import { FdcError } from './fdc.js';
import { calculateRecipeAudit, scaleAudit } from '../src/utils/recipeAudit.js';

const MAX_BYTES = 20 * 1024;
const invalid = () => new FdcError(400, 'invalid_calculation', 'Invalid recipe calculation parameters.');
const tooLarge = () => new FdcError(413, 'body_too_large', 'Calculation payload must not exceed 20 KB.');

export function createCalculationService({ recipes, details, audits, foods }) {
  const ids = new Set(recipes.map(recipe => recipe.id));
  return {
    calculate(body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
      const { recipeId, cookingServings, overrides = [] } = body;
      if (typeof recipeId !== 'string' || !/^[a-z0-9-]{1,120}$/.test(recipeId)
        || typeof cookingServings !== 'number' || !Number.isFinite(cookingServings) || cookingServings < 0.5 || cookingServings > 100
        || !Array.isArray(overrides)) throw invalid();
      if (!ids.has(recipeId)) throw new FdcError(404, 'recipe_not_found', 'Recipe not found.');
      const detail = details[recipeId];
      const original = audits[recipeId];
      if (!detail?.source || !Object.keys(detail.source).length || !Array.isArray(detail.ingredients) || !detail.ingredients.length
        || !Array.isArray(original?.ingredients) || original.ingredients.length !== detail.ingredients.length
        || !Number.isFinite(detail.servings) || detail.servings <= 0) {
        throw new FdcError(422, 'recipe_source_unavailable', 'This recipe lacks the source ingredients or original yield required for calculation.');
      }
      if (overrides.length > detail.ingredients.length) throw invalid();
      const ingredients = structuredClone(original.ingredients);
      const seen = new Set();
      for (const override of overrides) {
        if (!override || !Number.isInteger(override.index) || override.index < 0 || override.index >= ingredients.length || seen.has(override.index)
          || typeof override.grams !== 'number' || !Number.isFinite(override.grams) || override.grams < 0 || override.grams > 100000) throw invalid();
        seen.add(override.index);
        const ingredient = ingredients[override.index];
        if (ingredient.kind === 'heading') throw invalid();
        if (override.fdcId !== undefined) {
          if (!Number.isSafeInteger(override.fdcId) || override.fdcId <= 0) throw invalid();
          if (!foods[override.fdcId]) throw new FdcError(404, 'snapshot_food_not_found', 'This food is not included in the public USDA snapshot.');
          if (foods[override.fdcId].basis !== 'per100g') throw invalid();
          const food = foods[override.fdcId];
          ingredient.fdcId = override.fdcId;
          ingredient.foodDescription = food.description;
          ingredient.sourceUrl = food.sourceUrl;
          ingredient.dataType = food.dataType;
          ingredient.release = food.release;
          ingredient.matchNote = 'User-supplied computational correspondence; needs review.';
        }
        ingredient.grams = override.grams;
        delete ingredient.gramsMax;
        ingredient.weightNote = 'User supplied original-batch grams; unreviewed';
        ingredient.overrideApplied = true;
        ingredient.resolvedWeight = true;
        ingredient.sourceIssue = ingredient.sourceIssue ?? ingredient.issue ?? null;
        ingredient.issue = ingredient.fdcId ? null : 'USDA correspondence not selected.';
      }
      const audit = calculateRecipeAudit({ servings: detail.servings }, ingredients.filter(ingredient => ingredient.kind !== 'heading'), foods);
      return { recipeId, originalYieldServings: detail.servings, cookingServings, ingredients,
        audit, batchForCooking: scaleAudit(audit, cookingServings), reviewStatus: 'needs-review',
        provenance: { mode: 'snapshot', live: false, source: 'USDA FoodData Central public downloads',
          calculation: 'Stateless ingredient calculation; original full recipe grams; no persistence or cooking-retention adjustment' } };
    },
  };
}

let service;
export function getCalculationService() {
  if (!service) {
    const recipes = JSON.parse(readFileSync(new URL('../src/data/recipes.json', import.meta.url), 'utf8'));
    const details = JSON.parse(readFileSync(new URL('../src/data/recipeDetails.json', import.meta.url), 'utf8'));
    const audits = JSON.parse(readFileSync(new URL('../src/data/usdaRecipeAudit.json', import.meta.url), 'utf8'));
    const catalog = JSON.parse(readFileSync(new URL('./data/usdaCatalog.json', import.meta.url), 'utf8'));
    service = createCalculationService({ recipes, details, audits, foods: Object.fromEntries(catalog.foods.map(food => [food.fdcId, food])) });
  }
  return service;
}

export async function readCalculationBody(req) {
  let body = req.body;
  if (body === undefined) {
    if (Number(req.headers?.['content-length']) > MAX_BYTES) throw tooLarge();
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > MAX_BYTES) throw tooLarge();
      chunks.push(bytes);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  let text;
  try { text = typeof body === 'string' ? body : JSON.stringify(body); }
  catch { throw invalid(); }
  if (typeof text !== 'string') throw invalid();
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw tooLarge();
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { throw invalid(); }
  }
  return body;
}
