import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFdcFood, createFdcService, handleFdcRequest } from './fdc.js';

const food = (id = 123) => ({ fdcId: id, description: 'Example', dataType: 'Foundation', foodNutrients: [
  { nutrient: { id: 1003, unitName: 'g' }, amount: 2.5 },
  { nutrient: { id: 1093, unitName: 'mg' }, amount: 0 },
  { nutrient: { id: 1008, unitName: 'kcal' }, amount: 42 },
] });
const response = data => new Response(JSON.stringify(data));

test('normalizes only exact nutrient IDs and units; missing is null, zero is preserved', () => {
  const result = normalizeFdcFood({ ...food(), foodNutrients: [...food().foodNutrients,
    { nutrient: { id: 1092, unitName: 'g' }, amount: 7 },
    { nutrient: { id: 999, name: 'Phosphorus', unitName: 'mg' }, amount: 1 },
    { nutrient: { id: 1004, unitName: 'g' }, amount: -1 },
  ] });
  assert.equal(result.basis, 'per100g');
  assert.equal(result.nutrients.protein, 2.5);
  assert.equal(result.nutrients.sodium, 0);
  assert.equal(result.nutrients.calories, 42);
  assert.equal(result.nutrients.potassium, null);
  assert.equal(result.nutrients.phosphorus, null);
  assert.equal(result.nutrients.fat, null);
  assert.equal(result.units.sodium, 'mg');
});

test('branded liquid and unsupported records cannot become gram nutrition', () => {
  const liquid = normalizeFdcFood({ ...food(), dataType: 'Branded', servingSizeUnit: 'mL' });
  assert.equal(liquid.basis, 'per100ml');
  assert.equal(liquid.nutrients.protein, null);
  assert.equal(normalizeFdcFood({ ...food(), dataType: 'Experimental' }).basis, 'unknown');
  assert.equal(normalizeFdcFood({ ...food(), dataType: 'Branded' }).basis, 'unknown');
  assert.equal(normalizeFdcFood({ ...food(), dataType: 'Branded', servingSizeUnit: 'g' }).basis, 'per100g');
});

test('explicit Atwater energy fallback retains the selected method ID', () => {
  const result = normalizeFdcFood({ ...food(), foodNutrients: [
    { nutrient: { id: 2047, unitName: 'kcal' }, amount: 60 },
    { nutrient: { id: 2048, unitName: 'kcal' }, amount: 55 },
  ] });
  assert.equal(result.nutrients.calories, 55);
  assert.equal(result.nutrientIds.calories, 2048);
});

test('validates portions and preserves quantity semantics', () => {
  const result = normalizeFdcFood({ ...food(), foodPortions: [
    { amount: 2, gramWeight: 160, modifier: 'cups', measureUnit: { name: 'cup' } },
    { amount: 0, gramWeight: 40 }, { amount: 1, gramWeight: -2 }, { gramWeight: 10 },
  ] });
  assert.equal(result.portions.length, 1);
  assert.deepEqual(result.portions[0], { amount: 2, gramWeight: 160, unit: 'cup', modifier: 'cups' });
});

test('invalid input and missing configuration never fetch', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw Error('should not fetch'); };
  const configured = createFdcService({ apiKey: 'test-only', fetchImpl });
  for (const args of [null, [], { q: '' }, { q: ['rice'] }, { q: 'rice\n' }, { q: 'x'.repeat(121) }, { q: 'rice', dataTypes: ['Bogus'] }, { q: 'rice', pageSize: 51 }]) {
    await assert.rejects(configured.search(args), { status: 400 });
  }
  for (const id of ['1/../../', '-1', '0', ['123'], '1e2']) await assert.rejects(configured.getFood(id), { status: 400 });
  await assert.rejects(createFdcService({ fetchImpl }).getFood('123'), { status: 503, code: 'not_configured' });
  assert.equal(calls, 0);
});

test('fixed upstream, cache and provenance exclude secrets', async () => {
  let calls = 0;
  let clock = 0;
  const service = createFdcService({ apiKey: 'private-test-token', now: () => clock, fetchImpl: async url => {
    calls++; assert.equal(url.origin, 'https://api.nal.usda.gov');
    assert.equal(url.pathname, '/fdc/v1/food/123');
    return response(food());
  } });
  const first = await service.getFood('123');
  const cached = await service.getFood('123');
  assert.equal(calls, 1);
  assert.equal(cached.provenance.cached, true);
  assert.equal(JSON.stringify(first).includes('private-test-token'), false);
  clock += 300001;
  await service.getFood('123');
  assert.equal(calls, 2);
});

