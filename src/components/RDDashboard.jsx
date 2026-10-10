import { conversationText, MEALS } from '../utils/mealConversation.js';
import { reviewDays } from '../utils/rdReview.js';
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
export default function RDDashboard({ entries = [], recipesById = {}, profile = {}, dayRecords = {}, sharedIdentity = null }) {
  const [start, setStart] = useState(() => [...entries.map((e) => e.date)].concat(Object.keys(dayRecords)).sort()[0] || localDateKey());
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
  const daily = reviewDays(entries,recipesById,profile,dayRecords,start,end);
  const totals = nutrientCoverage(filtered, recipesById);
  const rows = filtered.map((entry) => {
    const food = entry.source === 'custom' ? entry.customFood : recipesById[entry.recipeId];
    return { date: entry.date, time: entry.time ? `${entry.time}${entry.timeSource === 'user-recorded' ? '' : entry.timeSource === 'recording-time' ? ' (logging time; meal time unknown)' : ' (scheduled time)'}` : null, meal: entry.meal || null,
      name: food?.name || food?.title || 'Unresolved food', servings: entry.servings,
      source: food?.fdcId ? `${food.sourceDescription || 'USDA food match'} · ${food.dataType || 'Type unknown'} · FDC ${food.fdcId}${food.sourceRelease ? ` · ${food.sourceRelease}` : ''} · estimate` : food?.sourceLabel || food?.methodLabel || food?.method || entry.source || 'Unknown',
      grams: food?.grams != null ? Number(food.grams) * Number(entry.servings) : null,
      sourceBasis: food?.sourceBasis || null, fdcId: food?.fdcId || null, sourceUrl: food?.sourceUrl || null,
      recordedAt: entry.recordedAt || entry.createdAt || null, conversation:entry.conversation || [], inputMethod:entry.inputMethod || 'manual', confirmedAt:entry.confirmedAt || null,
      nutrients: detailedNutritionFor(food, entry.servings) };
  });
  const dates = [...new Set(filtered.map((e) => e.date))];
  const report = { schema: 'renalsync-device-report', version: 1, exportedAt: new Date().toISOString(),
    range: { start, end }, nutrientUnits: Object.fromEntries(NUTRIENTS.map((n) => [n.key, n.unit])),
    selectedNutrients: selected, rows, totals, mealReviews:Object.fromEntries(daily.map(d=>[d.date,d.reviews])),
    days: dates.map((date) => ({ date, confirmedComplete: isDayComplete(dayRecords, entries, date) })) };
  const exportCsv = () => {
    const header = ['Date', 'Recorded meal time', 'Meal', 'Food', 'Servings', 'Source', 'Entry timestamp', 'Recorded grams', 'Source basis', 'Patient original words', 'Input method', 'Confirmed at', ...nutrients.map((n) => `${n.label} (${n.unit})`)];
    const body = rows.map((r) => [r.date, r.time || 'Unknown', r.meal, r.name, r.servings, r.source,
      r.recordedAt || 'Not recorded', r.grams ?? 'Unknown', r.sourceBasis || 'Unknown', conversationText(r.conversation),r.inputMethod,r.confirmedAt || '', ...nutrients.map((n) => r.nutrients[n.key] ?? 'Unknown')]);
    body.push(['Range known subtotal', '', '', '', '', '', '', '', '', '', '', '', ...nutrients.map((n) => totals[n.key].knownCount ? totals[n.key].knownSubtotal : 'Unknown')]);
    body.push(['Known items / recorded items', '', '', '', '', '', '', '', '', '', '', '', ...nutrients.map((n) => `${totals[n.key].knownCount}/${totals[n.key].itemCount}`)]);
    download(`renalsync-${start}-${end}.csv`, [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  return <section className="rd-dashboard" aria-labelledby="rd-title">
    <header><div><p className="rd-file-eyebrow">PATIENT FILE</p><h2 id="rd-title">{profile.name || "Name not recorded"}</h2><p>{sharedIdentity ? "Shared with your care account" : "Your device record"} · {entries.length} food records</p></div></header>
    <div className="rd-patient"><div><small>Condition</small><strong>{profile.condition || 'Not recorded'}</strong></div><div><small>Stage / treatment</small><strong>{[profile.stage,profile.treatment].filter(Boolean).join(' / ') || 'Not recorded'}</strong></div><div><small>Weight</small><strong>{profile.weightKg ? `${profile.weightKg} kg` : 'Not recorded'}</strong></div>{sharedIdentity && <div><small>Patient account</small><strong>{sharedIdentity}</strong></div>}</div>
    <p className="rd-notice">{sharedIdentity ? "This cloud record refreshes while the dashboard is open." : "This is the record on this device."} Remote access and sharing status are shown in the connection panel. Exports contain your food records; review the file and choose who receives it. Meal time is the recorded meal time, not a verified ingestion timestamp.</p>
    <details><summary>Review an exported JSON report locally</summary><p>This preview stays in this page and does not replace your records or connect an RD account.</p><label>Choose device report<input type="file" accept=".json,application/json" onChange={importReport} /></label>{importError && <p role="alert">{importError}</p>}{imported && <div><p>{imported.rows.length} imported items, validated for local review.</p><button className="secondary-button" onClick={() => setImported(null)}>Clear preview</button><div className="rd-table-scroll"><table><thead><tr><th>Date</th><th>Time</th><th>Food</th><th>Servings</th><th>Patient’s words</th>{nutrients.map((n) => <th key={n.key}>{n.label} ({n.unit})</th>)}</tr></thead><tbody>{imported.rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.time || 'Unknown'}</td><th scope="row">{r.name}</th><td>{r.servings}</td><td style={{whiteSpace:"pre-wrap",maxWidth:400}}>{conversationText(r.conversation) || "Not recorded"}</td>{nutrients.map((n) => <td key={n.key}>{formatAmount(r.nutrients[n.key], 2)}</td>)}</tr>)}</tbody></table></div></div>}</details>
    <div className="rd-controls"><label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Through<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><button className="secondary-button" onClick={exportCsv} disabled={start > end}>Export CSV</button><button className="secondary-button" onClick={() => download(`renalsync-${start}-${end}.json`, JSON.stringify(report, null, 2), 'application/json')} disabled={start > end}>Export JSON</button></div>
    {start > end && <p role="alert">Choose an end date on or after the start date.</p>}
    <details><summary>Choose nutrient columns ({selected.length})</summary><div className="rd-nutrient-picker">{NUTRIENTS.map((n) => <label key={n.key}><input type="checkbox" checked={selected.includes(n.key)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, n.key] : current.filter((k) => k !== n.key))} />{n.label} ({n.unit})</label>)}</div></details>
    <p>{filtered.length} recorded items · {dates.filter((d) => isDayComplete(dayRecords, entries, d)).length}/{dates.length} recorded days confirmed complete by the patient. Confirmation describes food logging, not nutrient completeness. Missing days are not zero intake.</p>
    <section className="rd-daily"><h3>Daily review</h3><p>Compare each day with this profile’s saved targets. These are recorded-food totals, not a clinical assessment.</p>{daily.map(day=><details key={day.date} open={daily.length===1}><summary>{day.date} · {day.items.length} food records</summary><div className="rd-meal-status">{MEALS.map(meal=><span key={meal}><strong>{meal}</strong>{day.items.some(e=>e.meal===meal)?'Food recorded':day.reviews[meal]?.status==='not-eaten'?'Patient reported not eaten':day.reviews[meal]?'Reviewed; no food details':'Not recorded'}</span>)}</div><div className="rd-summary">{nutrients.map(n=>{const v=day.nutrients[n.key];return <article key={n.key}><strong>{n.label}</strong><span>{v.knownCount?formatAmount(v.knownSubtotal,2):'Unknown'} {n.unit}</span><small>{v.status}</small><small>{v.knownCount}/{v.itemCount} items with data · Saved target {v.target.min ?? '—'} to {v.target.max ?? '—'} {n.unit}/day</small></article>;})}</div>{Object.entries(day.reviews).filter(([,r])=>r.conversation?.length).map(([meal,r])=><details key={meal}><summary>{meal} review conversation</summary>{r.conversation.map((t,i)=><p key={i}><strong>{t.role==='user'?'Patient':'Assistant'}:</strong> {t.content}</p>)}</details>)}</details>)}</section>
    <section className="rd-originals"><h3>Food details & patient’s words</h3><p>Voice text is an automatic transcription and may contain recognition errors. Corrections remain in the conversation. Old entries have no transcript.</p>{rows.map((r,i)=><details key={i}><summary>{r.date} · {r.meal} · {r.name} · {formatAmount(r.servings,2)} servings</summary><p>Meal time: {r.time || 'Unknown'} · Input: {r.inputMethod} · Confirmed: {r.confirmedAt || 'Not recorded'}</p><p>Source: {r.source} · Weight: {formatAmount(r.grams,2)} g</p>{r.conversation.length?r.conversation.map((t,j)=><div className="rd-utterance" key={j}><strong>{t.role==='user'?'Patient':'Assistant'}</strong><small>{t.at} · {t.source}</small><p>{t.content}</p></div>):<p>No original words recorded.</p>}</details>)}</section>
    <h3>Range totals · known amounts</h3><div className="rd-summary">{nutrients.map((n) => <article key={n.key}><strong>{n.label}</strong><span>{totals[n.key].knownCount ? formatAmount(totals[n.key].knownSubtotal, 2) : 'Unknown'} {n.unit}</span><small>{totals[n.key].complete ? 'Complete for recorded items' : 'Incomplete · known subtotal only'} · {totals[n.key].knownCount}/{totals[n.key].itemCount} items known</small></article>)}</div>
    <div className="rd-table-scroll" tabIndex="0" aria-label="Food record table, scroll horizontally"><table><caption>Per-item amounts include recorded servings. Unknown values are never treated as zero.</caption><thead><tr>{['Date', 'Meal time', 'Meal', 'Food', 'Servings', 'Recorded grams', 'Source', 'Entry timestamp', ...nutrients.map((n) => `${n.label} (${n.unit})`)].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.time || 'Unknown'}</td><td>{r.meal || 'Unknown'}</td><th scope="row">{r.name}</th><td>{formatAmount(r.servings, 2)}</td><td>{formatAmount(r.grams, 2)}</td><td>{r.source}</td><td>{r.recordedAt || 'Not recorded'}</td>{nutrients.map((n) => <td key={n.key}>{formatAmount(r.nutrients[n.key], 2)}</td>)}</tr>)}</tbody></table></div>
    {!rows.length && <p>No recorded items in this date range.</p>}
  </section>;
}
