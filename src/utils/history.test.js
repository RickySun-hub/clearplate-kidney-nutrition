import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarMonth, historyDayStatus } from "./history.js";

const profile = {
  sodiumTargetMg: 2000,
  proteinMinG: 56,
  proteinMaxG: 70,
};

test("historyDayStatus distinguishes empty, within, and review days", () => {
  assert.equal(historyDayStatus({ sodium: 0, protein: 0 }, 0, profile), "empty");
  assert.equal(historyDayStatus({ sodium: 1720, protein: 63 }, 3, profile), "within");
  assert.equal(historyDayStatus({ sodium: 2100, protein: 63 }, 3, profile), "review");
  assert.equal(historyDayStatus({ sodium: 1200, protein: 45 }, 3, profile), "review");
  assert.equal(historyDayStatus({ sodium: 1200, protein: 75 }, 3, profile), "review");
  assert.equal(historyDayStatus({ sodium: 1200, protein: 0 }, 1, { ...profile, proteinMinG: "", proteinMaxG: "" }), "review");
});

test("buildCalendarMonth returns a Sunday-first grid with stable date keys", () => {
  const cells = buildCalendarMonth(2026, 7);
  assert.equal(cells.length, 42);
  assert.equal(cells[0], null);
  assert.deepEqual(cells[6], { day: 1, dateKey: "2026-08-01", cellIndex: 6 });
  assert.deepEqual(cells[36], { day: 31, dateKey: "2026-08-31", cellIndex: 36 });
  assert.equal(cells[37], null);
});

test('unknown sodium cannot earn a within-limits calendar status',()=>{
 for(const sodium of [null,undefined,'',NaN])assert.equal(historyDayStatus({sodium,protein:63},1,profile),'review');
 assert.equal(historyDayStatus({sodium:0,protein:63},1,profile),'within');
});

test('history cards never turn missing nutrients into zero progress or a deficit',async()=>{
 const {historyNutritionState}=await import('./history.js');
 const state=historyNutritionState({sodium:null,protein:null},1,profile);
 assert.equal(state.sodiumProgress,undefined);assert.equal(state.proteinProgress,undefined);
 assert.equal(state.sodiumStatus,'Incomplete nutrient data');assert.equal(state.proteinStatus,'Incomplete nutrient data');
 const zero=historyNutritionState({sodium:0,protein:0},1,profile);
 assert.equal(zero.sodiumProgress,0);assert.equal(zero.sodiumStatus,'Within recorded limit');
 assert.equal(zero.proteinStatus,'56 g below range');
 const empty=historyNutritionState({sodium:0,protein:0},0,profile);
 assert.equal(empty.sodiumStatus,'No foods recorded');assert.equal(empty.proteinProgress,undefined);
 const invalid=historyNutritionState({sodium:30,protein:63},1,{...profile,sodiumTargetMg:null});
 assert.equal(invalid.sodiumStatus,'Targets need review');assert.equal(invalid.sodiumProgress,undefined);
});
