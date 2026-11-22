import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_QUESTIONS, normalizeActivitySurvey, validateActivitySurvey } from './activitySurvey.js';
import { normalizeOnboardingDraft, completeOnboarding } from './onboarding.js';
test('activity records two raw selections over the past year without derived scores', () => {
  assert.deepEqual(ACTIVITY_QUESTIONS.map(question => question.options.length), [5, 5]);
  const activitySurvey = { work: 'mostly-seated', leisure: 'weekend-light' };
  const result = completeOnboarding({ accountRole: 'patient', age: 35, sex: 'female', heightCm: 165, weightKg: 60, activitySurvey });
  assert.deepEqual(result.activitySurvey, { version: 1, period: 'past-year', ...activitySurvey });
  for (const key of ['activityScore', 'activityMultiplier', 'calorieTarget']) assert.equal(result[key], undefined);
});
test('legacy broad activity level is preserved but not guessed into new answers', () => {
  const result = normalizeOnboardingDraft({ activityLevel: 'moderate' });
  assert.equal(result.activityLevel, 'moderate');
  assert.deepEqual(result.activitySurvey, { version: 1, period: 'past-year', work: '', leisure: '' });
  assert.equal(validateActivitySurvey(result.activitySurvey), '');
  assert.match(validateActivitySurvey({ work: 'invented' }), /work/);
  assert.deepEqual(normalizeActivitySurvey({ work: 'invented' }).work, '');
});
