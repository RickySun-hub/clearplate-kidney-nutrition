import assert from "node:assert/strict";
import test from "node:test";
import { hasValidProteinTargets, normalizeProfileDraft, updateProfileDraft, optionalProfileNumbers, profileForStorage } from "./profile.js";
import { validateCareRecord } from './careCloud.js';
import { completeOnboarding } from './onboarding.js';

const automaticProfile = {
  name: "Alex",
  stage: "G2",
  treatment: "not-dialysis",
  weightKg: 70,
  proteinMinG: 56,
  proteinMaxG: 70,
  useGuidelineProteinRange: true,
};

test('finishing onboarding after leaving automatic target eligibility saves unknown bounds as null', () => {
  for (const changes of [{stage:'G5'}, {treatment:'dialysis'}, {stage:'',treatment:''}]) {
    const completed=completeOnboarding({...automaticProfile,...changes,accountRole:'patient',age:35,sex:'female',heightCm:175,activityLevel:'moderate',allergies:[],intolerances:[]});
    const profile=profileForStorage(completed);
    const saved=validateCareRecord({profile,entries:[],dayRecords:{}});
    assert.equal(saved.profile.proteinMinG,null);
    assert.equal(saved.profile.proteinMaxG,null);
    assert.equal(saved.profile.useGuidelineProteinRange,false);
    assert.equal(saved.profile.onboarding.step,'complete');
  }
});

test('retained blank-target drafts are recoverable without changing known targets or answers', () => {
  const profile=profileForStorage({...automaticProfile,useGuidelineProteinRange:false,proteinMinG:'',proteinMaxG:'',sodiumTargetMg:2000,activityLevel:'moderate'});
  assert.equal(profile.proteinMinG,null);
  assert.equal(profile.proteinMaxG,null);
  assert.equal(profile.sodiumTargetMg,2000);
  assert.equal(profile.activityLevel,'moderate');
  assert.doesNotThrow(()=>validateCareRecord({profile,entries:[],dayRecords:{}}));
  assert.deepEqual(profileForStorage(automaticProfile).proteinMinG,56);
});

test("a stored G5 automatic profile requires fresh manual protein targets", () => {
  assert.deepEqual(normalizeProfileDraft({ ...automaticProfile, stage: "G5" }), {
    ...automaticProfile,
    stage: "G5",
    useGuidelineProteinRange: false,
    proteinMinG: "",
    proteinMaxG: "",
  });
});

test("leaving guideline eligibility clears inherited automatic targets", () => {
  assert.deepEqual(updateProfileDraft(automaticProfile, "stage", "G5"), {
    ...automaticProfile,
    stage: "G5",
    useGuidelineProteinRange: false,
    proteinMinG: "",
    proteinMaxG: "",
  });
  assert.deepEqual(updateProfileDraft(automaticProfile, "treatment", "dialysis"), {
    ...automaticProfile,
    treatment: "dialysis",
    useGuidelineProteinRange: false,
    proteinMinG: "",
    proteinMaxG: "",
  });
});

test("manual targets survive stage and treatment changes", () => {
  const manual = { ...automaticProfile, useGuidelineProteinRange: false, proteinMinG: 45, proteinMaxG: 60 };
  assert.equal(updateProfileDraft(manual, "stage", "G5").proteinMinG, 45);
  assert.equal(updateProfileDraft(manual, "treatment", "dialysis").proteinMaxG, 60);
});

test("eligible automatic profiles recalculate when weight changes", () => {
  const result = updateProfileDraft(automaticProfile, "weightKg", "80");
  assert.equal(result.proteinMinG, 64);
  assert.equal(result.proteinMaxG, 80);
});

test("protein target validity rejects missing and reversed ranges", () => {
  assert.equal(hasValidProteinTargets({ proteinMinG: "", proteinMaxG: "" }), false);
  assert.equal(hasValidProteinTargets({ proteinMinG: 70, proteinMaxG: 60 }), false);
  assert.equal(hasValidProteinTargets({ ...automaticProfile, stage: "G5" }), false);
  assert.equal(hasValidProteinTargets({ proteinMinG: 55, proteinMaxG: 75 }), true);
});

test('missing profile targets remain null and users can save partial measurements', () => {
  assert.deepEqual(optionalProfileNumbers({weightKg:'70'}), {weightKg:70,heightCm:null,sodiumTargetMg:null,proteinMinG:null,proteinMaxG:null,fluidTargetMl:null});
  assert.throws(() => optionalProfileNumbers({proteinMinG:50}));
  assert.throws(() => optionalProfileNumbers({proteinMinG:70,proteinMaxG:50}));
  assert.throws(() => optionalProfileNumbers({sodiumTargetMg:-1}));
});

test('optional profile age preserves unknown and rejects fractional or invalid values', () => {
  assert.equal(optionalProfileNumbers({ age: '' }).age, null);
  assert.equal(optionalProfileNumbers({ age: '42' }).age, 42);
  assert.throws(() => optionalProfileNumbers({ age: 4.5 }), /age/);
  assert.throws(() => optionalProfileNumbers({ age: 121 }), /age/);
});

test('a known child age disables inherited adult guideline targets but retains manual ones', () => {
  const child = updateProfileDraft(automaticProfile, 'age', 12);
  assert.equal(child.useGuidelineProteinRange, false);
  assert.equal(child.proteinMinG, '');
  assert.equal(child.proteinMaxG, '');
  assert.equal(updateProfileDraft({ ...automaticProfile, useGuidelineProteinRange: false }, 'age', 12).proteinMinG, 56);
});


test('optional fluid target preserves unknown and accepts only positive amounts', () => {
  assert.equal(optionalProfileNumbers({ fluidTargetMl: '' }).fluidTargetMl, null);
  assert.equal(optionalProfileNumbers({ fluidTargetMl: '2000' }).fluidTargetMl, 2000);
  assert.throws(() => optionalProfileNumbers({ fluidTargetMl: 0 }), /positive/);
  assert.throws(() => optionalProfileNumbers({ fluidTargetMl: -200 }), /positive/);
  assert.equal(profileForStorage({ fluidTargetMl: '' }).fluidTargetMl, null);
});
