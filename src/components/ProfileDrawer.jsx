import { ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import { isGuidelineProteinEligible, normalizeProfileDraft, updateProfileDraft } from "../utils/profile";
import { NUTRIENTS, normalizeNutrientPreferences, validNutrientValue } from '../utils/nutrientCatalog.js';

export default function ProfileDrawer({ open, profile, saveError, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...normalizeProfileDraft(profile), ...normalizeNutrientPreferences(profile) }));
  const [validationError, setValidationError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [pending, setPending] = useState(false);
  const wasOpenRef = useRef(false);
  const submittingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);
  const dialogRef = useDialogFocus(open, requestClose);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft({ ...normalizeProfileDraft(profile), ...normalizeNutrientPreferences(profile) });
      setValidationError("");
      setSubmissionError("");
    }
    wasOpenRef.current = open;
  }, [open, profile]);

  if (!open) return null;

  const update = (key, value) => {
    if (submittingRef.current) return;
    setValidationError("");
    setDraft((current) => updateProfileDraft(current, key, value));
  };

  const save = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const numericFields = ["weightKg", "heightCm", "sodiumTargetMg", "proteinMinG", "proteinMaxG"];
    if (!draft.name.trim() || numericFields.some((key) => String(draft[key]).trim() === "" || !Number.isFinite(Number(draft[key])) || Number(draft[key]) <= 0)) {
      setValidationError("Enter a name and a positive number for every measurement and target.");
      return;
    }
    if (Number(draft.proteinMinG) > Number(draft.proteinMaxG)) {
      setValidationError("Protein minimum must be less than or equal to the maximum.");
      return;
    }
    for (const target of Object.values(draft.nutrientTargets || {})) {
      const supplied = ['min', 'max'].filter((key) => target[key] !== undefined && target[key] !== '');
      if (supplied.some((key) => !validNutrientValue(target[key])) || (supplied.length === 2 && Number(target.min) > Number(target.max))) {
        setValidationError('Optional nutrient targets must be nonnegative numbers, with minimum no greater than maximum.');
        return;
      }
    }
    submittingRef.current = true;
    setPending(true);
    setSubmissionError("");
    try {
      const saved = await onSave({
        ...draft,
        ...normalizeNutrientPreferences(draft),
        name: draft.name.trim(),
        weightKg: Number(draft.weightKg),
        heightCm: Number(draft.heightCm),
        sodiumTargetMg: Number(draft.sodiumTargetMg),
        proteinMinG: Number(draft.proteinMinG),
        proteinMaxG: Number(draft.proteinMaxG),
      });
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

  const guidelineEligible = isGuidelineProteinEligible(draft);

  return (
    <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={requestClose}>
      <form ref={dialogRef} className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex="-1" aria-busy={pending} onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
        <header className="modal-header"><div><h2 id="profile-title">Your nutrition plan</h2><p>Use targets reviewed with your kidney care team.</p></div><button className="icon-button" type="button" disabled={pending} onClick={requestClose} aria-label="Close profile"><X /></button></header>

        <div className="form-section">
          <h3>Profile context</h3>
          <div className="form-grid">
            <label><span>Name</span><input data-dialog-initial-focus required disabled={pending} value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label><span>Clinician-recorded CKD stage</span><select disabled={pending} value={draft.stage} onChange={(event) => update("stage", event.target.value)}>{["G1", "G2", "G3a", "G3b", "G4", "G5"].map((stage) => <option key={stage}>{stage}</option>)}</select></label>
            <label><span>Weight (kg)</span><input required disabled={pending} type="number" min="30" max="250" step="0.1" value={draft.weightKg} onChange={(event) => update("weightKg", event.target.value)} /></label>
            <label><span>Height (cm)</span><input required disabled={pending} type="number" min="120" max="230" value={draft.heightCm} onChange={(event) => update("heightCm", event.target.value)} /></label>
            <label className="full-field"><span>Treatment status</span><select disabled={pending} value={draft.treatment} onChange={(event) => update("treatment", event.target.value)}><option value="not-dialysis">Not receiving dialysis</option><option value="dialysis">Receiving dialysis</option></select></label>
          </div>
          <p className="field-note">Race is intentionally not collected. This tracker does not diagnose or calculate eGFR. In ADPKD, enlarged kidney or liver weight can also make ordinary BMI less representative.</p>
        </div>

        <div className="form-section">
          <h3>Daily targets</h3>
          <label className="check-row"><input type="checkbox" checked={draft.useGuidelineProteinRange} disabled={pending || !guidelineEligible} onChange={(event) => update("useGuidelineProteinRange", event.target.checked)} /><span><strong>Use ADPKD starting protein range</strong><small>0.8–1.0 g/kg/day for adults with ADPKD and CKD G1–G4; review with a renal dietitian.</small></span></label>
          {!guidelineEligible && <p className="clinical-alert">CKD G5 or dialysis can change protein needs. Enter only the targets supplied by your kidney care team.</p>}
          <div className="form-grid targets-grid">
            <label><span>Sodium maximum (mg)</span><input required disabled={pending} type="number" min="500" max="6000" step="50" value={draft.sodiumTargetMg} onChange={(event) => update("sodiumTargetMg", event.target.value)} /></label>
            <label><span>Protein minimum (g)</span><input required type="number" min="10" max="250" step="1" disabled={pending || draft.useGuidelineProteinRange} value={draft.proteinMinG} onChange={(event) => update("proteinMinG", event.target.value)} /></label>
            <label><span>Protein maximum (g)</span><input required type="number" min="10" max="250" step="1" disabled={pending || draft.useGuidelineProteinRange} value={draft.proteinMaxG} onChange={(event) => update("proteinMaxG", event.target.value)} /></label>
          </div>
        </div>

        <div className="form-section">
          <h3>Additional nutrients to track</h3>
          <p className="field-note">Choose report nutrients. Optional daily ranges must come from your care team; blank means no target. Missing food values remain unknown.</p>
          <div className="nutrient-settings-grid">{NUTRIENTS.map((nutrient) => <div className={`nutrient-setting-card ${draft.trackedNutrients.includes(nutrient.key) ? "is-selected" : ""}`} key={nutrient.key}>
            <label className="check-row"><input type="checkbox" disabled={pending} checked={draft.trackedNutrients.includes(nutrient.key)} onChange={(event) => update('trackedNutrients', event.target.checked ? [...draft.trackedNutrients, nutrient.key] : draft.trackedNutrients.filter((key) => key !== nutrient.key))} /><span><strong>{nutrient.label}</strong><small>{nutrient.unit} · {draft.trackedNutrients.includes(nutrient.key) ? "Tracking" : "Not tracked"}</small></span></label>
            {draft.trackedNutrients.includes(nutrient.key) && !['protein', 'sodium'].includes(nutrient.key) && <div className="nutrient-target-fields">{['min', 'max'].map((bound) => <label key={bound}><span>Optional {bound} ({nutrient.unit}/day)</span><input type="number" min="0" step="any" disabled={pending} value={draft.nutrientTargets?.[nutrient.key]?.[bound] ?? ''} onChange={(event) => update('nutrientTargets', { ...draft.nutrientTargets, [nutrient.key]: { ...draft.nutrientTargets?.[nutrient.key], [bound]: event.target.value } })} /></label>)}</div>}
            {draft.trackedNutrients.includes(nutrient.key) && ['protein', 'sodium'].includes(nutrient.key) && <p className="nutrient-target-hint">Target set in Daily targets above.</p>}
          </div>)}</div>
        </div>

        <div className="source-note">
          <strong>Clinical boundary</strong>
          <p>Defaults are starting points from KDIGO guidance, not a prescription. Potassium, phosphorus, fluids, calories and dialysis needs must be individualized from labs and clinical care.</p>
          <a href="https://kdigo.org/guidelines/autosomal-dominant-polycystic-kidney-disease-adpkd/" target="_blank" rel="noreferrer">Review KDIGO ADPKD guidance <ExternalLink size={15} /></a>
        </div>

        <footer className="drawer-actions">
          {(validationError || submissionError || saveError) && <p className="storage-alert" role="alert">{validationError || submissionError || saveError}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save plan"}</button><button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>Cancel</button>
        </footer>
      </form>
    </div>
  );
}
