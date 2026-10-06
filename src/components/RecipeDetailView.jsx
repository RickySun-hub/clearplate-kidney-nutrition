import { ArrowLeft, Check, FileQuestion, Info, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { recipeImages } from "../data/seed";
import { formatAmount, nutritionFor } from "../utils/nutrition";
import { formatHouseholdIngredient, parseIngredient } from "../utils/ingredients";
import recipeMetadata from "../data/recipeMetadata.json";
import recipeAudits from "../data/usdaRecipeAudit.json";
import RecipeNutritionAudit, { formatAuditGrams } from "./RecipeNutritionAudit";

export default function RecipeDetailView({ recipe, details, servings = 1, backLabel = "today’s meals", onBack }) {
  const [cookServings, setCookServings] = useState(servings);
  const [ingredientUnits, setIngredientUnits] = useState("household");
  const [checkedIngredients, setCheckedIngredients] = useState([]);
  const [reviewedIngredients, setReviewedIngredients] = useState(null);

  useEffect(() => {
    setCookServings(servings);
    setCheckedIngredients([]);
    setReviewedIngredients(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [recipe, servings]);

  const scaledIngredients = useMemo(() => {
    if (!details?.servings) return [];
    const factor = cookServings / details.servings;
    return details.ingredients.map((ingredient, index) => {
      const parsed = parseIngredient(ingredient);
      const auditIngredient = (reviewedIngredients || recipeAudits[recipe?.id]?.ingredients)?.[index];
      return { ...parsed, auditIngredient, display: formatHouseholdIngredient(ingredient, factor), metricFoodText: parseIngredient(formatHouseholdIngredient(ingredient, factor)).foodText, issues: [auditIngredient?.resolvedWeight ? auditIngredient.issue : auditIngredient?.issue || parsed.issue].filter(Boolean) };
    });
  }, [cookServings, details, recipe?.id, reviewedIngredients]);

  if (!recipe) return null;

  const nutrients = nutritionFor(recipe, 1);
  const batchNutrients = nutritionFor(recipe, cookServings);
  const eatenNutrients = nutritionFor(recipe, servings);
  const image = recipeImages[recipe.id];
  const scaleFactor = details?.servings > 0 ? cookServings / details.servings : 1;
  const toggleIngredient = (index) => {
    setCheckedIngredients((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]);
  };

  return (
    <main className="recipe-detail-page">
      <button className="recipe-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={19} /> Back to {backLabel}
      </button>

      <article className="recipe-detail-surface">
        <header className="recipe-detail-header">
          <div className="recipe-detail-hero">
            {image ? <img src={image} alt={`${recipe.name} prepared dish`} /> : <span className="recipe-placeholder">{recipe.name.slice(0, 1)}</span>}
            <div>
              <span>{recipeMetadata[recipe.id]?.category || recipe.category} · {details ? "Cooking instructions" : "Nutrition data only"}</span>
              <h1 id="recipe-detail-title">{recipe.name}</h1>
              <p>{details ? `${details.servingSize} per serving · source recipe makes ${details.servings} servings` : `${formatAmount(servings, 1)} serving${servings === 1 ? "" : "s"} · no preparation source linked`}</p>
            </div>
          </div>
        </header>

        <p className="scaling-note">{recipe.imported ? "Nutrition per 1 serving (not calculated)" : "Workbook nutrition per 1 serving"}{details?.servingSize ? ` (${details.servingSize})` : ""}.</p>
        <section className="recipe-detail-nutrition" aria-label="Nutrition per 1 serving">
          <div><strong>{formatAmount(nutrients.calories, 1)}</strong><span>kcal</span></div>
          <div><strong>{formatAmount(nutrients.sodium, 1)} mg</strong><span>sodium</span></div>
          <div><strong>{formatAmount(nutrients.protein, 1)} g</strong><span>protein</span></div>
          <div><strong>{formatAmount(nutrients.potassium, 1)} mg</strong><span>potassium</span></div>
        </section>

        <p className="scaling-note">Eating / meal portion: {formatAmount(servings, 1)} serving{servings === 1 ? "" : "s"} · {formatAmount(eatenNutrients.calories, 1)} kcal · {formatAmount(eatenNutrients.sodium, 1)} mg sodium · {formatAmount(eatenNutrients.protein, 1)} g protein · {formatAmount(eatenNutrients.potassium, 1)} mg potassium. Cooking batch changes do not update this portion or saved meals.</p>

        <RecipeNutritionAudit recipe={recipe} cookServings={details ? cookServings : null} onIngredientsCalculated={setReviewedIngredients} />

        {details ? (
          <div className="recipe-detail-body">
            <section className="ingredient-panel">
              <header>
                <div><h2>Ingredients</h2><a className="ingredient-usda-link" href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer noopener">USDA FoodData Central ↗</a><p>Cooking batch: {formatAmount(cookServings, 1)} serving{cookServings === 1 ? "" : "s"}</p></div>
                <div className="stepper compact-stepper">
                  <button type="button" onClick={() => setCookServings((value) => Math.max(0.5, value - 0.5))} aria-label="Decrease cooking servings"><Minus size={17} /></button>
                  <input aria-label="Cooking batch servings" type="number" min="0.5" max="100" step="0.5" value={cookServings} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0.5 && value <= 100) setCookServings(value); }} />
                  <button type="button" onClick={() => setCookServings((value) => Math.min(100, value + 0.5))} aria-label="Increase cooking servings"><Plus size={17} /></button>
                </div>
              </header>
              <div className="ingredient-unit-switch" role="group" aria-label="Ingredient units">
                <button type="button" aria-pressed={ingredientUnits === "household"} onClick={() => setIngredientUnits("household")}>Cups, spoons & pieces</button>
                <button type="button" aria-pressed={ingredientUnits === "grams"} onClick={() => setIngredientUnits("grams")}>Grams</button>
              </div>
              <p className="scaling-note">Quantities below are for your cooking batch. Use these amounts with the original cooking steps.</p>
              {ingredientUnits === "grams" && <p className="scaling-note">Grams use available USDA draft weights. Where a weight is unknown, the source amount stays visible. Pinches and to-taste amounts are not converted.</p>}
              <details className="ingredient-scaling-details"><summary>Serving and scaling details</summary>
                <p className="scaling-note">Batch scale × {formatAmount(scaleFactor, 2)} = {formatAmount(cookServings, 2)} cooking servings ÷ {details.servings} source servings. Alternate amounts scale together; package sizes stay fixed.</p>
                <p className="scaling-note">Workbook estimate for this batch: {formatAmount(batchNutrients.calories, 2)} kcal · {formatAmount(batchNutrients.sodium, 2)} mg sodium · {formatAmount(batchNutrients.protein, 2)} g protein · {formatAmount(batchNutrients.potassium, 2)} mg potassium.</p>
              </details>
              <div className="ingredient-checklist">
                {scaledIngredients.map((ingredient, index) => ingredient.original.endsWith(":") ? (
                  <h3 key={`${ingredient.original}-${index}`}>{ingredient.original}</h3>
                ) : (
                  <button className={checkedIngredients.includes(index) ? "checked" : ""} type="button" key={`${ingredient.original}-${index}`} onClick={() => toggleIngredient(index)}>
                    <span>{checkedIngredients.includes(index) && <Check size={14} strokeWidth={2.5} />}</span>
                    <b>{ingredientUnits === "grams" && formatAuditGrams(ingredient.auditIngredient, scaleFactor) !== "Unknown grams"
                      ? <>{formatAuditGrams(ingredient.auditIngredient, scaleFactor)} · {ingredient.metricFoodText}{/^Juice|^Zest/i.test(ingredient.original) ? " (juice / zest)" : ""}</>
                      : <>{ingredient.display}{ingredientUnits === "grams" && <span className="ingredient-weight-unknown"> · grams unknown</span>}</>}</b>
                  </button>
                ))}
              </div>
            </section>

            <section className="cooking-panel">
              <header><h2>Cooking instructions</h2><p>Follow the source steps in order. Ingredient checkboxes stay available while you cook.</p></header>
              <ol className="cooking-steps">
                {details.steps.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}
              </ol>
              {(details.notes || details.servingSuggestion) && (
                <div className="recipe-notes">
                  {details.notes && <div><strong>Notes</strong><p>{details.notes}</p></div>}
                  {details.servingSuggestion && <div><strong>Serving suggestion</strong><p>{details.servingSuggestion}</p></div>}
                </div>
              )}
              <div className="recipe-source-disclosure">
                <Info size={18} />
                {details.source.imported ? <p>Imported from <a href={details.source.url} target="_blank" rel="noreferrer">{details.source.publisher} ↗</a>. You confirmed the source serving count; nutrition has not been calculated.</p> : <p><strong>Editorial draft:</strong> preparation details are paraphrased from {details.source.publisher}, <em>{details.source.title}</em>, printed page {details.source.printedPage}. Permission status is not cleared; clinical notes are informational and are not used as target-setting rules.</p>}
              </div>
            </section>
          </div>
        ) : (
          <section className="recipe-detail-unavailable" aria-labelledby="preparation-unavailable-title">
            <span><FileQuestion size={30} /></span>
            <div>
              <p className="status-label">Source check complete</p>
              <h2 id="preparation-unavailable-title">Preparation details are not available</h2>
              <p>This recipe was manually added to the nutrition workbook and has no matching recipe or source page in the Cooking Well PDF. Its nutrition values remain available, but ingredients and cooking steps are intentionally not inferred.</p>
              <button className="secondary-button" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to {backLabel}</button>
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
