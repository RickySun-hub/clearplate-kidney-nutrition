import { mealSections, updateMealTime } from '../utils/meals';
import { localDateKey } from '../utils/nutrition';

export default function MealMomentFields({ value, onChange, disabled = false }) {
  return <fieldset className="meal-moment"><legend>When did you eat?</legend><div className="meal-moment-grid">
    <label>Date eaten<input required type="date" max={localDateKey()} disabled={disabled} value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} /></label>
    <label>Time eaten<input required type="time" disabled={disabled} value={value.time} onChange={e => onChange(updateMealTime(value, e.target.value))} /></label>
    <label>Meal<select disabled={disabled} value={value.meal} onChange={e => onChange({ ...value, meal: e.target.value, mealManuallyChosen: true })}>{mealSections.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
  </div><p className="field-note">{value.mealManuallyChosen ? 'Your meal choice is kept when the time changes.' : 'Suggested from the time eaten. You can change it, including to Brunch.'}</p></fieldset>;
}
