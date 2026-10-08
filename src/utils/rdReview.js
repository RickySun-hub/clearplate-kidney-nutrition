import { nutrientCoverage } from './nutrition.js';
import { normalizeNutrientPreferences } from './nutrientCatalog.js';
export function reviewDays(entries, recipes, profile, records, start, end) {
  const targets = {...normalizeNutrientPreferences(profile).nutrientTargets};
  if (!targets.sodium && Number.isFinite(profile.sodiumTargetMg)) targets.sodium={max:profile.sodiumTargetMg};
  if (!targets.protein && Number.isFinite(profile.proteinMinG) && Number.isFinite(profile.proteinMaxG)) targets.protein={min:profile.proteinMinG,max:profile.proteinMaxG};
  const dates=[...new Set([...entries.map(e=>e.date),...Object.keys(records)])].filter(d=>d>=start && d<=end).sort();
  return dates.map(date=>{
    const items=entries.filter(e=>e.date===date), coverage=nutrientCoverage(items,recipes);
    const nutrients=Object.fromEntries(Object.entries(coverage).map(([key,c])=>{
      const target=targets[key] || {};
      const status=c.knownCount && target.max!=null && c.knownSubtotal>target.max?'Above saved limit':!c.complete?'Incomplete':target.min!=null && c.knownSubtotal<target.min?'Below saved minimum (recorded foods)':target.min!=null || target.max!=null?'Within saved range (recorded foods)':'No saved target';
      return [key,{...c,target,status}];
    }));
    return {date,items,nutrients,reviews:records[date]?.mealReviews || {}};
  });
}
