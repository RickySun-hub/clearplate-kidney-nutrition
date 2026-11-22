import { Check, ChevronLeft, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recipeImages } from '../data/seed';
import defaultDetails from '../data/recipeDetails.json';
import recipeAudits from '../data/usdaRecipeAudit.json';
import usdaFoods from '../data/usdaFoods.json';
import useDialogFocus from '../hooks/useDialogFocus';
import { localDateKey, formatAmount } from '../utils/nutrition';
import { suggestedMeal, validateMealMoment } from '../utils/meals';
import { customizeRecipe, recipeRecordingBase } from '../utils/recipeRecording';
import MealMomentFields from './MealMomentFields';
import RecipePortionEditor from './RecipePortionEditor';
import './mealRecording.css';

export default function AddMealModal({ open, recipes, recipeDetails = defaultDetails, initialRecipeId, initialMeal, saveError, onClose, onAdd }) {
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({});
  const [moment, setMoment] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const close = useCallback(() => { if (!lock.current) onClose(); }, [onClose]);
  const dialog = useDialogFocus(open, close);
  const makeSelection = useCallback(recipe => ({ servings: 1, food: recipeRecordingBase(recipe, recipeDetails[recipe.id], recipeAudits[recipe.id], usdaFoods) }), [recipeDetails]);
  useEffect(() => {
    if (!open) return;
    const time = new Date().toTimeString().slice(0, 5);
    setMoment({ date: localDateKey(), time, meal: initialMeal || suggestedMeal(time), mealManuallyChosen: Boolean(initialMeal) });
    const recipe = recipes.find(item => item.id === initialRecipeId);
    setSelected(recipe ? { [recipe.id]: makeSelection(recipe) } : {});
    setSearch(''); setStep(recipe ? 2 : 1); setError('');
  }, [open, initialRecipeId, initialMeal]);
  const results = useMemo(() => recipes.filter(recipe => recipe.name.toLowerCase().includes(search.trim().toLowerCase())), [recipes, search]);
  const selectedEntries = Object.entries(selected);
  const update = (id, patch) => setSelected(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  const validPortions = selectedEntries.length > 0 && selectedEntries.every(([, item]) => Number.isFinite(Number(item.servings)) && Number(item.servings) > 0 && Number(item.servings) <= 1000);
  if (!open) return null;
  const save = async () => {
    if (lock.current) return;
    try {
      validateMealMoment(moment, localDateKey());
      if (!validPortions) throw Error('Enter a positive serving amount for each recipe.');
      lock.current = true; setPending(true); setError('');
      const result = await onAdd(selectedEntries.map(([recipeId, item]) => ({ recipeId, servings: Number(item.servings), customFood: item.food, date: moment.date, time: moment.time, meal: moment.meal })));
      if (result !== false) { lock.current = false; onClose(); }
    } catch (err) { setError(err.message || 'Changes could not be saved. Try again.'); }
    finally { lock.current = false; setPending(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section ref={dialog} className="meal-modal recording-modal" role="dialog" aria-modal="true" aria-labelledby="add-meal-title" tabIndex={-1} aria-busy={pending} onMouseDown={e => e.stopPropagation()}>
    <header className="modal-header"><div><span className="recording-eyebrow">A little more personal</span><h2 id="add-meal-title">Record food</h2><p>Make this meal yours before saving.</p></div><button className="icon-button" aria-label="Close food recorder" disabled={pending} onClick={close}><X /></button></header>
    <ol className="recording-steps" aria-label="Recording steps">{['Choose food', 'Your portion', 'Time & meal'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step >= index + 1 ? 'active' : ''}><span>{index + 1}</span>{label}</li>)}</ol>
    <div className="recording-body">
      {step === 1 && <><label className="search-field"><Search size={20} aria-hidden="true" /><input data-dialog-initial-focus aria-label="Search recipes" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your recipes" /></label><p className="field-note">Choose one or more recipes. You can adjust each portion next.</p><div className="recording-recipe-list">{results.map(recipe => <button key={recipe.id} type="button" className={`recording-recipe-choice ${selected[recipe.id] ? 'selected' : ''}`} aria-pressed={Boolean(selected[recipe.id])} onClick={() => setSelected(current => { const next = { ...current }; if (next[recipe.id]) delete next[recipe.id]; else next[recipe.id] = makeSelection(recipe); return next; })}>{recipeImages[recipe.id] ? <img src={recipeImages[recipe.id]} alt="" /> : <span className="recipe-placeholder">{recipe.name[0]}</span>}<span><strong>{recipe.name}</strong><small>{formatAmount(recipe.calories)} kcal · {formatAmount(recipe.protein, 1)} g protein per serving</small></span><span className="check-mark">{selected[recipe.id] && <Check size={16} />}</span></button>)}{!results.length && <p>No matching recipes. Try a different name.</p>}</div></>}
      {step === 2 && <><p className="recording-help">Adjust what you actually ate. Changes apply to this record only.</p>{selectedEntries.map(([id, item]) => <RecipePortionEditor key={id} food={item.food} servings={item.servings} disabled={pending} onServingsChange={servings => update(id, { servings })} onOverridesChange={overrides => update(id, { food: customizeRecipe(item.food, overrides) })} />)}</>}
      {step === 3 && <><MealMomentFields value={moment} onChange={setMoment} disabled={pending} /><section className="recording-review"><h3>Ready to record</h3>{selectedEntries.map(([id, item]) => <div key={id}><strong>{item.food.name}</strong><span>{formatAmount(item.servings, 2)} serving{Number(item.servings) === 1 ? '' : 's'}{Object.keys(item.food.recipeCustomization.overrides).length ? ' · ingredients adjusted' : ''}</span></div>)}<p>Your original recipes stay unchanged.</p></section></>}
    </div>
    <footer className="meal-modal-footer">{(error || saveError) && <p className="storage-alert" role="alert">{error || saveError}</p>}<div className="modal-actions">{step > 1 && <button type="button" className="secondary-button" disabled={pending} onClick={() => { setStep(step - 1); setError(''); }}><ChevronLeft size={16} /> Back</button>}{step < 3 ? <button type="button" className="primary-button" disabled={!validPortions} onClick={() => { const invalid = dialog.current?.querySelector('input:invalid'); if (invalid) { invalid.reportValidity(); return; } setStep(step + 1); }}>{step === 1 ? `Adjust ${selectedEntries.length || ''} selected` : 'Continue to time & meal'}</button> : <button type="button" className="primary-button" disabled={pending || !validPortions} onClick={save}>{pending ? 'Saving…' : 'Save food record'}</button>}</div></footer>
  </section></div>;
}
