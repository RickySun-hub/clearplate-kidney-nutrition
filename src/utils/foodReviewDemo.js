import { NUTRIENT_KEYS } from './nutrientCatalog.js';

// Synthetic memory-only protocol simulator. This module never authenticates,
// sends requests, writes browser storage or grants production reviewer access.
const stores = new WeakMap();
const foodKeys = ['name', 'brand', 'barcode', 'servingDescription', 'nutrients'];
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireDemoRuntime() {
  if (import.meta.env?.PROD || !(import.meta.env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT))) {
    throw Error('Food review demo is available only in DEV preview or tests.');
  }
}

export function createFoodReviewDemoStore() {
  requireDemoRuntime();
  const handle = Object.freeze({ kind: 'synthetic-food-review-store' });
  stores.set(handle, { submissions: new Map(), catalog: new Map(), identities: new Map(), audit: [], sequence: 0 });
  return handle;
}

function checkedFood(value) {
  let size;
  try { size = JSON.stringify(value)?.length; } catch { throw Error('Invalid food fields'); }
  if (!object(value) || !size || size > 12000 || Object.keys(value).some(key => !foodKeys.includes(key))
      || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 150
      || typeof value.servingDescription !== 'string' || !value.servingDescription.trim() || value.servingDescription.trim().length > 200
      || typeof value.brand !== 'string' || value.brand.length > 150
      || typeof value.barcode !== 'string' || (value.barcode !== '' && !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value.barcode))
      || !object(value.nutrients) || Object.entries(value.nutrients).some(([key, amount]) => !NUTRIENT_KEYS.includes(key)
        || (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)))) throw Error('Invalid food fields');
  return clone(value);
}

const visibleSubmission = row => clone(Object.fromEntries(['id', 'food', 'photo', 'status', 'version', 'review_note', 'catalog_id', 'updated_at'].map(key => [key, row[key]])));

export function createFoodReviewDemo({ reviewer = false, accountId, store = createFoodReviewDemoStore() } = {}) {
  requireDemoRuntime();
  const state = stores.get(store);
  if (!state) throw Error('Use a synthetic food review demo store.');
  const isReviewer = reviewer === true;
  const actor = accountId ?? (isReviewer ? 'synthetic-reviewer' : 'synthetic-patient');
  if (typeof actor !== 'string' || !actor.startsWith('synthetic-') || actor.length > 150) throw Error('Use a synthetic demo account ID.');
  if (state.identities.has(actor) && state.identities.get(actor) !== isReviewer) throw Error('Demo identity role cannot be changed. Use a separate synthetic account.');
  state.identities.set(actor, isReviewer);

  const stamp = () => { state.sequence++; return new Date().toISOString(); };
  const audit = (row, action, reason = '', food = row.food) => state.audit.push({ actor_id: actor, submission_id: row.id, action, reason, food: clone(food) });

  return Object.freeze({
    demo: true,
    async foodReview(action, payload = {}) {
      requireDemoRuntime();
      if (!object(payload)) throw Error('Invalid food review payload');
      if (action === 'status') return { reviewer: isReviewer };
      if (action === 'search') {
        const query = String(payload.query ?? '').trim();
        if (!query || query.length > 150) throw Error('Enter a food name or barcode');
        return [...state.catalog.values()].filter(row => row.food.barcode === query || row.food.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => b.order - a.order).slice(0, 30).map(({ id, version, food }) => clone({ id, version, food }));
      }
      if (action === 'list') return [...state.submissions.values()].filter(row => isReviewer ? ['pending', 'needs-info'].includes(row.status) : row.owner_id === actor)
        .sort((a, b) => isReviewer ? a.order - b.order : b.order - a.order).slice(0, 100).map(visibleSubmission);
      if (action === 'submit') {
        const food = checkedFood(payload.food);
        const photo = payload.photo ?? '';
        if (typeof photo !== 'string' || photo.length > 480000 || (photo !== '' && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))) throw Error('Invalid label image');
        let row;
        if (payload.id != null) {
          row = state.submissions.get(payload.id);
          if (!row || row.owner_id !== actor) throw Error('Submission unavailable');
          if (row.status !== 'needs-info' || row.version !== payload.version) throw Error('Submission changed; reload');
          row.food = food; row.photo = photo; row.status = 'pending'; row.version++;
          row.updated_at = stamp(); row.order = state.sequence;
        } else {
          if ([...state.submissions.values()].filter(row => row.owner_id === actor && Date.parse(row.created_at) > Date.now() - 86400000).length >= 20) throw Error('Daily submission limit reached');
          const now = stamp();
          row = { id: crypto.randomUUID(), owner_id: actor, food, photo, status: 'pending', version: 1, review_note: '', catalog_id: null, created_at: now, updated_at: now, order: state.sequence };
          state.submissions.set(row.id, row);
        }
        audit(row, action);
        return { id: row.id, status: row.status, version: row.version };
      }
      if (!['approve', 'needs-info', 'reject', 'merge'].includes(action) || !isReviewer) throw Error('Reviewed dietitian access required');
      const row = state.submissions.get(payload.id);
      if (!row || !['pending', 'needs-info'].includes(row.status) || row.version !== payload.version) throw Error('Submission changed; reload');
      const reason = String(payload.reason ?? '').trim();
      if (!reason || reason.length > 1000) throw Error('Enter a review note');
      let target = null;
      let reviewedFood;
      if (action === 'approve') {
        reviewedFood = checkedFood(payload.food);
        if (!Object.values(reviewedFood.nutrients).some(amount => typeof amount === 'number')) throw Error('At least one reviewed nutrient is required');
        if (reviewedFood.barcode && [...state.catalog.values()].some(item => item.food.barcode === reviewedFood.barcode)) throw Error('Barcode already exists. Search and merge with its reviewed food.');
        target = crypto.randomUUID();
      } else if (action === 'merge') {
        if (!state.catalog.has(payload.mergeId)) throw Error('Choose an existing reviewed food');
        target = payload.mergeId;
      }
      // Commit only after every check succeeds, matching the SQL transaction.
      const now = stamp();
      if (action === 'approve') {
        state.catalog.set(target, { id: target, version: 1, food: reviewedFood, approved_by: actor, approved_at: now, order: state.sequence });
        row.food = clone(reviewedFood);
      }
      row.status = { approve: 'approved', reject: 'rejected', merge: 'merged', 'needs-info': 'needs-info' }[action];
      row.review_note = reason; row.reviewed_by = actor; row.catalog_id = target;
      row.version++; row.updated_at = now; row.order = state.sequence;
      audit(row, action, reason);
      return { id: row.id, catalogId: target };
    },
  });
}
