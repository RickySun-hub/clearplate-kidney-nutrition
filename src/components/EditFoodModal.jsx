import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import useDialogFocus from '../hooks/useDialogFocus';
import { editFoodEntry, editableMealTime } from '../utils/entryEditing';
import { formatAmount, localDateKey, nutritionFor } from '../utils/nutrition';
import { isMeal, suggestedMeal, updateMealTime, mealSections } from '../utils/meals';
import { recipeRecordingBase, customizeRecipe } from '../utils/recipeRecording';
import defaultDetails from '../data/recipeDetails.json';
import recipeAudits from '../data/usdaRecipeAudit.json';
import usdaFoods from '../data/usdaFoods.json';
import RecipePortionEditor from './RecipePortionEditor';
import './mealRecording.css';

export default function EditFoodModal({ entry, recipesById, recipeDetails = defaultDetails, onSave, onClose }) {
  const [draft, setDraft] = useState({ date: entry.date, meal: isMeal(entry.meal) ? entry.meal : suggestedMeal(editableMealTime(entry)), mealManuallyChosen: isMeal(entry.meal), time: editableMealTime(entry), amount: entry.servings, unit: 'servings', recipeId: '', customFood: entry.customFood?.recipeCustomization ? entry.customFood : undefined });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), editSnapshot = useRef(null);
  const ref = useDialogFocus(true, () => { if (!lock.current) onClose(); });
  const food = draft.customFood || (draft.recipeId ? recipesById[draft.recipeId] : entry.source === 'custom' ? entry.customFood : recipesById[entry.recipeId]);
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const grams = Number(food?.grams);
  const servings = draft.unit === 'g' ? Number(draft.amount) / grams : Number(draft.amount);
  const nutrition = nutritionFor(food, servings);
  return <div className="modal-backdrop"><section className="modal edit-food-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="edit-food-title" tabIndex={-1}>
    <header><div><h2 id="edit-food-title">Edit food record</h2><p>{food?.name || 'Food source unavailable'}</p></div><button className="icon-button" aria-label="Close food editor" disabled={busy} onClick={onClose}><X /></button></header>
    <form onSubmit={async e => { e.preventDefault(); if (lock.current) return; setError(''); try { const next = editSnapshot.current?.draft === draft && editSnapshot.current?.entry === entry ? editSnapshot.current.record : editFoodEntry(entry, draft, recipesById); editSnapshot.current = {draft, entry, record:next}; lock.current = true; setBusy(true); if (await onSave(next) === false) setError('Not saved. Retry without changing this draft. If you changed it after a failed save, close this editor and use Retry unsynced save to save the retained version first.'); } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); } }}>
      <label>Food<select aria-label="Food" value={draft.recipeId} onChange={e => { const recipe = recipesById[e.target.value]; setDraft({ ...draft, recipeId: e.target.value, unit: 'servings', amount: recipe ? 1 : entry.servings, customFood: recipe ? recipeRecordingBase(recipe, recipeDetails[recipe.id], recipeAudits[recipe.id], usdaFoods) : entry.customFood?.recipeCustomization ? entry.customFood : undefined }); }}><option value="">Keep recorded food</option>{Object.values(recipesById).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <p className="field-note">Choose a recipe to replace the food. For a different USDA match or nutrition label, add the correct food, then remove this record. Changing a name would not change its nutrition.</p>
      {food?.recipeCustomization && <RecipePortionEditor food={food} servings={draft.amount} disabled={busy} onServingsChange={amount => setDraft(current => ({ ...current, amount, unit: 'servings' }))} onOverridesChange={overrides => setDraft(current => ({ ...current, customFood: customizeRecipe(food, overrides) }))} />}
      <div className="edit-food-grid">{!food?.recipeCustomization && <><label>Amount<input data-dialog-initial-focus required type="number" min="0.000001" step="any" value={draft.amount} onChange={e => set('amount', e.target.value)} /></label><label>Unit<select aria-label="Unit" value={draft.unit} onChange={e => { const unit = e.target.value; setDraft({ ...draft, unit, amount: unit === 'g' ? Number(draft.amount) * grams : Number(draft.amount) / grams }); }}><option value="servings">Source servings</option>{grams > 0 && Number.isFinite(grams) && <option value="g">Grams (g)</option>}</select></label></>}<label>Date eaten<input required type="date" max={localDateKey()} value={draft.date} onChange={e => set('date', e.target.value)} /></label><label>Meal<select aria-label="Meal" value={draft.meal} onChange={e => setDraft({ ...draft, meal: e.target.value, mealManuallyChosen: true })}>{mealSections.map(({name}) => <option key={name}>{name}</option>)}</select></label><label>Time eaten (optional)<input type="time" value={draft.time} onChange={e => setDraft({ ...updateMealTime(draft, e.target.value), timeConfirmed: true })} /></label></div>
      <p>{food?.servingDescription || (grams > 0 ? `1 source serving = ${formatAmount(grams, 2)} g` : 'Use the serving size in the original recipe or food label; no gram conversion is available.')}</p>
      {entry.timeSource !== 'user-recorded' && <p className="field-note">The previous time was a logging or scheduled time. Leave meal time blank unless you know when you ate.</p>}
      <p>Use the same raw or cooked state as the selected food source. Grams and servings describe that source only.</p>
      <p className="edit-food-preview">Preview: {formatAmount(nutrition.calories, 1)} kcal · {formatAmount(nutrition.sodium, 1)} mg sodium · {formatAmount(nutrition.protein, 1)} g protein</p>
      <p className="field-note">Changes reopen the affected day’s recording confirmation. Saved target snapshots are retained.</p>
      {error && <p role="alert">{error}</p>}<footer><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
    </form></section></div>;
}
