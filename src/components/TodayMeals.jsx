import { Plus } from "lucide-react";
import { useMemo } from "react";
import MealRow from "./MealRow";

// Only explicitly recorded eating times establish chronology. Historical
// scheduled/recording timestamps are not evidence of when the food was eaten.
export function eatenTimeOrder(entry) {
  if (entry.timeSource !== 'user-recorded') return Infinity;
  const match = String(entry.time || '').match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return Infinity;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return Infinity;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

export function eatenTimeLabel(entry) {
  return Number.isFinite(eatenTimeOrder(entry)) ? entry.time : 'Time eaten unknown';
}

export default function TodayMeals({ entries, recipesById, onAddMeal, onOpenRecipe, onRemove }) {
  const orderedEntries = useMemo(() => [...entries].sort((a, b) => eatenTimeOrder(a) - eatenTimeOrder(b)), [entries]);
  return (
    <section className="today-meals">
      <header className="today-meals-header"><h2>Today’s food</h2></header>
      <div className="meal-groups">
        {orderedEntries.map(entry => <section className="meal-group" key={entry.id}>
          <header className="meal-group-header"><div className="meal-group-title"><div>
            <h3>{eatenTimeLabel(entry)}</h3>
            {entry.meal && <small>{entry.meal}</small>}
          </div></div></header>
          <div className="meal-group-list"><MealRow
            meal={entry}
            showTime={false}
            recipe={recipesById[entry.recipeId]}
            onOpenDetails={entry.source === 'recipe' ? () => onOpenRecipe(entry) : null}
            onRemove={onRemove}
          /></div>
        </section>)}
        {!orderedEntries.length && <p>No food recorded today.</p>}
      </div>
      <button className="add-another" type="button" onClick={() => onAddMeal(null)}><span><Plus size={20} /></span> Record food</button>
    </section>
  );
}
