import DiscoveryVoice from './DiscoveryVoice';
import useDialogFocus from '../hooks/useDialogFocus';
import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { recipeImages } from "../data/seed.js";
import { mealOptions, optimizeRemainingDay } from "../optimization/optimizeRemainingDay.js";
import { formatAmount } from "../utils/nutrition.js";

const objectiveLabels = {
  balanced: ["Balanced", "Balances the remaining protein gap, calories, and sodium."],
  "lowest-sodium": ["Lowest sodium", "Uses less sodium among strong target-compatible options."],
  simplest: ["Simplest preparation", "Uses the fewest known cooking steps."],
};

const formatRemaining = (value, unit) => value >= 0
  ? `${formatAmount(value, 1)} ${unit} remaining`
  : `${formatAmount(Math.abs(value), 1)} ${unit} over`;

export default function PlannerView({ accessToken, recipes, recipeDetails, profile, todayEntries, todayTotals, plannerSession, onPlannerSessionChange, onAddPlan, onOpenRecipe, onBrowseRecipes, onEditTargets }) {
  const [logPlan, setLogPlan] = useState(null);
  const initialMeals = useMemo(() => {
    const loggedMeals = new Set(todayEntries.map((entry) => entry.meal));
    const remainingMeals = mealOptions.filter((meal) => !loggedMeals.has(meal));
    return remainingMeals.length ? remainingMeals : ["Snack"];
  }, [todayEntries]);
  const selectedMeals = plannerSession.selectedMeals?.length ? plannerSession.selectedMeals : initialMeals;
  const caloriesPerMeal = plannerSession.caloriesPerMeal;
  const activeObjective = plannerSession.activeObjective;

  const result = useMemo(() => optimizeRemainingDay({
    recipes,
    detailsById: recipeDetails,
    loggedTotals: todayTotals,
    targets: {
      sodiumMax: profile.sodiumTargetMg,
      proteinMin: profile.proteinMinG,
      proteinMax: profile.proteinMaxG,
      potassiumMax: profile.potassiumTargetMg ?? null,
      phosphorusMax: profile.phosphorusTargetMg ?? null,
    },
    selectedMeals,
    calorieReference: Number(caloriesPerMeal) * selectedMeals.length,
    maxRecipes: 4,
  }), [caloriesPerMeal, profile, recipeDetails, recipes, selectedMeals, todayTotals]);

  const compatiblePlans = result.status === "compatible"
    ? (result.plans || []).filter((plan) => plan.withinUpperLimits)
    : [];
  const activePlan = compatiblePlans.find((plan) => plan.objective === activeObjective) || compatiblePlans[0];
  // An open review must also remain compatible after targets or intake change.
  const reviewedPlan = logPlan && compatiblePlans.find((plan) => plan.signature === logPlan.signature);

  const toggleMeal = (meal) => {
    const nextMeals = selectedMeals.includes(meal)
      ? (selectedMeals.length === 1 ? selectedMeals : selectedMeals.filter((item) => item !== meal))
      : mealOptions.filter((item) => selectedMeals.includes(item) || item === meal);
    onPlannerSessionChange((current) => ({ ...current, selectedMeals: nextMeals }));
  };

  return (
    <main className="planner-page">
      <header className="page-heading"><div><h1>Plan upcoming meals</h1><p>Choose meals to prepare, then compare recipe combinations. Planning does not add food to your record.</p></div><DiscoveryVoice accessToken={accessToken} kind="plan" onApply={conditions => onPlannerSessionChange(current => ({...current,...conditions}))} /></header>
      <div className="plan-draft-label">Meal ideas · not logged <button onClick={onBrowseRecipes}>Browse recipes instead <ChevronRight size={16} /></button></div>
      {todayTotals.estimatedCount > 0 && <p className="estimate-note">Your log includes estimates. Planning uses their upper bounds for nutrient ceilings and their lower protein bound for the remaining protein gap. Results depend on your user-set ranges.</p>}

      <section className="planner-controls">
        <div className="meal-planning-control">
          <span className="control-label">Meals to plan</span>
          <div className="meal-selector" role="group" aria-label="Meals to plan">
            {mealOptions.map((meal) => <button className={selectedMeals.includes(meal) ? "selected" : ""} type="button" aria-pressed={selectedMeals.includes(meal)} key={meal} onClick={() => toggleMeal(meal)}><span aria-hidden="true" className="meal-selection-mark">{selectedMeals.includes(meal) ? "✓" : "+"}</span>{meal}</button>)}

          </div>
        </div>
        <label><span>Approx. calories per meal</span><div className="inline-unit"><input type="number" min="100" max="1500" step="50" value={caloriesPerMeal} onChange={(event) => onPlannerSessionChange((current) => ({ ...current, caloriesPerMeal: event.target.value }))} /><span>kcal</span></div></label>
        <div className="constraint-summary">
          {result.remainingBefore ? <>
            <span>Sodium <strong>{formatRemaining(result.remainingBefore.sodiumMax, "mg")}</strong></span>
            <span>Protein <strong>{formatAmount(result.remainingBefore.proteinMin, 1)}–{formatAmount(Math.max(0, result.remainingBefore.proteinMax), 1)} g remaining</strong></span>
          </> : <span>Targets <strong>Review required</strong></span>}
          <span>Up to <strong>4 dishes</strong> · 0.5–2 servings</span>
        </div>
      </section>

      {result.status === "invalid" && <section className="plan-status closest"><AlertTriangle size={22} /><div><strong>{result.message}</strong><p>Use the targets saved with your care team, or browse recipes without a target comparison.</p><button className="secondary-button" onClick={onEditTargets}>Review saved targets</button></div></section>}
      {result.status === "empty" && <section className="plan-status closest"><AlertTriangle size={22} /><div><strong>No suitable meal plan found</strong><p>{result.message}</p></div></section>}

      {activePlan && <>
        <div className="plan-variants" role="tablist" aria-label="Meal idea type">
          {compatiblePlans.map((plan) => <button className={plan.objective === activePlan.objective ? "active" : ""} type="button" role="tab" aria-selected={plan.objective === activePlan.objective} key={plan.objective} onClick={() => onPlannerSessionChange((current) => ({ ...current, activeObjective: plan.objective }))}><strong>{objectiveLabels[plan.objective][0]}</strong><span>{objectiveLabels[plan.objective][1]}</span></button>)}
        </div>

        <section className={`plan-status ${activePlan.withinUpperLimits ? "" : "closest"}`}>
          {activePlan.withinUpperLimits ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
          <div><strong>{activePlan.withinUpperLimits ? "Within current upper limits" : "Closest available option"}</strong><p>{activePlan.reason}</p></div>
        </section>

        <div className="plan-board-heading"><h2>Your meal ideas</h2><span>Open a recipe for ingredients & steps</span></div>
        <div className="plan-list plan-meal-board">
          {activePlan.items.map((item) => <button className="plan-row plan-row-button" type="button" key={`${item.recipeId}-${item.meal}`} onClick={() => onOpenRecipe(item)} aria-label={`View ${item.recipe.name} recipe`}>
            {recipeImages[item.recipeId] ? <img src={recipeImages[item.recipeId]} alt="" loading="lazy" decoding="async" /> : <span className="plan-index">{item.meal.slice(0, 1)}</span>}
            <div><small>{item.meal}</small><strong>{item.recipe.name}</strong><span>{formatAmount(item.servings, 1)} serving{item.servings === 1 ? "" : "s"} · {formatAmount(item.nutrition.calories, 1)} kcal · {formatAmount(item.nutrition.protein, 1)} g protein · {formatAmount(item.nutrition.sodium, 1)} mg sodium</span><span className="plan-row-link">View recipe</span></div>
            <ChevronRight className="plan-row-arrow" size={20} />
          </button>)}
        </div>

        <section className="plan-summary-grid">
          <div className="plan-totals">
            <div><span>Calories</span><strong>{formatAmount(activePlan.totals.calories, 1)} kcal</strong></div>
            <div><span>Protein</span><strong>{formatAmount(activePlan.totals.protein, 1)} g</strong></div>
            <div><span>Sodium</span><strong>{formatAmount(activePlan.totals.sodium, 1)} mg</strong></div>
          </div>
          <div className={`remaining-card ${activePlan.withinUpperLimits ? "" : "over"}`}>
            <span>After these meals</span>
            <strong>{formatRemaining(activePlan.remainingAfter.sodiumMax, "mg sodium")}</strong>
            <small>{activePlan.remainingAfter.proteinMax < 0
              ? `${formatAmount(Math.abs(activePlan.remainingAfter.proteinMax), 1)} g over the protein maximum`
              : activePlan.proteinGap > 0
                ? `${formatAmount(activePlan.proteinGap, 1)} g protein remains to reach the daily range`
                : `${formatAmount(activePlan.remainingAfter.proteinMax, 1)} g remains before the protein maximum`}</small>
          </div>
          <button className="primary-button" type="button" onClick={() => setLogPlan(activePlan)}>I ate these — review & log</button>
        </section>
      </>}

      {reviewedPlan && <PlanLogConfirmation plan={reviewedPlan} onClose={() => setLogPlan(null)} onAdd={onAddPlan} />}
      <details className="plan-explanation"><summary>How meal ideas are compared</summary><section className="optimization-note"><Sparkles size={20} /><div><strong>How these ideas are generated</strong><p>A deterministic browser-based search uses only stored nutrition values, today’s logged intake, 0.5–2 serving options, and the upper limits in your profile. Sodium is treated as a ceiling, not a target to fill. “Simplest preparation” uses known cooking-step counts because reliable preparation times are not yet stored.</p></div></section>
      </details>
    </main>
  );
}

function PlanLogConfirmation({ plan, onClose, onAdd }) {
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ref = useDialogFocus(true, () => { if (!busy) onClose(); });
  return <div className="modal-backdrop"><section ref={ref} role="dialog" aria-modal="true" aria-labelledby="plan-log-title" className="plan-log-confirm" tabIndex={-1}><h2 id="plan-log-title">Log meals you have eaten</h2><p>A meal idea is not a food record. Check these foods and portions before adding them to Today.</p><ul>{plan.items.map(item => <li key={item.meal + item.recipeId}><strong>{item.meal} · {item.recipe.name}</strong><span>{formatAmount(item.servings, 1)} source servings</span></li>)}</ul><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I have eaten these foods in these portions today.</label>{error && <p role="alert">{error}</p>}<footer><button className="secondary-button" disabled={busy} onClick={onClose}>Keep planning</button><button className="primary-button" disabled={!confirmed || busy} onClick={async () => {setBusy(true);setError('');try {if (await onAdd(plan.items) === false) setError('Not saved. Check your connection and try again.');} catch {setError('Not saved. Please try again.');} finally {setBusy(false);} }}> {busy ? 'Saving…' : 'Confirm & log to Today'}</button></footer></section></div>;
}
