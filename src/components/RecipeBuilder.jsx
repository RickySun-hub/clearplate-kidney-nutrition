import { useEffect, useRef, useState } from 'react';
import { NUTRIENTS } from '../utils/nutrientCatalog.js';
import { formatAmount, localDateKey } from '../utils/nutrition.js';
import { createUsdaSelection, portionDescription } from '../utils/usdaSelection.js';
import { buildCalculatedRecipe, calculateRecipe, editRecipeIngredients, recipePortion } from '../utils/recipeCalculation.js';
import './RecipeBuilder.css';

const empty = {name:'',ingredients:[],servings:'1',finishedGrams:'',yieldConfirmed:false};
export default function RecipeBuilder({recipe, onSave, onLog, onClose}) {
  const [draft,setDraft] = useState(()=>structuredClone(recipe?.calculation || empty));
  const [saved,setSaved] = useState(recipe || null), [dirty,setDirty] = useState(!recipe);
  const [query,setQuery] = useState(''), [results,setResults] = useState([]), [food,setFood] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [searched,setSearched] = useState(false);
  const [basis,setBasis] = useState('servings'), [amount,setAmount] = useState('1'), [meal,setMeal] = useState('');
  const [date,setDate] = useState(localDateKey);
  const [time,setTime] = useState(()=>new Date().toTimeString().slice(0,5));
  const [allNutrients,setAllNutrients] = useState(false);
  const [editing,setEditing] = useState(!recipe), [advanced,setAdvanced] = useState(false);
  const pending=useRef(false), heading=useRef(null), selection=useRef(null), searchController=useRef(null);
  if (!selection.current) selection.current=createUsdaSelection({onStart:()=>{pending.current=true;setBusy(true);setError('');setFood(null);},onFood:data=>setFood(data.food),onError:setError,onEnd:()=>{pending.current=false;setBusy(false);}});
  useEffect(()=>{heading.current?.focus();window.scrollTo(0,0);return ()=>{selection.current.cancel();searchController.current?.abort();};},[]);
  const result=calculateRecipe(draft);
  const change=(key,value)=>{setDraft(current=>({...current,[key]:value}));setDirty(true);};
  const ingredients=(rows)=>{setDraft(current=>editRecipeIngredients(current,rows));setDirty(true);};
  function editRow(index,key,value){ingredients(draft.ingredients.map((row,i)=>i===index?{...row,[key]:value}:row));}
  async function search(event){
    event.preventDefault();if(pending.current || !query.trim())return;
    selection.current.cancel();pending.current=true;setBusy(true);setError('');setFood(null);
    const controller=new AbortController();searchController.current=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {const response=await fetch(`/api/fdc-search?q=${encodeURIComponent(query.trim())}&pageSize=15`,{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error('Food search unavailable. Please retry.');setResults(data.foods || []);setSearched(true);}
    catch {if(!controller.signal.aborted)setError('Food search unavailable. Please retry.');else setError('Search timed out. Please retry.');}
    finally{clearTimeout(timeout);pending.current=false;setBusy(false);}
  }
  function addIngredient(){
    if(!food || draft.ingredients.length>=100)return;
    ingredients([...draft.ingredients,{food:structuredClone(food),quantity:food.portions?.some(p=>Number(p.gramWeight)>0&&Number(p.amount)>0)?'1':'',unit:food.portions?.some(p=>Number(p.gramWeight)>0&&Number(p.amount)>0)?`portion:${food.portions.findIndex(p=>Number(p.gramWeight)>0&&Number(p.amount)>0)}`:'g',state:'as-listed'}]);setFood(null);setResults([]);setQuery('');setSearched(false);
  }
  async function save(){
    if(pending.current)return;
    if(!draft.name.trim() || !draft.ingredients.length || !result.servings || result.servings<1 || result.servings>1000){setError('Enter a recipe name, add ingredients, and enter 1–1,000 equal servings.');return;}
    if(draft.finishedGrams !== '' && (!result.weightGrams || !draft.yieldConfirmed)){setError('Confirm a positive measured finished weight, or clear it to use the ingredient weight estimate.');return;}
    pending.current=true;setBusy(true);setError('');
    try{const next=buildCalculatedRecipe(draft);if(await onSave(next,saved?.id)===false)throw Error('Save failed. Review the storage message and retry.');setSaved(next);setDirty(false);setEditing(false);return next;}
    catch(err){setError(err.message);}finally{pending.current=false;setBusy(false);}
  }
  async function log(){
    if(pending.current)return;
    if(!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){setError('Enter the date and time eaten.');return;}
    if(!Number.isFinite(Number(amount)) || Number(amount)<=0 || (basis==='grams' && !result.weightGrams)){setError('Enter a positive portion and resolve the recipe weight for gram portions.');return;}
    const current=dirty||!saved ? await save() : saved;
    if(!current)return;
    pending.current=true;setBusy(true);setError('');
    try{
      const customFood={...current,...recipePortion(current.calculation,basis,amount),servingDescription:`${amount} ${basis==='grams'?'g':'equal servings'}`,grams:basis==='grams'?Number(amount):result.weightGrams?result.weightGrams*Number(amount)/result.servings:null,recipeVersionId:current.id};
      if(await onLog({customFood,servings:1,meal,time,date,timeSource:'user-recorded'})===false)throw Error('Meal not saved. Review the storage message and retry.');onClose();
    }catch(err){setError(err.message);}finally{pending.current=false;setBusy(false);}
  }
  const display=(value,unit)=>value===null?'Unknown':`${formatAmount(value,3)} ${unit}`;

  return <main className="recipe-builder">
    <header className="recipe-builder-heading"><div><h1 ref={heading} tabIndex={-1}>{saved ? saved.name : 'Make a recipe'}</h1><p>{saved ? 'Choose your portion and save.' : 'Add the foods you use. Save it once, log it again anytime.'}</p></div><button type="button" disabled={busy} onClick={onClose}>Back to recipes</button></header>
    <details className="recipe-edit" open={editing} onToggle={e=>setEditing(e.currentTarget.open)}><summary>{saved ? 'Edit recipe' : 'Your recipe'}</summary>
    <label className="recipe-name">Recipe name<input maxLength={120} value={draft.name} disabled={busy} onChange={e=>change('name',e.target.value)} /></label>
    <section aria-labelledby="recipe-ingredients-title"><h2 id="recipe-ingredients-title">What goes in it?</h2><p>Choose the food as used, such as raw oats or cooked rice.</p>
      <form className="recipe-search" onSubmit={search}><label>Describe an ingredient<input placeholder="Oats, banana, cooked rice…" maxLength={120} value={query} disabled={busy} onChange={e=>{setQuery(e.target.value);setFood(null);setResults([]);setSearched(false);}} /></label><button disabled={busy||!query.trim()}>Find food</button></form>
      <div className="recipe-search-results">{results.map(item=><button type="button" key={item.fdcId} disabled={busy} aria-pressed={food?.fdcId===item.fdcId} onClick={()=>selection.current.select(item)}><strong>{item.description}</strong></button>)}</div>
      {searched&&!results.length&&<p>No matching foods. Try a simpler search.</p>}
      {food&&<div className="recipe-selected"><p><strong>{food.description}</strong>{food.basis!=='per100g'&&<span> · Nutrition unavailable for this record.</span>}</p><button type="button" disabled={busy||draft.ingredients.length>=100} onClick={addIngredient}>Use this food</button></div>}
      {draft.ingredients.map((row,index)=><article className="recipe-ingredient" key={index} aria-label={`Ingredient ${index+1}`}>
        <div className="recipe-ingredient-title"><h3>{index+1}. {row.food.description}</h3><button type="button" disabled={busy} onClick={()=>ingredients(draft.ingredients.filter((_,i)=>i!==index))} aria-label={`Remove ingredient ${index+1}`}>Remove</button></div>
        <div className="recipe-fields"><label>How much?<input aria-label={`Ingredient ${index+1} quantity`} type="number" min="0" step="any" value={row.quantity} disabled={busy} placeholder="Unknown" onChange={e=>editRow(index,'quantity',e.target.value)} /></label>
          <label>Portion<select aria-label={`Ingredient ${index+1} measure`} value={row.unit} disabled={busy} onChange={e=>editRow(index,'unit',e.target.value)}><option value="g">Grams</option>{row.food.portions?.map((p,i)=>Number(p.gramWeight)>0&&Number(p.amount)>0?<option key={i} value={`portion:${i}`}>{p.amount} {portionDescription(p)}</option>:null)}</select></label>
</div>
        {result.weights[index]===null&&<p className="recipe-uncertainty">Amount unknown. Enter a measured amount or save with incomplete nutrition.</p>}
      </article>)}
      {!draft.ingredients.length&&<p>Find a food above, then check its portion. If no familiar measure is available, enter a measured weight or leave it unknown.</p>}
    </section>
    </details>
    {draft.ingredients.length>0&&<p className="recipe-uncertainty" role="status">{NUTRIENTS.slice(0,5).filter(n=>!result.nutrients[n.key].complete).map(n=>n.label).join(', ') ? `Incomplete: ${NUTRIENTS.slice(0,5).filter(n=>!result.nutrients[n.key].complete).map(n=>n.label).join(', ')}. Unknown is not zero.` : 'Nutrition is estimated from your selected foods.'}{NUTRIENTS.slice(5).some(n=>!result.nutrients[n.key].complete)&&' Other nutrient data is also missing; see advanced review.'}</p>}
    {draft.finishedGrams!==''&&!draft.yieldConfirmed&&<p className="recipe-uncertainty">Ingredients changed. Reconfirm the finished weight in advanced review, or clear it before saving.</p>}
    <section aria-labelledby="recipe-log-title"><h2 id="recipe-log-title">Your portion</h2><p>{result.servings ? `Whole recipe makes ${result.servings} personal serving${result.servings===1?'':'s'}. Choose how much you ate.` : 'Whole recipe yield unknown. Enter its serving count before logging.'}</p><div role="group" aria-label="Personal serving presets">{[0.5,1,2].map(value=><button type="button" key={value} disabled={busy} aria-pressed={basis==='servings'&&Number(amount)===value} onClick={()=>{setBasis('servings');setAmount(String(value));}}>{value} serving{value===1?'':'s'}</button>)}<button type="button" disabled={busy||!result.servings} onClick={()=>{setBasis('servings');setAmount(String(result.servings));}}>Whole recipe{result.servings ? ` · ${result.servings} servings` : ' · yield unknown'}</button></div><div className="recipe-fields recipe-log-fields"><label>Portion amount<input type="number" min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>Measure<select aria-label="Portion measure" value={basis} onChange={e=>setBasis(e.target.value)}><option value="servings">Personal servings</option><option value="grams">Grams of finished recipe</option></select></label></div><div className="recipe-fields"><label>Date eaten<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label>Time eaten<input type="time" value={time} onChange={e=>setTime(e.target.value)} /></label><label>Meal label (optional)<input list="recipe-meal-labels" value={meal} onChange={e=>setMeal(e.target.value)} /></label><datalist id="recipe-meal-labels">{['Breakfast','Brunch','Lunch','Dinner','Snack'].map(m=><option key={m} value={m}/>)}</datalist></div>
      <button type="button" className="primary-button" disabled={busy||!draft.ingredients.length||(basis==='grams'&&!result.weightGrams)} onClick={log}>{dirty||!saved?'Save recipe & log portion':'Save meal'}</button>
      {dirty&&<button type="button" className="recipe-save-only" disabled={busy} onClick={save}>{saved?'Save recipe changes only':'Keep recipe for later'}</button>}
      {saved&&!dirty&&<p role="status">Saved in your recipes.</p>}
    </section>
    <details className="recipe-advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>Advanced review & editing</summary>
    <section aria-labelledby="recipe-yield-title"><h2 id="recipe-yield-title">Recipe size & weight</h2><div className="recipe-fields"><label>Whole recipe makes (personal servings)<input type="number" min="1" max="1000" step="any" value={draft.servings} disabled={busy} onChange={e=>change('servings',e.target.value)} /></label><label>Measured finished weight (g, optional)<input type="number" min="0" step="any" value={draft.finishedGrams} disabled={busy} onChange={e=>{setDraft(current=>({...current,finishedGrams:e.target.value,yieldConfirmed:false}));setDirty(true);}} placeholder="After cooking, excluding container" /></label></div>
      {draft.finishedGrams!==''&&<label className="recipe-confirm"><input type="checkbox" checked={draft.yieldConfirmed} disabled={busy} onChange={e=>change('yieldConfirmed',e.target.checked)} />I confirm this finished weight for the current ingredients.</label>}
      {draft.finishedGrams!==''&&!draft.yieldConfirmed&&<p role="status">Confirm the measured weight after ingredient or weight changes. Weight-based amounts are unavailable until confirmed.</p>}
      <p><strong>{result.weightBasis}:</strong> {display(result.weightGrams,'g')}</p><p>Finished weight changes concentration, not total nutrients. Draining, discarded liquid, and cooking retention are not estimated.</p>
    </section>
    <section aria-labelledby="recipe-nutrition-title"><h2 id="recipe-nutrition-title">Nutrition details</h2><p>Database estimates. Unknown is never zero. Incomplete values show only the known ingredient subtotal; they do not establish a low or safe intake.</p>
      <label className="recipe-confirm"><input type="checkbox" checked={allNutrients} onChange={e=>setAllNutrients(e.target.checked)} />Show all nutrients</label>
      <div className="recipe-nutrition">{(allNutrients?NUTRIENTS:NUTRIENTS.slice(0,5)).map(n=>{const v=result.nutrients[n.key];return <article key={n.key} aria-label={`${n.label} calculation`}><h3>{n.label} <small>({n.unit})</small></h3><dl><div><dt>Whole recipe</dt><dd>{display(v.total,n.unit)}</dd></div><div><dt>One equal serving</dt><dd>{display(v.perServing,n.unit)}</dd></div><div><dt>Per 100 g</dt><dd>{display(v.per100g,n.unit)}</dd></div></dl><p>{v.knownCount}/{v.itemCount} ingredients with data{!v.complete&&` · Incomplete · Known subtotal: ${display(v.knownSubtotal,n.unit)}`}</p></article>;})}</div>
    </section>
    <section><h2>Food sources & conversions</h2>{draft.ingredients.map((row,index)=><article key={index}><h3>{row.food.description}</h3><p><a href={`https://fdc.nal.usda.gov/food-details/${row.food.fdcId}/nutrients`} target="_blank" rel="noreferrer">USDA FDC {row.food.fdcId}</a> · {row.food.dataType} · {row.food.release || 'Release not supplied'} · {row.food.basis}</p><p>{display(result.weights[index],'g')} in this recipe</p><label>Preparation of selected record<select aria-label={`Ingredient ${index+1} preparation`} value={row.state} disabled={busy} onChange={e=>editRow(index,'state',e.target.value)}><option value="as-listed">As listed / unspecified</option><option value="raw">Raw</option><option value="cooked">Cooked</option><option value="other">Other prepared state</option></select></label></article>)}<p>Preparation labels do not convert nutrients. Select a different food match if the preparation differs. Earlier versions and meal logs retain their original nutrition.</p></section>
    </details>
    {busy&&<p role="status">Working…</p>}{error&&<p className="recipe-error" role="alert">{error}</p>}
  </main>;
}
