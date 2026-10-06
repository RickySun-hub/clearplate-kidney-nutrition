import recipeAudits from '../data/usdaRecipeAudit.json';
import { useEffect, useState } from 'react';
import RecipeAuditEditor from './RecipeAuditEditor';
import { auditNutrients, auditUnits } from '../utils/recipeAudit';
import { formatAmount } from '../utils/nutrition';

const nutrientNames = { calories: 'Energy', protein: 'Protein', sodium: 'Sodium', potassium: 'Potassium', phosphorus: 'Phosphorus', carbs: 'Carbohydrate', fat: 'Fat', fiber: 'Fiber', calcium: 'Calcium' };
const known = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function formatAuditGrams(ingredient, factor = 1) {
  if (!known(ingredient?.grams) || !known(factor)) return 'Unknown grams';
  const max = ingredient.gramsMax ?? ingredient.grams;
  if (!known(max) || max < ingredient.grams) return 'Unknown grams';
  const lowText = formatAmount(ingredient.grams * factor, 2);
  return Math.abs(max - ingredient.grams) < 1e-10 ? `${lowText} g`
    : `${lowText}–${formatAmount(max * factor, 2)} g`;
}

function completeNutrient(audit, key, factor = 1) {
  if (!known(factor)) return 'Unknown';
  const bounds = audit?.perServingBounds?.[key];
  if (known(bounds?.min) && known(bounds?.max)) {
    const low = formatAmount(bounds.min * factor, 2);
    const high = formatAmount(bounds.max * factor, 2);
    return `${Math.abs(bounds.max - bounds.min) < 1e-10 ? low : `${low}–${high}`} ${auditUnits[key]}`;
  }
  const value = audit?.perServing?.[key];
  if (known(value)) return `${formatAmount(value * factor, 2)} ${auditUnits[key]}`;
  return !audit || audit.status === 'unavailable' ? 'Unknown' : 'Incomplete';
}

function downloadAudit(recipe, entry, cookServings) {
  const payload = { recipeId: recipe.id, recipeName: recipe.name, selectedCookingServings: cookServings, ...entry };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${recipe.id}-usda-audit.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RecipeNutritionAudit({ recipe, cookServings, onIngredientsCalculated }) {
  const [calculated, setCalculated] = useState(null);
  useEffect(() => setCalculated(null), [recipe.id]);
  const entry = calculated ? { ...recipeAudits[recipe.id], ...calculated } : recipeAudits[recipe.id];
  const audit = entry?.audit;
  const rows = entry?.ingredients?.filter((ingredient) => ingredient.kind !== 'heading') || [];
  const yieldServings = audit?.yieldServings;
  const factor = known(yieldServings) && yieldServings > 0 && known(cookServings) ? cookServings / yieldServings : null;
  const weighted = audit?.weightedIngredientCount ?? 0;
  const count = audit?.ingredientCount ?? rows.length;
  const status = !audit || audit.status === 'unavailable' ? 'Unavailable' : audit.status === 'partial' ? 'Partial' : audit.status === 'range' ? 'Calculated range draft' : 'Calculated draft';

  return (
    <details className="nutrition-audit">
      <summary>Nutrition sources & USDA review <span>· {status}</span></summary>
      <p className="audit-note">{weighted}/{count} ingredients have usable gram weights. <strong>Draft — human review required.</strong> Food matches, portions and preparation assumptions need review. This audit does not replace workbook nutrition, logged meals or saved records. No cooking yield, moisture change or nutrient-retention correction is applied.</p>
      <p className="audit-note">Original recipe yield: {known(yieldServings) && yieldServings > 0 ? `${formatAmount(yieldServings, 2)} servings` : 'Unknown'}{entry?.sourceServingSize ? ` (${entry.sourceServingSize} per serving)` : ''}. Selected cooking batch: {known(cookServings) ? `${formatAmount(cookServings, 2)} servings` : 'Unknown'}{factor !== null ? `; scale × ${formatAmount(factor, 2)}` : ''}. Ingredient gram weights below refer to the full original recipe before scaling.</p>
      <p className="audit-note">Calculation: USDA nutrient per 100 g × ingredient grams ÷ 100; sum ingredients, then divide by the original recipe yield for one serving. For example, sodium mg per 100 g × grams ÷ 100 ÷ source servings gives mg per serving. A range remains a range; a missing weight or nutrient leaves that total incomplete.</p>
      {rows.length > 0 && <RecipeAuditEditor key={recipe.id} recipeId={recipe.id} ingredients={entry.ingredients} cookServings={cookServings} onCalculated={({ ingredients, audit, provenance }) => { setCalculated({ ingredients, audit, provenance }); onIngredientsCalculated?.(ingredients); }} />}
      <div className="audit-scroll">
        <table className="audit-table">
          <caption>Nutrition comparison and completeness — workbook values retained</caption>
          <thead><tr><th scope="col">Nutrient</th><th scope="col">Workbook per 1 serving</th><th scope="col">USDA per 1 serving</th><th scope="col">USDA selected cooking batch</th><th scope="col">Known subtotal lower bound per 1 serving — not total</th></tr></thead>
          <tbody>{auditNutrients.map((key) => {
            const missing = audit?.missingByNutrient?.[key];
            const partialKnown = known(audit?.knownPerServing?.[key]) && known(missing) && missing > 0 && missing < count;
            return <tr key={key}>
              <th scope="row">{nutrientNames[key]} ({auditUnits[key]})</th>
              <td>{known(entry?.workbook?.[key]) ? `${formatAmount(entry.workbook[key], 2)} ${auditUnits[key]}` : 'Unknown'}</td>
              <td>{completeNutrient(audit, key)}</td>
              <td>{completeNutrient(audit, key, cookServings)}</td>
              <td>{partialKnown ? `${formatAmount(audit.knownPerServing[key], 2)} ${auditUnits[key]} · ${missing} unresolved ingredient${missing === 1 ? '' : 's'}` : missing > 0 ? 'Unknown — no usable subtotal' : '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="audit-scroll">
        <table className="audit-table">
          <caption>Ingredient weights, matches and unresolved assumptions</caption>
          <thead><tr><th scope="col">Original ingredient text</th><th scope="col">Original full batch grams</th><th scope="col">Selected cooking batch grams</th><th scope="col">USDA food source</th><th scope="col">Notes / review</th></tr></thead>
          <tbody>{rows.map((ingredient, index) => <tr key={`${ingredient.original}-${index}`}>
            <th scope="row">{ingredient.original}</th>
            <td>{formatAuditGrams(ingredient)}</td>
            <td>{factor === null ? 'Unknown grams' : formatAuditGrams(ingredient, factor)}</td>
            <td>{ingredient.fdcId ? <>{ingredient.foodDescription || 'Food description unavailable'}<br /><a href={ingredient.sourceUrl || `https://fdc.nal.usda.gov/food-details/${ingredient.fdcId}/nutrients`} target="_blank" rel="noreferrer noopener">FDC {ingredient.fdcId}</a></> : 'Unmatched'}</td>
            <td>{[ingredient.weightNote, ingredient.matchNote, ingredient.sourceIssue && `Original source issue: ${ingredient.sourceIssue}`, ingredient.issue && `Unresolved: ${ingredient.issue}`].filter(Boolean).join(' ') || 'Human review required.'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="audit-note">No source ingredient list is available. Gram-based nutrition cannot be calculated.</p>}
      {entry && <button type="button" className="secondary-button" onClick={() => downloadAudit(recipe, entry, cookServings)}>Download this audit JSON</button>}
    </details>
  );
}
