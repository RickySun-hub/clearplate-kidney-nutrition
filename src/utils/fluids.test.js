import test from 'node:test';
import assert from 'node:assert/strict';
import { fluidAmountMl, fluidTotal, upsertFluid, validateFluidRecords } from './fluids.js';

test('fluid units use explicit US cup/fl oz conversions and reject invalid amounts', () => {
  assert.equal(fluidAmountMl('250', 'ml'), 250);
  assert.equal(fluidAmountMl(1, 'cup'), 236.5882365);
  assert.equal(fluidAmountMl(8, 'floz'), fluidAmountMl(1, 'cup'));
  for (const amount of ['', -1, 0, Infinity]) assert.throws(() => fluidAmountMl(amount, 'ml'));
});
test('linked drink can be updated once and disappears from total if food is removed', () => {
  const first = upsertFluid([], {id:'f1', name:'Milk', amountMl:120, time:'09:00', entryId:'meal1'});
  const next = upsertFluid(first, {id:'f2', name:'Milk', amountMl:240, time:'09:00', entryId:'meal1'});
  assert.equal(next.length, 1);
  assert.equal(fluidTotal(next, [{id:'meal1'}]), 240);
  assert.equal(fluidTotal(next, []), 0);
  assert.equal(fluidTotal([...next, {id:'water',name:'Water',amountMl:100,time:'10:00'}], []), 100);
});
test('fluid validation rejects duplicate ids/linked food and malformed records', () => {
  assert.equal(validateFluidRecords(undefined), true);
  assert.equal(validateFluidRecords([{id:'a',name:'Water',amountMl:100,time:'10:00'}]), true);
  assert.equal(validateFluidRecords([{id:'a',name:'Water',amountMl:null,time:'10:00'}]), false);
  const f={id:'a',name:'Milk',amountMl:100,time:'10:00',entryId:'meal1'};
  assert.equal(validateFluidRecords([f,f]), false);
  assert.equal(validateFluidRecords([f,{...f,id:'b'}]), false);
});

test('changing a drink display unit preserves the volume instead of reinterpreting the number', async () => {
  const { convertFluidAmount } = await import('./fluids.js');
  assert.equal(typeof convertFluidAmount, 'function');
  assert.equal(convertFluidAmount('', 'ml', 'cup'), '');
  assert.equal(convertFluidAmount(1, 'cup', 'floz'), 8);
  assert.equal(convertFluidAmount(8, 'floz', 'cup'), 1);
  assert.ok(Math.abs(fluidAmountMl(convertFluidAmount(250, 'ml', 'floz'), 'floz') - 250) < 1e-10);
  assert.throws(() => convertFluidAmount(250, 'ml', 'unknown'));
});

test('editing a separate drink to an existing food link replaces both records without double counting', () => {
  const standalone = { id: 'water', name: 'Water', amountMl: 200, time: '11:00' };
  const linked = { id: 'milk', name: 'Sample drink', amountMl: 120, time: '09:00', entryId: 'meal-1' };
  const next = upsertFluid([standalone, linked], { ...standalone, amountMl: 240, entryId: 'meal-1' });
  assert.equal(next.length, 1);
  assert.equal(fluidTotal(next, [{ id: 'meal-1' }]), 240);
  assert.equal(fluidTotal(next, []), 0);
});
