import { useEffect, useState } from 'react';
import { formatAmount, nutritionFor } from '../utils/nutrition';
import { ingredientAmount } from '../utils/recipeRecording';

function IngredientAmountField({ row, override, factor, id, resetToken, disabled, onChange }) {
  const initial = ingredientAmount(row, override, factor);
  const [unit, setUnit] = useState(initial.unit);
  const [raw, setRaw] = useState(initial.amount == null ? '' : String(Number(initial.amount.toFixed(6))));
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const value = ingredientAmount(row, override, factor);
    setUnit(value.unit); setRaw(value.amount == null ? '' : String(Number(value.amount.toFixed(6)))); setTouched(false);
  }, [factor, resetToken]);
  const publish = (value, nextUnit) => {
    if (value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000) onChange({ amount: Number(value) / factor, unit: nextUnit });
  };
  return <div className="recording-ingredient-row"><label htmlFor={id} title={row.sourceText}>{row.text}</label><div>
    <input id={id} aria-label={`Amount of ${row.text}`} type="number" min="0" max="100000" step="any" required={touched} disabled={disabled} value={raw} placeholder="Not measured" onChange={e => { setTouched(true); setRaw(e.target.value); publish(e.target.value, unit); }} />
    <select aria-label={`Unit for ${row.text}`} disabled={disabled} value={unit} onChange={e => {
      const nextUnit = e.target.value;
      const current = raw === '' ? null : Number(raw);
      const grams = unit === 'g' ? current : row.grams != null && row.quantity > 0 && current != null ? current * row.grams / row.quantity : null;
      const converted = nextUnit === 'g' ? grams : row.grams > 0 && grams != null ? grams * row.quantity / row.grams : null;
      const nextRaw = converted == null ? '' : String(Number(converted.toFixed(6)));
      setUnit(nextUnit); setRaw(nextRaw); setTouched(true); publish(nextRaw, nextUnit);
    }}><option value="g">g</option>{row.unit !== 'g' && <option value={row.unit}>{row.unit === 'count' ? 'pieces' : row.unit}</option>}</select>
  </div></div>;
}

export default function RecipePortionEditor({ food, servings, onServingsChange, onOverridesChange, disabled = false }) {
  const model = food.recipeCustomization;
  const [resetToken, setResetToken] = useState(0);
  const nutrition = nutritionFor(food, servings);
  const factor = Number(servings) > 0 ? Number(servings) : 1;
  return <section className="recipe-portion-editor">
    <div className="recipe-portion-heading"><h3>{food.name}</h3><label>Servings eaten<input aria-label={`Servings of ${food.name}`} type="number" min="0.000001" max="1000" step="any" required disabled={disabled} value={servings} onChange={e => onServingsChange(e.target.value)} /></label></div>
    <p className="field-note">1 serving: {food.servingDescription || 'use the original recipe portion'}. You can enter any positive amount, including 0.8.</p>
    <div className="recording-nutrition-preview" aria-live="polite"><span><strong>{formatAmount(nutrition.calories, 1)}</strong> kcal</span><span><strong>{formatAmount(nutrition.protein, 1)}</strong> g protein</span><span><strong>{formatAmount(nutrition.sodium, 1)}</strong> mg sodium</span></div>
    {!!model?.ingredients.length && <details className="recording-ingredients"><summary>Adjust individual ingredients <span>Optional</span></summary><p>Amounts are for the portion you are logging. Changing servings scales these amounts. Your original recipe stays the same.</p>
      {model.ingredients.map((row, index) => <IngredientAmountField key={index} id={`ingredient-${food.id}-${index}`} row={row} override={model.overrides[index]} factor={factor} resetToken={resetToken} disabled={disabled} onChange={edit => onOverridesChange({ ...model.overrides, [index]: edit })} />)}
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => { onOverridesChange({}); setResetToken(value => value + 1); }}>Reset ingredient changes</button>
      <p className="field-note">Adjusted nutrition is estimated from ingredient amounts and available food data. Missing amounts or food data stay unknown.</p>
    </details>}
    {!model?.ingredients.length && <p className="field-note">This recipe has no ingredient amounts available. You can adjust servings.</p>}
    {model?.nutritionStatus === 'incomplete' && <p className="recording-incomplete" role="status">Some ingredient amounts or nutrients are unavailable. Incomplete totals are shown as Unknown; your ingredient changes will still be saved.</p>}
    {model?.nutritionStatus === 'estimated' && <p className="field-note">Ingredient estimate updated for this record.</p>}
  </section>;
}
