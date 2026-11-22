import { proteinRangeForWeight } from "./nutrition.js";

const guidelineStages = new Set(["G1", "G2", "G3a", "G3b", "G4"]);

export const isGuidelineProteinEligible = (profile) =>
  profile?.treatment === "not-dialysis" && guidelineStages.has(profile?.stage)
  && (profile?.age == null || String(profile.age).trim() === '' || Number(profile.age) >= 18);

export const hasValidProteinTargets = (profile) =>
  !(profile?.useGuidelineProteinRange && !isGuidelineProteinEligible(profile))
  && Number.isFinite(Number(profile?.proteinMinG))
  && String(profile.proteinMinG).trim() !== ""
  && Number(profile.proteinMinG) > 0
  && Number.isFinite(Number(profile?.proteinMaxG))
  && String(profile.proteinMaxG).trim() !== ""
  && Number(profile.proteinMaxG) >= Number(profile.proteinMinG);

export function normalizeProfileDraft(profile) {
  const draft = { ...profile };
  if (draft.useGuidelineProteinRange && !isGuidelineProteinEligible(draft)) {
    draft.useGuidelineProteinRange = false;
    draft.proteinMinG = "";
    draft.proteinMaxG = "";
  }
  return draft;
}

// Form blanks represent unknown values. Persist null, never an empty string or zero.
export function profileForStorage(profile) {
  const result = normalizeProfileDraft(profile);
  for (const key of ['weightKg', 'heightCm', 'sodiumTargetMg', 'proteinMinG', 'proteinMaxG', 'fluidTargetMl']) {
    if (result[key] == null || String(result[key]).trim() === '') result[key] = null;
  }
  return result;
}

export function updateProfileDraft(current, key, value) {
  const next = { ...current, [key]: value };
  if (current.useGuidelineProteinRange && !isGuidelineProteinEligible(next)) {
    next.useGuidelineProteinRange = false;
    next.proteinMinG = "";
    next.proteinMaxG = "";
    return next;
  }
  if (key === "useGuidelineProteinRange") {
    next.useGuidelineProteinRange = Boolean(value) && isGuidelineProteinEligible(next);
  }
  if (next.useGuidelineProteinRange && isGuidelineProteinEligible(next)
      && (key === "weightKg" || key === "useGuidelineProteinRange")) {
    const range = proteinRangeForWeight(next.weightKg);
    next.proteinMinG = range.min;
    next.proteinMaxG = range.max;
  }
  return next;
}

// Missing personal measurements/targets remain unknown; never coerce them to zero.
export function optionalProfileNumbers(draft) {
  const result = {};
  if (Object.hasOwn(draft, 'age')) {
    if (draft.age == null || String(draft.age).trim() === '') result.age = null;
    else if (!Number.isInteger(Number(draft.age)) || Number(draft.age) < 1 || Number(draft.age) > 120) throw Error('Enter age as a whole number from 1 to 120, or leave it blank.');
    else result.age = Number(draft.age);
  }
  for (const key of ['weightKg', 'heightCm', 'sodiumTargetMg', 'proteinMinG', 'proteinMaxG', 'fluidTargetMl']) {
    const raw = draft[key];
    if (raw == null || String(raw).trim() === '') result[key] = null;
    else if (!Number.isFinite(Number(raw)) || Number(raw) <= 0) throw Error('Enter positive numbers for the measurements and targets you know, or leave them blank.');
    else result[key] = Number(raw);
  }
  if ((result.proteinMinG === null) !== (result.proteinMaxG === null)) throw Error('Enter both protein bounds, or leave both blank.');
  if (result.proteinMinG !== null && result.proteinMinG > result.proteinMaxG) throw Error('Protein minimum must be less than or equal to the maximum.');
  return result;
}
