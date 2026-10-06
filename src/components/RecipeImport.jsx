import { useRef, useState } from 'react';
import { buildImportedRecipe, parseRecipeSource, validateRecipeDraft, validateSourceUrl } from '../utils/recipeImport.js';
import './recipe-import.css';
export default function RecipeImport({ onImport, onClose }) {
  const [url,setUrl] = useState('');
  const [name,setName] = useState('');
  const [servings,setServings] = useState('');
  const [ingredients,setIngredients] = useState('');
  const [steps,setSteps] = useState('');
  const [json,setJson] = useState('');
  const [sourceYield,setSourceYield] = useState(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const pending = useRef(false);
  const sourceVersion = useRef(0);
  const loadDraft = (draft) => {
    setUrl(draft.sourceUrl); setName(draft.name); setServings(draft.servings ?? ''); setIngredients(draft.ingredients.join('\n')); setSteps(draft.steps.join('\n')); setSourceYield(draft.sourceYield); setConfirmed(false);
    setMessage(draft.servings === null ? 'Source servings are unknown. Confirm the original serving count before saving.' : 'Source recipe loaded. Review the editable draft below.');
  };
  async function fetchSource() {
    if (pending.current) return;
    pending.current=true; setBusy(true); setMessage('');
    const version=sourceVersion.current;
    try {
      const sourceUrl=validateSourceUrl(url);
      const response=await fetch('/api/recipe-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:sourceUrl}),signal:AbortSignal.timeout(7000)});
      if (!response.ok) throw new Error('Could not import this page. Paste Recipe JSON-LD or source ingredients and steps below.');
      const result=await response.json();
      if (sourceVersion.current === version) loadDraft(validateRecipeDraft(result.draft));
    } catch (error) { if (sourceVersion.current === version) setMessage(error.message?.includes('HTTPS') ? error.message : 'Could not import this page. Paste Recipe JSON-LD or source ingredients and steps below.'); }
    finally { pending.current=false; setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); if (pending.current || !confirmed) return;
    pending.current=true; setBusy(true); setMessage('');
    try {
      const imported=buildImportedRecipe({sourceUrl:url,name,servings,ingredients:ingredients.split(/\r?\n/).filter((line)=>line.trim()),steps:steps.split(/\r?\n/).filter((line)=>line.trim()),sourceYield});
      const result=await onImport?.(imported);
      if (result === false) throw new Error('The recipe could not be saved. Please try again.');
      setMessage('Recipe saved locally. Nutrition remains unknown.');
      onClose?.();
    } catch (error) { setMessage(error.message || 'Recipe could not be saved.'); }
    finally { pending.current=false; setBusy(false); }
  }
  const edit = (setter) => (event) => { setter(event.target.value); setConfirmed(false); sourceVersion.current++; };
  return <section className="recipe-import" aria-labelledby="recipe-import-title">
    <header><h2 id="recipe-import-title">Import a recipe</h2>{onClose && <button type="button" onClick={onClose} disabled={busy}>Close</button>}</header>
    <p>Import a public source recipe into an editable draft. Nutrition stays unknown until separately calculated or entered.</p>
    <label>Recipe source URL<input type="url" placeholder="https://…" value={url} onChange={edit(setUrl)} /></label>
    <button disabled={busy || !url} type="button" onClick={fetchSource}>{busy ? 'Working…' : 'Load public recipe URL'}</button>
    <details><summary>Paste Recipe JSON-LD from the source</summary><p>If the website blocks loading, paste its Recipe JSON-LD or copy the ingredients and steps into the draft below.</p><textarea aria-label="Source Recipe JSON-LD" value={json} onChange={(event)=>setJson(event.target.value)} /><button disabled={busy || !json || !url} type="button" onClick={()=>{try {loadDraft(parseRecipeSource(json,url));} catch(error){setMessage(error.message);}}}>Read pasted JSON-LD</button></details>
    <form onSubmit={save}>
      <label>Recipe name<input required maxLength="200" value={name} onChange={edit(setName)} /></label>
      <label>Original recipe servings<input required type="number" min="0.01" max="1000" step="any" value={servings} onChange={edit(setServings)} /></label>
      {sourceYield && <p>Source yield: {sourceYield}</p>}
      <label>Ingredients · one ingredient per line<textarea required value={ingredients} onChange={edit(setIngredients)} /></label>
      <label>Instructions · one step per line<textarea required value={steps} onChange={edit(setSteps)} /></label>
      <label className="recipe-import-confirm"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)} />I checked the source, quantities and original serving count.</label>
      <button disabled={busy || !confirmed || !onImport} type="submit">Save recipe locally</button>
    </form>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
