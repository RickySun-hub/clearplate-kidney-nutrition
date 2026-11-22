import { profileForStorage } from './profile.js';

// Compare persisted JSON, not React object identity. Legacy drafts may omit
// collections added later, and profile drafts use empty strings for nulls.
export function samePendingRecord(left, right) {
  const normalize = record => ({profile:profileForStorage(record.profile),entries:record.entries || [],dayRecords:record.dayRecords || {},customRecipes:record.customRecipes || [],customRecipeDetails:record.customRecipeDetails || {}});
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(normalize(left))) === JSON.stringify(canonical(normalize(right)));
}
