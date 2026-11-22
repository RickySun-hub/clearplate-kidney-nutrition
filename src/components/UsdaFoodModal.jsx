import { useState, useRef, useEffect } from 'react';
import { createUsdaSelection, householdPortionLabel, validHouseholdPortion, resolveEatenPortion, usdaFoodSnapshot, isUnspecifiedFood } from '../utils/usdaSelection.js';
import { NUTRIENT_KEYS } from '../utils/nutrientCatalog.js';
import useDialogFocus from '../hooks/useDialogFocus';
import { formatAmount, localDateKey } from '../utils/nutrition';
import { suggestedMeal, validateMealMoment } from '../utils/meals';
import MealMomentFields from './MealMomentFields';
import './mealRecording.css';

export default function UsdaFoodModal({ open, onClose, onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [food, setFood] = useState(null);
  const [grams, setGrams] = useState('');
  const [amountMode, setAmountMode] = useState('household');
  const [portionIndex, setPortionIndex] = useState('');
  const [quantity, setQuantity] = useState('');
  const [matchConfirmed, setMatchConfirmed] = useState(false);
  const [moment, setMoment] = useState({});
  const { date, meal, time } = moment;
  useEffect(() => { if (open) { const time = new Date().toTimeString().slice(0, 5); setMoment({ date: localDateKey(), time, meal: suggestedMeal(time), mealManuallyChosen: false }); } }, [open]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [searched, setSearched] = useState(false);
  const pending = useRef(false);
  const selection = useRef(null);
  if (!selection.current) selection.current = createUsdaSelection({
    onStart: () => { pending.current=true; setBusy(true); setFood(null); setGrams(''); setQuantity(''); setPortionIndex(''); setMatchConfirmed(false); setError(''); },
    onFood: data => { setFood(data.food); setAmountMode(data.food.portions.some(validHouseholdPortion) ? 'household' : 'grams'); setSource(data.provenance?.live === true ? 'Live USDA food details' : data.provenance?.live === false ? 'USDA public download' : 'USDA food details · source mode not supplied'); },
    onError: setError,
    onEnd: () => { pending.current=false; setBusy(false); },
  });
  useEffect(() => { if (!open) { selection.current.cancel(); pending.current=false; setBusy(false); } return () => selection.current.cancel(); }, [open]);
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  let portion = null, preview = null;
  if (food) {
    try { portion = resolveEatenPortion(food, amountMode === 'household' ? {kind:'household',portionIndex:portionIndex === '' ? null : Number(portionIndex),quantity} : {kind:'grams',grams}); preview = usdaFoodSnapshot(food,portion); } catch { /* An incomplete amount is not intake. */ }
  }
  async function search(event) {
    event.preventDefault();
    if (pending.current) return;
    selection.current.cancel(); pending.current = true; setBusy(true); setError(''); setFood(null); setResults([]); setMatchConfirmed(false);
    try {
      const response = await fetch('/api/fdc-search?' + new URLSearchParams({q:query.trim(),pageSize:'20',dataTypes:'Foundation,SR Legacy,Survey (FNDDS),Branded'}));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Search unavailable.');
      setResults(data.foods || []); setSearched(true);
      setSource(data.provenance?.live === true ? 'Live USDA search' : data.provenance?.live === false ? 'USDA public download' : 'USDA search · source mode not supplied');
    } catch (err) { setError(err.message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function save(placeholder = false) {
    if (pending.current) return;
    try { validateMealMoment(moment, localDateKey()); } catch (err) { setError(err.message); return; }
    if (!query.trim() || (!placeholder && (!preview || isUnspecifiedFood(food) && !matchConfirmed))) {
      setError(isUnspecifiedFood(food) && !matchConfirmed ? 'Confirm that this unspecified-food estimate fits what you ate.' : 'Choose the food and your eaten household portion or measured grams. You can also save it with unknown nutrients.'); return;
    }
    pending.current = true; setBusy(true); setError('');
    try {
      const customFood = placeholder ? {name:query.trim(),...Object.fromEntries(NUTRIENT_KEYS.map(key=>[key,null])),method:'unresolved',methodLabel:'Nutrients not yet available',servingDescription:'Amount not yet measured',grams:null,fdcId:null,sourceSnapshot:null,portionSelection:null} : {...preview,matchConfirmed:true};
      const saved = await onAdd({meal, time, date, servings:1, customFood:{id:`usda-${Date.now()}`,...customFood,notes:notes.trim(),sourceDescription:source}});
      if (saved !== false) { setFood(null); setResults([]); setQuery(''); setNotes(''); onClose(); }
      else setError('Not saved. Review the storage message and try again.');
    } catch { setError('Could not save this food. Please try again.'); }
    finally { pending.current=false; setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="custom-food-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="usda-food-title" tabIndex={-1}>
    <header className="modal-header"><div><h2 id="usda-food-title">Find food with USDA</h2><p>Choose a food that fits its preparation and brand, then tell us how much you ate.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close USDA search">Close</button></header>
    <form onSubmit={search} className="usda-search-form"><label>Food name<input required maxLength={120} value={query} disabled={busy} onChange={e=>{selection.current.cancel();setQuery(e.target.value);setFood(null);setResults([]);setSearched(false);setSource('');}} placeholder="Banana, rice, chicken…" /></label><button className="primary-button" disabled={busy || !query.trim()}>Search</button></form>
    {source && <p>{source}</p>}
    <div className="usda-search-results">{results.map(item=><button type="button" key={item.fdcId} aria-pressed={food?.fdcId===item.fdcId} disabled={busy} onClick={()=>selection.current.select(item)}><strong>{item.description}</strong><span>{item.dataType} · FDC {item.fdcId}{isUnspecifiedFood(item) ? ' · Unspecified-food estimate: please confirm' : ''}</span></button>)}</div>
    {searched && !results.length && <p>No matching food in this source. Try a simpler name, use the package label, or save an unmeasured food below.</p>}
    {food && <section className="usda-food-amount"><h3>{food.description}</h3><a href={`https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`} target="_blank" rel="noreferrer">View USDA source ↗</a>
      {isUnspecifiedFood(food) && <label><input type="checkbox" checked={matchConfirmed} onChange={e=>setMatchConfirmed(e.target.checked)} /> This FNDDS food has unspecified details. I confirm it is a reasonable estimate of what I ate.</label>}
      {food.portions.some(validHouseholdPortion) && <label>How will you enter your portion?<select value={amountMode} onChange={e=>setAmountMode(e.target.value)}><option value="household">Household measure</option><option value="grams">Measured grams</option></select></label>}
      {amountMode === 'household' ? <><label>Source household measure<select value={portionIndex} onChange={e=>setPortionIndex(e.target.value)}><option value="">Choose a measure</option>{food.portions.map((p,i)=>validHouseholdPortion(p) && <option value={i} key={i}>{householdPortionLabel(p)} ({formatAmount(p.gramWeight,2)} g)</option>)}</select></label><label>How many of that measure did you eat?<input type="number" min="0.000001" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="For example, 0.5 or 2" /></label><p>The quantity multiplies the entire source measure above. Household weights are estimates.</p></> : <><label>Amount eaten (grams)<input type="number" min="0.000001" max="10000" step="any" value={grams} onChange={e=>setGrams(e.target.value)} placeholder="Enter your measured weight" /></label>{!food.portions.some(validHouseholdPortion) && <p>This source has no usable household measure. Enter a measured weight or keep nutrients unknown.</p>}</>}
      {preview && <p>{preview.servingDescription}</p>}<p>{['calories','protein','sodium','potassium','phosphorus'].map(key=>`${key}: ${formatAmount(preview?.[key] ?? null,2)} ${key==='calories'?'kcal':key==='protein'?'g':'mg'}`).join(' · ')}</p><p>USDA values are estimates. Unknown means this source does not provide the value; it does not mean zero.</p></section>}
    <MealMomentFields value={moment} onChange={setMoment} disabled={busy} /><div className="form-grid"><label className="full-field">Notes or product URL (optional)<input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}<footer className="drawer-actions"><button type="button" className="primary-button" disabled={busy||!preview||isUnspecifiedFood(food)&&!matchConfirmed} onClick={()=>save(false)}>Confirm food and portion · Save</button><button type="button" className="secondary-button" disabled={busy||!query.trim()} onClick={()=>save(true)}>Save with unknown nutrients</button></footer>
  </section></div>;
}
