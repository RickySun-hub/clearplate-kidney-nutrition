import { NUTRIENT_KEYS } from './nutrientCatalog.js';

// Search responses can omit portions; select only a matching full food detail.
export function createUsdaSelection({ onStart, onFood, onError, onEnd, fetchImpl = fetch }) {
  let version = 0, controller = null, timer = null;
  function cancel() { version++; clearTimeout(timer); controller?.abort(); controller = null; }
  async function select(food) {
    cancel();
    const current = version;
    controller = new AbortController();
    const requestController = controller;
    const signal = requestController.signal;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    timer = timeout;
    onStart();
    try {
      if (!Number.isSafeInteger(food?.fdcId) || food.fdcId <= 0) throw Error('Invalid food');
      const response = await fetchImpl('/api/fdc-food?fdcId=' + food.fdcId, { signal });
      if (!response.ok) throw Error('Detail unavailable');
      const data = await response.json();
      if (data.food?.fdcId !== food.fdcId || !data.food.nutrients || !Array.isArray(data.food.portions)) throw Error('Invalid detail');
      if (current === version && !signal.aborted) onFood(data);
    } catch {
      if (current === version) onError('Could not load USDA food details. Select the food again to retry.');
    } finally {
      clearTimeout(timeout);
      if (current === version) { controller = null; onEnd(); }
    }
  }
  return { select, cancel };
}
export const portionDescription = p => p.description || p.modifier || p.unit || '';
export const isUnspecifiedFood = food => food?.matchType === 'unspecified' || food?.dataType === 'Survey (FNDDS)' && /\bNFS\b|not (?:further )?specified/i.test(food.description || '');
export const validHouseholdPortion = p => typeof p?.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0
  && typeof p?.gramWeight === 'number' && Number.isFinite(p.gramWeight) && p.gramWeight > 0
  && Boolean(portionDescription(p).trim()) && !/^(?:undetermined|unknown)$/i.test(portionDescription(p).trim());

export function householdPortionLabel(portion) {
  const description = portionDescription(portion).trim();
  // FNDDS descriptions can already include the source amount (e.g. "1 cup").
  return /^\d|^[¼½¾⅓⅔⅛⅜⅝⅞]/.test(description) ? description : `${portion.amount} ${description}`.trim();
}

const numberText = value => String(Number(value.toFixed(4)));
const positiveInput = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) && Number(value) > 0;

// Quantity is a multiplier of the whole returned source portion, including its amount.
// No selection or quantity is inferred from a newly retrieved food.
export function resolveEatenPortion(food, input = {}) {
  if (food?.basis !== 'per100g') throw Error('This source does not support a gram-based food estimate.');
  if (input.kind === 'grams') {
    if (!positiveInput(input.grams) || Number(input.grams) > 10000) throw Error('Enter the weight you ate, above zero and up to 10,000 g.');
    return {kind:'grams',grams:Number(input.grams),quantity:null,sourcePortionId:null,sourceAmount:null,sourceDescription:null,sourceGramWeight:null,estimated:false};
  }
  const portion = Number.isInteger(input.portionIndex) ? food.portions?.[input.portionIndex] : null;
  if (input.kind !== 'household' || !validHouseholdPortion(portion) || !positiveInput(input.quantity) || input.grams != null && input.grams !== '') throw Error('Choose a source household measure and enter how many of that measure you ate.');
  const grams = portion.gramWeight * Number(input.quantity);
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) throw Error('This portion must be above zero and no more than 10,000 g.');
  return {kind:'household',grams,quantity:Number(input.quantity),sourcePortionId:portion.sourcePortionId ?? null,
    sourceAmount:portion.amount,sourceDescription:householdPortionLabel(portion),sourceGramWeight:portion.gramWeight,estimated:true};
}

export function usdaFoodSnapshot(food, portion) {
  if (!Number.isSafeInteger(food?.fdcId) || food.fdcId <= 0 || food.basis !== 'per100g' || !positiveInput(portion?.grams)) throw Error('Choose a valid USDA source and eaten portion.');
  const nutrients = Object.fromEntries(NUTRIENT_KEYS.map(key => [key, typeof food.nutrients?.[key] === 'number' && Number.isFinite(food.nutrients[key]) && food.nutrients[key] >= 0 ? food.nutrients[key] : null]));
  const sourceSnapshot = JSON.parse(JSON.stringify({fdcId:food.fdcId,description:food.description,dataType:food.dataType ?? null,basis:food.basis,release:food.release ?? null,
    sourceUrl:food.sourceUrl ?? null,nutrients,nutrientIds:food.nutrientIds ?? null,units:food.units ?? null,portions:food.portions || []}));
  const servingDescription = portion.kind === 'household' ? `${numberText(portion.quantity)} × ${portion.sourceDescription} (about ${numberText(portion.grams)} g)` : `${numberText(portion.grams)} g`;
  return {name:food.description,...Object.fromEntries(NUTRIENT_KEYS.map(key => [key,nutrients[key] === null ? null : nutrients[key] * portion.grams / 100])),
    method:'usda-estimate',methodLabel:isUnspecifiedFood(food) ? 'USDA FNDDS unspecified-food match · estimate' : 'USDA food match · estimate',
    fdcId:food.fdcId,sourceUrl:food.sourceUrl ?? null,dataType:food.dataType ?? null,sourceRelease:food.release ?? null,sourceBasis:food.basis,sourceNutrients:{...nutrients},
    sourceSnapshot,portionSelection:{...portion},grams:portion.grams,servingDescription,matchType:isUnspecifiedFood(food) ? 'unspecified' : 'candidate'};
}
