import { profileForDate } from './historicalProfile.js';
import { localDateKey } from './nutrition.js';
import { nutrientCoverage } from './nutrition.js';
import { normalizeNutrientPreferences, validNutrientValue } from './nutrientCatalog.js';
import { hasValidProteinTargets } from './profile.js';
import { isDayComplete } from './recording.js';

export function reviewDateRange(start, end) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end) || start > end) return { dates: [], error: 'Choose a valid start and end date.' };
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count > 366) return { dates: [], error: 'Choose a range of up to 366 days.' };
  return { dates: Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10)), error: '' };
}

export function reviewDays(entries, recipes, profile, records, start, end) {
  return reviewDateRange(start, end).dates.map(date => {
    const items = entries.filter(e => e.date === date);
    const confirmedComplete = isDayComplete(records, entries, date);
    const snapshot = records[date]?.profile;
    const saved = profileForDate(profile, records, date);
    const targets = { ...normalizeNutrientPreferences(saved).nutrientTargets };
    if (!targets.sodium && validNutrientValue(saved.sodiumTargetMg)) targets.sodium = { max: Number(saved.sodiumTargetMg) };
    const invalidTargets = new Set();
    for (const [key, raw] of Object.entries(saved.nutrientTargets || {})) {
      if (raw && validNutrientValue(raw.min) && validNutrientValue(raw.max) && Number(raw.min) > Number(raw.max)) {
        invalidTargets.add(key); delete targets[key];
      }
    }
    if (!targets.protein && !invalidTargets.has('protein')) {
      if (hasValidProteinTargets(saved)) targets.protein = { min: Number(saved.proteinMinG), max: Number(saved.proteinMaxG) };
      else if ([saved.proteinMinG, saved.proteinMaxG].some(v => v != null && String(v).trim() !== '')) invalidTargets.add('protein');
    }
    const nutrients = Object.fromEntries(Object.entries(nutrientCoverage(items, recipes)).map(([key, c]) => {
      const target = targets[key] || {};
      const status = !items.length ? 'No food records' : !c.knownCount ? 'Unknown'
        : !confirmedComplete || !c.complete ? 'Known subtotal only'
        : invalidTargets.has(key) ? 'Targets need review'
        : target.max != null && c.knownSubtotal > target.max ? 'Above saved limit'
        : target.min != null && c.knownSubtotal < target.min ? 'Below saved minimum (recorded foods)'
        : target.min != null || target.max != null ? 'Within saved range (recorded foods)' : 'No saved target';
      return [key, { ...c, target, targetNeedsReview: invalidTargets.has(key), status }];
    }));
    return { date, items, nutrients, confirmedComplete, targetSource: snapshot ? (confirmedComplete ? 'Confirmed-day snapshot' : 'Saved day snapshot · log edited or reopened') : date === localDateKey() ? 'Current saved targets · today' : 'No historical target snapshot', reviews: records[date]?.mealReviews || {} };
  });
}

export function reviewQuality(days, recipes) {
  const items = days.flatMap(day => day.items);
  return {
    missingDays: days.filter(day => !day.items.length).length,
    unconfirmedDays: days.filter(day => day.items.length && !day.confirmedComplete).length,
    estimatedItems: items.filter(entry => isEstimatedFoodEntry(entry, recipes)).length,
    unknownMealTimes: items.filter(entry => !entry.time || entry.timeSource !== 'user-recorded').length,
  };
}

export function isEstimatedFoodEntry(entry, recipes = {}) {
  const food = entry.source === 'custom' ? entry.customFood : recipes[entry.recipeId];
  return Boolean(food?.fdcId || ['unpackaged', 'usda-estimate', 'recipe-estimate'].includes(food?.method));
}
