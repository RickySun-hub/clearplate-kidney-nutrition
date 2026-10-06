export const NUTRIENTS = [
  ['calories', 'Energy', 'kcal'], ['protein', 'Protein', 'g'], ['sodium', 'Sodium', 'mg'],
  ['potassium', 'Potassium', 'mg'], ['phosphorus', 'Phosphorus', 'mg'],
  ['carbs', 'Carbohydrate', 'g'], ['fat', 'Total fat', 'g'], ['fiber', 'Fiber', 'g'],
  ['sugars', 'Total sugars', 'g'], ['addedSugars', 'Added sugars', 'g'], ['saturatedFat', 'Saturated fat', 'g'],
  ['cholesterol', 'Cholesterol', 'mg'], ['calcium', 'Calcium', 'mg'], ['magnesium', 'Magnesium', 'mg'],
  ['iron', 'Iron', 'mg'], ['zinc', 'Zinc', 'mg'], ['selenium', 'Selenium', 'µg'],
  ['vitaminA', 'Vitamin A (RAE)', 'µg'], ['vitaminC', 'Vitamin C', 'mg'], ['vitaminD', 'Vitamin D', 'µg'],
  ['vitaminE', 'Vitamin E (alpha-tocopherol)', 'mg'], ['vitaminK', 'Vitamin K (phylloquinone)', 'µg'],
  ['thiamin', 'Thiamin (B1)', 'mg'], ['riboflavin', 'Riboflavin (B2)', 'mg'], ['niacin', 'Niacin', 'mg'],
  ['vitaminB6', 'Vitamin B6', 'mg'], ['folate', 'Folate (DFE)', 'µg'], ['vitaminB12', 'Vitamin B12', 'µg'],
].map(([key, label, unit]) => ({ key, label, unit }));
export const NUTRIENT_KEYS = NUTRIENTS.map(({ key }) => key);
export const DEFAULT_TRACKED_NUTRIENTS = NUTRIENT_KEYS.slice(0, 5);
export const validNutrientValue = (value) => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
export function normalizeNutrientPreferences(profile = {}) {
  const trackedNutrients = Array.isArray(profile.trackedNutrients)
    ? NUTRIENT_KEYS.filter((key) => profile.trackedNutrients.includes(key)) : [...DEFAULT_TRACKED_NUTRIENTS];
  const nutrientTargets = {};
  for (const key of NUTRIENT_KEYS) {
    const target = profile.nutrientTargets?.[key];
    if (!target || typeof target !== 'object') continue;
    const range = Object.fromEntries(['min', 'max'].filter((bound) => validNutrientValue(target[bound]))
      .map((bound) => [bound, Number(target[bound])]));
    if (Object.keys(range).length && !(range.min !== undefined && range.max !== undefined && range.min > range.max)) nutrientTargets[key] = range;
  }
  return { trackedNutrients, nutrientTargets };
}
