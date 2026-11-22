export const isDiscoveryMode = mode => mode === 'recipes' || mode === 'plan';
export function discoveryPreferences(mode, value) {
  if (!isDiscoveryMode(mode) || !value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid preferences');
  if (mode === 'recipes') {
    if (typeof value.search !== 'string' || !value.search.trim() || value.search.length > 200) throw Error('Name the recipe or ingredients');
    return {search:value.search.trim()};
  }
  if (!Array.isArray(value.selectedMeals) || !value.selectedMeals.length || value.selectedMeals.length > 4 || !value.selectedMeals.every(m => ['Breakfast','Lunch','Dinner','Snack'].includes(m)) || !['balanced','lowest-sodium','simplest'].includes(value.activeObjective)) throw Error('Select meals and a supported comparison');
  return {selectedMeals:[...new Set(value.selectedMeals)],activeObjective:value.activeObjective};
}
export function runDiscoveryTool(mode, name, args, onPreferences) {
  if (name !== 'prepare_discovery_preferences') return {status:'unsupported_tool',message:'Only discovery preferences are allowed. No records can be saved.'};
  const preferences = discoveryPreferences(mode,args);
  onPreferences(preferences);
  return {status:'review_required',preferences,message:'Draft conditions displayed. Ask the user to review and apply with the button. No food was logged. No targets were changed.'};
}
