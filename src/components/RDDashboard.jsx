import { eatenTimeOrder } from './TodayMeals.jsx';
import { conversationText, MEALS } from '../utils/mealConversation.js';
import { reviewDays } from '../utils/rdReview.js';
import { useMemo, useState } from 'react';
import { NUTRIENTS, normalizeNutrientPreferences } from '../utils/nutrientCatalog.js';
import { detailedNutritionFor, nutrientCoverage, formatAmount, localDateKey } from '../utils/nutrition.js';
import { isDayComplete } from '../utils/recording.js';
import './RDDashboard.css';

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
  const nutrients = NUTRIENTS.filter((n) => selected.includes(n.key));
  const filtered = useMemo(() => entries.filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || eatenTimeOrder(a)-eatenTimeOrder(b)), [entries, start, end]);
  const daily = reviewDays(entries,recipesById,profile,dayRecords,start,end);
  const totals = nutrientCoverage(filtered, recipesById);
  const latestDay = daily.at(-1);
  const reviewFlags = latestDay ? nutrients.map(n => ({...n, status:latestDay.nutrients[n.key].status})).filter(n => n.status==='Incomplete' || n.status.startsWith('Above') || n.status.startsWith('Below')) : [];
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
  const exportCsv = () => {
    const header = ['Date', 'Recorded meal time', 'Meal', 'Food', 'Servings', 'Source', 'Entry timestamp', 'Recorded grams', 'Source basis', 'Patient original words', 'Input method', 'Confirmed at', ...nutrients.map((n) => `${n.label} (${n.unit})`)];
    const body = rows.map((r) => [r.date, r.time || 'Unknown', r.meal, r.name, r.servings, r.source,
      r.recordedAt || 'Not recorded', r.grams ?? 'Unknown', r.sourceBasis || 'Unknown', conversationText(r.conversation),r.inputMethod,r.confirmedAt || '', ...nutrients.map((n) => r.nutrients[n.key] ?? 'Unknown')]);
    body.push(['Range known subtotal', '', '', '', '', '', '', '', '', '', '', '', ...nutrients.map((n) => totals[n.key].knownCount ? totals[n.key].knownSubtotal : 'Unknown')]);
    body.push(['Known items / recorded items', '', '', '', '', '', '', '', '', '', '', '', ...nutrients.map((n) => `${totals[n.key].knownCount}/${totals[n.key].itemCount}`)]);
    download(`nepholio-${start}-${end}.csv`, '\uFEFF' + [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const jumpTo = (id) => { const section = document.getElementById(id); if (section?.tagName === 'DETAILS') section.open = true; section?.focus(); section?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  return <section className="rd-dashboard" aria-labelledby="rd-title">
    <header><div><p className="rd-file-eyebrow">PATIENT FILE</p><h2 id="rd-title">{profile.name || "Name not recorded"}</h2><p>{sharedIdentity ? "Shared with your care account" : "Your device record"}</p></div></header>
    <nav className="rd-review-nav" aria-label="Patient file sections">{[['rd-profile','Profile'],['rd-daily-review','Daily review'],['rd-food-log','Food log']].map(([id,label])=><button key={id} type="button" onClick={()=>{jumpTo(id);}}>{label}</button>)}</nav>
    <section className="rd-review-first" aria-labelledby="rd-review-first-title"><div><p className="rd-file-eyebrow">LATEST RECORDED DAY{latestDay ? ` · ${latestDay.date}` : ''}</p><h3 id="rd-review-first-title">Review first</h3></div>{reviewFlags.length ? <ul>{reviewFlags.map(n=><li key={n.key}><strong>{n.label}</strong><span>{n.status}</span></li>)}</ul> : <p>{latestDay ? 'Review recorded values and saved targets below.' : 'No recorded days in this range.'}</p>}<button type="button" onClick={()=>{jumpTo('rd-daily-review');}}>Review daily values →</button><small>Data coverage & saved targets · not a clinical assessment</small></section>
    <div className="rd-controls"><label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Through<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
    {start > end && <p role="alert">Choose an end date on or after the start date.</p>}
    <section className="rd-daily" id="rd-daily-review" tabIndex="-1"><h3>Daily review</h3><p>Recorded amounts against saved daily targets.</p>{daily.map(day=><details key={day.date} open={day.date===daily.at(-1)?.date}><summary>{day.date} · {day.items.length} food records</summary><details className="rd-meal-review"><summary>Meal recording status</summary><div className="rd-meal-status">{MEALS.map(meal=><span key={meal}><strong>{meal}</strong>{day.items.some(e=>e.meal===meal)?'Food recorded':day.reviews[meal]?.status==='not-eaten'?'Patient reported not eaten':day.reviews[meal]?'Reviewed; no food details':'Not recorded'}</span>)}</div></details><div className="rd-summary">{nutrients.map(n=>{const v=day.nutrients[n.key];return <article key={n.key} data-nutrient={n.key}><strong>{n.label}</strong><span>{v.knownCount?formatAmount(v.knownSubtotal,2):'Unknown'} {n.unit}</span><small className={v.status==='Incomplete'||v.status.startsWith('Above')||v.status.startsWith('Below')?'rd-status-attention':undefined}>{v.status}</small><small>{v.knownCount}/{v.itemCount} items known{(v.target.min!=null||v.target.max!=null)&&<> · Saved target: {v.target.min!=null?`min ${v.target.min}`:''}{v.target.min!=null&&v.target.max!=null?' · ':''}{v.target.max!=null?`max ${v.target.max}`:''} {n.unit}/day</>}</small></article>;})}</div>{Object.entries(day.reviews).filter(([,r])=>r.conversation?.length).map(([meal,r])=><details key={meal}><summary>{meal} review conversation</summary>{r.conversation.map((t,i)=><p key={i}><strong>{t.role==='user'?'Patient':'Assistant'}:</strong> {t.content}</p>)}</details>)}</details>)}</section>


    <section aria-labelledby="rd-range-title"><h3 id="rd-range-title">Range totals · known amounts</h3><p>Across the selected dates. Missing values are unknown, never zero.</p><div className="rd-summary">{nutrients.map((n) => <article key={n.key} data-nutrient={n.key}><strong>{n.label}</strong><span>{totals[n.key].knownCount ? formatAmount(totals[n.key].knownSubtotal, 2) : 'Unknown'} {n.unit}</span><small className={totals[n.key].complete ? undefined : "rd-status-attention"}>{totals[n.key].knownCount}/{totals[n.key].itemCount} items known{totals[n.key].complete ? '' : ' · Incomplete'}</small></article>)}</div></section>
    <details><summary>Choose nutrient columns ({selected.length})</summary><div className="rd-nutrient-picker">{NUTRIENTS.map((n) => <label key={n.key}><input type="checkbox" checked={selected.includes(n.key)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, n.key] : current.filter((k) => k !== n.key))} />{n.label} ({n.unit})</label>)}</div></details>
    <p className="rd-coverage-note">{filtered.length} recorded items · {dates.filter((d) => isDayComplete(dayRecords, entries, d)).length}/{dates.length} recorded days confirmed complete by the patient. Confirmation describes food logging, not nutrient completeness. Missing days are not zero intake.</p>
    <details className="rd-secondary" id="rd-profile" tabIndex="-1" aria-labelledby="rd-profile-title"><summary id="rd-profile-title">Patient profile</summary><dl className="rd-patient">
      {[['Condition', profile.condition], ['CKD stage', profile.stage], ['Treatment', ({'not-dialysis':'Not receiving dialysis',dialysis:'Receiving dialysis'})[profile.treatment] || profile.treatment], ['Weight', profile.weightKg != null ? `${profile.weightKg} kg` : null], ['Height', profile.heightCm != null ? `${profile.heightCm} cm` : null], ...(sharedIdentity ? [['Patient account', sharedIdentity]] : [])].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}
    </dl></details>
    <details className="rd-secondary"><summary>Record access & export notes</summary><button className="secondary-button" onClick={exportCsv} disabled={start > end}>Export CSV for Excel</button><p className="rd-notice">{sharedIdentity ? "This cloud record refreshes while the dashboard is open." : "This is the record on this device."} Remote access and sharing status are shown in the connection panel. Exports contain your food records; review the file and choose who receives it. Meal time is the recorded meal time, not a verified ingestion timestamp.</p></details>
    <details className="rd-secondary rd-records" id="rd-food-log" tabIndex="-1"><summary>Food log · {rows.length} records</summary><p id="rd-table-help">Per-item amounts include recorded servings. Scroll horizontally for all columns.</p>
    <div className="rd-table-scroll" aria-describedby="rd-table-help" role="region" tabIndex="0" aria-label="Food record table, scroll horizontally"><table><caption>Food log · per-item amounts</caption><thead><tr>{['Date', 'Meal time', 'Meal', 'Food', 'Servings', 'Recorded grams', 'Source', 'Entry timestamp', ...nutrients.map((n) => `${n.label} (${n.unit})`)].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.time || 'Unknown'}</td><td>{r.meal || 'Unknown'}</td><th scope="row">{r.name}</th><td>{formatAmount(r.servings, 2)}</td><td>{formatAmount(r.grams, 2)}</td><td>{r.source}</td><td>{r.recordedAt || 'Not recorded'}</td>{nutrients.map((n) => <td key={n.key}>{formatAmount(r.nutrients[n.key], 2)}</td>)}</tr>)}</tbody></table></div>
    <details className="rd-originals rd-secondary"><summary>Patient’s words & recording details</summary><p>Voice text is an automatic transcription and may contain recognition errors. Corrections remain in the conversation. Old entries have no transcript.</p>{rows.map((r,i)=><details key={i}><summary>{r.date} · {r.meal} · {r.name} · {formatAmount(r.servings,2)} servings</summary><p>Meal time: {r.time || 'Unknown'} · Input: {r.inputMethod} · Confirmed: {r.confirmedAt || 'Not recorded'}</p>{r.conversation.length?r.conversation.map((t,j)=><div className="rd-utterance" key={j}><strong>{t.role==='user'?'Patient':'Assistant'}</strong><small>{t.at} · {t.source}</small><p>{t.content}</p></div>):<p>No original words recorded.</p>}</details>)}</details>
    {!rows.length && <p>No recorded items in this date range.</p>}</details>
  </section>;
}
