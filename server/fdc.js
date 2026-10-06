// Server-only: import from API handlers, never from src/.
const UPSTREAM = 'https://api.nal.usda.gov/fdc/v1';
const DATA_TYPES = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']);
const TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const FDC_NUTRIENTS = {
  // Legacy energy first, then explicitly identified Atwater specific/general
  // energy if legacy is absent. Retain the selected ID so the method is visible.
  calories: [[1008, 2048, 2047], 'kcal'], protein: [[1003], 'g'], sodium: [[1093], 'mg'],
  potassium: [[1092], 'mg'], phosphorus: [[1091], 'mg'], carbs: [[1005], 'g'],
  fat: [[1004], 'g'], fiber: [[1079], 'g'], calcium: [[1087], 'mg'],
  sugars: [[2000, 1063], 'g'], addedSugars: [[1235], 'g'], saturatedFat: [[1258], 'g'],
  cholesterol: [[1253], 'mg'], magnesium: [[1090], 'mg'], iron: [[1089], 'mg'],
  zinc: [[1095], 'mg'], selenium: [[1103], 'ug'], vitaminA: [[1106], 'ug'],
  vitaminC: [[1162], 'mg'], vitaminD: [[1114], 'ug'], vitaminE: [[1109], 'mg'],
  vitaminK: [[1185], 'ug'], thiamin: [[1165], 'mg'], riboflavin: [[1166], 'mg'],
  niacin: [[1167], 'mg'], vitaminB6: [[1175], 'mg'], folate: [[1190], 'ug'], vitaminB12: [[1178], 'ug'],
};
const NUTRIENTS = FDC_NUTRIENTS;
const cleanText = (value, max = 300) => typeof value === 'string' ? value.slice(0, max) : '';
const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const safeId = value => Number.isSafeInteger(value) && value > 0;

export class FdcError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const invalid = () => new FdcError(400, 'invalid_request', 'Invalid USDA request parameters.');
const unavailable = () => new FdcError(502, 'upstream_unavailable', 'USDA data is temporarily unavailable.');

export function normalizeFdcFood(food) {
  const dataType = cleanText(food?.dataType, 50);
  // USDA Foundation, SR and FNDDS composition is per 100 g. Branded
  // 100-unit values require a supported mass unit; liquid values cannot be
  // used in gram-based calculations without density evidence.
  const servingUnit = cleanText(food?.servingSizeUnit, 20).toLowerCase();
  const basis = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'].includes(dataType) ? 'per100g'
    : dataType === 'Branded' && servingUnit === 'g' ? 'per100g'
    : dataType === 'Branded' && servingUnit === 'ml' ? 'per100ml' : 'unknown';
  const nutrients = Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key, null]));
  const nutrientIds = Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key, null]));
  const units = Object.fromEntries(Object.entries(NUTRIENTS).map(([key, [, unit]]) => [key, unit]));
  if (basis === 'per100g') {
    const entries = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
    for (const [key, [expectedIds, expectedUnit]] of Object.entries(NUTRIENTS)) {
      for (const expectedId of expectedIds) {
        const entry = entries.find(candidate => {
          const id = candidate?.nutrient?.id ?? candidate?.nutrientId;
          const amount = candidate?.nutrient ? candidate.amount : candidate?.value;
          const unit = cleanText(candidate?.nutrient?.unitName ?? candidate?.unitName, 20).toLowerCase();
          return id === expectedId && unit === expectedUnit && typeof amount === 'number'
            && Number.isFinite(amount) && amount >= 0 && candidate.belowLoq !== true && candidate.isBelowLoq !== true;
        });
        if (entry) {
          nutrients[key] = entry.nutrient ? entry.amount : entry.value;
          nutrientIds[key] = expectedId;
          break;
        }
      }
    }
  }
  const portions = (Array.isArray(food?.foodPortions) ? food.foodPortions : [])
    .filter(portion => finitePositive(portion?.amount) && finitePositive(portion?.gramWeight))
    .slice(0, 100).map(portion => ({ amount: portion.amount, gramWeight: portion.gramWeight,
      unit: cleanText(portion.measureUnit?.name, 80), modifier: cleanText(portion.modifier, 200) }));
  const fdcId = safeId(food?.fdcId) ? food.fdcId : null;
  return { fdcId, description: cleanText(food?.description), dataType, basis, nutrients, nutrientIds, units, portions,
    sourceUrl: fdcId ? `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients` : null };
}