test('search result IDs are normalized without confusing food nutrient record IDs', async () => {
  const service = createFdcService({ apiKey: 'test', fetchImpl: async () => response({ totalHits: 1, foods: [
    { ...food(), foodNutrients: [{ nutrientId: 1003, nutrientName: 'Protein', unitName: 'G', value: 4, id: 999 }] },
  ] }) });
  const result = await service.search({ q: 'rice', pageSize: 1 });
  assert.equal(result.foods[0].nutrients.protein, 4);
  assert.equal(result.totalHits, 1);
});

test('upstream and timeout errors never expose upstream text or credentials', async () => {
  for (const fetchImpl of [async () => { throw Error('https://upstream/?api_key=private'); },
    async () => new Response('private', { status: 429 }),
    async () => { throw Object.assign(Error('private'), { name: 'AbortError' }); },
    async () => response({ ...food(), fdcId: 456 }),
  ]) {
    const service = createFdcService({ apiKey: 'private', fetchImpl });
    await assert.rejects(service.getFood('123'), error => error.status === 502 && !error.message.includes('private'));
  }
});

test('upstream budget applies across queries without client IP and resets over time', async () => {
  let calls = 0;
  let clock = 0;
  const service = createFdcService({ apiKey: 'test', now: () => clock, fetchImpl: async () => {
    calls++; return response({ foods: [], totalHits: 0 });
  } });
  for (let i = 0; i < 30; i++) await service.search({ q: `rice ${i}` });
  await assert.rejects(service.search({ q: 'rice 31' }), { status: 429 });
  assert.equal(calls, 30);
  clock += 60001;
  await service.search({ q: 'rice 31' });
  assert.equal(calls, 31);
});

test('cache is bounded to 100 entries even within its TTL', async () => {
  let calls = 0;
  let clock = 0;
  const service = createFdcService({ apiKey: 'test', now: () => clock, fetchImpl: async url => {
    calls++; return response(food(Number(url.pathname.split('/').pop())));
  } });
  for (let i = 1; i <= 101; i++) {
    clock = Math.floor((i - 1) / 30) * 60001;
    await service.getFood(String(i));
  }
  assert.equal(calls, 101);
  await service.getFood('1');
  assert.equal(calls, 102);
});

test('real timeout bounds a fetch that ignores AbortSignal', async () => {
  const start = Date.now();
  const service = createFdcService({ apiKey: 'test', fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(service.getFood('123'), { status: 502 });
  assert.ok(Date.now() - start >= 7900);
  assert.ok(Date.now() - start < 11000);
});

test('Node ESM handlers import successfully and non-GET gets a safe response', async () => {
  const search = await import('../api/fdc-search.js');
  const details = await import('../api/fdc-food.js');
  assert.equal(typeof search.default, 'function');
  assert.equal(typeof details.default, 'function');
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handleFdcRequest({ method: 'POST' }, res, () => { throw Error('should not run'); });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('expanded micronutrients require chemical definition IDs and exact units', () => {
  const normalized = normalizeFdcFood({ ...food(), foodNutrients: [
    { nutrient: { id: 1104, unitName: 'IU' }, amount: 100 },
    { nutrient: { id: 1177, unitName: 'ug' }, amount: 20 },
    { nutrient: { id: 1110, unitName: 'IU' }, amount: 40 },
    { nutrient: { id: 1089, unitName: 'mg' }, amount: 0 },
    { nutrient: { id: 1103, unitName: 'mg' }, amount: 1 },
    { nutrient: { id: 1162, unitName: 'mg' }, amount: 5, isBelowLoq: true },
    { nutrient: { id: 1190, unitName: 'ug' }, amount: 30 },
    { nutrient: { id: 2000, unitName: 'g' }, amount: 4 },
    { nutrient: { id: 1063, unitName: 'g' }, amount: 6 },
  ] });
  assert.equal(Object.keys(normalized.nutrients).length, 28);
  assert.equal(normalized.nutrients.vitaminA, null);
  assert.equal(normalized.nutrients.vitaminD, null);
  assert.equal(normalized.nutrients.selenium, null);
  assert.equal(normalized.nutrients.vitaminC, null);
  assert.equal(normalized.nutrients.iron, 0);
  assert.equal(normalized.nutrients.folate, 30);
  assert.equal(normalized.nutrients.sugars, 4);
  assert.equal(normalized.nutrientIds.folate, 1190);
});
