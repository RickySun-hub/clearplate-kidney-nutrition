import { useMemo, useState } from 'react';
import './RecipeBuilder.css';

export default function RecipeLibrary({recipes, onChoose, onOpenRecipe, onCreate, onDescribe, onImport}) {
  const [search,setSearch]=useState('');
  const matches=useMemo(()=>recipes.filter(r=>r.name.toLowerCase().includes(search.trim().toLowerCase())),[recipes,search]);
  const saved=matches.filter(r=>r.calculated||r.imported);
  const cookbook=matches.filter(r=>!r.calculated&&!r.imported);
  const row=recipe=><li key={recipe.id}><button type="button" className="recipe-row-name" onClick={()=>onOpenRecipe(recipe)} aria-label={`View ${recipe.name} recipe`}><strong>{recipe.name}</strong><span>{recipe.calculated?'Your recipe':recipe.imported?'Imported · nutrition unknown':'Cookbook recipe'}</span></button><button type="button" onClick={()=>onChoose(recipe)} aria-label={`Log ${recipe.name}`}>Log</button></li>;
  return <main className="recipe-builder patient-recipes">
    <header><h1>Food & recipes</h1><p>Tell us what you ate. Check the food and portion, then save.</p></header>
    <button type="button" className="primary-button recipe-describe" onClick={onDescribe}>Describe food · speak or type</button>
    <section><div className="recipe-builder-heading"><h2>Your recipes</h2><button type="button" onClick={onCreate}>Create a recipe</button></div><p>Save foods you make together for a quicker next time.</p>
      <label>Find a recipe<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name" /></label>
      {saved.length?<ul className="patient-recipe-list">{saved.map(row)}</ul>:<p>{search?'No saved recipes match.':'Your saved recipes will appear here.'}</p>}
    </section>
    <details className="recipe-advanced"><summary>Browse cookbook recipes ({cookbook.length})</summary><ul className="patient-recipe-list">{cookbook.map(row)}</ul></details>
  <details className="recipe-advanced"><summary>More recipe options</summary><button type="button" onClick={onImport}>Import a recipe source</button></details>
  </main>;
}
