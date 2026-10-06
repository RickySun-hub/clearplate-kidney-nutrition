import { readFileSync } from 'node:fs';
import { FdcError, FDC_NUTRIENTS, getFdcService, handleFdcRequest } from './fdc.js';

const UNITS = Object.fromEntries(Object.entries(FDC_NUTRIENTS).map(([key, [, unit]]) => [key, unit]));
const TYPES = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']);
const invalid = () => new FdcError(400, 'invalid_request', 'Invalid USDA request parameters.');

function normalizeSnapshot(food) {
  const nutrients = Object.fromEntries(Object.keys(UNITS).map(key => {
    const value = food.nutrients?.[key];
    const correctUnit = !food.units || food.units[key] === UNITS[key];
    const correctId = !food.nutrientIds || FDC_NUTRIENTS[key][0].includes(food.nutrientIds[key]);
    return [key, food.basis === 'per100g' && correctUnit && correctId && typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null];
  }));
  return { ...food, nutrients, units: { ...UNITS }, portions: (food.portions ?? []).filter(portion =>
    Number.isFinite(portion.amount) && portion.amount > 0 && Number.isFinite(portion.gramWeight) && portion.gramWeight > 0)
    .slice(0, 100).map(portion => ({ ...portion, unit: portion.unit ?? '', modifier: portion.modifier ?? portion.description ?? '' })) };
}

export function createSnapshotService({ catalog } = {}) {
  if (!catalog || !Array.isArray(catalog.foods)) throw new FdcError(503, 'snapshot_unavailable', 'USDA public snapshot is unavailable.');
  const foods = catalog.foods.filter(food => Number.isSafeInteger(food.fdcId) && food.fdcId > 0).map(normalizeSnapshot);
  const index = new Map(foods.map(food => [food.fdcId, food]));
  const searchable = foods.map(food => ({ food, text: String(food.description).toLocaleLowerCase('en-US') }));
  const provenance = { source: 'USDA FoodData Central public downloads', mode: 'snapshot', live: false,
    releases: Object.fromEntries((catalog.sources ?? []).map(source => [source.dataType, source.release])),
    sources: catalog.sources ?? [], archives: catalog.archives ?? [], catalogFoodCount: foods.length };
  return {
    async search(args = {}) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw invalid();
      let { q, pageSize = 20, dataTypes = ['Foundation', 'SR Legacy'] } = args;
      if (typeof q !== 'string' || !q.trim() || q.length > 120 || /[\u0000-\u001f\u007f]/u.test(q)) throw invalid();
      if (typeof pageSize === 'string' && /^\d{1,2}$/.test(pageSize)) pageSize = Number(pageSize);
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw invalid();
      if (typeof dataTypes === 'string') dataTypes = dataTypes.split(',');
      if (!Array.isArray(dataTypes) || !dataTypes.length || dataTypes.length > 4 || dataTypes.some(type => !TYPES.has(type))) throw invalid();
      dataTypes = [...new Set(dataTypes)].sort();
      const terms = q.trim().toLocaleLowerCase('en-US').split(/\s+/u);
      const matches = searchable.filter(({ food, text }) => dataTypes.includes(food.dataType) && terms.every(term => text.includes(term)));
      // Common whole foods should not be buried behind branded or composite matches.
      const queryText = q.trim().toLocaleLowerCase('en-US');
      const score = ({text}) => {
        const primary = text.split(',')[0].trim();
        return (text === queryText ? 100 : 0)
          + (primary.replace(/s$/, '') === queryText.replace(/s$/, '') ? 50 : 0)
          + (text.startsWith(queryText) ? 20 : 0)
          + (text.includes(', raw') ? 3 : 0);
      };
      matches.sort((a,b) => score(b)-score(a) || a.text.length-b.text.length || a.food.fdcId-b.food.fdcId);
      return structuredClone({ query: q.trim(), pageSize, dataTypes, totalHits: matches.length,
        foods: matches.slice(0, pageSize).map(match => match.food), provenance });
    },
    async getFood(id) {
      if ((typeof id !== 'string' && typeof id !== 'number') || !/^[1-9]\d{0,9}$/.test(String(id))) throw invalid();
      const food = index.get(Number(id));
      if (!food) throw new FdcError(404, 'snapshot_food_not_found', 'This food is not included in the public USDA snapshot.');
      return structuredClone({ food, provenance });
    },
  };
}

let snapshot;
export function getSnapshotService() {
  if (!snapshot) {
    try { snapshot = createSnapshotService({ catalog: JSON.parse(readFileSync(new URL('./data/usdaCatalog.json', import.meta.url), 'utf8')) }); }
    catch { throw new FdcError(503, 'snapshot_unavailable', 'USDA public snapshot is unavailable.'); }
  }
  return snapshot;
}

export async function handleNutritionRequest(req, res, operation) {
  // Runtime-only inspection; credentials are never placed in the public bundle.
  if (process.env.USDA_FDC_API_KEY?.trim()) {
    return handleFdcRequest(req, res, async () => {
      const result = await operation(getFdcService());
      return { ...result, provenance: { ...result.provenance, mode: 'live', live: true } };
    });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET for USDA requests.' } });
  }
  try { return res.status(200).json(await operation(getSnapshotService())); }
  catch (error) {
    const safe = error instanceof FdcError ? error : new FdcError(503, 'snapshot_unavailable', 'USDA public snapshot is unavailable.');
    return res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  }
}
