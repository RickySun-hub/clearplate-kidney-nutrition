import { useMemo } from 'react';
import { ArrowUpRight, BookOpen, Plus } from 'lucide-react';
import { recipeImages } from '../data/seed.js';
import recipeMetadata from '../data/recipeMetadata.json';
import { formatAmount } from '../utils/nutrition.js';
import { getMealIdeas } from '../utils/mealIdeas.js';
import './meal-ideas.css';

export default function MealIdeas({ recipes, recipeDetails, profile, onOpenRecipe, onRecord }) {
  const result = useMemo(() => getMealIdeas({ recipes, recipeDetails, profile, metadataById: recipeMetadata }), [recipes, recipeDetails, profile]);

  return <section className="meal-ideas" aria-labelledby="meal-ideas-heading">
    <div className="meal-ideas-heading"><div><span className="meal-ideas-eyebrow">A little inspiration</span><h2 id="meal-ideas-heading">Ideas for your next meal</h2><p>Explore a recipe, then record your portion when you have eaten.</p></div><BookOpen size={25} aria-hidden="true" /></div>
    {result.recipes.length ? <>
      <div className="meal-ideas-grid">{result.recipes.map((recipe) => <article className="meal-idea-card" key={recipe.id}>
        <button className="meal-idea-open" type="button" onClick={() => onOpenRecipe(recipe)} aria-label={`View ${recipe.name} recipe`}>
          <div className="meal-idea-image">{recipeImages[recipe.id] ? <img src={recipeImages[recipe.id]} alt="" loading="lazy" decoding="async" /> : <BookOpen size={34} aria-hidden="true" />}<span>{recipeMetadata[recipe.id]?.category || recipe.category}</span></div>
          <div className="meal-idea-title"><h3>{recipe.name}</h3><ArrowUpRight size={18} aria-hidden="true" /></div>
        </button>
        <div className="meal-idea-nutrition"><span>{formatAmount(recipe.calories, 0)} kcal</span><span>{formatAmount(recipe.protein, 1)} g protein</span><span>{formatAmount(recipe.sodium, 0)} mg sodium</span></div>
        <p className="meal-idea-portion">Per serving{recipeDetails?.[recipe.id]?.servingSize ? ` · ${recipeDetails[recipe.id].servingSize}` : ''}</p>
        <div className="meal-idea-actions"><button type="button" className="meal-idea-view" onClick={() => onOpenRecipe(recipe)}>View recipe</button><button type="button" className="meal-idea-record" onClick={() => onRecord(recipe)} aria-label={`Record ${recipe.name}`}><Plus size={15} aria-hidden="true" />Record this meal</button></div>
      </article>)}</div>
      <p className="meal-ideas-note">{result.targetCount ? 'Uses your saved food preferences and nutrient limits. ' : 'Uses your saved food preferences. '}Check ingredients and package labels before preparing a recipe.</p>
    </> : <div className="meal-ideas-empty"><strong>{result.status === 'needs-preferences' ? 'Let’s check your food preferences first' : 'No matching ideas right now'}</strong><p>{result.status === 'needs-preferences' ? 'Review allergies and intolerances in Profile. Preferences that need individual review are kept out of automatic suggestions.' : 'The available recipes do not match all of your saved preferences and limits. You can still browse recipes and review ingredients with your dietitian.'}</p></div>}
  </section>;
}
