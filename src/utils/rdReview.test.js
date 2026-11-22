import test from 'node:test';
import assert from 'node:assert/strict';
import { isEstimatedFoodEntry, reviewDays, reviewDateRange, reviewQuality } from './rdReview.js';
import { daySignature } from './recording.js';
const profile = { sodiumTargetMg: 2000, proteinMinG: 50, proteinMaxG: 70 };
const date = '2026-10-10';
const entries = [{ id: 'one', date, meal: 'Lunch', source: 'custom', servings: 1, customFood: { name: 'Synthetic food', sodium: 1500, protein: null, method: 'unpackaged' } }];
test('RD uses a valid confirmed-day target snapshot and labels fallback targets', () => {
  const records = { [date]: { completedAt: date+'T20:00:00Z', signature: daySignature(entries,date), profile: { ...profile,sodiumTargetMg:1000 } } };
  const day = reviewDays(entries,{},profile,records,date,date)[0];
  assert.equal(day.targetSource,'Confirmed-day snapshot');
  assert.equal(day.nutrients.sodium.target.max,1000);
  assert.equal(day.nutrients.sodium.status,'Above saved limit');
  assert.equal(day.nutrients.protein.status,'Unknown');
  const edited=reviewDays([{...entries[0],servings:2}],{},profile,records,date,date)[0];
  assert.equal(edited.targetSource,'Saved day snapshot · log edited or reopened');
  assert.equal(edited.nutrients.sodium.target.max,1000);
  assert.equal(edited.nutrients.sodium.status,'Known subtotal only');
});
test('missing days remain unknown and incomplete days cannot be marked within targets', () => {
  const days=reviewDays(entries,{},profile,{},date,'2026-10-11');
  assert.equal(days.length,2);assert.equal(days[0].nutrients.sodium.status,'Known subtotal only');
  assert.equal(days[1].nutrients.sodium.total,null);assert.equal(days[1].nutrients.sodium.status,'No food records');
  assert.deepEqual(reviewQuality(days,{}),{missingDays:1,unconfirmedDays:1,estimatedItems:1,unknownMealTimes:1});
});
test('date range validates impossible, reversed and unbounded inputs', () => {
  for(const [start,end] of [['','2026-10-10'],['2026-02-30','2026-03-01'],['2026-10-11','2026-10-10'],['2020-01-01','2026-10-10']])assert.ok(reviewDateRange(start,end).error);
  assert.equal(reviewDateRange('2026-10-10','2026-10-10').dates.length,1);
});
test('known zero remains zero and partial nutrient data is never complete', () => {
  const items=[{...entries[0],customFood:{sodium:0}},{...entries[0],id:'two',customFood:{sodium:null}}];
  const records={[date]:{completedAt:date,signature:daySignature(items,date)}};
  const day=reviewDays(items,{},profile,records,date,date)[0];
  assert.equal(day.nutrients.sodium.knownSubtotal,0);assert.equal(day.nutrients.sodium.knownCount,1);
  assert.equal(day.nutrients.sodium.total,null);assert.equal(day.nutrients.sodium.status,'Known subtotal only');
});

test('invalid saved ranges never become intake comparisons or legacy fallbacks', () => {
  const items=[{...entries[0],customFood:{sodium:1500,protein:65}}];
  for(const saved of [
    {...profile,proteinMinG:80,proteinMaxG:60},
    {...profile,useGuidelineProteinRange:true,treatment:'dialysis',stage:'G5'},
    {...profile,nutrientTargets:{protein:{min:90,max:60},sodium:{min:2000,max:1000}}},
  ]) {
    const records={[date]:{completedAt:date,signature:daySignature(items,date),profile:saved}};
    const day=reviewDays(items,{},profile,records,date,date)[0];
    assert.equal(day.nutrients.protein.status,'Targets need review');
    assert.deepEqual(day.nutrients.protein.target,{});
    assert.equal(day.targetSource,'Confirmed-day snapshot');
    if(saved.nutrientTargets)assert.equal(day.nutrients.sodium.status,'Targets need review');
  }
});

test('saved ingredient and USDA estimates remain classified as estimates in history and RD quality', () => {
  const items = ['recipe-estimate', 'usda-estimate', 'unpackaged', 'label'].map((method, index) => ({
    id: `estimate-${index}`, date, meal: 'Lunch', time: '12:30', timeSource: 'user-recorded', source: 'custom', servings: 1,
    customFood: { method, sodium: 100, protein: 15, calories: 200 },
  }));
  const records = { [date]: { completedAt: date, signature: daySignature(items, date) } };
  const days = reviewDays(items, {}, profile, records, date, date);
  assert.equal(days[0].confirmedComplete, true);
  assert.equal(reviewQuality(days, {}).estimatedItems, 3);
  assert.equal(isEstimatedFoodEntry(items[0]), true);
  assert.equal(isEstimatedFoodEntry(items[3]), false);
  assert.equal(isEstimatedFoodEntry({ source: 'custom', customFood: { fdcId: 123 } }), true);
  assert.equal(isEstimatedFoodEntry({ source: 'recipe', recipeId: 'missing' }), false);
});
