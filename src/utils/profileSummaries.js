import { NUTRIENTS, normalizeNutrientPreferences, validNutrientValue } from './nutrientCatalog.js';
import { formatAmount } from './nutrition.js';

export function profileSummaries(profile = {}) {
  const body = [];
  for (const [key, unit] of [['age', 'years'], ['weightKg', 'kg'], ['heightCm', 'cm']]) {
    if (validNutrientValue(profile[key]) && Number(profile[key]) > 0) body.push(`${formatAmount(profile[key], 1)} ${unit}`);
  }
  const sex = { female: 'Female', male: 'Male', 'prefer-not-to-say': 'Sex not disclosed' }[profile.sex];
  if (sex) body.push(sex);
  if (profile.stage) body.push(`CKD ${profile.stage}`);
  const treatment = { dialysis: 'Receiving dialysis', 'not-dialysis': 'Not receiving dialysis' }[profile.treatment];
  if (treatment) body.push(treatment);
  const preferences = normalizeNutrientPreferences(profile);
  const targets = [];
  if (validNutrientValue(profile.sodiumTargetMg)) targets.push(`Sodium ≤ ${formatAmount(profile.sodiumTargetMg)} mg/day`);
  if (validNutrientValue(profile.proteinMinG) && validNutrientValue(profile.proteinMaxG)) targets.push(`Protein ${formatAmount(profile.proteinMinG, 1)}–${formatAmount(profile.proteinMaxG, 1)} g/day`);
  if (validNutrientValue(profile.fluidTargetMl)) targets.push(`Fluid ${formatAmount(profile.fluidTargetMl)} mL/day`);
  for (const nutrient of NUTRIENTS.filter(n => !['sodium', 'protein'].includes(n.key))) {
    const target = preferences.nutrientTargets[nutrient.key];
    if (!target) continue;
    const amount = target.min != null && target.max != null ? `${formatAmount(target.min, 2)}–${formatAmount(target.max, 2)}` : target.min != null ? `≥ ${formatAmount(target.min, 2)}` : `≤ ${formatAmount(target.max, 2)}`;
    targets.push(`${nutrient.label} ${amount} ${nutrient.unit}/day`);
  }
  const tracked = NUTRIENTS.filter(n => preferences.trackedNutrients.includes(n.key)).map(n => n.label);
  return {
    body: body.length ? `Saved: ${body.join(' · ')}` : 'No body or health details saved',
    targets: targets.length ? `Saved: ${targets.join(' · ')}` : 'No daily targets saved',
    tracked: tracked.length ? `Saved: ${tracked.join(' · ')}` : 'No nutrients selected',
  };
}
