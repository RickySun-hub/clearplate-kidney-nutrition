import { Clock3, GripVertical, Package, Trash2, Pencil } from "lucide-react";
import { recipeImages } from "../data/seed";
import recipeDetails from "../data/recipeDetails.json";
import { formatAmount, nutritionFor } from "../utils/nutrition";
import { mealLabel } from '../utils/meals';

export default function MealRow({
  meal,
  recipe,
  editMode = false,
  isDragging = false,
  isDropTarget = false,
  onOpenDetails,
  onRemove,
  onEdit,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}) {
  const item = (meal.source === "custom" ? meal.customFood : recipe) || { name: 'Unresolved food' };
  const nutrients = nutritionFor(item, meal.servings);
  const image = recipeImages[item.id];

  const content = (
    <>
      <div className="meal-recipe">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <div className="recipe-placeholder" aria-hidden="true">{meal.source === "custom" ? <Package size={20} /> : item.name.slice(0, 1)}</div>}
        <div><strong>{item.name}</strong><span className="meal-time-badge"><Clock3 size={12} />{meal.time || 'Time not recorded'} · {mealLabel(meal)}{meal.time && meal.timeSource !== 'user-recorded' ? meal.timeSource === 'recording-time' ? ' (logging time)' : ' (scheduled time)' : ''}</span><small>{formatAmount(meal.servings, 2)} serving{meal.servings === 1 ? "" : "s"}{item.recipeCustomization && Object.keys(item.recipeCustomization.overrides).length > 0 ? ' · ingredients adjusted' : ''}{item.grams != null ? ` · ${formatAmount(item.grams * meal.servings, 2)} g recorded` : ''}</small>{item.servingDescription && <small>1 serving: {item.servingDescription}</small>}{meal.source !== "custom" && <small>1 serving: {recipeDetails[item.id]?.servingSize || "source portion not available"}</small>}</div>
      </div>
      <div className="meal-nutrient"><strong>{formatAmount(nutrients.sodium, 1)} mg</strong><small>sodium</small></div>
      <div className="meal-nutrient"><strong>{formatAmount(nutrients.protein, 1)} g</strong><small>protein</small></div>
      <div className="meal-mobile-nutrients">{formatAmount(nutrients.sodium, 1)} mg sodium · {formatAmount(nutrients.protein, 1)} g protein</div>
    </>
  );

  return (
    <article
      className={`meal-row${onOpenDetails && !editMode ? " recipe-row-clickable" : ""}${editMode ? " edit-row" : ""}${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`}
      data-entry-id={meal.id}
    >
      {editMode && (
        <button
          className="meal-drag-handle"
          type="button"
          aria-label={`Drag ${item.name} to another meal`}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerCancel}
        >
          <GripVertical size={19} />
        </button>
      )}
      {onOpenDetails && !editMode ? (
        <button className="meal-row-open" type="button" onClick={onOpenDetails} aria-label={`Open ingredients and cooking instructions for ${item.name}`}>{content}</button>
      ) : (
        <div className="meal-row-static">{content}</div>
      )}
      {onEdit && <button className="icon-button meal-edit" type="button" onClick={() => onEdit(meal)} aria-label={`Edit ${item.name}`}><Pencil size={18} /></button>}
      {editMode ? (
        <button className="icon-button meal-menu" type="button" onClick={() => onRemove(meal.id)} aria-label={`Remove ${item.name}`}><Trash2 size={18} strokeWidth={1.8} /></button>
      ) : (
        <button className="icon-button meal-menu" type="button" onClick={() => onRemove(meal.id)} aria-label={`Remove ${item.name}`}><Trash2 size={19} strokeWidth={1.8} /></button>
      )}
    </article>
  );
}
