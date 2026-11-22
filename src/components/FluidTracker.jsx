import { useRef, useState } from 'react';
import { activeFluids, convertFluidAmount, fluidAmountMl, fluidTotal, upsertFluid } from '../utils/fluids.js';
import { formatAmount } from '../utils/nutrition.js';
import './revision-20261104.css';
import './fluid-entry.css';

const quickAmounts = [150, 250, 500];
export default function FluidTracker({ date, records = [], entries = [], targetMl, onSave }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  const begin = (record, amount = '') => {
    if (saving.current) return;
    setError('');
    setDraft(record ? {...record, amount: record.amountMl, unit: 'ml'} : {id: crypto.randomUUID(), name: 'Water', amount, unit: 'ml', time: new Date().toTimeString().slice(0, 5), entryId: ''});
    setEditing(true);
  };
  async function save(nextRecords) {
    if (saving.current) return false;
    saving.current = true; setBusy(true); setError('');
    try {
      if (await onSave(date, nextRecords) !== false) { setEditing(false); return true; }
      setError('Drink could not be saved. Retry without changing this draft. If you changed it after a failed save, cancel this form and use Retry unsynced save to save the retained version first.');
    } catch (e) { setError(e.message || 'Drink could not be saved.'); }
    finally { saving.current = false; setBusy(false); }
    return false;
  }
  function changeUnit(unit) {
    try { setDraft({...draft, amount: convertFluidAmount(draft.amount, draft.unit, unit), unit}); setError(''); }
    catch (e) { setError(e.message); }
  }
  const linkedRecord = draft.entryId && records.find(r => r.entryId === draft.entryId && r.id !== draft.id);
  return <section className="fluid-tracker" aria-label="Fluid intake">
    <header><div><h3>Fluid intake</h3><p>Water and drinks recorded · {formatAmount(fluidTotal(records, entries), 0)} mL{Number(targetMl) > 0 ? ` · Your target: ${formatAmount(targetMl)} mL/day` : ''}</p></div>{onSave && !editing && <button type="button" className="secondary-button" disabled={busy} onClick={() => begin()}>Record fluid</button>}</header>
    <p className="field-note">Record drinks only, not water in solid foods or soup. If a drink is already in your meals, link that food below so its nutrition stays counted once.</p>
    {onSave && !editing && <div className="fluid-quick-entry"><p className="field-note">Choose an amount, then review and save.</p><div className="fluid-amounts" aria-label="Choose a drink amount">{quickAmounts.map(amount => <button type="button" className="secondary-button" disabled={busy} key={amount} onClick={() => begin(null, amount)}>{amount} mL</button>)}</div></div>}
    <ul>{activeFluids(records, entries).map(r => <li key={r.id}><span>{r.time} · {r.name} · {formatAmount(r.amountMl)} mL{r.entryId ? ' · Linked to meal' : ''}</span>{onSave && <span><button type="button" disabled={busy} onClick={() => begin(r)}>Edit<span className="sr-only"> {r.name} drink</span></button><button type="button" disabled={busy} onClick={() => save(records.filter(f => f.id !== r.id))}>Remove<span className="sr-only"> {r.name} drink</span></button></span>}</li>)}</ul>
    {editing && <form aria-label="Record a drink" onInvalid={event => event.currentTarget.querySelector('.fluid-drink-details')?.setAttribute('open', '')} onSubmit={e => {
      e.preventDefault(); if (saving.current) return;
      try {
        const record = {id: draft.id, name: draft.name.trim(), time: draft.time, amountMl: fluidAmountMl(draft.amount, draft.unit), ...(draft.entryId ? {entryId: draft.entryId} : {})};
        void save(upsertFluid(records, record));
      } catch (e) { setError(e.message); }
    }}>
      <div className="form-grid fluid-volume-fields"><label>Amount<input autoFocus required type="number" min="0.000001" step="any" disabled={busy} value={draft.amount} onChange={e => setDraft({...draft, amount: e.target.value})}/></label><label>Unit<select disabled={busy} value={draft.unit} onChange={e => changeUnit(e.target.value)}><option value="ml">mL</option><option value="floz">US fl oz</option><option value="cup">US cup (236.6 mL)</option></select></label></div>
      <div className="fluid-amounts" aria-label="Choose a drink amount">{quickAmounts.map(amount => <button type="button" className="secondary-button" disabled={busy} key={amount} onClick={() => {setDraft({...draft, amount, unit: 'ml'}); setError('');}}>{amount} mL</button>)}</div>
      <details className="fluid-drink-details"><summary>{draft.name || 'Drink'} · {draft.time || 'Set time'} <span>Change name or time</span></summary><div className="form-grid"><label>Drink name<input required maxLength={150} disabled={busy} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})}/></label><label>Time<input required type="time" disabled={busy} value={draft.time} onChange={e => setDraft({...draft, time: e.target.value})}/></label></div></details>
      <label className="fluid-food-link">Already logged this drink as food?<select disabled={busy} value={draft.entryId || ''} onChange={e => {
        const entryId = e.target.value, food = entries.find(entry => entry.id === entryId);
        setDraft({...draft, entryId, ...(food && !records.some(record => record.id === draft.id) ? {name: food.customFood?.name || food.name || food.recipeId || draft.name} : {})});
      }}><option value="">No — separate drink</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.customFood?.name || entry.name || entry.recipeId} · {entry.time}</option>)}</select></label>
      {linkedRecord && <p className="fluid-link-notice" role="status">This food already has {formatAmount(linkedRecord.amountMl)} mL in the fluid log. Saving replaces that amount, rather than adding another drink.</p>}
      <p className="field-note">Enter the total volume you drank. {draft.entryId ? 'Linked food nutrition is not added again. If you later change its food portion, update the fluid amount here too.' : 'This adds drink volume only. Log any food nutrition separately, then link it here.'}</p>
      <div className="care-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save fluid'}</button><button className="secondary-button" type="button" disabled={busy} onClick={() => {setEditing(false); setError('');}}>Cancel</button></div>
    </form>}{error && <p role="alert">{error}</p>}
  </section>;
}
