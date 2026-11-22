// A compact change fingerprint, not an authentication or security signature.
// Four mixed 32-bit lanes retain all serialized record fields without storing
// another full copy of ingredient sources inside each confirmed day.
function compactSignature(serialized) {
  let a = 1779033703, b = 3144134277, c = 1013904242, d = 2773480762;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    a = b ^ Math.imul(a ^ code, 597399067);
    b = c ^ Math.imul(b ^ code, 2869860233);
    c = d ^ Math.imul(c ^ code, 951274213);
    d = a ^ Math.imul(d ^ code, 2716044179);
  }
  a = Math.imul(c ^ (a >>> 18), 597399067);
  b = Math.imul(d ^ (b >>> 22), 2869860233);
  c = Math.imul(a ^ (c >>> 17), 951274213);
  d = Math.imul(b ^ (d >>> 19), 2716044179);
  const digest = [a ^ b ^ c ^ d, b ^ a, c ^ a, d ^ a]
    .map(value => (value >>> 0).toString(16).padStart(8, '0')).join('');
  return `v2:${serialized.length}:${digest}`;
}

export function daySignature(entries, date) {
  // Time, meal, quantities, ingredients and source data all invalidate a day.
  return compactSignature(JSON.stringify(entries.filter(entry => entry.date === date)));
}

export function isDayComplete(records, entries, date) {
  const record = records[date];
  if (!record?.completedAt || typeof record.signature !== 'string') return false;
  const items = entries.filter(entry => entry.date === date);
  if (!items.length) return false;
  const serialized = JSON.stringify(items);
  // Existing confirmations use the full JSON. Keep them valid without a data
  // migration; the next explicit confirmation writes the compact version.
  return record.signature.startsWith('v2:')
    ? record.signature === compactSignature(serialized)
    : record.signature === serialized;
}
