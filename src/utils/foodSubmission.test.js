import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFoodSubmission, catalogFoodSnapshot } from './foodSubmission.js';
test('submission keeps unknown nutrients null and validates label basis/barcode', () => {
  const food=normalizeFoodSubmission({name:'Example cereal',brand:'Example',barcode:'012345678901',servingDescription:'1 cup',nutrients:{calories:100,sodium:0}});
  assert.equal(food.nutrients.sodium,0); assert.equal(food.nutrients.phosphorus,null);
  assert.throws(()=>normalizeFoodSubmission({...food,barcode:'bad'}));
  assert.throws(()=>normalizeFoodSubmission({...food,servingDescription:''}));
  assert.throws(()=>normalizeFoodSubmission({...food,nutrients:{sodium:-1}}));
});
test('catalog recording snapshots data and never borrows submitter identity', () => {
  const row={id:'food1',version:2,food:normalizeFoodSubmission({name:'Milk',servingDescription:'1 cup',nutrients:{protein:8}}),owner_id:'private'};
  const saved=catalogFoodSnapshot(row);
  row.food.nutrients.protein=999;
  assert.equal(saved.protein,8); assert.equal(saved.catalogVersion,2); assert.equal(saved.owner_id,undefined);
});
