import { localDateKey } from './nutrition.js';

// Keep the user's nutrient display choices, but never infer past targets from today's profile.
export function profileForDate(profile = {}, records = {}, date, today = localDateKey()) {
  if (records[date]?.profile) return records[date].profile;
  if (date === today) return profile;
  return { trackedNutrients: profile.trackedNutrients, nutrientTargets: {} };
}
