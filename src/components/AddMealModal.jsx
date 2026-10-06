import { Check, Minus, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recipeImages } from "../data/seed";
import recipeDetails from "../data/recipeDetails.json";
import recipeMetadata from "../data/recipeMetadata.json";
import { enrichRecipe } from "../utils/recipeFilters";
import useDialogFocus from "../hooks/useDialogFocus";
import { mealSections } from "../utils/meals";
import { formatAmount, nutritionFor } from "../utils/nutrition";
import { hasValidProteinTargets } from "../utils/profile";

const meals = mealSections.map(({ name }) => name);
const sumKnown = (a, b) => a == null || b == null ? null : a + b;

const emptyTotals = { sodium: 0, protein: 0 };

export default function AddMealModal({
  open,
  recipes,
  initialRecipeId,
  initialMeal,
  todayTotals = emptyTotals,
  profile,
  saveError,
  onClose,
  onAdd,
}) {
  const [search, setSearch] = useState("");
  const [meal, setMeal] = useState("Lunch");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0,5));
  const [dietFilter, setDietFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [servings, setServings] = useState(1);
  const [submissionError, setSubmissionError] = useState("");
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);
  const dialogRef = useDialogFocus(open, requestClose);

  useEffect(() => {
    if (open) {
      setSelectedIds(initialRecipeId ? [initialRecipeId] : []);
      setSearch("");
      setDietFilter("all");
      setCourseFilter("all");
      setServings(1);
      setTime(new Date().toTimeString().slice(0, 5));
      setMeal(initialMeal || "Lunch");
      setSubmissionError("");
    }
  }, [open, initialMeal, initialRecipeId]);

  const enriched = useMemo(() => recipes.map((recipe) => enrichRecipe(recipe, recipeDetails[recipe.id], recipeMetadata[recipe.id])), [recipes]);
  const courseFilters = useMemo(() => [{ value: "all", label: "All courses" }, ...[...new Set(enriched.map((recipe) => recipe.category))].sort().map((category) => ({ value: category, label: category }))], [enriched]);
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enriched
      .filter((recipe) => !query || recipe.name.toLowerCase().includes(query))
      .filter((recipe) => courseFilter === "all" || recipe.category === courseFilter)
      .filter((recipe) => dietFilter !== "low" || typeof recipe.sodium === "number" && recipe.sodium <= 140)
      .filter((recipe) => dietFilter !== "protein" || recipe.protein >= 15)
      .sort((a, b) => {
        const aImage = recipeImages[a.id] ? 0 : 1;
        const bImage = recipeImages[b.id] ? 0 : 1;
        return aImage - bImage || a.sodium - b.sodium;
      });
  }, [courseFilter, dietFilter, enriched, search]);

  const selectedRecipes = useMemo(
    () => selectedIds.map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean),
    [recipes, selectedIds],
  );

  const selectedNutrition = useMemo(
    () => selectedRecipes.reduce((totals, recipe) => {
      const nutrients = nutritionFor(recipe, servings);
      return {
        sodium: sumKnown(totals.sodium, nutrients.sodium),
        protein: sumKnown(totals.protein, nutrients.protein),
      };
    }, { ...emptyTotals }),
    [selectedRecipes, servings],
  );

  const sodiumTarget = Number.isFinite(Number(profile?.sodiumTargetMg)) && Number(profile.sodiumTargetMg) > 0
    ? Number(profile.sodiumTargetMg)
    : null;
  const proteinTargetsValid = hasValidProteinTargets(profile);
  const proteinMin = proteinTargetsValid ? Number(profile.proteinMinG) : null;
  const proteinMax = proteinTargetsValid ? Number(profile.proteinMaxG) : null;
  const combined = {
    sodium: sumKnown(todayTotals.upper ? todayTotals.upper.sodium : todayTotals.sodium, selectedNutrition.sodium),
    protein: sumKnown(todayTotals.upper ? todayTotals.upper.protein : todayTotals.protein, selectedNutrition.protein),
  };
  const sodiumOver = sodiumTarget !== null && combined.sodium > sodiumTarget;
  const proteinOver = proteinTargetsValid && combined.protein > proteinMax;

  if (!open) return null;

  const toggleRecipe = (recipeId) => {
    if (submittingRef.current) return;
    setSelectedIds((current) => current.includes(recipeId)
      ? current.filter((id) => id !== recipeId)
      : [...current, recipeId]);
  };

  const handleAdd = async () => {
    if (!selectedRecipes.length || submittingRef.current) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setSubmissionError("Enter the time eaten."); return; }
    submittingRef.current = true;
    setPending(true);
    setSubmissionError("");
    try {
      const saved = await onAdd(selectedRecipes.map((recipe) => ({ recipeId: recipe.id, servings, meal, time })));
      if (saved === false) return;
      submittingRef.current = false;
      onClose();
    } catch {
      setSubmissionError("Changes could not be saved. Try again.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const recipeFitLabel = (recipe, chosen) => {
    const nutrients = nutritionFor(recipe, servings);
    const projected = chosen ? combined : {
      sodium: sumKnown(combined.sodium, nutrients.sodium),
      protein: sumKnown(combined.protein, nutrients.protein),
    };
    if (projected.sodium == null || projected.protein == null) return { text: "Incomplete nutrition · fit unknown", danger: false };
    const over = [];
    if (sodiumTarget !== null && projected.sodium > sodiumTarget) over.push("sodium");
    if (proteinTargetsValid && projected.protein > proteinMax) over.push("protein");
    if (over.length) return { text: `${chosen ? "Selected · over" : "Would exceed"} ${over.join(" & ")}`, danger: true };
    if (!proteinTargetsValid) return { text: "Protein targets need review", danger: true };
    return { text: chosen ? "Selected · within limits" : "Fits today’s remaining limits", danger: false };
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
      <section ref={dialogRef} className="meal-modal" role="dialog" aria-modal="true" aria-labelledby="add-meal-title" tabIndex="-1" aria-busy={pending} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="add-meal-title">Add a meal</h2>
          <button className="icon-button" type="button" disabled={pending} onClick={requestClose} aria-label="Close add meal dialog"><X /></button>
        </header>
        <label>Time eaten<input type="time" required disabled={pending} value={time} onChange={event=>setTime(event.target.value)} /></label>
        <label className="search-field">
          <Search size={21} strokeWidth={1.8} aria-hidden="true" />
          <input data-dialog-initial-focus disabled={pending} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${recipes.length} recipes`} />
        </label>

        <section className="selection-progress" aria-label="Selected recipes and today’s logged totals">
          <header>
            <div><strong>Selected recipes</strong><small>{selectedRecipes.length ? `${selectedRecipes.length} selected · ${formatAmount(servings, 1)} serving${servings === 1 ? "" : "s"} each` : "Select recipes to preview the combined total"}</small></div>
            {(sodiumOver || proteinOver) && <span className="selection-warning">Over target</span>}
            {!proteinTargetsValid && <span className="selection-warning">Targets need review</span>}
          </header>
          <div className="selection-progress-grid">
            <CompactProgress
              label="Sodium"
              value={combined.sodium}
              unit="mg"
              max={sodiumTarget ?? 0}
              displayMax={sodiumTarget === null ? "Target needs review" : `${formatAmount(sodiumTarget)} mg max`}
              danger={sodiumOver}
              warning={sodiumTarget === null}
              status={combined.sodium == null ? "Incomplete nutrition · remaining amount unknown" : sodiumTarget === null ? "Target needs review" : sodiumOver ? `${formatAmount(combined.sodium - sodiumTarget, 1)} mg over` : `${formatAmount(sodiumTarget - combined.sodium, 1)} mg remaining`}
            />
            <CompactProgress
              label="Protein"
              value={combined.protein}
              unit="g"
              max={proteinMax ?? 0}
              displayMax={proteinTargetsValid ? `${formatAmount(proteinMin)}–${formatAmount(proteinMax)} g` : "Targets need review"}
              marker={proteinTargetsValid ? (proteinMin / proteinMax) * 100 : undefined}
              danger={proteinOver}
              warning={!proteinTargetsValid || combined.protein < proteinMin}
              status={combined.protein == null ? "Incomplete nutrition · range check unknown" : !proteinTargetsValid ? "Targets need review" : proteinOver ? `${formatAmount(combined.protein - proteinMax, 1)} g over` : todayTotals.estimatedCount > 0 ? "Includes estimates" : combined.protein < proteinMin ? `${formatAmount(proteinMin - combined.protein, 1)} g to minimum` : "Within range"}
            />
          </div>
        </section>

        <fieldset className="meal-choice">
          <legend>Meal</legend>
          <div>{meals.map((option) => <button className={meal === option ? "selected" : ""} type="button" disabled={pending} key={option} onClick={() => setMeal(option)}>{option}</button>)}</div>
        </fieldset>

        <div className="filter-group">
          <span>Course</span>
          <div className="course-filter-row" aria-label="Recipe course filters">
            {courseFilters.map((option) => (
              <button type="button" disabled={pending} key={option.value} className={courseFilter === option.value ? "selected" : ""} onClick={() => setCourseFilter(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>

        <div className="filter-row" aria-label="Nutrition filters">
          <button type="button" disabled={pending} className={dietFilter === "all" ? "selected" : ""} onClick={() => setDietFilter("all")}>All nutrition</button>
          <button type="button" disabled={pending} className={dietFilter === "low" ? "selected" : ""} onClick={() => setDietFilter("low")}>Low sodium</button>
          <button type="button" disabled={pending} className={dietFilter === "protein" ? "selected" : ""} onClick={() => setDietFilter("protein")}>Higher protein</button>
        </div>

        <div className="recipe-results" aria-live="polite">
          {results.length ? results.map((recipe) => {
            const image = recipeImages[recipe.id];
            const chosen = selectedIds.includes(recipe.id);
            const fit = recipeFitLabel(recipe, chosen);
            const details = recipeDetails[recipe.id];
            return (
              <button type="button" disabled={pending} aria-pressed={chosen} className={`recipe-result ${chosen ? "selected" : ""}`} key={recipe.id} onClick={() => toggleRecipe(recipe.id)}>
                {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="recipe-placeholder">{recipe.name.slice(0, 1)}</span>}
                <span className="recipe-result-copy">
                  <strong>{recipe.name}</strong>
                  <small>1 serving: {recipeDetails[recipe.id]?.servingSize || "source portion not available"}</small>
                  <small>{formatAmount(recipe.calories, 1)} kcal · {formatAmount(recipe.protein, 1)} g protein · {formatAmount(recipe.sodium, 1)} mg sodium</small>
                  {details && <small className="recipe-quick-info"><b>Needs:</b> {details.quickIngredients.join(" · ")}</small>}
                  {details && <small className="recipe-quick-info method"><b>Method:</b> {details.quickMethod}</small>}
                  {!details && <small className="recipe-quick-info unavailable">Nutrition data only · preparation details not available yet</small>}
                  <small className={`recipe-fit ${fit.danger ? "danger" : ""}`}>{fit.text}</small>
                </span>
                <span className="check-mark">{chosen && <Check size={15} strokeWidth={2.4} />}</span>
              </button>
            );
          }) : <p className="empty-state">No recipes match those filters.</p>}
        </div>

        <footer className="meal-modal-footer">
          {todayTotals.estimatedCount > 0 && <p className="field-note">User-defined ranges are used where recorded; USDA matches remain point estimates. Missing amounts or ranges prevent a complete limit check.</p>}
          {(submissionError || saveError) && <p className="storage-alert" role="alert">{submissionError || saveError}</p>}
          <div className="serving-row">
            <span>Servings for each selected recipe</span>
            <div className="stepper">
              <button type="button" disabled={pending} onClick={() => setServings((value) => Math.max(0.5, value - 0.5))} aria-label="Decrease servings"><Minus size={18} /></button>
              <strong>{formatAmount(servings, 1)}</strong>
              <button type="button" disabled={pending} onClick={() => setServings((value) => Math.min(10, value + 0.5))} aria-label="Increase servings"><Plus size={18} /></button>
            </div>
          </div>
          <div className={`contribution ${sodiumOver || proteinOver ? "danger" : ""}`}>
            {selectedRecipes.length ? <>{selectedRecipes.length} recipe{selectedRecipes.length === 1 ? "" : "s"} add <strong>{formatAmount(selectedNutrition.sodium, 1)} mg sodium</strong> and <strong>{formatAmount(selectedNutrition.protein, 1)} g protein</strong></> : "Choose one or more recipes"}
          </div>
          <div className="modal-actions"><button type="button" className="primary-button" disabled={pending || !selectedRecipes.length} onClick={handleAdd}>{pending ? "Saving…" : `Add ${selectedRecipes.length || ""} ${selectedRecipes.length === 1 ? "recipe" : "recipes"} to today`}</button><button type="button" className="secondary-button" disabled={pending} onClick={requestClose}>Cancel</button></div>
        </footer>
      </section>
    </div>
  );
}

function CompactProgress({ label, value, unit, max, displayMax, marker, danger, warning, status }) {
  const percent = value != null && max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`compact-progress ${danger ? "danger" : warning ? "warning" : ""}`}>
      <div><strong>{label}</strong><span>{formatAmount(value, 1)} {unit} / {displayMax}</span></div>
      <div className="compact-progress-track">
        <span style={{ width: `${percent}%` }} />
        {marker !== undefined && <i style={{ left: `${Math.min(100, Math.max(0, marker))}%` }} />}
      </div>
      <small>{status}</small>
    </div>
  );
}
