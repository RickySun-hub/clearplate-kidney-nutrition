// Local ingredient screening only. No title-based safety claims or external requests.
export const FOOD_ALLERGIES = Object.freeze([
  { id: 'milk', label: 'Milk', aliases: 'milk|butter|cheese|cream|yogurt|yoghurt|whey|casein|caseinate|ghee|parmesan|mozzarella|ricotta|feta|buttermilk' },
  { id: 'egg', label: 'Egg', aliases: 'egg|eggs|albumen|mayonnaise|mayo|meringue|aioli' },
  { id: 'peanut', label: 'Peanut', aliases: 'peanut|peanuts|groundnut|groundnuts|arachis' },
  { id: 'tree-nut', label: 'Tree nuts', aliases: 'almond|almonds|walnut|walnuts|cashew|cashews|pecan|pecans|pistachio|pistachios|hazelnut|hazelnuts|macadamia|macadamias|brazil nut|pine nut|pine nuts|pesto|marzipan' },
  { id: 'soy', label: 'Soy', aliases: 'soy|soya|soybean|soybeans|tofu|tempeh|edamame|miso|tamari' },
  { id: 'wheat', label: 'Wheat', aliases: 'wheat|semolina|durum|spelt|farro|bulgur|couscous|seitan|wonton|wontons|soy sauce|bread|breadcrumbs|panko|pasta|flour|tortilla|tortillas' },
  { id: 'fish', label: 'Fish', aliases: 'fish|salmon|tuna|cod|haddock|anchovy|anchovies|sardine|sardines|tilapia|trout|halibut|mackerel|bonito|worcestershire' },
  { id: 'shellfish', label: 'Shellfish', aliases: 'shellfish|shrimp|prawn|prawns|crab|lobster|crayfish|crawfish|clam|clams|mussel|mussels|oyster|oysters|scallop|scallops|squid|octopus' },
  { id: 'sesame', label: 'Sesame', aliases: 'sesame|tahini|benne|gingelly|halvah|halva' },
]);
const normalizedText = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/[‐‑–—-]/g, ' ');
export function normalizeFoodAllergies(profile = {}) {
  const raw = Array.isArray(profile.foodAllergies) ? profile.foodAllergies.filter(value => typeof value === 'string') : [];
  return {
    foodAllergies: [...new Set(raw)],
    otherFoodAllergies: typeof profile.otherFoodAllergies === 'string' ? profile.otherFoodAllergies.trim().slice(0, 500) : '',
  };
}
const matchesWord = (text, alternatives) => new RegExp(`\\b(?:${alternatives})\\b`, 'i').test(text);
// Brand recipes, alternative ingredients and unspecified mixtures require label review.
const compound = /\b(sauce|dressing|stock|broth|bouillon|seasoning|spice blend|curry paste|cooking spray|bread|breadcrumbs|panko|pasta|noodles?|sausage|sausages|bacon|ham|pastry|pastries|cake|cakes|cookies?|biscuits?|crackers?|tortillas?|cereal|granola|margarine|spread|chocolate|protein powder|substitute|non dairy|nondairy|vegan cheese|pesto|mayonnaise|aioli|wonton|mix|mixture)\b|\bor\b|\bmay contain\b/i;
export function assessRecipeAllergies(recipe, detail, profile = {}) {
  const prefs = normalizeFoodAllergies(profile);
  if (!prefs.foodAllergies.length && !prefs.otherFoodAllergies) return { status: 'not-filtered', eligible: true, matches: [], reasons: [], message: '' };
  const ingredients = detail?.ingredients ?? recipe?.ingredients;
  const texts = Array.isArray(ingredients) ? ingredients.map(item => typeof item === 'string' ? item : (item?.name || item?.description || item?.food?.description || '')).map(normalizedText) : [];
  const matches = FOOD_ALLERGIES.filter(allergy => prefs.foodAllergies.includes(allergy.id) && texts.some(text => matchesWord(text, allergy.aliases))).map(allergy => allergy.label);
  const custom = prefs.otherFoodAllergies.split(/[,;\n]/).map(normalizedText).map(s => s.trim()).filter(Boolean);
  for (const allergy of custom) if (texts.some(text => text.includes(allergy))) matches.push(allergy);
  const reasons = [];
  if (!texts.length || texts.some(text => !text.trim())) reasons.push('Ingredient list incomplete');
  if (texts.some(text => compound.test(text))) reasons.push('Compound or alternative ingredients need label review');
  if (prefs.otherFoodAllergies || prefs.foodAllergies.some(id => !FOOD_ALLERGIES.some(a => a.id === id))) reasons.push('Other allergies need manual ingredient review');
  if (matches.length) return { status: 'blocked', eligible: false, matches, reasons, message: `Possible ${matches.join(', ')} ingredient. Excluded by your allergy settings.` };
  if (reasons.length) return { status: 'unknown', eligible: false, matches, reasons, message: 'Allergy match unknown. Review ingredients and product labels before choosing.' };
  return { status: 'no-match', eligible: true, matches, reasons, message: 'No listed allergy match found. Check product labels and cross-contact; this is not a safety guarantee.' };
}
