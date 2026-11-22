import { ChevronRight, ExternalLink, LogOut, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import { isGuidelineProteinEligible, normalizeProfileDraft, updateProfileDraft, optionalProfileNumbers } from "../utils/profile";
import { NUTRIENTS, normalizeNutrientPreferences, validNutrientValue } from '../utils/nutrientCatalog.js';
import { normalizeOnboardingDraft, restrictionSummary, validateRestrictions } from '../utils/onboarding.js';
import { validateActivitySurvey } from '../utils/activitySurvey.js';
import { profileHasUnsavedChanges } from '../utils/accountNavigation.js';
import ActivityFields from './ActivityFields';
import { FoodRestrictionsFields } from './Onboarding';
import './profile-account.css';
import './nutrient-profile.css';
import { profileSummaries } from '../utils/profileSummaries.js';

const COMMON_NUTRIENT_KEYS = ['calories', 'protein', 'sodium', 'potassium', 'phosphorus', 'carbs', 'fat', 'fiber', 'calcium', 'magnesium'];
const profileDraft = profile => ({ ...normalizeOnboardingDraft(normalizeProfileDraft(profile)), ...normalizeNutrientPreferences(profile) });

export default function ProfileDrawer({ open, profile, saveError, onClose, onSave, onOpenAccount, onOpenDietitian, onOpenPatient, onOpenFoodReview, onSignOut }) {
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const initialDraftRef = useRef(profileDraft(profile));
  const [editingRestrictions, setEditingRestrictions] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const decisionRef = useRef(null);
  const wasOpenRef = useRef(false);
  const submittingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (submittingRef.current) return;
    if (profileHasUnsavedChanges(initialDraftRef.current, draft)) setPendingAction('close');
    else onClose();
  }, [onClose, draft]);
  const dialogRef = useDialogFocus(open, requestClose);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = profileDraft(profile);
      initialDraftRef.current = next;
      setDraft(next);
      setEditingRestrictions(false);
      setValidationError("");
      setSubmissionError("");
      setPendingAction(null);
    }
    wasOpenRef.current = open;
  }, [open, profile]);
  useEffect(() => { if (pendingAction) decisionRef.current?.focus(); }, [pendingAction]);

  if (!open) return null;

  const update = (key, value) => {
    if (submittingRef.current) return;
    setValidationError("");
    setDraft((current) => updateProfileDraft(current, key, value));
  };

  const saveDraft = async () => {
    if (submittingRef.current) return false;
    let numbers;
    try { numbers = optionalProfileNumbers(draft); } catch (error) { setValidationError(error.message); return false; }
    const restrictionsError = validateRestrictions(draft) || validateActivitySurvey(draft.activitySurvey);
    if (restrictionsError) { setValidationError(restrictionsError); setEditingRestrictions(true); return false; }
    for (const target of Object.values(draft.nutrientTargets || {})) {
      const supplied = ['min', 'max'].filter((key) => target[key] !== undefined && target[key] !== '');
      if (supplied.some((key) => !validNutrientValue(target[key])) || (supplied.length === 2 && Number(target.min) > Number(target.max))) {
        setValidationError('Optional nutrient targets must be nonnegative numbers, with minimum no greater than maximum.');
        return false;
      }
    }
    submittingRef.current = true;
    setPending(true);
    setSubmissionError("");
    try {
      const saved = await onSave({
        ...draft,
        ...normalizeNutrientPreferences(draft),
        name: String(draft.name || '').trim(),
        ...numbers,
      });
      if (saved === false) { setSubmissionError('Changes could not be saved. Your edits are still here.'); return false; }
      initialDraftRef.current = draft;
      return true;
    } catch {
      setSubmissionError("Changes could not be saved. Try again.");
      return false;
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };
  const runAction = async action => {
    if (submittingRef.current) return;
    const callback = { account: onOpenAccount, dietitian: onOpenDietitian, patient: onOpenPatient, foodReview: onOpenFoodReview, logout: onSignOut }[action];
    if (action === 'close') { onClose(); return; }
    if (!callback) return;
    submittingRef.current = true; setPending(true); setSubmissionError('');
    try {
      if (await callback() === false) { setSubmissionError('This action could not be completed. Please try again.'); return; }
      onClose();
    } catch (error) { setSubmissionError(error.message || 'This action could not be completed. Please try again.'); }
    finally { submittingRef.current = false; setPending(false); }
  };
  const requestAction = action => {
    if (submittingRef.current) return;
    if (profileHasUnsavedChanges(initialDraftRef.current, draft)) setPendingAction(action);
    else void runAction(action);
  };
  const save = async event => { event.preventDefault(); if (await saveDraft()) onClose(); };
  const continueAfterSave = async () => { const action = pendingAction; if (await saveDraft()) { setPendingAction(null); await runAction(action); } };

  const savedSummary = profileSummaries(profile);
  const guidelineEligible = isGuidelineProteinEligible(draft);

  return (
    <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={requestClose}>
      <form ref={dialogRef} className="profile-drawer profile-compact" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex="-1" aria-busy={pending} onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
        <header className="modal-header"><div><h2 id="profile-title">Your profile</h2><p>Your details, preferences and account settings.</p></div><button className="icon-button" type="button" disabled={pending} onClick={requestClose} aria-label="Close profile"><X /></button></header>

        {pendingAction && <section className="profile-unsaved" role="alert" aria-labelledby="profile-unsaved-title"><h3 id="profile-unsaved-title">You have unsaved changes</h3><p>Save your profile or discard these edits before {pendingAction === 'logout' ? 'logging out' : pendingAction === 'close' ? 'closing it' : 'opening another view'}.</p><div><button ref={decisionRef} className="primary-button" type="button" disabled={pending} onClick={continueAfterSave}>Save and continue</button><button className="secondary-button" type="button" disabled={pending} onClick={() => { const action = pendingAction; setDraft(initialDraftRef.current); setPendingAction(null); void runAction(action); }}>Discard changes</button><button className="secondary-button" type="button" disabled={pending} onClick={() => setPendingAction(null)}>Keep editing</button></div></section>}

        <div className="form-section">
          <h3>About you</h3>
          <div className="form-grid">
            <label className="full-field"><span>Display name (optional)</span><input data-dialog-initial-focus disabled={pending} autoComplete="nickname" maxLength={100} value={draft.name ?? ""} onChange={(event) => update("name", event.target.value)} /></label>
          </div>
          <p className="field-note">{draft.accountRole === 'dietitian' ? 'Dietitian account' : 'Personal food journal'}</p>
        </div>

        {draft.accountRole !== 'dietitian' && <><section className="profile-restriction-summary"><header><h3>Foods to keep in mind</h3><button type="button" disabled={pending} aria-expanded={editingRestrictions} onClick={() => setEditingRestrictions(value => !value)}>{editingRestrictions ? 'Done editing' : 'Edit'}</button></header><dl><div><dt>Allergies</dt><dd>{restrictionSummary(draft, 'allergies')}</dd></div><div><dt>Intolerances</dt><dd>{restrictionSummary(draft, 'intolerances')}</dd></div></dl>{editingRestrictions && <FoodRestrictionsFields draft={draft} disabled={pending} onChange={changes => { setValidationError(''); setDraft(current => ({ ...current, ...changes })); }} />}</section>

        <details className="form-section profile-expand-section"><summary>Body & health details<small className="profile-saved-summary">{savedSummary.body}</small></summary><div className="form-grid">
          <label><span>Age (years)</span><input disabled={pending} type="number" min="1" max="120" step="1" value={draft.age ?? ''} onChange={event => update('age', event.target.value)} /></label>
          <label><span>Sex</span><select disabled={pending} value={draft.sex || ''} onChange={event => update('sex', event.target.value)}><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="prefer-not-to-say">Prefer not to say</option></select></label>
          <label><span>Weight (kg)</span><input disabled={pending} type="number" min="1" max="500" step="any" value={draft.weightKg ?? ''} onChange={event => update('weightKg', event.target.value)} /></label>
          <label><span>Height (cm)</span><input disabled={pending} type="number" min="50" max="275" step="any" value={draft.heightCm ?? ''} onChange={event => update('heightCm', event.target.value)} /></label>
          <label><span>Clinician-recorded CKD stage</span><select disabled={pending} value={draft.stage ?? ''} onChange={event => update('stage', event.target.value)}><option value="">Not sure / not recorded</option>{['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5'].map(stage => <option key={stage}>{stage}</option>)}</select></label>
          <label><span>Treatment status</span><select disabled={pending} value={draft.treatment ?? ''} onChange={event => update('treatment', event.target.value)}><option value="">Not sure / not recorded</option><option value="not-dialysis">Not receiving dialysis</option><option value="dialysis">Receiving dialysis</option></select></label>
        </div><h3>Activity over the past year</h3><ActivityFields value={draft.activitySurvey} disabled={pending} onChange={value => update('activitySurvey', value)} /><p className="field-note">In ADPKD, enlarged kidneys or liver can make BMI less representative. This tracker does not diagnose or calculate eGFR.</p></details>

        <details className="form-section profile-expand-section"><summary>Daily nutrition targets<small className="profile-saved-summary">{savedSummary.targets}</small></summary>
          <p className="field-note">Optional. Leave unknown targets blank; enter only values agreed with your care team.</p>
          <label className="check-row"><input type="checkbox" checked={draft.useGuidelineProteinRange} disabled={pending || !guidelineEligible} onChange={(event) => update("useGuidelineProteinRange", event.target.checked)} /><span><strong>Use ADPKD starting protein range</strong><small>0.8–1.0 g/kg/day for adults with ADPKD and CKD G1–G4; review with a renal dietitian.</small></span></label>
          {!guidelineEligible && <p className="clinical-alert">Age, CKD stage or dialysis can change protein needs. Enter only the targets supplied by your kidney care team.</p>}
          <div className="form-grid targets-grid">
            <label><span>Sodium maximum (mg)</span><input disabled={pending} type="number" min="500" max="6000" step="50" value={draft.sodiumTargetMg ?? ""} onChange={(event) => update("sodiumTargetMg", event.target.value)} /></label>
            <label><span>Protein minimum (g)</span><input type="number" min="10" max="250" step="1" disabled={pending || draft.useGuidelineProteinRange} value={draft.proteinMinG ?? ""} onChange={(event) => update("proteinMinG", event.target.value)} /></label>
            <label><span>Protein maximum (g)</span><input type="number" min="10" max="250" step="1" disabled={pending || draft.useGuidelineProteinRange} value={draft.proteinMaxG ?? ""} onChange={(event) => update("proteinMaxG", event.target.value)} /></label>
            <label><span>Fluid target (mL/day, optional)</span><input type="number" min="1" step="any" disabled={pending} value={draft.fluidTargetMl ?? ''} onChange={event => update('fluidTargetMl', event.target.value)} /></label>
          </div>
        </details>

        <details className="form-section profile-expand-section"><summary>Nutrients to track<small className="profile-saved-summary">{savedSummary.tracked}</small></summary>
          <p className="field-note">Choose report nutrients. Optional daily ranges must come from your care team; blank means no target. Missing food values remain unknown.</p>
          {['common', 'more'].map(group => { const content = <div className="nutrient-settings-grid">{NUTRIENTS.filter(nutrient => COMMON_NUTRIENT_KEYS.includes(nutrient.key) === (group === 'common')).map((nutrient) => <div className={`nutrient-setting-card ${draft.trackedNutrients.includes(nutrient.key) ? "is-selected" : ""}`} key={nutrient.key}>
            <label className="check-row"><input type="checkbox" disabled={pending} checked={draft.trackedNutrients.includes(nutrient.key)} onChange={(event) => update('trackedNutrients', event.target.checked ? [...draft.trackedNutrients, nutrient.key] : draft.trackedNutrients.filter((key) => key !== nutrient.key))} /><span><strong>{nutrient.label}</strong><small>{nutrient.unit} · {draft.trackedNutrients.includes(nutrient.key) ? "Tracking" : "Not tracked"}</small></span></label>
            {draft.trackedNutrients.includes(nutrient.key) && !['protein', 'sodium'].includes(nutrient.key) && <div className="nutrient-target-fields">{['min', 'max'].map((bound) => <label key={bound}><span>Optional {bound} ({nutrient.unit}/day)</span><input type="number" min="0" step="any" disabled={pending} value={draft.nutrientTargets?.[nutrient.key]?.[bound] ?? ''} onChange={(event) => update('nutrientTargets', { ...draft.nutrientTargets, [nutrient.key]: { ...draft.nutrientTargets?.[nutrient.key], [bound]: event.target.value } })} /></label>)}</div>}
            {draft.trackedNutrients.includes(nutrient.key) && ['protein', 'sodium'].includes(nutrient.key) && <p className="nutrient-target-hint">Target set in Daily targets above.</p>}
          </div>)}</div>; return group === 'common' ? <section key={group}><h3>Common nutrients</h3>{content}</section> : <details className="profile-more-nutrients" key={group}><summary>More nutrients<small>Vitamins, minerals and additional nutrition details</small></summary>{content}</details>; })}
        </details>

        <details className="profile-clinical-note">
          <summary>About nutrition targets</summary>
          <p>The optional starting-range calculation is based on KDIGO guidance, not a prescription. Potassium, phosphorus, fluids, calories and dialysis needs must be individualized from labs and clinical care.</p>
          <a href="https://kdigo.org/guidelines/autosomal-dominant-polycystic-kidney-disease-adpkd/" target="_blank" rel="noreferrer">Review KDIGO ADPKD guidance <ExternalLink size={15} /></a>
        </details></>}

        {onOpenAccount && <button className="profile-account-link" type="button" disabled={pending} onClick={() => requestAction('account')}><span>Account & care sharing<small>Manage sign-in and your care connections.</small></span><ChevronRight size={19} /></button>}
        {onOpenDietitian && <button className="profile-account-link" type="button" disabled={pending} onClick={() => requestAction('dietitian')}><span>Dietitian demo<small>Explore a separate view with fictional patients.</small></span><ChevronRight size={19} /></button>}
        {onOpenPatient && <button className="profile-account-link" type="button" disabled={pending} onClick={() => requestAction('patient')}><span>My food journal<small>Return to your own meal record.</small></span><ChevronRight size={19} /></button>}
        {onOpenFoodReview && <button className="profile-account-link" type="button" disabled={pending} onClick={() => requestAction('foodReview')}><span>Food submissions<small>Review your submitted foods.</small></span><ChevronRight size={19} /></button>}

        <footer className="drawer-actions">
          {(validationError || saveError || submissionError) && <p className="storage-alert" role="alert">{validationError || saveError || submissionError}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button><button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>Cancel</button>
          {onSignOut && <button className="profile-logout" type="button" disabled={pending} onClick={() => requestAction('logout')}><LogOut size={18} />Log out</button>}
        </footer>
      </form>
    </div>
  );
}
