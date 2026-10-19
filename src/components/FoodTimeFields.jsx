import { useId } from 'react';

export default function FoodTimeFields({ date, time, meal, onDateChange, onTimeChange, onMealChange, disabled = false }) {
  const mealOptions = useId();
  return <>
    <label><span>Date eaten</span><input required disabled={disabled} type="date" value={date} onChange={event => onDateChange(event.target.value)} /></label>
    <label><span>Time eaten (optional)</span><input disabled={disabled} type="time" value={time} onChange={event => onTimeChange(event.target.value)} /></label>
    <label><span>Meal label (optional)</span><input disabled={disabled} list={mealOptions} maxLength={60} value={meal} onChange={event => onMealChange(event.target.value)} placeholder="Brunch, snack…" /><datalist id={mealOptions}>{['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Brunch'].map(label => <option key={label} value={label} />)}</datalist></label>
  </>;
}
