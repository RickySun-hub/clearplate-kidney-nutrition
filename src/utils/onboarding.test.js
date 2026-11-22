import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBmi, completeOnboarding, metricMeasurements, needsOnboarding, normalizeOnboardingDraft, restrictionStatus, restrictionSummary, validateOnboardingBasics, validateRestrictions } from './onboarding.js';

const patient = { accountRole: 'patient', age: 35, sex: 'female', heightCm: 175, weightKg: 70, activityLevel: 'light', allergies: [], allergiesStatus: 'none', intolerances: ['Lactose'], intolerancesStatus: 'listed', stage: '', treatment: '', sodiumTargetMg: 1800, proteinMinG: 50, proteinMaxG: 65 };

test('BMI uses canonical height and weight, with adult categories only from age 20', () => {
  const adult = calculateBmi(70, 175, 35);
  assert.equal(adult.display, '22.9');
  assert.equal(adult.category, 'Healthy weight range');
  assert.equal(calculateBmi(70, 175, 19).category, null);
  assert.equal(calculateBmi(70, 175, null).category, null);
  assert.equal(calculateBmi('', 175, 35), null);
  assert.equal(calculateBmi(70, 0, 35), null);
  assert.equal(calculateBmi(100, 200, 35).category, 'Overweight range');
});

test('imperial conversion yields the same metric BMI without sex or age inputs', () => {
  const canonical = metricMeasurements({ unit: 'imperial', heightFeet: 5, heightInches: 10, weightLb: 154.323584 });
  assert.ok(Math.abs(canonical.heightCm - 177.8) < 1e-9);
  assert.ok(Math.abs(canonical.weightKg - 70) < 1e-6);
  assert.equal(calculateBmi(canonical.weightKg, canonical.heightCm, 35).display, '22.1');
});

test('unknown restrictions and health context are not silently changed to none', () => {
  const draft = normalizeOnboardingDraft({ stage: '', treatment: '' });
  assert.equal(draft.allergiesStatus, 'unknown');
  assert.equal(draft.intolerancesStatus, 'unknown');
  assert.equal(draft.stage, '');
  assert.equal(draft.treatment, '');
  assert.equal(restrictionSummary(draft, 'allergies'), 'Not recorded');
  assert.equal(restrictionStatus({ allergiesStatus: 'none', allergies: ['Milk'] }, 'allergies'), 'listed');
  assert.equal(restrictionSummary({ allergiesStatus: 'none' }, 'allergies'), 'None reported');
});

test('one-time completion preserves existing targets and leaves unknown health context unknown', () => {
  assert.equal(needsOnboarding(patient), true);
  const result = completeOnboarding(patient, '2026-10-20T12:00:00.000Z');
  assert.equal(needsOnboarding(result), false);
  assert.equal(normalizeOnboardingDraft(result).onboarding.step, 'complete');
  assert.equal(result.sodiumTargetMg, 1800);
  assert.equal(result.proteinMinG, 50);
  assert.equal(result.proteinMaxG, 65);
  assert.equal(result.stage, '');
  assert.equal(result.treatment, '');
  assert.equal(result.onboarding.completedAt, '2026-10-20T12:00:00.000Z');
  assert.deepEqual(result.intolerances, ['Lactose']);
  assert.equal(needsOnboarding({ ...result, accountRole: '' }), true);
});

test('saved step resumes and dietitians skip patient measurements', () => {
  const resumed = normalizeOnboardingDraft({ ...patient, onboarding: { version: 1, step: 'health' } });
  assert.equal(resumed.onboarding.step, 'health');
  assert.equal(normalizeOnboardingDraft({ onboarding: { step: 'health' } }).onboarding.step, 'role');
  const rd = completeOnboarding({ accountRole: 'dietitian' });
  assert.equal(needsOnboarding(rd), false);
  assert.equal(rd.heightCm, undefined);
  assert.equal(rd.age, undefined);
});

test('invalid or incomplete answers cannot be marked completed', () => {
  assert.match(validateOnboardingBasics({ ...patient, age: 12.5 }), /age/);
  assert.match(validateOnboardingBasics({ ...patient, heightCm: 0 }), /height/);
  assert.match(validateOnboardingBasics({ ...patient, sex: '' }), /sex/);
  assert.match(validateRestrictions({ allergiesStatus: 'listed', allergies: [] }), /allergies/);
  assert.throws(() => completeOnboarding({ ...patient, activitySurvey: { work: 'invalid' } }), /activity/);
  assert.doesNotThrow(() => completeOnboarding({ ...patient, activityLevel: '', activitySurvey: { work: '', leisure: '' } }));
  assert.throws(() => completeOnboarding({ ...patient, weightKg: null }), /weight/);
  assert.throws(() => completeOnboarding({}), /Choose/);
});
