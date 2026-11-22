import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { localDateKey, nutrientCoverage } from './nutrition.js';
import { daySignature } from './recording.js';

let server;
before(async () => {
  // A local transform server only: no listener, env files or remote services.
  server = await createServer({ configFile: false, envFile: false, envDir: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' });
});
after(async () => { await server?.close(); });

const rows = [
  { id: 'synthetic-known', source: 'custom', meal: 'Lunch', date: localDateKey(), servings: 1, customFood: { name: 'Synthetic known food', calories: 100, sodium: 120, protein: 60, fiber: 2.5 } },
  { id: 'synthetic-missing', source: 'custom', meal: 'Lunch', date: localDateKey(), servings: 1, customFood: { name: 'Synthetic missing food', calories: null, sodium: null, protein: null, fiber: null } },
];

async function render(component, props) {
  const module = await server.ssrLoadModule(`/src/components/${component}.jsx`);
  return renderToStaticMarkup(createElement(module.default, props));
}

test('progress renders the known subtotal but never a success state for incomplete nutrients', async () => {
  const html = await render('NutrientProgress', { type: 'sodium', coverage: nutrientCoverage(rows).sodium, target: 2000, complete: true });
  assert.match(html, /nutrient-band neutral/);
  assert.match(html, /120/);
  assert.match(html, /known subtotal/);
  assert.match(html, /Incomplete nutrient data/);
  assert.match(html, /1\/2 items have data/);
  assert.doesNotMatch(html, /Below saved limit|Within saved/);
});

test('unknown nutrients render Unknown without a zero progress bar', async () => {
  const html = await render('NutrientProgress', { type: 'sodium', coverage: nutrientCoverage([rows[1]]).sodium, target: 2000, complete: true });
  assert.match(html, /Unknown/);
  assert.doesNotMatch(html, /role="progressbar"|aria-valuenow="0"|Below saved limit/);
});

test('meal summaries show incomplete subtotals while individual missing foods stay Unknown', async () => {
  const html = await render('TodayMeals', { entries: rows, recipesById: {} });
  assert.match(html, /120 mg subtotal · incomplete/);
  assert.match(html, /60 g subtotal · incomplete/);
  assert.match(html, /Unknown/);
});

test('History uses the same subtotal display, historical nutrient selection and conservative day status', async () => {
  const date = rows[0].date;
  const savedProfile = { sodiumTargetMg: 2000, proteinMinG: 56, proteinMaxG: 70, trackedNutrients: ['sodium', 'protein', 'fiber'], nutrientTargets: { fiber: { min: 20 } } };
  const html = await render('HistoryView', { entries: rows, recipesById: {}, profile: { ...savedProfile, trackedNutrients: ['sodium'] }, dayRecords: { [date]: { completedAt: 'synthetic-confirmation', signature: daySignature(rows, date), profile: savedProfile } } });
  assert.match(html, /Dietary fiber/);
  assert.match(html, /2\.5 g subtotal · incomplete/);
  assert.ok((html.match(/120 mg subtotal · incomplete/g) || []).length >= 3);
  assert.match(html, /Review recorded nutrition/);
  const selectedDay = html.match(/<button class="history-calendar-day selected"[\s\S]*?<\/button>/)?.[0];
  assert.ok(selectedDay);
  assert.doesNotMatch(selectedDay, /history-check-circle/);
  assert.match(html, /Fluid intake/);
});
