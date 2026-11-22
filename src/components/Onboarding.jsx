import { ArrowLeft, ArrowRight, Check, Heart, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { ALLERGY_OPTIONS, INTOLERANCE_OPTIONS, calculateBmi, completeOnboarding, metricMeasurements, normalizeOnboardingDraft, normalizeRestrictionList, validateOnboardingBasics, validateRestrictions } from '../utils/onboarding.js';
import './onboarding.css';
import ActivityFields from './ActivityFields';

export function FoodRestrictionsFields({ draft, onChange, disabled = false }) {
  const [otherText, setOtherText] = useState(() => ({
    allergies: normalizeRestrictionList(draft.allergies).filter(item => !ALLERGY_OPTIONS.includes(item)).join(', '),
    intolerances: normalizeRestrictionList(draft.intolerances).filter(item => !INTOLERANCE_OPTIONS.includes(item)).join(', '),
  }));
  return <div className="food-restrictions-fields">{[['allergies', 'Food allergies', ALLERGY_OPTIONS], ['intolerances', 'Food intolerances', INTOLERANCE_OPTIONS]].map(([key, title, options]) => {
    const selected = normalizeRestrictionList(draft[key]);
    const status = draft[`${key}Status`] || (selected.length ? 'listed' : 'unknown');
    return <fieldset key={key} disabled={disabled}><legend>{title}</legend><div className="restriction-status">{[['none', 'None'], ['listed', 'I have some'], ['unknown', 'Not sure']].map(([value, label]) => <label key={value}><input type="radio" name={`${key}-status`} checked={status === value} onChange={() => { if (value !== 'listed') setOtherText(current => ({ ...current, [key]: '' })); onChange({ [`${key}Status`]: value, ...(value !== 'listed' ? { [key]: [] } : {}) }); }} />{label}</label>)}</div>
      {status === 'listed' && <><div className="restriction-options">{options.map(item => <label key={item}><input type="checkbox" checked={selected.includes(item)} onChange={event => onChange({ [key]: event.target.checked ? [...selected, item] : selected.filter(value => value !== item) })} />{item}</label>)}</div><label className="restriction-other"><span>Other {key} (separate with commas)</span><input value={otherText[key]} maxLength={300} onChange={event => { setOtherText(current => ({ ...current, [key]: event.target.value })); onChange({ [key]: [...selected.filter(item => options.includes(item)), ...event.target.value.split(',').map(item => item.trim()).filter(Boolean)] }); }} /></label></>}
    </fieldset>;
  })}</div>;
}

const steps = ['role', 'basics', 'bmi', 'health'];
const headings = {
  role: ['A little about you.', 'How will you use Nepholio? We’ll make your home feel right for you.'],
  basics: ['Start with the basics.', 'A few details help put your food record in context.'],
  bmi: ['One number. Part of your story.', 'Your BMI is a starting point for a conversation, not a verdict on your health.'],
  health: ['Make it personal.', 'A few final details help us understand your food preferences and care context.'],
};

export default function Onboarding({ profile, onDraft, onComplete, busy = false, error = '' }) {
  const [draft, setDraft] = useState(() => normalizeOnboardingDraft(profile));
  const [unit, setUnit] = useState(profile?.measurementUnit === 'imperial' ? 'imperial' : 'metric');
  const [measurements, setMeasurements] = useState(() => measurementDraft(profile));
  const [localError, setLocalError] = useState('');
  const [working, setWorking] = useState(false);
  const headingRef = useRef(null);
  const step = steps.includes(draft.onboarding.step) ? draft.onboarding.step : 'role';
  const stepIndex = steps.indexOf(step);
  const locked = busy || working;
  const bmi = calculateBmi(draft.weightKg, draft.heightCm, draft.age);
  useEffect(() => { headingRef.current?.focus(); window.scrollTo(0, 0); }, [step]);

  function update(changes) { setDraft(current => ({ ...current, ...changes })); setLocalError(''); }
  function setMeasurement(key, value) { setMeasurements(current => ({ ...current, [key]: value })); setLocalError(''); }
  function switchUnit(nextUnit) {
    const canonical = metricMeasurements({ ...measurements, unit });
    setMeasurements(measurementDraft({ ...draft, ...canonical }));
    setUnit(nextUnit);
  }
  async function transition(nextStep, nextDraft = draft) {
    if (locked) return;
    const value = { ...nextDraft, onboarding: { ...nextDraft.onboarding, step: nextStep } };
    setWorking(true); setLocalError('');
    try { if (await onDraft(value) === false) { setLocalError('Your progress could not be saved. Please try again.'); return; } setDraft(value); }
    catch { setLocalError('Your progress could not be saved. Please try again.'); }
    finally { setWorking(false); }
  }
  async function finish(nextDraft = draft) {
    if (locked) return;
    setLocalError('');
    let completed;
    try { completed = completeOnboarding(nextDraft); } catch (cause) { setLocalError(cause.message); return; }
    setWorking(true);
    try { if (await onComplete(completed) === false) setLocalError('Your profile could not be saved. Your answers are still here. Please try again.'); }
    catch { setLocalError('Your profile could not be saved. Your answers are still here. Please try again.'); }
    finally { setWorking(false); }
  }
  function next(event) {
    event.preventDefault();
    if (step === 'role') {
      if (!draft.accountRole) { setLocalError('Choose how you’ll use Nepholio.'); return; }
      if (draft.accountRole === 'dietitian') finish(); else transition('basics');
    } else if (step === 'basics') {
      const nextDraft = { ...draft, ...metricMeasurements({ ...measurements, unit }), measurementUnit: unit };
      const validation = validateOnboardingBasics(nextDraft);
      if (validation) { setLocalError(validation); return; }
      transition('bmi', nextDraft);
    } else if (step === 'bmi') transition('health');
    else {
      const validation = validateRestrictions(draft);
      if (validation) { setLocalError(validation); return; }
      finish();
    }
  }

  return <div className="onboarding-page"><header className="onboarding-brand"><Logo /><span>Made for your everyday</span></header><main className="onboarding-shell"><aside className="onboarding-aside"><span className="onboarding-kicker">YOUR FIRST STEP</span><h1>Small steps.<br />A clearer picture.</h1><p>Get to know your daily habits, one meal at a time.</p><div className="onboarding-promise"><ShieldCheck size={22} /><span>Your record stays private.<br />You choose who can see it.</span></div></aside><form className="onboarding-card" onSubmit={next} aria-busy={locked}>
    <div className="onboarding-progress"><span>{step === 'role' ? 'Welcome' : `Step ${stepIndex} of 3`}</span><span>{step === 'role' ? 'Let’s get you started' : 'You can edit these details later'}</span></div><div className="onboarding-progress-track" aria-hidden="true"><span style={{ width: `${(stepIndex + 1) * 25}%` }} /></div>
    <h2 ref={headingRef} tabIndex={-1}>{headings[step][0]}</h2><p className="onboarding-intro">{headings[step][1]}</p>
    <fieldset className="onboarding-step-fields" disabled={locked}>
      {step === 'role' && <div className="onboarding-roles">{[['patient', Heart, 'For myself', 'Record my meals and understand my daily nutrition.'], ['dietitian', UsersRound, 'Dietitian', 'Explore the RD demo with simulated patients.']].map(([role, Icon, title, detail]) => <label key={role} className={`onboarding-role ${draft.accountRole === role ? 'is-selected' : ''}`}><input type="radio" name="account-role" checked={draft.accountRole === role} onChange={() => update({ accountRole: role })} /><Icon aria-hidden="true" size={26} /><span><strong>{title}</strong><small>{detail}</small></span><Check className="onboarding-role-check" size={20} aria-hidden="true" /></label>)}<p className="onboarding-note">RD demo access needs no approval. All patients and food records in the demo are fictional.</p></div>}
      {step === 'basics' && <><div className="onboarding-fields"><label><span>Age</span><div className="onboarding-input-unit"><input type="number" min="1" max="120" step="1" inputMode="numeric" required value={draft.age} onChange={event => update({ age: event.target.value })} /><span>years</span></div></label><label><span>Sex</span><select required value={draft.sex} onChange={event => update({ sex: event.target.value })}><option value="">Choose an option</option><option value="female">Female</option><option value="male">Male</option><option value="prefer-not-to-say">Prefer not to say</option></select></label></div><p className="onboarding-note">BMI uses height and weight. Age helps us show the appropriate explanation; sex is saved for your care context.</p><div className="onboarding-unit-switch" role="group" aria-label="Measurement units"><button type="button" aria-pressed={unit === 'metric'} onClick={() => switchUnit('metric')}>cm / kg</button><button type="button" aria-pressed={unit === 'imperial'} onClick={() => switchUnit('imperial')}>ft + in / lb</button></div>
        {unit === 'metric' ? <div className="onboarding-fields"><label><span>Height</span><div className="onboarding-input-unit"><input type="number" min="50" max="275" step="any" required value={measurements.heightCm} onChange={event => setMeasurement('heightCm', event.target.value)} /><span>cm</span></div></label><label><span>Current weight</span><div className="onboarding-input-unit"><input type="number" min="1" max="500" step="any" required value={measurements.weightKg} onChange={event => setMeasurement('weightKg', event.target.value)} /><span>kg</span></div></label></div> : <div className="onboarding-fields"><div><span className="onboarding-field-label">Height</span><div className="onboarding-height-imperial"><label className="onboarding-input-unit"><input aria-label="Height in feet" type="number" min="1" max="8" step="1" required value={measurements.heightFeet} onChange={event => setMeasurement('heightFeet', event.target.value)} /><span>ft</span></label><label className="onboarding-input-unit"><input aria-label="Additional height in inches" type="number" min="0" max="11.99" step="any" required value={measurements.heightInches} onChange={event => setMeasurement('heightInches', event.target.value)} /><span>in</span></label></div></div><label><span>Current weight</span><div className="onboarding-input-unit"><input type="number" min="2.21" max="1102" step="any" required value={measurements.weightLb} onChange={event => setMeasurement('weightLb', event.target.value)} /><span>lb</span></div></label></div>}</>}
      {step === 'bmi' && <><div className="onboarding-bmi"><span>Your BMI</span><strong>{bmi?.display || '—'}</strong><span>{bmi?.category || 'A reference number, without an adult category'}</span><small>Based on {Number(draft.heightCm).toFixed(1)} cm and {Number(draft.weightKg).toFixed(1)} kg</small><button type="button" onClick={() => transition('basics')}>Edit measurements</button></div><div className="onboarding-encouragement"><Heart size={22} aria-hidden="true" /><div><h3>Every small step counts.</h3><p>You are more than a number. Start by recording a meal and noticing your habits. You and your care team can decide what changes fit your needs.</p></div></div><p className="onboarding-note">{bmi?.adult ? 'Adult BMI categories are a screening reference, not a diagnosis. ' : 'For people younger than 20, adult BMI categories do not apply. A clinician can interpret growth and BMI using age-specific information. '}In ADPKD, enlarged kidneys or liver can affect weight and make BMI less representative. We do not set weight-loss or nutrition targets from this number.</p><a className="onboarding-source" href="https://www.cdc.gov/bmi/about/index.html" target="_blank" rel="noreferrer">Learn about BMI from the CDC ↗</a></>}
      {step === 'health' && <><div className="onboarding-question"><span className="onboarding-question-number">03</span><div><h3>Your kidney health</h3><p>Use what your clinician has told you. It’s okay not to know.</p></div></div><div className="onboarding-fields"><label><span>Clinician-recorded CKD stage</span><select value={draft.stage || ''} onChange={event => update({ stage: event.target.value })}><option value="">I’m not sure / not recorded</option>{['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>Dialysis</span><select value={draft.treatment || ''} onChange={event => update({ treatment: event.target.value })}><option value="">I’m not sure / not recorded</option><option value="not-dialysis">Not receiving dialysis</option><option value="dialysis">Receiving dialysis</option></select></label></div><div className="onboarding-question"><span className="onboarding-question-number">04</span><div><h3>Foods you need to avoid</h3><p>Allergies and intolerances are recorded separately.</p></div></div><FoodRestrictionsFields draft={draft} onChange={update} disabled={locked} /><div className="onboarding-question"><span className="onboarding-question-number">05</span><div><h3>Activity over the past year</h3><p>Work, household tasks and time outside your daily routine.</p></div></div><ActivityFields value={draft.activitySurvey} disabled={locked} onChange={activitySurvey => update({ activitySurvey })} /><p className="onboarding-note">These answers won’t replace any nutrition targets you’ve already saved. Review targets with your kidney care team.</p></>}
    </fieldset>
    {(localError || error) && <p className="onboarding-error" role="alert">{error || localError}</p>}
    <footer className="onboarding-actions">{stepIndex > 0 ? <button className="secondary-button" type="button" disabled={locked} onClick={() => transition(steps[stepIndex - 1])}><ArrowLeft size={17} />Back</button> : <span />}<button className="primary-button" disabled={locked} type="submit">{locked ? 'Saving…' : step === 'health' ? 'Start my food journal' : step === 'role' && draft.accountRole === 'dietitian' ? 'Open RD demo' : 'Continue'}{!locked && <ArrowRight size={17} />}</button></footer>
    <p className="onboarding-save-note">A one-time setup. Your details remain editable in Profile.</p>
  </form></main></div>;
}

function measurementDraft(profile = {}) {
  const height = Number(profile.heightCm);
  const weight = Number(profile.weightKg);
  const totalInches = height > 0 ? height / 2.54 : 0;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round((totalInches - feet * 12) * 100) / 100;
  if (inches >= 12) { feet += 1; inches = 0; }
  return { heightCm: height > 0 ? Number(height.toFixed(3)) : '', weightKg: weight > 0 ? Number(weight.toFixed(3)) : '', heightFeet: height > 0 ? feet : '', heightInches: height > 0 ? inches : '', weightLb: weight > 0 ? Number((weight / 0.45359237).toFixed(2)) : '' };
}
