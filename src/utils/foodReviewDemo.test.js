import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createFoodReviewDemo, createFoodReviewDemoStore } from './foodReviewDemo.js';

const food = (changes = {}) => ({ name: 'Synthetic oats', brand: 'Demo only', barcode: '012345678901', servingDescription: 'One synthetic serving, 40 g', nutrients: { calories: 150, protein: 5, sodium: 0, potassium: null }, ...changes });
const clients = () => {
  const store = createFoodReviewDemoStore();
  return { patient: createFoodReviewDemo({ store }), reviewer: createFoodReviewDemo({ store, reviewer: true }), other: createFoodReviewDemo({ store, accountId: 'synthetic-patient-other' }) };
};
test('patient submission is private until reviewer approval creates a searchable snapshot', async () => {
  const { patient, reviewer, other } = clients();
  assert.deepEqual(await patient.foodReview('status'), { reviewer: false });
  assert.deepEqual(await reviewer.foodReview('status'), { reviewer: true });
  const draft = food();
  const submitted = await patient.foodReview('submit', { food: draft });
  draft.nutrients.protein = 999;
  assert.equal(submitted.status, 'pending');
  assert.deepEqual(await patient.foodReview('search', { query: 'oats' }), []);
  assert.deepEqual(await other.foodReview('list'), []);
  const queue = await reviewer.foodReview('list');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].food.nutrients.protein, 5);
  assert.equal(queue[0].owner_id, undefined);
  await assert.rejects(patient.foodReview('approve', { ...submitted, food: food(), reason: 'No access' }), /dietitian access/);
  await reviewer.foodReview('approve', { ...submitted, food: food(), reason: 'Synthetic label checked' });
  const matches = await patient.foodReview('search', { query: '012345678901' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].version, 1);
  matches[0].food.nutrients.protein = 777;
  assert.equal((await other.foodReview('search', { query: 'OATS' }))[0].food.nutrients.protein, 5);
  assert.equal((await patient.foodReview('list'))[0].status, 'approved');
});
test('requesting information permits only the owner to resubmit the current version', async () => {
  const { patient, reviewer, other } = clients();
  const submitted = await patient.foodReview('submit', { food: food() });
  await reviewer.foodReview('needs-info', { ...submitted, reason: 'Clarify synthetic serving' });
  const row = (await patient.foodReview('list'))[0];
  assert.equal(row.status, 'needs-info');
  assert.equal(row.version, 2);
  await assert.rejects(other.foodReview('submit', { id: row.id, version: row.version, food: food() }), /unavailable/);
  await assert.rejects(patient.foodReview('submit', { ...submitted, food: food() }), /changed/);
  const resubmitted = await patient.foodReview('submit', { id: row.id, version: row.version, food: food({ servingDescription: '40 grams' }) });
  assert.equal(resubmitted.version, 3);
  await reviewer.foodReview('reject', { ...resubmitted, reason: 'Synthetic rejection' });
  assert.equal((await patient.foodReview('list'))[0].status, 'rejected');
  await assert.rejects(patient.foodReview('submit', { id: row.id, version: 4, food: food() }), /changed/);
});
test('duplicate barcodes require merge and stale review decisions cannot mutate rows', async () => {
  const { patient, reviewer } = clients();
  const first = await patient.foodReview('submit', { food: food() });
  const approval = await reviewer.foodReview('approve', { ...first, food: food(), reason: 'Synthetic approval' });
  const duplicate = await patient.foodReview('submit', { food: food({ name: 'Synthetic duplicate' }) });
  await assert.rejects(reviewer.foodReview('approve', { ...duplicate, food: food(), reason: 'Duplicate' }), /Barcode already exists/);
  assert.equal((await reviewer.foodReview('list')).find(row => row.id === duplicate.id).version, 1);
  await assert.rejects(reviewer.foodReview('merge', { ...duplicate, mergeId: 'missing', reason: 'Merge' }), /existing reviewed food/);
  await reviewer.foodReview('merge', { ...duplicate, mergeId: approval.catalogId, reason: 'Same synthetic label' });
  await assert.rejects(reviewer.foodReview('reject', { ...duplicate, reason: 'Late decision' }), /changed/);
  assert.equal((await patient.foodReview('list')).find(row => row.id === duplicate.id).status, 'merged');
  assert.equal((await patient.foodReview('search', { query: 'oats' })).length, 1);
});
test('invalid payloads, images and unreviewed nutrients do not enter the catalog', async () => {
  const { patient, reviewer } = clients();
  await assert.rejects(patient.foodReview('submit', { food: food({ nutrients: { protein: '5' } }) }), /Invalid food/);
  await assert.rejects(patient.foodReview('submit', { food: food({ secret: 'not allowed' }) }), /Invalid food/);
  await assert.rejects(patient.foodReview('submit', { food: food(), photo: 'https://example.test/photo' }), /Invalid label image/);
  const submitted = await patient.foodReview('submit', { food: food({ nutrients: { protein: null } }) });
  await assert.rejects(reviewer.foodReview('approve', { ...submitted, food: food({ nutrients: { protein: null } }), reason: 'Unknown' }), /reviewed nutrient/);
  await assert.rejects(reviewer.foodReview('reject', { ...submitted, reason: '' }), /review note/);
  assert.deepEqual(await patient.foodReview('search', { query: 'oats' }), []);
});
test('stores are isolated and submission quota matches the SQL daily limit', async () => {
  const { patient } = clients();
  for (let i = 0; i < 20; i++) await patient.foodReview('submit', { food: food({ barcode: '' }) });
  await assert.rejects(patient.foodReview('submit', { food: food() }), /Daily submission limit/);
  assert.deepEqual(await createFoodReviewDemo({ reviewer: true }).foodReview('list'), []);
});
test('reviewers receive the oldest 100 pending cases and completed reviews cannot hide the next batch', async () => {
  const store = createFoodReviewDemoStore();
  const reviewer = createFoodReviewDemo({ store, reviewer: true });
  const submissions = [];
  for (let group = 0; group < 6; group++) {
    const patient = createFoodReviewDemo({ store, accountId: `synthetic-batch-${group}` });
    for (let item = 0; item < (group === 5 ? 1 : 20); item++) submissions.push(await patient.foodReview('submit', { food: food({ name: `Synthetic case ${submissions.length + 1}`, barcode: '' }) }));
  }
  const firstBatch = await reviewer.foodReview('list');
  assert.equal(firstBatch.length, 100);
  assert.equal(firstBatch[0].id, submissions[0].id);
  assert.equal(firstBatch[99].id, submissions[99].id);
  await reviewer.foodReview('reject', { ...firstBatch[0], reason: 'Synthetic batch check' });
  const nextBatch = await reviewer.foodReview('list');
  assert.equal(nextBatch.length, 100);
  assert.equal(nextBatch[0].id, submissions[1].id);
  assert.equal(nextBatch[99].id, submissions[100].id);
  assert.equal(nextBatch.some(row => row.id === submissions[0].id), false);
  const firstPatient = createFoodReviewDemo({ store, accountId: 'synthetic-batch-0' });
  const history = await firstPatient.foodReview('list');
  assert.equal(history[0].id, submissions[0].id);
  assert.equal(history[0].status, 'rejected');
});
test('a synthetic patient identity cannot acquire reviewer access by reopening a client', () => {
  const store = createFoodReviewDemoStore();
  createFoodReviewDemo({ store, accountId: 'synthetic-patient' });
  assert.throws(() => createFoodReviewDemo({ store, reviewer: true, accountId: 'synthetic-patient' }), /role cannot be changed/);
});
test('the demo factory refuses ordinary runtime use outside DEV or the Node test runner', () => {
  const script = `import { createFoodReviewDemo } from ${JSON.stringify(new URL('./foodReviewDemo.js', import.meta.url).href)}; try { createFoodReviewDemo(); process.exitCode=1; } catch(error) { if (!/DEV preview or tests/.test(error.message)) throw error; }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, NODE_TEST_CONTEXT: '' }, stdio: 'pipe' });
});
