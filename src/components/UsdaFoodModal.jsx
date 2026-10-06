import { useState, useRef } from 'react';
import useDialogFocus from '../hooks/useDialogFocus';
import { formatAmount } from '../utils/nutrition';

export default function UsdaFoodModal({ open, onClose, onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [food, setFood] = useState(null);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState('Snack');
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0,5));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [searched, setSearched] = useState(false);
  const pending = useRef(false);
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  async function search(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setFood(null);
    try {
      const response = await fetch(`/api/fdc-search?q=${encodeURIComponent(query.trim())}&pageSize=20`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Search unavailable.');
      setResults(data.foods || []); setSearched(true);
      setSource(data.provenance?.live ? 'Live USDA search' : 'USDA public download · Foundation / SR Legacy');
    } catch (err) { setError(err.message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function save(placeholder = false) {
    if (pending.current) return;
    const weight = Number(grams);
    if (!query.trim() || (!placeholder && (!food || food.basis !== 'per100g' || !Number.isFinite(weight) || weight <= 0 || weight > 10000))) {
      setError('Choose a food and enter the amount eaten in grams, or save an unmeasured food.'); return;
    }
    pending.current = true; setBusy(true); setError('');
    try {
      const nutrients = placeholder ? { calories:null,protein:null,sodium:null,potassium:null,phosphorus:null } : Object.fromEntries(Object.entries(food.nutrients).map(([key,value]) => [key, typeof value === 'number' && Number.isFinite(value) ? value * weight / 100 : null]));
      const saved = await onAdd({meal, time, servings:1, customFood:{id:`usda-${Date.now()}`,name:placeholder?query.trim():food.description,...nutrients,
        method:placeholder?'unresolved':'usda-estimate', methodLabel:placeholder?'Nutrients not yet available':'USDA food match · estimate',
        servingDescription:placeholder?'Amount not yet measured':`${formatAmount(weight,2)} g`, grams:placeholder?null:weight,
        fdcId:placeholder?null:food.fdcId, sourceUrl:placeholder?null:food.sourceUrl, dataType:placeholder?null:food.dataType,
        sourceRelease:placeholder?null:food.release, sourceBasis:placeholder?null:food.basis, sourceNutrients:placeholder?null:food.nutrients, notes:notes.trim(), sourceDescription:source }});
      if (saved !== false) { setFood(null); setResults([]); setQuery(''); setNotes(''); onClose(); }
      else setError('Not saved. Review the storage message and try again.');
    } catch { setError('Could not save this food. Please try again.'); }
    finally { pending.current=false; setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="custom-food-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="usda-food-title" tabIndex={-1}>
    <header className="modal-header"><div><h2 id="usda-food-title">Find food with USDA</h2><p>Choose the closest match. Actual brands and recipes may differ.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close USDA search">Close</button></header>
    <form onSubmit={search} className="usda-search-form"><label>Food name<input required maxLength={120} value={query} onChange={e=>{setQuery(e.target.value);setFood(null);}} placeholder="Banana, rice, chicken…" /></label><button className="primary-button" disabled={busy || !query.trim()}>Search</button></form>
    {source && <p>{source}</p>}
    <div className="usda-search-results">{results.map(item=><button type="button" key={item.fdcId} aria-pressed={food?.fdcId===item.fdcId} onClick={()=>{setFood(item);setGrams('100');}}><strong>{item.description}</strong><span>{item.dataType} · FDC {item.fdcId}</span></button>)}</div>
    {searched && !results.length && <p>No matching food in this source. Try a simpler name, use the package label, or save an unmeasured food below.</p>}
    {food && <section className="usda-food-amount"><h3>{food.description}</h3><a href={`https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`} target="_blank" rel="noreferrer">View USDA source ↗</a>
      {!!food.portions?.length && <label>Use a household measure<select defaultValue="" onChange={e=>{if(e.target.value!=='')setGrams(String(food.portions[Number(e.target.value)].gramWeight));}} key={food.fdcId}><option value="">Choose a measure</option>{food.portions.map((p,i)=><option value={i} key={i}>{p.amount} {p.description || p.modifier} ({formatAmount(p.gramWeight,2)} g)</option>)}</select></label>}
      <label>Amount eaten (grams)<input type="number" min="0.01" max="10000" step="0.01" value={grams} onChange={e=>setGrams(e.target.value)} /></label>
      <p>{['calories','protein','sodium','potassium','phosphorus'].map(key=>`${key}: ${formatAmount(food.nutrients?.[key] == null ? null : food.nutrients[key]*Number(grams)/100,2)} ${key==='calories'?'kcal':key==='protein'?'g':'mg'}`).join(' · ')}</p><p>Unknown means this source does not provide the value; it does not mean zero.</p></section>}
    <div className="form-grid"><label>Meal<select value={meal} onChange={e=>setMeal(e.target.value)}>{['Breakfast','Lunch','Dinner','Snack'].map(x=><option key={x}>{x}</option>)}</select></label><label>Time eaten<input type="time" value={time} onChange={e=>setTime(e.target.value)} /></label><label className="full-field">Notes or product URL (optional)<input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}<footer className="drawer-actions"><button type="button" className="primary-button" disabled={busy||!food} onClick={()=>save(false)}>Confirm and save food</button><button type="button" className="secondary-button" disabled={busy||!query.trim()} onClick={()=>save(true)}>Can't measure it? Save with unknown nutrients</button></footer>
  </section></div>;
}
