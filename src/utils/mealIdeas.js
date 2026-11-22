import { normalizeNutrientPreferences } from './nutrientCatalog.js';

const hasNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const completeList = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim());
const normalize = (value) => String(value).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

// Conservative ingredient matching, never an allergen-free certification. A
// missing list, unsupported restriction or unresolved compound ingredient is
// excluded from automatic ideas. Users still need to check product labels.
const restrictionPatterns = {
  milk: /\b(milk|butter|cream|cheese|yogurt|yoghurt|whey|casein|ghee|parmesan|mozzarella|feta|ricotta|buttermilk)\b/i,
  egg: /\b(eggs?|mayonnaise|mayo|meringue|albumin|aioli)\b/i,
  peanut: /\b(peanuts?|groundnuts?)\b/i,
  'tree nuts': /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?|pesto|marzipan)\b/i,
  soy: /\b(soy|soya|soybeans?|edamame|tofu|tempeh|miso|tamari)\b/i,
  wheat: /\b(wheat|flour|bread|breadcrumbs?|panko|pasta|spaghetti|noodles?|couscous|bulgur|farro|semolina|seitan|wontons?|tortillas?|crackers?|orzo|soy sauce|spelt)\b/i,
  fish: /\b(fish|salmon|tuna|cod|haddock|halibut|tilapia|sardines?|anchov(?:y|ies)|trout|bass|snapper|worcestershire)\b/i,
  shellfish: /\b(shellfish|shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|crayfish|crawfish)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
  gluten: /\b(wheat|barley|rye|malt|oats?|flour|bread|breadcrumbs?|panko|pasta|spaghetti|noodles?|couscous|bulgur|farro|semolina|seitan|wontons?|tortillas?|crackers?|orzo|soy sauce|spelt)\b/i,
};
const aliases = {
  dairy: 'milk', lactose: 'milk', 'lactose intolerance': 'milk', 'dairy intolerance': 'milk',
  eggs: 'egg', peanuts: 'peanut', 'tree nut': 'tree nuts', treenuts: 'tree nuts',
  soybean: 'soy', soybeans: 'soy', 'gluten intolerance': 'gluten', 'gluten sensitivity': 'gluten',
};
const compoundIngredient = /\b(sauce|dressing|stock|broth|bouillon|seasoning|spice mix|cake mix|baking mix|cooking spray|margarine|sausage|imitation|substitute|wontons?|tortillas?|crackers?|pesto)\b/i;
const excludedCategories = new Set(['Desserts', 'Spices & Rubs', 'Sauces', 'sauce', 'Other']);
const categoryOrder = ['Entrees', 'Soups & Salads', 'Grains', 'Sides', 'Breakfast', 'Appetizers', 'Breads'];

function profileRestrictions(profile) {
  const restrictions = [];
  for (const key of ['allergies', 'intolerances']) {
    const values = Array.isArray(profile[key]) ? profile[key].filter((value) => String(value).trim()) : [];
    if (profile[`${key}Status`] === 'unknown' || (!profile[`${key}Status`] && !values.length)) return null;
    if (profile[`${key}Status`] === 'listed' && !values.length) return null;
    for (const value of values) {
      const normalized = normalize(value);
      if (['none', 'no known allergies', 'no known intolerances'].includes(normalized)) continue;
      const restriction = aliases[normalized] || normalized;
      if (!restrictionPatterns[restriction]) return null;
      restrictions.push(restriction);
    }
  }
  // Free-text restrictions are not silently treated as a confirmed match.
  if (String(profile.otherAllergies || profile.otherIntolerances || '').trim()) return null;
  return [...new Set(restrictions)];
}

export function recipeRestrictionStatus(detail, profile = {}) {
  if (!completeList(detail?.ingredients)) return 'unknown';
  const restrictions = profileRestrictions(profile);
  if (restrictions === null) return 'unknown';
  if (!restrictions.length) return 'clear';
  const ingredients = detail.ingredients.join('\n');
  if (restrictions.some((restriction) => restrictionPatterns[restriction].test(ingredients))) return 'excluded';
  if (compoundIngredient.test(ingredients)) return 'unknown';
  return 'clear';
}

export function savedIdeaCeilings(profile = {}) {
  const targets = normalizeNutrientPreferences(profile).nutrientTargets;
  const ceilings = Object.fromEntries(Object.entries(targets).filter(([, target]) => hasNumber(target.max)).map(([key, target]) => [key, target.max]));
  for (const [nutrient, key] of [['sodium', 'sodiumTargetMg'], ['protein', 'proteinMaxG'], ['potassium', 'potassiumTargetMg'], ['phosphorus', 'phosphorusTargetMg']]) {
    const raw = profile[key];
    if (raw !== null && raw !== undefined && String(raw).trim() && Number.isFinite(Number(raw)) && Number(raw) >= 0) {
      ceilings[nutrient] = ceilings[nutrient] === undefined ? Number(raw) : Math.min(ceilings[nutrient], Number(raw));
    }
  }
  return ceilings;
}

/** Recipe inspiration only. No today totals, serving optimization, clinical
 * targets or food records are created here. Saved ceilings compare one source
 * serving; the UI asks users to confirm what they actually ate before logging.
 */
export function getMealIdeas({ recipes = [], recipeDetails = {}, profile = {}, metadataById = {}, limit = 3 } = {}) {
  if (profileRestrictions(profile) === null) return { status: 'needs-preferences', recipes: [], targetCount: 0 };
  const ceilings = savedIdeaCeilings(profile);
  const diet = normalize(profile.dietPreference || profile.diet || 'none');
  if (!['none', 'no preference', 'omnivore', 'regular', 'vegetarian', 'vegan'].includes(diet)
    || (Array.isArray(profile.dietaryRestrictions) && profile.dietaryRestrictions.length)) {
    return { status: 'needs-preferences', recipes: [], targetCount: Object.keys(ceilings).length };
  }
  const ranked = recipes.filter((recipe) => {
    const detail = recipeDetails[recipe.id];
    const annotation = metadataById[recipe.id] || {};
    if (!completeList(detail?.steps) || recipeRestrictionStatus(detail, profile) !== 'clear') return false;
    if (excludedCategories.has(annotation.category || recipe.category)) return false;
    if (!['calories', 'protein', 'sodium'].every((key) => hasNumber(recipe[key])) || recipe.calories <= 0) return false;
    if (diet === 'vegan' && annotation.diet !== 'vegan') return false;
    if (diet === 'vegetarian' && !['vegetarian', 'vegan'].includes(annotation.diet)) return false;
    return Object.entries(ceilings).every(([key, max]) => hasNumber(recipe[key]) && recipe[key] <= max);
  }).map((recipe) => {
    const category = metadataById[recipe.id]?.category || recipe.category;
    const priority = categoryOrder.includes(category) ? categoryOrder.indexOf(category) : categoryOrder.length;
    return { recipe, category, priority };
  }).sort((left, right) => left.priority - right.priority
    || left.recipe.sodium - right.recipe.sodium
    || left.recipe.name.localeCompare(right.recipe.name));
  const count = Math.max(0, Math.min(3, Math.floor(Number(limit) || 0)));
  const selected = [];
  const categories = new Set();
  for (const item of ranked) {
    if (!categories.has(item.category) && selected.length < count) {
      selected.push(item.recipe);
      categories.add(item.category);
    }
  }
  for (const item of ranked) {
    if (selected.length < count && !selected.some((recipe) => recipe.id === item.recipe.id)) selected.push(item.recipe);
  }
  return { status: selected.length ? 'ready' : 'empty', recipes: selected, targetCount: Object.keys(ceilings).length };
}
