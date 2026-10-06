import { useMemo, useState } from 'react';
import { NUTRIENTS, normalizeNutrientPreferences } from '../utils/nutrientCatalog.js';
import { detailedNutritionFor, nutrientCoverage, formatAmount, localDateKey } from '../utils/nutrition.js';
import { isDayComplete } from '../utils/recording.js';
import './RDDashboard.css';
import { validateDeviceReport } from '../utils/rdReport.js';

const csvCell = (value) => {
  const text = String(value ?? '');
  return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
};
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function RDDashboard({ entries = [], recipesById = {}, profile = {}, dayRecords = {} }) {
  const [start, setStart] = useState(() => [...entries.map((e) => e.date)].sort()[0] || localDateKey());
  const [end, setEnd] = useState(localDateKey);
  const [selected, setSelected] = useState(() => normalizeNutrientPreferences(profile).trackedNutrients);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState('');
  const importReport = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Report must be smaller than 5 MB.');
      const report = validateDeviceReport(JSON.parse(await file.text()));
      setImported(report); setImportError('');
    } catch (error) { setImportError(error.message || 'Could not read report.'); }
  };
  const nutrients = NUTRIENTS.filter((n) => selected.includes(n.key));
  const filtered = useMemo(() => entries.filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)), [entries, start, end]);
  const totals = nutrientCoverage(filtered, recipesById);
  const rows = filtered.map((entry) => {
    const food = entry.source === 'custom' ? entry.customFood : recipesById[entry.recipeId];
    return { date: entry.date, time: entry.time ? `${entry.time}${entry.timeSource === 'user-recorded' ? '' : ' (scheduled time)'}` : null, meal: entry.meal || null,
      name: food?.name || food?.title || 'Unresolved food', servings: entry.servings,
      source: food?.fdcId ? `${food.sourceDescription || 'USDA food match'} · ${food.dataType || 'Type unknown'} · FDC ${food.fdcId}${food.sourceRelease ? ` · ${food.sourceRelease}` : ''} · estimate` : food?.sourceLabel || food?.methodLabel || food?.method || entry.source || 'Unknown',
      grams: food?.grams != null ? Number(food.grams) * Number(entry.servings) : null,
      sourceBasis: food?.sourceBasis || null, fdcId: food?.fdcId || null, sourceUrl: food?.sourceUrl || null,
      recordedAt: entry.recordedAt || entry.createdAt || null,
      nutrients: detailedNutritionFor(food, entry.servings) };
  });
  const dates = [...new Set(filtered.map((e) => e.date))];
  const report = { schema: 'clearplate-device-report', version: 1, exportedAt: new Date().toISOString(),
    range: { start, end }, nutrientUnits: Object.fromEntries(NUTRIENTS.map((n) => [n.key, n.unit])),
    selectedNutrients: selected, rows, totals,
    days: dates.map((date) => ({ date, confirmedComplete: isDayComplete(dayRecords, entries, date) })) };
  const exportCsv = () => {
    const header = ['Date', 'Recorded meal time', 'Meal', 'Food', 'Servings', 'Source', 'Entry timestamp', 'Recorded grams', 'Source basis', ...nutrients.map((n) => `${n.label} (${n.unit})`)];
    const body = rows.map((r) => [r.date, r.time || 'Unknown', r.meal, r.name, r.servings, r.source,
      r.recordedAt || 'Not recorded', r.grams ?? 'Unknown', r.sourceBasis || 'Unknown', ...nutrients.map((n) => r.nutrients[n.key] ?? 'Unknown')]);
    body.push(['Range known subtotal', '', '', '', '', '', '', '', '', ...nutrients.map((n) => totals[n.key].knownCount ? totals[n.key].knownSubtotal : 'Unknown')]);
    body.push(['Known items / recorded items', '', '', '', '', '', '', '', '', ...nutrients.map((n) => `${totals[n.key].knownCount}/${totals[n.key].itemCount}`)]);
    download(`clearplate-${start}-${end}.csv`, [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  return <section className="rd-dashboard" aria-labelledby="rd-title">
    <header><div><h2 id="rd-title">Dietitian review report</h2><p>Detailed food records on this device, ready for your review and sharing.</p></div></header>
    <p className="rd-notice">This is a device report. Remote access and sharing status are shown in the connection panel. Exports contain your food records; review the file and choose who receives it. Meal time is the recorded meal time, not a verified ingestion timestamp.</p>
    <details><summary>Review an exported JSON report locally</summary><p>This preview stays in this page and does not replace your records or connect an RD account.</p><label>Choose device report<input type="file" accept=".json,application/json" onChange={importReport} /></label>{importError && <p role="alert">{importError}</p>}{imported && <div><p>{imported.rows.length} imported items, validated for local review.</p><button className="secondary-button" onClick={() => setImported(null)}>Clear preview</button><div className="rd-table-scroll"><table><thead><tr><th>Date</th><th>Time</th><th>Food</th><th>Servings</th>{nutrients.map((n) => <th key={n.key}>{n.label} ({n.unit})</th>)}</tr></thead><tbody>{imported.rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.time || 'Unknown'}</td><th scope="row">{r.name}</th><td>{r.servings}</td>{nutrients.map((n) => <td key={n.key}>{formatAmount(r.nutrients[n.key], 2)}</td>)}</tr>)}</tbody></table></div></div>}</details>
    <div className="rd-controls"><label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Through<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><button className="secondary-button" onClick={exportCsv} disabled={start > end}>Export CSV</button><button className="secondary-button" onClick={() => download(`clearplate-${start}-${end}.json`, JSON.stringify(report, null, 2), 'application/json')} disabled={start > end}>Export JSON</button></div>
    {start > end && <p role="alert">Choose an end date on or after the start date.</p>}
    <details><summary>Choose nutrient columns ({selected.length})</summary><div className="rd-nutrient-picker">{NUTRIENTS.map((n) => <label key={n.key}><input type="checkbox" checked={selected.includes(n.key)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, n.key] : current.filter((k) => k !== n.key))} />{n.label} ({n.unit})</label>)}</div></details>
    <p>{filtered.length} recorded items · {dates.filter((d) => isDayComplete(dayRecords, entries, d)).length}/{dates.length} recorded days confirmed complete by the patient. Confirmation describes food logging, not nutrient completeness. Missing days are not zero intake.</p>
    <div className="rd-summary">{nutrients.map((n) => <article key={n.key}><strong>{n.label}</strong><span>{totals[n.key].knownCount ? formatAmount(totals[n.key].knownSubtotal, 2) : 'Unknown'} {n.unit}</span><small>{totals[n.key].complete ? 'Complete for recorded items' : 'Incomplete · known subtotal only'} · {totals[n.key].knownCount}/{totals[n.key].itemCount} items known</small></article>)}</div>
    <div className="rd-table-scroll" tabIndex="0" aria-label="Food record table, scroll horizontally"><table><caption>Per-item amounts include recorded servings. Unknown values are never treated as zero.</caption><thead><tr>{['Date', 'Meal time', 'Meal', 'Food', 'Servings', 'Recorded grams', 'Source', 'Entry timestamp', ...nutrients.map((n) => `${n.label} (${n.unit})`)].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.time || 'Unknown'}</td><td>{r.meal || 'Unknown'}</td><th scope="row">{r.name}</th><td>{formatAmount(r.servings, 2)}</td><td>{formatAmount(r.grams, 2)}</td><td>{r.source}</td><td>{r.recordedAt || 'Not recorded'}</td>{nutrients.map((n) => <td key={n.key}>{formatAmount(r.nutrients[n.key], 2)}</td>)}</tr>)}</tbody></table></div>
    {!rows.length && <p>No recorded items in this date range.</p>}
  </section>;
}
