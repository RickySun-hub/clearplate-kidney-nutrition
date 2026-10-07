import { NUTRIENTS, NUTRIENT_KEYS, validNutrientValue } from './nutrientCatalog.js';
export function validateDeviceReport(value) {
  if (!['renalsync-device-report', 'clearplate-device-report'].includes(value?.schema) || value.version !== 1 || !Array.isArray(value.rows) || value.rows.length > 10000) throw new Error('Choose a RenalSync version 1 device report with at most 10,000 items.');
  if (value.nutrientUnits && NUTRIENTS.some(({ key, unit }) => value.nutrientUnits[key] !== unit)) throw new Error('Report nutrient units do not match this report format.');
  const rows = value.rows.map((row) => {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !validNutrientValue(row.servings) || Number(row.servings) <= 0 || typeof row.name !== 'string' || row.name.length > 500 || !row.nutrients || typeof row.nutrients !== 'object') throw new Error('Report contains an invalid food record.');
    const parsedDate = new Date(`${row.date}T12:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== row.date) throw new Error('Report contains an invalid calendar date.');
    const nutrients = {};
    for (const key of NUTRIENT_KEYS) {
      const amount = row.nutrients[key];
      if (amount !== null && amount !== undefined && !validNutrientValue(amount)) throw new Error('Report contains an invalid nutrient amount.');
      nutrients[key] = amount === null || amount === undefined ? null : Number(amount);
    }
    const text = (key) => typeof row[key] === 'string' ? row[key].slice(0, 500) : null;
    return { date: row.date, time: text('time'), name: row.name, servings: Number(row.servings), meal: text('meal'), source: text('source'), recordedAt: text('recordedAt'), nutrients };
  });
  return { rows };
}
