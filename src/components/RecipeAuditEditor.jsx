import { useState } from 'react';

export default function RecipeAuditEditor({ recipeId, ingredients, cookServings, onCalculated }) {
  const [overrides, setOverrides] = useState({});
  const [activeIndex, setActiveIndex] = useState(null);
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (index, key, value) => setOverrides((current) => ({ ...current, [index]: { ...current[index], [key]: value } }));
  async function search(event) {
    event.preventDefault(); setBusy(true); setMessage(''); setFoods([]);
    try {
      const response = await fetch(`/api/fdc-search?q=${encodeURIComponent(query)}&pageSize=10`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Search failed');
      setFoods(result.foods || []);
      setMessage(`${result.totalHits} results · ${result.provenance?.mode === 'snapshot' ? 'public USDA snapshot' : 'USDA API'}`);
    } catch (error) { setMessage(`Search unavailable. Start the local API with npm run dev:api. ${error.message}`); }
    finally { setBusy(false); }
  }
  async function calculate() {
    setBusy(true); setMessage('');
    try {
      const body = { recipeId, cookingServings: cookServings, overrides: Object.entries(overrides).map(([index, value]) => ({ index: Number(index), grams: Number(value.grams), ...(value.fdcId ? { fdcId: Number(value.fdcId) } : {}) })) };
      if (!body.overrides.length || Object.values(overrides).some((v) => v.grams === undefined || v.grams === '' || !Number.isFinite(Number(v.grams)) || Number(v.grams) < 0)) throw new Error('Enter original full-batch grams for every edited row.');
      const response = await fetch('/api/recipe-calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Calculation failed');
      onCalculated(result);
      setMessage('Draft recalculated. Changes stay in this view; download the audit to retain them. Meals and source files are unchanged.');
    } catch (error) { setMessage(`Unable to recalculate: ${error.message}`); }
    finally { setBusy(false); }
  }
  return <details className="audit-editor">
    <summary>Review food matches and measured grams</summary>
    <p className="audit-note">Enter edible grams for the <strong>full original recipe</strong>, before dividing into servings. Select a USDA food when needed. These edits remain a draft and are not saved to meal records.</p>
    <div className="audit-scroll"><table className="audit-table"><thead><tr><th>Ingredient</th><th>Original full-batch grams</th><th>USDA FDC ID</th><th>Find food</th></tr></thead><tbody>{ingredients.map((item, index) => item.kind === 'heading' ? null : <tr key={index}>
      <th>{item.original}</th>
      <td><input aria-label={`Original grams for ingredient ${index + 1}`} type="number" min="0" max="100000" step="any" placeholder={item.grams === null ? 'Measured grams' : String(item.grams)} value={overrides[index]?.grams ?? ''} onChange={(e) => update(index, 'grams', e.target.value)} /></td>
      <td><input aria-label={`FDC ID for ingredient ${index + 1}`} type="number" min="1" placeholder={item.fdcId ? String(item.fdcId) : 'Choose food'} value={overrides[index]?.fdcId ?? ''} onChange={(e) => update(index, 'fdcId', e.target.value)} /></td>
      <td><button className="table-add" type="button" onClick={() => { setActiveIndex(index); setQuery(item.foodDescription || item.foodText || ''); setFoods([]); }}>Search</button></td>
    </tr>)}</tbody></table></div>
    {activeIndex !== null && <form className="audit-search" onSubmit={search}>
      <label>USDA search for ingredient {activeIndex + 1}<input value={query} maxLength="120" onChange={(e) => setQuery(e.target.value)} required /></label>
      <button className="secondary-button" disabled={busy} type="submit">Search USDA</button>
      <ul>{foods.map((food) => <li key={food.fdcId}><button type="button" onClick={() => { update(activeIndex, 'fdcId', String(food.fdcId)); setFoods([]); setMessage(`Selected ${food.description}; enter measured full-batch grams.`); }}>{food.description} · {food.dataType} · FDC {food.fdcId}</button></li>)}</ul>
    </form>}
    <button className="secondary-button" type="button" disabled={busy} onClick={calculate}>{busy ? 'Working…' : 'Recalculate draft on backend'}</button>
    <p className="audit-note" role="status">{message}</p>
  </details>;
}
