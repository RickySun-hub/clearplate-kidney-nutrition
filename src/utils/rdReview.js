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
      const dataStatus=c.complete ? 'Nutrition data available' : c.knownCount ? 'Partial nutrition data' : 'Nutrition data missing';
      const above=c.knownCount>0 && target.max!=null && c.knownSubtotal>target.max;
      const status=above ? (c.complete ? 'Above saved limit' : 'Known amount above saved limit')
        : !c.complete ? 'Cannot assess full total'
        : target.min!=null && c.knownSubtotal<target.min ? 'Below saved minimum (recorded foods)'
        : target.min!=null && target.max!=null ? 'Within saved range (recorded foods)'
        : target.max!=null ? 'Within saved limit'
        : target.min!=null ? 'Meets saved minimum (recorded foods)' : 'No saved target';
      return [key,{...c,target,status,dataStatus,attention:above || (c.complete && target.min!=null && c.knownSubtotal<target.min)}];
    }));
    return {date,items,nutrients,reviews:records[date]?.mealReviews || {}};
  });
}