function validateSearch(args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw invalid();
  let { q, pageSize = 20, dataTypes = ['Foundation', 'SR Legacy'] } = args;
  if (typeof q !== 'string' || !q.trim() || q.length > 120 || /[\u0000-\u001f\u007f]/u.test(q)) throw invalid();
  if (typeof pageSize === 'string' && /^\d{1,2}$/.test(pageSize)) pageSize = Number(pageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw invalid();
  if (typeof dataTypes === 'string') dataTypes = dataTypes.split(',');
  if (!Array.isArray(dataTypes) || !dataTypes.length || dataTypes.length > 4
    || dataTypes.some(type => !DATA_TYPES.has(type))) throw invalid();
  return { q: q.trim(), pageSize, dataTypes: [...new Set(dataTypes)].sort() };
}

async function readJson(response) {
  if (Number(response.headers?.get('content-length')) > MAX_BODY_BYTES) throw unavailable();
  let body = '';
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) { await reader.cancel(); throw unavailable(); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
  } else {
    body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw unavailable();
  }
  return JSON.parse(body);
}

export function createFdcService({ apiKey, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const budgets = new Map();
  // Global to this service instance, independent of untrusted IP headers.
  // Multi-instance deployments need a shared gateway/store for deployment-wide limits.
  function consume(name, limit, duration) {
    const time = now();
    let budget = budgets.get(name);
    if (!budget || time - budget.start >= duration) { budget = { start: time, used: 0 }; budgets.set(name, budget); }
    if (budget.used >= limit) throw new FdcError(429, 'rate_limited', 'USDA request budget reached. Try again later.');
    budget.used++;
  }
  async function request(path, params, key, transform) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new FdcError(503, 'not_configured', 'USDA API is not configured on this server.');
    consume('requests', 120, 60000);
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return { ...structuredClone(cached.value), provenance: { ...cached.value.provenance, cached: true } };
    if (cached) cache.delete(key);
    if (inFlight.has(key)) return structuredClone(await inFlight.get(key));
    consume('upstreamMinute', 30, 60000);
    consume('upstreamHour', 500, 3600000);
    const operation = (async () => {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, TIMEOUT_MS); });
      try {
        const url = new URL(`${UPSTREAM}${path}`);
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
        url.searchParams.set('api_key', apiKey);
        const data = await Promise.race([(async () => {
          const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
          if (!response.ok) throw unavailable();
          return transform(await readJson(response));
        })(), timeout]);
        const value = { ...data, provenance: { source: 'USDA FoodData Central', retrievedAt: new Date(now()).toISOString(), cached: false } };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { expires: now() + 300000, value });
        return structuredClone(value);
      } catch { throw unavailable(); }
      finally { clearTimeout(timer); }
    })();
    inFlight.set(key, operation);
    try { return await operation; } finally { inFlight.delete(key); }
  }
  return {
    search: async args => {
      const query = validateSearch(args);
      return request('/foods/search', { query: query.q, pageSize: String(query.pageSize), dataType: query.dataTypes.join(',') },
        `search:${JSON.stringify(query)}`, raw => {
          if (!raw || !Array.isArray(raw.foods)) throw unavailable();
          return { query: query.q, pageSize: query.pageSize, dataTypes: query.dataTypes,
            totalHits: Number.isSafeInteger(raw.totalHits) && raw.totalHits >= 0 ? raw.totalHits : null,
            foods: raw.foods.slice(0, query.pageSize).filter(item => safeId(item?.fdcId)).map(normalizeFdcFood) };
        });
    },
    getFood: async id => {
      if ((typeof id !== 'string' && typeof id !== 'number') || !/^[1-9]\d{0,9}$/.test(String(id)) || !safeId(Number(id))) throw invalid();
      return request(`/food/${id}`, { format: 'full' }, `food:${id}`, raw => {
        if (raw?.fdcId !== Number(id)) throw unavailable();
        return { food: normalizeFdcFood(raw) };
      });
    },
  };
}

let service;
export function getFdcService() {
  service ??= createFdcService({ apiKey: process.env.USDA_FDC_API_KEY });
  return service;
}

export async function handleFdcRequest(req, res, operation) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET for USDA requests.' } });
  }
  try { return res.status(200).json(await operation(getFdcService())); }
  catch (error) {
    const safe = error instanceof FdcError ? error : unavailable();
    if (safe.status === 429) res.setHeader('Retry-After', '60');
    return res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  }
}
