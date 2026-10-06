export const DEFAULT_FILTERS = Object.freeze({ search: '', category: '', diet: '', preparation: '', source: '', maxSodium: '', maxProtein: '', maxPotassium: '', sort: 'name' });

const hasContent = (items) => Array.isArray(items) && items.length > 0 && items.every((item) => typeof item === 'string' && item.trim());
const nutrientNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Discovery annotations are editorial drafts based on the complete imported list.
 * Missing source and unresolved alternatives must never become diet evidence.
 * Metadata is intentionally an inspected allowlist, rather than title inference.
 */
export function enrichRecipe(recipe, detail, annotation = {}) {
  const full = hasContent(detail?.ingredients) && hasContent(detail?.steps);
  const diet = full && ['vegetarian', 'vegan'].includes(annotation.diet) ? annotation.diet : 'unknown';
  return {
    ...recipe,
    category: annotation.category || (recipe.category === 'sauce' ? 'Sauces' : recipe.category),
    diet,
    dietStatus: diet === 'unknown' ? 'unknown' : 'draft-unreviewed',
    preparation: full && annotation.preparation === 'no-cook' ? 'no-cook' : 'unknown',
    preparationNote: full ? annotation.preparationNote || '' : '',
    sourceCompleteness: full ? 'full' : 'nutrition-only',
    searchText: `${recipe.name} ${detail?.ingredients?.join(' ') || ''}`.toLowerCase(),
  };
}

export function filterRecipes(recipes, selections = {}) {
  const filters = { ...DEFAULT_FILTERS, ...selections };
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const result = recipes.filter((recipe) => {
    if (filters.category && recipe.category !== filters.category) return false;
    if (filters.diet && recipe.diet !== filters.diet && !(filters.diet === 'vegetarian' && recipe.diet === 'vegan')) return false;
    if (filters.preparation && recipe.preparation !== filters.preparation) return false;
    if (filters.source && recipe.sourceCompleteness !== filters.source) return false;
    if (!terms.every((term) => (recipe.searchText || recipe.name.toLowerCase()).includes(term))) return false;
    return [['maxSodium', 'sodium'], ['maxProtein', 'protein'], ['maxPotassium', 'potassium']].every(([key, nutrient]) => {
      if (filters[key] === '' || filters[key] == null) return true;
      const ceiling = Number(filters[key]);
      const value = nutrientNumber(recipe[nutrient]);
      return Number.isFinite(ceiling) && ceiling >= 0 && value !== null && value <= ceiling;
    });
  });
  return result.sort((a, b) => {
    if (['sodium', 'protein', 'potassium'].includes(filters.sort)) {
      const left = nutrientNumber(a[filters.sort]);
      const right = nutrientNumber(b[filters.sort]);
      if (left === null && right !== null) return 1;
      if (left !== null && right === null) return -1;
      if (left !== null && right !== null && left !== right) return left - right;
    }
    return a.name.localeCompare(b.name);
  });
}
