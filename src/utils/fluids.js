const factors = { ml: 1, floz: 29.5735295625, cup: 236.5882365 };
export function fluidAmountMl(amount, unit) {
  const ml = Number(amount) * factors[unit];
  if (!String(amount ?? '').trim() || !Number.isFinite(ml) || ml <= 0 || ml > 10000) throw Error('Enter a positive drink amount up to 10,000 mL.');
  return ml;
}
export function validateFluidRecords(records) {
  if (records === undefined) return true;
  if (!Array.isArray(records) || records.length > 200) return false;
  const ids = new Set(), links = new Set();
  return records.every(r => {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 150 || ids.has(r.id)
      || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 150
      || typeof r.amountMl !== 'number' || !Number.isFinite(r.amountMl) || r.amountMl <= 0 || r.amountMl > 10000
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time || '')) return false;
    if (r.entryId !== undefined && (typeof r.entryId !== 'string' || !r.entryId || r.entryId.length > 150 || links.has(r.entryId))) return false;
    ids.add(r.id); if (r.entryId) links.add(r.entryId); return true;
  });
}
export function upsertFluid(records, record) {
  const next = [...records.filter(r => r.id !== record.id && (!record.entryId || r.entryId !== record.entryId)), record];
  if (!validateFluidRecords(next)) throw Error('Check the drink name, time and amount.');
  return next;
}
export function activeFluids(records = [], entries = []) {
  const ids = new Set(entries.map(e => e.id));
  return records.filter(r => !r.entryId || ids.has(r.entryId));
}
export function fluidTotal(records = [], entries = []) {
  return activeFluids(records, entries).reduce((total, r) => total + r.amountMl, 0);
}

// Changing the display unit must never silently change the volume being saved.
export function convertFluidAmount(amount, fromUnit, toUnit) {
  if (!Object.hasOwn(factors, fromUnit) || !Object.hasOwn(factors, toUnit)) throw Error('Choose a supported drink unit.');
  if (amount === '' || amount == null) return '';
  return fluidAmountMl(amount, fromUnit) / factors[toUnit];
}

// Move the saved manual volume with its food, without recalculating it from
// portions. Conflicting destination records require explicit user resolution.
export function moveLinkedFluids(dayRecords, previous, updated) {
  if (!previous) throw Error('The food record is no longer available.');
  if (previous.date === updated.date) return dayRecords;
  const source = dayRecords[previous.date] || {}, destination = dayRecords[updated.date] || {};
  const linked = (source.fluids || []).filter(record => record.entryId === previous.id);
  const remaining = (source.fluids || []).filter(record => record.entryId !== previous.id);
  const existing = destination.fluids || [];
  if (existing.some(record => linked.some(moving => record.id === moving.id || record.entryId === moving.entryId))) throw Error('A linked drink conflicts with a saved drink on the destination date. Both records are unchanged. Keep the original date for now; the saved records need review before they can be combined.');
  const fluids = [...existing, ...linked];
  if (!validateFluidRecords(fluids) || !validateFluidRecords(remaining)) throw Error('Check the drink records before moving this food.');
  return {...dayRecords,
    [previous.date]: {...source, fluids:remaining, completedAt:null, signature:null},
    [updated.date]: {...destination, fluids, completedAt:null, signature:null}};
}
