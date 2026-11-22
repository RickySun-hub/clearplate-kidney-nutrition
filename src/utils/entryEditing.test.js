import test from 'node:test';
import assert from 'node:assert/strict';
import { editFoodEntry, recipeSnapshot, editableMealTime } from './entryEditing.js';
import { mealTotals } from './nutrition.js';
import { daySignature, isDayComplete } from './recording.js';
import { validateCareRecord } from './careCloud.js';
const food = { id: 'synthetic', name: 'Synthetic food', grams: 150, protein: 0.04, sodium: 100, calories: 0, potassium: null, phosphorus: 0 };
const entry = { id: 'one', date: '2026-10-14', meal: 'Lunch', source: 'custom', customFood: food, servings: 2 };
const draft = { date: entry.date, meal: 'Lunch', time: '12:30', amount: 300, unit: 'g', recipeId: '' };
test('editing source grams scales exactly once and preserves unknown and zero nutrients', () => {
  const edited = editFoodEntry(entry, draft, {}, entry.date);
  assert.equal(edited.servings, 2);
  assert.equal(mealTotals([edited], {}).protein, 0.08);
  assert.equal(mealTotals([edited], {}).potassium, null);
  assert.equal(mealTotals([edited], {}).phosphorus, 0);
  assert.equal(editFoodEntry(edited, {...draft, amount: 150}, {}, entry.date).servings, 1);
  assert.equal(entry.servings, 2);
});
test('invalid dates, amount and unsupported gram conversions are rejected', () => {
  for (const patch of [{date:'2026-02-30'}, {date:'2026-10-15'}, {amount:0}, {amount:-2}, {amount:Infinity}, {unit:'cups'}, {time:'25:00'}]) assert.throws(() => editFoodEntry(entry, {...draft,...patch}, {}, entry.date));
  assert.throws(() => editFoodEntry({...entry,customFood:{name:'Unmeasured'}}, draft, {}, entry.date));
});
test('date and portion edits invalidate completeness while retaining the source record', () => {
  const records = {[entry.date]:{completedAt:'2026-10-14T12:00:00Z',signature:daySignature([entry],entry.date)}};
  const edited=editFoodEntry(entry,{...draft,date:'2026-10-13'}, {}, entry.date);
  assert.equal(isDayComplete(records,[edited],entry.date), false);
  assert.equal(edited.customFood, food);
  assert.equal(edited.timeSource,'user-recorded');
});
test('new recipe snapshots and replacement foods survive recipe changes using existing record schema', () => {
  const recipes={synthetic:{...food}};
  const saved={...entry,customFood:recipeSnapshot(recipes.synthetic)};
  const replacement=editFoodEntry(entry,{...draft,recipeId:'synthetic',unit:'servings',amount:0.5},recipes,entry.date);
  recipes.synthetic.sodium=900;
  assert.equal(mealTotals([saved],recipes).sodium,200);
  assert.equal(mealTotals([replacement],recipes).sodium,50);
  assert.equal(validateCareRecord({profile:{name:'Synthetic'},entries:[replacement],dayRecords:{}}).entries[0].customFood.sodium,100);
});

test('scheduled/logging times are not reclassified as patient-confirmed meal times', () => {
  assert.equal(editableMealTime({time:'12:30 PM'}),'');
  assert.equal(editableMealTime({time:'12:30',timeSource:'recording-time'}),'');
  assert.equal(editableMealTime({time:'12:30 PM',timeSource:'user-recorded'}),'12:30');
  assert.equal(editableMealTime({time:'12:30 AM',timeSource:'user-recorded'}),'00:30');
  const scheduled={...entry,time:'12:30 PM'};
  const edited=editFoodEntry(scheduled,{...draft,time:editableMealTime(scheduled)}, {}, entry.date);
  assert.equal(edited.time,''); assert.equal(edited.timeSource,undefined);
});

test('portion-only edits preserve an unchanged estimated time provenance', () => {
 const original={...entry,time:'12:30',timeSource:'estimated'};
 assert.equal(editFoodEntry(original,draft,{},entry.date).timeSource,'estimated');
 assert.equal(editFoodEntry(original,{...draft,timeConfirmed:true},{},entry.date).timeSource,'user-recorded');
});
