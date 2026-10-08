export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export function nextMeal(entries, reviews = {}, date, hour = new Date().getHours()) {
  const due = hour < 11 ? ['Breakfast'] : hour < 17 ? ['Breakfast', 'Lunch'] : MEALS;
  return due.find(meal => !reviews[meal] && !entries.some(e => e.date === date && e.meal === meal)) || 'Snack';
}
export function mealQuestion(meal, hasEntries = false) {
  return hasEntries ? `Anything else for ${meal.toLowerCase()}? Include drinks, sauces, and snacks.` : `What did you have for ${meal.toLowerCase()} today? If you have not eaten it yet, you can skip it.`;
}
export function validConversation(value) {
  return Array.isArray(value) && value.length <= 40 && value.every(t => t && ['user','assistant'].includes(t.role) && typeof t.content === 'string' && t.content.length <= 2000 && ['voice','typed','assistant'].includes(t.source) && typeof t.at === 'string' && Number.isFinite(Date.parse(t.at)));
}
export function conversationText(turns = []) { return turns.filter(t => t.role === 'user').map(t => t.content).join('\n'); }
