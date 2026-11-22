import { useId } from 'react';
import { ACTIVITY_QUESTIONS, normalizeActivitySurvey } from '../utils/activitySurvey.js';
import './profile-account.css';

export default function ActivityFields({ value, onChange, disabled = false }) {
  const id = useId();
  const answers = normalizeActivitySurvey(value);
  return <section className="activity-history"><p className="field-note">Think about your usual activity over the past year. Choose one description for each question, or leave it unanswered.</p>
    {ACTIVITY_QUESTIONS.map(({ key, title, options }) => <fieldset key={key} disabled={disabled}><legend>{title}</legend><div className="activity-history-options">{options.map(([choice, label]) => <label key={choice} className={answers[key] === choice ? 'is-selected' : ''}><input type="radio" name={`${id}-${key}`} value={choice} checked={answers[key] === choice} onChange={() => onChange({ ...answers, [key]: choice })} /><span>{label}</span></label>)}</div>{answers[key] && <button className="activity-clear" type="button" onClick={() => onChange({ ...answers, [key]: '' })}>Clear answer</button>}</fieldset>)}
    <p className="field-note">Adapted, unscored questions inspired by the <a href="https://cdas.cancer.gov/files/download/5t05xix1pw/Stanford_physical_activity_screener.pdf" target="_blank" rel="noreferrer">Stanford Brief Activity Survey</a>. We save your selections without calculating an activity score or calorie target.</p>
  </section>;
}
