import { Apple, Check, Coffee, MoonStar, Pencil, Plus, Sun } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { mealSections, sortMealEntries, mealLabel } from "../utils/meals";
import { formatNutrientCoverage, nutrientCoverage } from "../utils/nutrition";
import MealRow from "./MealRow";

const mealIcons = {
  Breakfast: Coffee,
  Brunch: Sun,
  Lunch: Sun,
  Snack: Apple,
  Dinner: MoonStar,
  'Other meals': Apple,
};

export default function TodayMeals({ entries, recipesById, onAddMeal, onOpenRecipe, onRemove, onReorder, onEdit }) {
  const [editMode, setEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);
  const draggedId = dragState?.entryId || null;

  const commitDragState = (nextState) => {
    dragStateRef.current = nextState;
    setDragState(nextState);
  };

  const sections = [...mealSections, { name: 'Other meals' }];
  const groups = useMemo(() => Object.fromEntries([...mealSections, { name: 'Other meals' }].map(({ name }) => [
    name,
    sortMealEntries(entries.filter((entry) => mealLabel(entry) === name)),
  ])), [entries]);

  const pointerTarget = (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const mealGroup = element?.closest("[data-meal-drop]");
    if (!mealGroup) return null;
    return {
      targetMeal: mealGroup.dataset.mealDrop,
      targetEntryId: element.closest("[data-entry-id]")?.dataset.entryId || null,
    };
  };

  const startDrag = (event, entryId) => {
    if (!editMode || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    commitDragState({ entryId, pointerId: event.pointerId, targetMeal: null, targetEntryId: null });
  };

  const updateDrag = (event) => {
    const activeDrag = dragStateRef.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    event.preventDefault();
    const target = pointerTarget(event);
    const targetMeal = target?.targetMeal || null;
    const targetEntryId = target?.targetEntryId || null;
    if (targetMeal === activeDrag.targetMeal && targetEntryId === activeDrag.targetEntryId) return;
    commitDragState({ ...activeDrag, targetMeal, targetEntryId });
  };

  const finishDrag = (event) => {
    const activeDrag = dragStateRef.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    event.preventDefault();
    const target = pointerTarget(event);
    if (target?.targetMeal && target.targetEntryId !== activeDrag.entryId) {
      onReorder({
        entryId: activeDrag.entryId,
        targetMeal: target.targetMeal,
        targetEntryId: target.targetEntryId,
      });
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitDragState(null);
  };

  const cancelDrag = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitDragState(null);
  };

  return (
    <section className={`today-meals${editMode ? " editing" : ""}`}>
      <header className="today-meals-header">
        <div>
          <h2>Today’s meals</h2>
          {editMode && <p>Drag the dotted handle to move a dish. Log leftovers again in the later meal.</p>}
        </div>
        <button className={`edit-meals-button${editMode ? " active" : ""}`} type="button" onClick={() => { setEditMode((value) => !value); commitDragState(null); }}>
          {editMode ? <Check size={17} /> : <Pencil size={16} />}
          {editMode ? "Done" : "Edit meals"}
        </button>
      </header>

      <div className="meal-groups">
        {sections.filter(section => groups[section.name].length || editMode && section.name !== 'Other meals').map((section) => {
          const groupEntries = groups[section.name];
          const coverage = nutrientCoverage(groupEntries, recipesById);
          const Icon = mealIcons[section.name];
          return (
            <section
              className={`meal-group${dragState?.targetMeal === section.name ? " drop-target" : ""}`}
              key={section.name}
              aria-labelledby={`meal-group-${section.name}`}
              data-meal-drop={section.name === 'Other meals' ? undefined : section.name}
            >
              <header className="meal-group-header">
                <div className="meal-group-title">
                  <span><Icon size={19} strokeWidth={1.8} /></span>
                  <div><h3 id={`meal-group-${section.name}`}>{section.name}</h3><small>{groupEntries.length} food{groupEntries.length === 1 ? '' : 's'} recorded</small></div>
                </div>
                {groupEntries.length > 0 && <div className="meal-group-summary" aria-label={`${section.name} recorded nutrition`}>
                  <span><strong>{formatNutrientCoverage(coverage.calories, 'kcal')}</strong></span>
                  <span><strong>{formatNutrientCoverage(coverage.sodium, 'mg')}</strong> sodium</span>
                  <span><strong>{formatNutrientCoverage(coverage.protein, 'g')}</strong> protein</span>
                </div>}
                {section.name !== 'Other meals' && <button className="meal-group-add" type="button" onClick={() => onAddMeal(section.name)}><Plus size={16} /> Add</button>}
              </header>

              <div className="meal-group-list">
                {groupEntries.length ? groupEntries.map((entry) => (
                  <MealRow
                    key={entry.id}
                    meal={entry}
                    recipe={recipesById[entry.recipeId]}
                    editMode={editMode}
                    isDragging={draggedId === entry.id}
                    isDropTarget={dragState?.targetEntryId === entry.id}
                    onOpenDetails={entry.recipeId && recipesById[entry.recipeId] ? () => onOpenRecipe(entry) : null}
                    onRemove={onRemove}
                    onEdit={onEdit}
                    onDragPointerDown={(event) => startDrag(event, entry.id)}
                    onDragPointerMove={updateDrag}
                    onDragPointerUp={finishDrag}
                    onDragPointerCancel={cancelDrag}
                  />
                )) : (
                  <p className="meal-empty-note">Not recorded yet</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!entries.length && !editMode && <p className="meal-empty-note">Your meals will appear here. Start with what you ate today.</p>}
      <button className="add-another" type="button" onClick={() => onAddMeal(null)}><span><Plus size={20} /></span> Record food</button>
    </section>
  );
}
