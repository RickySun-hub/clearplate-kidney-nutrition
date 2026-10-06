import { parseIngredient } from './ingredients.js';
import { gramsForQuantity } from './recipeAudit.js';

const volume = { cup: 48, tbsp: 3, tsp: 1, pint: 96, quart: 192, gallon: 768 };
function portionUnit(description = '') {
  if (/^(?:cup)\b/i.test(description)) return 'cup';
  if (/^(?:tablespoons?|tbsp)\b/i.test(description)) return 'tbsp';
  if (/^(?:teaspoons?|tsp)\b/i.test(description)) return 'tsp';
  if (/^pints?\b/i.test(description)) return 'pint';
  if (/^quarts?\b/i.test(description)) return 'quart';
  if (/^cloves?\b/i.test(description)) return 'clove';
  if (/^stalks?\b/i.test(description)) return 'stalk';
  return 'count';
}
const goodPortion = (p) => typeof p.amount === 'number' && p.amount > 0 && typeof p.gramWeight === 'number' && p.gramWeight > 0;

export function resolveIngredientWeight(original, food, match = {}) {
  const parsed = parseIngredient(original);
  const result = { ...parsed, kind: original.trim().endsWith(':') ? 'heading' : 'ingredient', grams: null, weightNote: null, portionId: null };
  if (result.kind === 'heading') return result;
  const reject = (reason) => ({ ...result, issue: [parsed.issue, reason].filter(Boolean).join(' ') });
  if (!food) return reject('USDA correspondence not selected.');
  if (food.basis !== 'per100g') return reject('Food has no per-100g nutrient basis.');
  if (parsed.quantity === null || parsed.issue) return reject('Measured weight requires source review.');
  if (/\b(?:plus|additional|more to taste)\b/i.test(original)) return reject('Additional ingredient quantity requires review.');
  if (/\b(?:fl(?:uid)?\.?\s*(?:oz|ounces?))\b/i.test(original)) return reject('Fluid ounces require a food-specific volume portion.');
  if (parsed.unit === 'count') {
    const each = original.match(/^\s*\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s*[-–]\s*(ounce|pound|gram)\b/i)
      || original.match(/\(\s*(\d+(?:\.\d+)?)\s+(ounce|pound|gram)s?\s+each\s*\)/i);
    if (each) {
      const units = { ounce: 'oz', pound: 'lb', gram: 'g' };
      const perPiece = gramsForQuantity(Number(each[1]), units[each[2].toLowerCase()]);
      return { ...result, grams: parsed.quantity * perPiece, weightNote: 'Explicit source piece count × mass per piece; edible yield not adjusted.' };
    }
  }
  const mass = gramsForQuantity(parsed.quantity, parsed.unit);
  if (mass !== null) {
    return { ...result, grams: mass, ...(parsed.quantityMax !== null ? { gramsMax: gramsForQuantity(parsed.quantityMax, parsed.unit) } : {}), weightNote: 'Explicit source mass; exact unit conversion, edible yield not adjusted.' };
  }
  // Containers are not edible weights: drain/rinse yields cannot be inferred.
  if (['can', 'package', 'bag'].includes(parsed.unit)) return reject('Package count needs a measured edible/drained weight.');
  const portions = (food.portions || []).filter(goodPortion);
  let candidates = match.portionId ? portions.filter((p) => String(p.sourcePortionId) === String(match.portionId)) : portions;
  if (match.portionId && candidates.length !== 1) return reject('Selected USDA portion is missing.');
  if (!match.portionId && volume[parsed.unit]) {
    if (['pint', 'quart', 'gallon'].includes(parsed.unit)) return reject('Large volume measure needs an explicit food portion and measurement stage.');
    candidates = candidates.filter((p) => volume[portionUnit(p.description)]);
    // Prefer matching preparation. A chopped cup must not silently become whole leaves.
    const prep = /\b(chopped|minced|sliced|slices|diced|pieces|shredded|grated|packed)\b/i.exec(original)?.[1]?.toLowerCase();
    if (prep) {
      const exactPrep = candidates.filter((p) => new RegExp(`\\b${prep}\\b`, 'i').test(p.description));
      if (exactPrep.length) candidates = exactPrep;
      else return reject('Preparation-specific household weight is unavailable; measure edible grams.');
    } else candidates = candidates.filter((p) => !/\b(whipped|sifted|packed|whole)\b/i.test(p.description));
    const exactUnit = candidates.filter((p) => portionUnit(p.description) === parsed.unit);
    if (exactUnit.length) candidates = exactUnit;
  } else if (!match.portionId) {
    if (parsed.unit === 'clove') {
      if (/\b(large|small|head)\b/i.test(original)) return reject('Clove size requires a measured weight; generic USDA clove is not size-specific.');
      candidates = candidates.filter((p) => /^cloves?\b/i.test(p.description));
    } else if (parsed.unit === 'stalk') candidates = candidates.filter((p) => /^stalks?\b/i.test(p.description));
    else return reject('Food count/size needs an explicit USDA portion selection.');
  }
  // Equivalent portions (e.g. 1 clove/3g and 3 cloves/9g) are safe to deduplicate.
  const options = candidates.map((p) => {
    if (/RACC|serving|quantity not specified/i.test(p.description)) return { p, rate: null };
    const unit = portionUnit(p.description);
    const factor = volume[parsed.unit] && volume[unit] ? volume[parsed.unit] / volume[unit] : parsed.unit === unit ? 1 : null;
    return { p, rate: factor === null ? null : p.gramWeight / p.amount * factor };
  }).filter((o) => o.rate !== null);
  if (!options.length) return reject('USDA portion unit is incompatible with the source amount.');
  const rates = new Set(options.map((o) => o.rate.toFixed(8)));
  if (rates.size !== 1) return reject('Multiple household portion weights require an explicit choice.');
  const { p, rate } = options[0];
  return { ...result, grams: parsed.quantity * rate, ...(parsed.quantityMax !== null ? { gramsMax: parsed.quantityMax * rate } : {}), portionId: p.sourcePortionId,
    weightNote: `USDA average estimate: ${p.amount} ${p.description} = ${p.gramWeight} g.${portionUnit(p.description) !== parsed.unit ? ' Household volume converted within this food only.' : ''}` };
}
