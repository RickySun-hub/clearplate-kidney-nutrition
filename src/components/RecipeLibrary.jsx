import { useMemo, useState } from 'react';
import './RecipeBuilder.css';
import { searchRecipes } from '../utils/recipeSearch.js';

export default function RecipeLibrary({recipes, details = {}, onChoose, onOpenRecipe, onCreate, onDescribe, onImport}) {
  const [search,setSearch]=useState('');
  const matches=useMemo(()=>searchRecipes(recipes,details,search),[recipes,details,search]);
  const saved=matches.filter(({recipe:r})=>r.calculated||r.imported);
  const cookbook=matches.filter(({recipe:r})=>!r.calculated&&!r.imported);
  const row=({recipe,ingredientHint,approximate})=><li key={recipe.id}><button type="button" className="recipe-row-name" onClick={()=>onOpenRecipe(recipe)} aria-label={`View ${recipe.name} recipe`}><strong>{recipe.name}</strong><span>{recipe.calculated?'Your recipe':recipe.imported?'Imported · nutrition unknown':'Cookbook recipe'}</span>{ingredientHint&&<span className="recipe-search-hint">{approximate?'Possible ingredient match':'Ingredient'}: {ingredientHint}</span>}{approximate&&!ingredientHint&&<span>Similar recipe name</span>}</button><button type="button" onClick={()=>onChoose(recipe)} aria-label={`Log ${recipe.name}`}>Log</button></li>;
  return <main className="recipe-builder patient-recipes">
    <header><h1>Food & recipes</h1><p>Tell us what you ate. Check the food and portion, then save.</p></header>
    <button type="button" className="primary-button recipe-describe" onClick={onDescribe}>Describe food · speak or type</button>
    <section><div className="recipe-builder-heading"><h2>Your recipes</h2><button type="button" onClick={onCreate}>Create a recipe</button></div><p>Save foods you make together for a quicker next time.</p>
      <label>Find a recipe<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes or ingredients" maxLength={160} /></label>
      {search.trim()?<><p role="status">{matches.length?`${matches.length} matching recipes`:'No recipes match. Try a shorter food name or another ingredient.'}</p><ul className="patient-recipe-list">{matches.map(row)}</ul></>:saved.length?<ul className="patient-recipe-list">{saved.map(row)}</ul>:<p>Your saved recipes will appear here.</p>}
    </section>
    {!search.trim()&&<details className="recipe-advanced"><summary>Browse cookbook recipes ({cookbook.length})</summary><ul className="patient-recipe-list">{cookbook.map(row)}</ul></details>}
  <details className="recipe-advanced"><summary>More recipe options</summary><button type="button" onClick={onImport}>Import a recipe source</button></details>
  </main>;
}
