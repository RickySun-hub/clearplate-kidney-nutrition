import { localDateKey } from './nutrition.js';
import { isMeal } from './meals.js';

export function editableMealTime(entry) {
  if (entry.timeSource !== 'user-recorded') return '';
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time || '')) return entry.time;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(entry.time || '');
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) return '';
  return `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`;
}

// Use the existing embedded-food format. Never backfill old recipe nutrition.
export function recipeSnapshot(recipe, servingDescription) {
  return { ...recipe, ...(servingDescription ? {servingDescription} : {}), method: 'recipe-estimate', methodLabel: 'Recipe estimate · saved when logged', sourceLabel: 'Recipe estimate · saved when logged' };
}

export function editFoodEntry(entry, draft, recipes, today = localDateKey()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(Date.parse(draft.date)) || new Date(draft.date).toISOString().slice(0, 10) !== draft.date || draft.date > today) throw Error('Choose a valid date on or before today.');
  if (!isMeal(draft.meal)) throw Error('Choose a meal.');
  if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) throw Error('Choose a valid meal time.');
  const replacing = Boolean(draft.recipeId);
  const food = draft.customFood || (replacing ? recipes[draft.recipeId] : entry.source === 'custom' ? entry.customFood : recipes[entry.recipeId]);
  if (!food) throw Error('This food source is unavailable. Choose a replacement recipe.');
  const amount = Number(draft.amount);
  const grams = Number(food.grams);
  if (!['servings', 'g'].includes(draft.unit) || draft.unit === 'g' && (!Number.isFinite(grams) || grams <= 0)) throw Error('Gram conversion is unavailable for this food. Use source servings.');
  const servings = draft.unit === 'g' ? amount / grams : amount;
  if (!Number.isFinite(servings) || servings <= 0 || servings > 1000) throw Error('Enter a positive amount of up to 1,000 source servings.');
  return { ...entry, date: draft.date, meal: draft.meal, time: draft.time, timeSource: draft.time ? (draft.timeConfirmed || draft.time !== entry.time ? 'user-recorded' : entry.timeSource) : undefined, servings,
    ...(draft.customFood ? { source: 'custom', recipeId: draft.recipeId || entry.recipeId, customFood: JSON.parse(JSON.stringify(draft.customFood)) } : replacing ? { source: 'custom', recipeId: draft.recipeId, customFood: recipeSnapshot(food) } : {}),
    editedAt: new Date().toISOString() };
}
