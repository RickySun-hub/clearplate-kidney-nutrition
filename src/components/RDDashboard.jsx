import { useMemo, useState } from 'react';
import { ArrowLeft, Download, ChevronRight } from 'lucide-react';
import { conversationText, MEALS } from '../utils/mealConversation.js';
import { reviewDays, reviewDateRange, reviewQuality, isEstimatedFoodEntry } from '../utils/rdReview.js';
import { NUTRIENTS, normalizeNutrientPreferences } from '../utils/nutrientCatalog.js';
import { detailedNutritionFor, nutrientCoverage, formatAmount, localDateKey } from '../utils/nutrition.js';
import { validateDeviceReport } from '../utils/rdReport.js';
import './RDDashboard.css';

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not available';
const csvCell = value => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"'; };
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Words({ turns = [] }) {
  return turns.length ? <details className="rd-words"><summary>Patient’s words & conversation</summary><p className="rd-muted">Voice text may contain recognition errors.</p>{turns.map((turn, index) => <div key={index}><strong>{turn.role === 'user' ? 'Patient' : 'Assistant'}</strong><p>{turn.content}</p></div>)}</details> : null;
}
const targetText = (target, unit) => target.min == null && target.max == null ? 'Not saved' : target.min == null ? `Max ${formatAmount(target.max)} ${unit}/day` : target.max == null ? `Min ${formatAmount(target.min)} ${unit}/day` : `${formatAmount(target.min)}–${formatAmount(target.max)} ${unit}/day`;

