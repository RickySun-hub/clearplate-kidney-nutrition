import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotService, getSnapshotService } from './snapshot.js';

test('common whole-food matches rank before composite foods', async () => {
  const result = await getSnapshotService().search({q:'banana',pageSize:5});
  assert.ok(result.foods.some(food=>food.description.toLowerCase()==='bananas, raw'));
});

const catalog = { sources: [{ dataType: 'Foundation', release: '2026-04', url: 'https://fdc.nal.usda.gov/example.zip' }], foods: [
  { fdcId: 123, description: 'Rice, brown, cooked', dataType: 'Foundation', basis: 'per100g', release: '2026-04',
    nutrients: { calories: 123, protein: 2, carbs: -1, sodium: 0 }, portions: [{ amount: 1, gramWeight: 100, description: 'cup' }] },
  { fdcId: 456, description: 'Rice flour', dataType: 'SR Legacy', basis: 'per100g', release: '2018-04', nutrients: {} },
] };

test('snapshot search filters terms/types and identifies public release, never live', async () => {
  const service = createSnapshotService({ catalog });
  const result = await service.search({ q: 'brown rice', dataTypes: 'Foundation', pageSize: '1' });
  assert.equal(result.totalHits, 1);
  assert.equal(result.foods[0].fdcId, 123);
  assert.equal(result.provenance.mode, 'snapshot');
  assert.equal(result.provenance.live, false);
  assert.equal(result.provenance.releases.Foundation, '2026-04');
});

test('detail preserves release, valid portions, null missing nutrients and explicit units', async () => {
  const result = await createSnapshotService({ catalog }).getFood('123');
  assert.equal(result.food.release, '2026-04');
  assert.equal(result.food.nutrients.carbs, null);
  assert.equal(result.food.nutrients.sodium, 0);
  assert.equal(result.food.nutrients.potassium, null);
  assert.equal(result.food.units.sodium, 'mg');
  assert.equal(result.food.portions[0].gramWeight, 100);
  result.food.nutrients.protein = 999;
  assert.equal((await createSnapshotService({ catalog }).getFood('123')).food.nutrients.protein, 2);
});

test('snapshot invalid requests and unavailable IDs get precise safe errors', async () => {
  const service = createSnapshotService({ catalog });
  for (const args of [null, { q: '' }, { q: ['rice'] }, { q: 'x'.repeat(121) }, { q: 'rice', pageSize: 51 }, { q: 'rice', dataTypes: 'invalid' }]) {
    await assert.rejects(service.search(args), { status: 400 });
  }
  for (const id of ['0', '-1', '../123', ['123']]) await assert.rejects(service.getFood(id), { status: 400 });
  await assert.rejects(service.getFood('999'), { status: 404, code: 'snapshot_food_not_found' });
});

test('bundled catalog contains genuine downloadable USDA release metadata and usable foods', async () => {
  const result = await getSnapshotService().search({ q: 'rice', pageSize: 2 });
  assert.ok(result.totalHits > 0);
  assert.equal(result.foods.length, 2);
  assert.ok(result.provenance.sources.every(source => source.url.startsWith('https://fdc.nal.usda.gov/')));
  assert.ok(result.provenance.releases.Foundation);
  const detail = await getSnapshotService().getFood(String(result.foods[0].fdcId));
  assert.equal(detail.food.fdcId, result.foods[0].fdcId);
});

test('snapshot rejects incorrect declared units and chemical definition IDs', async () => {
  const service = createSnapshotService({ catalog: { foods: [{ fdcId: 1, dataType: 'SR Legacy', basis: 'per100g', nutrients: { vitaminA: 10, folate: 12, iron: 0 }, nutrientIds: { vitaminA: 1104, folate: 1190, iron: 1089 }, units: { vitaminA: 'ug', folate: 'mg', iron: 'mg' } }] } });
  const { food } = await service.getFood(1);
  assert.equal(food.nutrients.vitaminA, null);
  assert.equal(food.nutrients.folate, null);
  assert.equal(food.nutrients.iron, 0);
});
