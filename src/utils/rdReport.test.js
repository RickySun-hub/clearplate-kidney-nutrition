import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeviceReport } from './rdReport.js';
test('device report validation rejects unsupported schemas and negative nutrients', () => {
  assert.throws(() => validateDeviceReport({ schema: 'other', version: 1, rows: [] }));
  assert.throws(() => validateDeviceReport({ schema: 'clearplate-device-report', version: 1, rows: [{ date: '2026-10-04', name: 'Food', servings: 1, nutrients: { iron: -1 } }] }));
});
test('device report preserves null and plain text without accepting external totals', () => {
  const result = validateDeviceReport({ schema: 'clearplate-device-report', version: 1, totals: { iron: 999 }, rows: [{ date: '2026-10-04', name: '<script>text</script>', servings: 1, nutrients: { iron: 0 } }] });
  assert.equal(result.rows[0].nutrients.iron, 0);
  assert.equal(result.rows[0].nutrients.vitaminD, null);
  assert.equal(result.totals, undefined);
});

test('device report rejects impossible dates and incompatible declared units', () => {
  const row = { date: '2026-02-30', name: 'Food', servings: 1, nutrients: {} };
  assert.throws(() => validateDeviceReport({ schema: 'clearplate-device-report', version: 1, rows: [row] }));
  assert.throws(() => validateDeviceReport({ schema: 'clearplate-device-report', version: 1, rows: [], nutrientUnits: { vitaminA: 'IU' } }));
});