export default function RDDashboard({ entries = [], recipesById = {}, profile = {}, dayRecords = {}, sharedIdentity, updatedAt, onBack }) {
  const [end, setEnd] = useState(localDateKey);
  const [start, setStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return localDateKey(date); });
  const [tab, setTab] = useState('overview');
  const [qualityDate, setQualityDate] = useState(null);
  const showEvidence = date => { setQualityDate(date); setTab('quality'); };
  const [selected, setSelected] = useState(() => normalizeNutrientPreferences(profile).trackedNutrients);
  const [metric, setMetric] = useState('sodium');
  const [imported, setImported] = useState(null), [importError, setImportError] = useState('');
  const range = reviewDateRange(start, end);
  const daily = useMemo(() => reviewDays(entries, recipesById, profile, dayRecords, start, end), [entries, recipesById, profile, dayRecords, start, end]);
  const filtered = useMemo(() => range.error ? [] : entries.filter(e => e.date >= start && e.date <= end).sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)), [entries, start, end, range.error]);
  const nutrients = NUTRIENTS.filter(n => selected.includes(n.key));
  const nutrient = NUTRIENTS.find(n => n.key === metric);
  const coverage = nutrientCoverage(filtered, recipesById);
  const quality = reviewQuality(daily, recipesById);
  const rows = filtered.map(entry => {
    const food = entry.source === 'custom' ? entry.customFood : recipesById[entry.recipeId];
    return { date: entry.date, time: entry.time ? `${entry.time}${entry.timeSource === 'user-recorded' ? '' : entry.timeSource === 'recording-time' ? ' (logging time; meal time unknown)' : ' (scheduled time)'}` : null,
      meal: entry.meal || null, name: food?.name || food?.title || 'Unresolved food', servings: entry.servings,
      source: food?.fdcId ? `${food.sourceDescription || 'USDA food match'} · ${food.dataType || 'Type unknown'} · FDC ${food.fdcId}${food.sourceRelease ? ` · ${food.sourceRelease}` : ''} · estimate` : food?.sourceLabel || food?.methodLabel || food?.method || entry.source || 'Unknown',
      grams: food?.grams != null ? Number(food.grams) * Number(entry.servings) : null,
      sourceBasis: food?.sourceBasis || null, fdcId: food?.fdcId || null, sourceUrl: food?.sourceUrl || null,
      recordedAt: entry.recordedAt || entry.createdAt || null, conversation: entry.conversation || [], inputMethod: entry.inputMethod || 'manual', confirmedAt: entry.confirmedAt || null,
      nutrients: detailedNutritionFor(food, entry.servings) };
  });
  function exportCsv() {
    const header = ['Date', 'Meal time', 'Meal', 'Food', 'Servings', 'Source', 'Entry timestamp', 'Recorded grams', 'Source basis', 'Patient original words', 'Input method', 'Confirmed at', ...nutrients.map(n => `${n.label} (${n.unit})`)];
    download(`nepholio-${start}-${end}.csv`, [header, ...rows.map(r => [r.date, r.time || 'Unknown', r.meal, r.name, r.servings, r.source, r.recordedAt || 'Not recorded', r.grams ?? 'Unknown', r.sourceBasis || 'Unknown', conversationText(r.conversation), r.inputMethod, r.confirmedAt || '', ...nutrients.map(n => r.nutrients[n.key] ?? 'Unknown')])].map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  const report = { schema: 'renalsync-device-report', version: 1, exportedAt: new Date().toISOString(), range: { start, end }, nutrientUnits: Object.fromEntries(NUTRIENTS.map(n => [n.key, n.unit])), selectedNutrients: selected, rows, totals: coverage, mealReviews: Object.fromEntries(daily.map(d => [d.date, d.reviews])), days: daily.map(d => ({ date: d.date, confirmedComplete: d.confirmedComplete, targetSource: d.targetSource })) };
  async function importReport(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('Report must be smaller than 5 MB.'); setImported(validateDeviceReport(JSON.parse(await file.text()))); setImportError(''); }
    catch (error) { setImported(null); setImportError(error.message || 'Could not read report.'); }
  }
  return <section className="rd-review" aria-labelledby="rd-patient-title">
    <header className="rd-review-header">
      <button className="rd-back" onClick={onBack}><ArrowLeft size={17} />Patients</button>
      <div className="rd-identity"><div><h1 id="rd-patient-title">{profile.name || 'Name not recorded'}</h1><p>{[profile.condition, profile.stage, profile.treatment].filter(Boolean).join(' · ') || 'Profile details not recorded'}</p></div><div className="rd-updated"><span>Record updated</span><strong>{timestamp(updatedAt)}</strong><small>File {sharedIdentity?.slice(0, 8)}</small></div></div>
      <div className="rd-range"><label>From<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>Through<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <details className="rd-tools"><summary><Download size={16} />Export & report tools</summary><div><p>Exports contain patient data. Share only with intended recipients.</p><button disabled={!!range.error} onClick={exportCsv}>Export CSV</button><button disabled={!!range.error} onClick={() => download(`nepholio-${start}-${end}.json`, JSON.stringify(report, null, 2), 'application/json')}>Export JSON</button>
        <details><summary>Preview a saved JSON report</summary><label>Local report<input type="file" accept=".json,application/json" onChange={importReport} /></label>{importError && <p role="alert">{importError}</p>}{imported && <><p>{imported.rows.length} items · local preview, not this patient’s cloud record</p><button onClick={() => setImported(null)}>Clear preview</button><div className="rd-imported">{imported.rows.map((r, i) => <details key={i}><summary>{r.date} · {r.name} · {formatAmount(r.servings, 2)} servings</summary><p>Meal time: {r.time || 'Unknown'}</p><dl>{nutrients.map(n => <div key={n.key}><dt>{n.label}</dt><dd>{formatAmount(r.nutrients[n.key], 2)} {n.unit}</dd></div>)}</dl><Words turns={r.conversation} /></details>)}</div></>}</details></div></details>
      </div>
    </header>
    <nav className="rd-tabs" aria-label="Patient review sections">{[['overview', 'Overview'], ['food', 'Food log'], ['quality', 'Sources & confidence']].map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {range.error ? <div className="rd-empty" role="alert">{range.error}</div> : <div className="rd-panel" key={`${start}-${end}-${tab}`}>
      {tab === 'overview' && <>
        <div className="rd-section-heading"><div><h2>Recorded nutrition</h2><p>{daily.filter(d => d.items.length).length} of {daily.length} days have food records · {daily.filter(d => d.confirmedComplete).length} confirmed complete by the patient</p></div><label>Nutrient<select value={metric} onChange={e => setMetric(e.target.value)}>{NUTRIENTS.map(n => <option key={n.key} value={n.key}>{n.label} ({n.unit})</option>)}</select></label></div>
        <p className="rd-muted">Recorded amounts only. Select a status to review its sources and completeness.</p>
        <div className="rd-day-table"><div className="rd-day-head" aria-hidden="true"><span>Date / recording</span><span>{nutrient.label}</span><span>Saved target</span></div>{daily.slice().reverse().map(day => { const value = day.nutrients[metric]; return <article className="rd-day-row" key={day.date}><div><strong>{day.date}</strong><small>{!day.items.length ? 'No food records' : day.confirmedComplete ? 'Patient confirmed complete' : 'Not confirmed complete'}</small></div><div><strong>{value.knownCount ? formatAmount(value.knownSubtotal, 2) + ' ' + nutrient.unit : 'Unknown'}</strong>{day.items.length > 0 && <div className="rd-evidence-tags">{(!day.confirmedComplete || value.knownCount < value.itemCount) && <button onClick={() => showEvidence(day.date)}>Partial record</button>}{day.items.some(entry => isEstimatedFoodEntry(entry, recipesById)) && <button onClick={() => showEvidence(day.date)}>Includes estimates</button>}</div>}</div><div><span>{value.targetNeedsReview ? 'Targets need review' : targetText(value.target, nutrient.unit)}</span><button className="rd-source-link" onClick={() => showEvidence(day.date)}>{day.targetSource.startsWith('Current') ? 'Current reference' : 'Saved for this day'}</button></div></article>; })}</div>
        
      </>}
      {tab === 'food' && <>
        <div className="rd-section-heading"><div><h2>Food log</h2><p>{rows.length} recorded items. Open a day, then a meal to inspect its foods.</p><p>Meal confirmations are made by the patient. They are not RD reviews.</p></div></div>
        <details className="rd-columns"><summary>Nutrients shown in food details & exports ({selected.length})</summary><div className="rd-nutrient-options">{NUTRIENTS.map(n => <label key={n.key}><input type="checkbox" checked={selected.includes(n.key)} onChange={e => setSelected(current => e.target.checked ? [...current, n.key] : current.filter(k => k !== n.key))} />{n.label}</label>)}</div></details>
        {daily.slice().reverse().map(day => <details className="rd-log-day" key={day.date}><summary><span>{day.date}</span><small>{day.items.length ? `${day.items.length} items` : 'No food records'}</small><ChevronRight size={17} /></summary><div className="rd-log-meals">{[...MEALS, ...(day.items.some(e => !MEALS.includes(e.meal)) ? ['Unspecified'] : [])].map(meal => {
          const foods = rows.filter(r => r.date === day.date && (meal === 'Unspecified' ? !MEALS.includes(r.meal) : r.meal === meal));
          const review = day.reviews[meal];
          return <details className="rd-log-meal" key={meal}><summary>{meal}<small>{foods.length ? `${foods.length} items` : review?.status === 'not-eaten' ? 'Patient reported not eaten' : review ? 'Patient confirmed; no food details' : 'Not recorded'}</small></summary>
            {foods.map((r, i) => <article className="rd-food-row" key={i}><div><h3>{r.name}</h3><p>{formatAmount(r.servings, 2)} servings · {r.time || 'Meal time unknown'}</p><small>{r.source}{r.grams != null ? ` · ${formatAmount(r.grams, 2)} g` : ''}</small></div><details><summary>Food details</summary><dl>{nutrients.map(n => <div key={n.key}><dt>{n.label}</dt><dd>{formatAmount(r.nutrients[n.key], 2)} {n.unit}</dd></div>)}</dl><p>Recorded: {timestamp(r.recordedAt)} · Input: {r.inputMethod}</p><Words turns={r.conversation} /></details></article>)}<Words turns={review?.conversation} />
          </details>;
        })}</div></details>)}
      </>}
      {tab === 'quality' && <>
        <h2>Sources & confidence</h2><p className="rd-muted">Source, nutrient availability and recording completeness are separate. A saved value is not an independently verified measurement.</p>
        <section className="rd-evidence-days" aria-label="Daily sources and completeness">
          {daily.slice().reverse().map(day => <details key={day.date} open={qualityDate === day.date} onToggle={event => { if (event.currentTarget.open && qualityDate !== day.date) setQualityDate(day.date); }}>
            <summary>{day.date} · {day.items.length ? `${day.items.length} recorded items` : 'No food records'}</summary>
            <p>{day.confirmedComplete ? 'The patient confirmed the day’s food log is complete. This does not verify nutrient accuracy.' : 'The patient has not confirmed the day’s food log is complete. Amounts cover recorded foods only.'}</p>
            <p>Target reference: {day.targetSource}. Targets are context, not a clinical assessment.</p>
            <p>{nutrient.label}: {day.nutrients[metric].knownCount} of {day.nutrients[metric].itemCount} recorded items have a value. Missing values are unknown, not zero.</p>
            {rows.filter(row => row.date === day.date).map((row,index) => <article key={index}><strong>{row.name}</strong><p>Source: {row.source}</p><p>Input: {row.inputMethod}. Recorded: {timestamp(row.recordedAt)}.</p></article>)}
          </details>)}
        </section>
        <p className="rd-muted">Recipe records without a saved nutrition snapshot use current recipe values. RD review status and follow-up notes are not saved here.</p>
        <h2>Recording completeness</h2><p className="rd-muted">These are gaps in the saved data, not findings about health or adherence.</p>
        <dl className="rd-quality-list">{[[quality.missingDays, 'Days without food records', 'Intake is unknown, including days with meal-status notes only.'], [quality.unconfirmedDays, 'Recorded days not confirmed complete', 'Amounts represent only the foods recorded.'], [quality.estimatedItems, 'Items marked as estimates', 'USDA matches and user-entered unpackaged estimates.'], [quality.unknownMealTimes, 'Items without a user-recorded meal time', 'Logging and scheduled times do not establish when food was eaten.']].map(([count, title, explanation]) => <div key={title}><dt>{title}<small>{explanation}</small></dt><dd>{count}</dd></div>)}</dl>
        <h2>Nutrient availability</h2><p className="rd-muted">Availability across {filtered.length} recorded items; zero is retained only when it is a known value.</p><div className="rd-quality-nutrients">{NUTRIENTS.map(n => { const c = coverage[n.key]; return <div key={n.key}><span>{n.label}</span><strong>{c.knownCount}/{c.itemCount} known</strong></div>; })}</div>
      </>}
    </div>}
  </section>;
}
