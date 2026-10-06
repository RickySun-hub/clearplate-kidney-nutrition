import { ArrowUpRight, Plus, Search, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { recipeImages } from "../data/seed";
import recipeDetails from "../data/recipeDetails.json";
import recipeMetadata from "../data/recipeMetadata.json";
import { formatAmount } from "../utils/nutrition";
import { DEFAULT_FILTERS, enrichRecipe, filterRecipes } from "../utils/recipeFilters";

export default function RecipeLibrary({ recipes, details = recipeDetails, onChoose, onOpenRecipe }) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [view, setView] = useState('cards');
  const [snackOnly,setSnackOnly] = useState(false);
  const snackIdeas = new Set(['hummus','artichoke-dip','fresh-tzatziki','mango-salsa-wontons','apple-muffin']);
  const enriched = useMemo(() => recipes.map((recipe) => enrichRecipe(recipe, details[recipe.id], recipeMetadata[recipe.id])), [recipes,details]);
  const categories = useMemo(() => [...new Set([...enriched.map((recipe) => recipe.category), "Smoothies"])].sort(), [enriched]);
  const filtered = filterRecipes(enriched, filters).filter(recipe=>!snackOnly||snackIdeas.has(recipe.id));
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const nutrient = (value, unit) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${formatAmount(value, 1)} ${unit}` : "Unknown";
  const originalRecipe = (recipe) => recipes.find((item) => item.id === recipe.id);

  return (
    <main className="library-page">
      <header className="page-heading"><div><h1>Recipe library</h1><p>Find a recipe. Compare nutrition. Make it your own portion.</p></div><div className="library-count"><strong>{recipes.length}</strong><span>recipes in your library</span></div></header>
      <button type="button" className="smoothie-category" aria-pressed={filters.category === 'Smoothies'} onClick={()=>{setFilters({...DEFAULT_FILTERS,category:'Smoothies'});setSnackOnly(false);}}><span><strong>Smoothies</strong><small>Recipes coming soon</small></span><ArrowUpRight size={20} /></button>
      <div className="library-filter-panel">
        <label className="snack-filter"><input type="checkbox" checked={snackOnly} onChange={event=>setSnackOnly(event.target.checked)} />Snack ideas & small plates</label>
        <div className="library-toolbar">
          <label className="search-field"><Search size={20} /><input aria-label="Search recipe names and ingredients" value={filters.search} onChange={setFilter("search")} placeholder="Search names or ingredients" /></label>
          <label className="library-filter-field">Category<select value={filters.category} onChange={setFilter("category")}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="library-filter-field">Sort by<select value={filters.sort} onChange={setFilter("sort")}><option value="name">Name A–Z</option><option value="sodium">Sodium: ascending</option><option value="protein">Protein: ascending</option><option value="potassium">Potassium: ascending</option></select></label>
        </div>
        <details className="advanced-filters"><summary><SlidersHorizontal size={17} /> More filters <span>Diet, preparation & nutrient limits</span></summary><div className="library-filter-grid">
          <label className="library-filter-field">Diet (draft)<select value={filters.diet} onChange={setFilter("diet")}><option value="">All / unknown diets</option><option value="vegetarian">Vegetarian ingredients (draft)</option><option value="vegan">Vegan ingredients (draft)</option></select></label>
          <label className="library-filter-field">Preparation<select value={filters.preparation} onChange={setFilter("preparation")}><option value="">All preparations</option><option value="no-cook">No-cook assembly (draft)</option></select></label>
          <label className="library-filter-field">Source completeness<select value={filters.source} onChange={setFilter("source")}><option value="">All sources</option><option value="full">Ingredients + steps available</option><option value="nutrition-only">Nutrition only / missing recipe</option></select></label>
          {[['maxSodium', 'Sodium ceiling (mg)'], ['maxProtein', 'Protein ceiling (g)'], ['maxPotassium', 'Potassium ceiling (mg)']].map(([key, label]) => <label className="library-filter-field" key={key}>{label}<input type="number" min="0" step="any" value={filters[key]} onChange={setFilter(key)} placeholder="No ceiling" /></label>)}
        </div>
        <p className="library-filter-help">Ceilings apply to workbook values per serving and exclude unknown values. Diet and preparation annotations are unreviewed drafts from available ingredients and steps; uncertain diets are excluded. No-cook assembly may require precooked ingredients. These filters do not indicate clinical suitability.</p>
        </details>
      </div>
      <div className="library-filter-summary"><span role="status" aria-live="polite">{filtered.length} of {recipes.length} recipes</span><div className="library-display-actions"><button type="button" className="library-clear-filters" onClick={() => { setFilters({ ...DEFAULT_FILTERS }); setSnackOnly(false); }}>Clear filters</button><div className="view-switch" aria-label="Recipe display"><button type="button" aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={18} /></button><button type="button" aria-label="Table view" aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={18} /></button></div></div></div>
      {view === 'cards' ? <div className="recipe-card-grid">{filtered.map((recipe) => <article className="recipe-card" key={recipe.id}>
        <button className="recipe-card-open" type="button" onClick={() => onOpenRecipe(originalRecipe(recipe))} aria-label={`View ${recipe.name} recipe`}>
          <div className="recipe-card-image">{recipeImages[recipe.id] ? <img src={recipeImages[recipe.id]} alt="" loading="lazy" /> : <div className="recipe-card-placeholder"><BookPlaceholder /></div>}<span className="recipe-card-category">{recipe.category}</span></div>
          <div className="recipe-card-title"><h2>{recipe.name}</h2><ArrowUpRight size={19} /><p>{recipe.sourceCompleteness === 'full' ? 'Ingredients & cooking instructions' : 'Nutrition information only'}</p></div>
        </button>
        <dl className="recipe-card-nutrients"><div><dt>Calories</dt><dd>{nutrient(recipe.calories, 'kcal')}</dd></div><div><dt>Sodium</dt><dd>{nutrient(recipe.sodium, 'mg')}</dd></div><div><dt>Protein</dt><dd>{nutrient(recipe.protein, 'g')}</dd></div></dl>
        <div className="recipe-card-footer"><span>Per serving</span><button type="button" onClick={() => onChoose(originalRecipe(recipe))} aria-label={`Add ${recipe.name}`}><Plus size={16} /> Add to meal</button></div>
      </article>)}</div> : <div className="recipe-table-wrap">
        <table className="recipe-table">
          <thead><tr><th>Recipe</th><th>Category</th><th>Calories</th><th>Protein</th><th>Sodium</th><th>Potassium</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{filtered.map((recipe) => {
            const image = recipeImages[recipe.id];
            return <tr key={recipe.id}><td><button className="table-recipe table-recipe-button" type="button" onClick={() => onOpenRecipe(originalRecipe(recipe))} aria-label={`View ${recipe.name} recipe`}>{image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="recipe-placeholder">{recipe.name.slice(0, 1)}</span>}<span><strong>{recipe.name}</strong><small>{recipe.sourceCompleteness === "full" ? "Ingredients + steps" : "Nutrition only"}{recipe.diet !== "unknown" ? ` · ${recipe.diet} (draft)` : ""}</small>{recipe.preparation === "no-cook" && <small>No-cook assembly (draft){recipe.preparationNote ? ` · ${recipe.preparationNote}` : ""}</small>}</span><ArrowUpRight size={17} /></button></td><td>{recipe.category}</td><td>{nutrient(recipe.calories, "kcal")}</td><td>{nutrient(recipe.protein, "g")}</td><td><strong>{nutrient(recipe.sodium, "mg")}</strong></td><td>{nutrient(recipe.potassium, "mg")}</td><td><button type="button" className="table-add" onClick={() => onChoose(originalRecipe(recipe))} aria-label={`Add ${recipe.name}`}><Plus size={17} /> Add</button></td></tr>;
          })}</tbody>
        </table>
      </div>}
      {filtered.length === 0 && <p className="library-empty" role="status">{filters.category === 'Smoothies' ? 'Smoothie recipes are coming soon. This collection is waiting for recipes to be added.' : 'No recipes match these filters. Clear a filter or raise a ceiling to see more recipes.'}</p>}
      <p className="library-note">Cookbook nutrition comes from <strong>AA_PKD Direct Study.xlsx</strong>. Imported recipes retain their own source and unknown nutrition. Snack ideas are an editorial grouping; confirm your portion.</p>
    </main>
  );
}

function BookPlaceholder() { return <LayoutGrid size={32} strokeWidth={1} />; }
