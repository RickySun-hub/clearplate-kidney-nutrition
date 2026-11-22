import { normalizeActivitySurvey, validateActivitySurvey } from './activitySurvey.js';
export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STEPS = ['role', 'basics', 'bmi', 'health'];
export const ALLERGY_OPTIONS = ['Milk', 'Egg', 'Peanut', 'Tree nuts', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame'];
export const INTOLERANCE_OPTIONS = ['Lactose', 'Gluten', 'Fructose', 'Histamine'];
export const ACTIVITY_OPTIONS = [
  ['sedentary', 'Mostly seated', 'Most of my day is spent sitting.'],
  ['light', 'Lightly active', 'Some walking or light activity.'],
  ['moderate', 'Moderately active', 'Regular walking or moderate activity.'],
  ['active', 'Very active', 'A physically active day or frequent exercise.'],
  ['unknown', 'I’m not sure', 'I can update this later.'],
];

const positive = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0;
export const normalizeRestrictionList = value => Array.isArray(value)
  ? [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
  : [];

export function restrictionStatus(profile, key) {
  if (normalizeRestrictionList(profile?.[key]).length) return 'listed';
  return profile?.[`${key}Status`] === 'none' ? 'none' : 'unknown';
}

export function restrictionSummary(profile, key) {
  const status = restrictionStatus(profile, key);
  return status === 'listed' ? normalizeRestrictionList(profile[key]).join(', ') : status === 'none' ? 'None reported' : 'Not recorded';
}

export function needsOnboarding(profile) {
  return !['patient', 'dietitian'].includes(profile?.accountRole)
    || !profile?.onboarding?.completedAt;
}

export function normalizeOnboardingDraft(profile = {}) {
  const role = ['patient', 'dietitian'].includes(profile.accountRole) ? profile.accountRole : '';
  const requestedStep = profile.onboarding?.step;
  return {
    ...profile,
    accountRole: role,
    age: profile.age ?? '',
    sex: profile.sex ?? '',
    activityLevel: profile.activityLevel ?? '',
    activitySurvey: normalizeActivitySurvey(profile.activitySurvey),
    allergies: normalizeRestrictionList(profile.allergies),
    intolerances: normalizeRestrictionList(profile.intolerances),
    allergiesStatus: restrictionStatus(profile, 'allergies'),
    intolerancesStatus: restrictionStatus(profile, 'intolerances'),
    onboarding: {
      ...profile.onboarding,
      version: ONBOARDING_VERSION,
      step: role && profile.onboarding?.completedAt ? 'complete' : role && ONBOARDING_STEPS.includes(requestedStep) ? requestedStep : 'role',
      completedAt: profile.onboarding?.completedAt || null,
    },
  };
}

export function calculateBmi(weightKg, heightCm, age) {
  if (!positive(weightKg) || !positive(heightCm)) return null;
  const value = Number(weightKg) / (Number(heightCm) / 100) ** 2;
  if (!Number.isFinite(value)) return null;
  const adult = positive(age) && Number(age) >= 20;
  const category = !adult ? null : value < 18.5 ? 'Underweight range' : value < 25 ? 'Healthy weight range' : value < 30 ? 'Overweight range' : 'Obesity range';
  return { value, display: value.toFixed(1), category, adult };
}

// Store canonical metric measurements; presentation units do not affect the formula.
export function metricMeasurements({ unit = 'metric', heightCm, weightKg, heightFeet, heightInches, weightLb }) {
  if (unit === 'imperial') return {
    heightCm: (Number(heightFeet || 0) * 12 + Number(heightInches || 0)) * 2.54,
    weightKg: Number(weightLb) * 0.45359237,
  };
  return { heightCm: Number(heightCm), weightKg: Number(weightKg) };
}

export function validateOnboardingBasics(profile) {
  if (!Number.isInteger(Number(profile.age)) || Number(profile.age) < 1 || Number(profile.age) > 120) return 'Enter your age in years, from 1 to 120.';
  if (!['female', 'male', 'prefer-not-to-say'].includes(profile.sex)) return 'Choose a sex option, or select Prefer not to say.';
  if (!positive(profile.heightCm) || Number(profile.heightCm) < 50 || Number(profile.heightCm) > 275) return 'Check your height and its unit.';
  if (!positive(profile.weightKg) || Number(profile.weightKg) < 1 || Number(profile.weightKg) > 500) return 'Check your weight and its unit.';
  return '';
}

export function validateRestrictions(profile) {
  for (const key of ['allergies', 'intolerances']) {
    if (profile[`${key}Status`] === 'listed' && !normalizeRestrictionList(profile[key]).length) return `Select or enter your food ${key}, or choose None or Not sure.`;
  }
  return '';
}

export function completeOnboarding(profile, now = new Date().toISOString()) {
  if (!['patient', 'dietitian'].includes(profile.accountRole)) throw new Error('Choose how you will use Nepholio.');
  if (profile.accountRole === 'patient') {
    const error = validateOnboardingBasics(profile) || validateRestrictions(profile);
    if (error) throw new Error(error);
    const activityError = validateActivitySurvey(profile.activitySurvey);
    if (activityError) throw new Error(activityError);
  }
  return {
    ...profile,
    activitySurvey: normalizeActivitySurvey(profile.activitySurvey),
    ...(profile.accountRole === 'patient' ? { age: Number(profile.age), heightCm: Number(profile.heightCm), weightKg: Number(profile.weightKg) } : {}),
    onboarding: { ...profile.onboarding, version: ONBOARDING_VERSION, step: 'complete', completedAt: now },
  };
}
