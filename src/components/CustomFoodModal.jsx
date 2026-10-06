import { Info, Package, Scale, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import { formatAmount, parseNutrientValues } from "../utils/nutrition";

const emptyValues = { calories: "", protein: "", sodium: "", potassium: "", phosphorus: "" };

export default function CustomFoodModal({ open, saveError, onClose, onAdd }) {
  const [mode, setMode] = useState("packaged");
  const [name, setName] = useState("");
  const [meal, setMeal] = useState("Snack");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0,5));
  const [servings, setServings] = useState(1);
  const [margin, setMargin] = useState(25);
  const [values, setValues] = useState(emptyValues);
  const [validationError, setValidationError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);
  const dialogRef = useDialogFocus(open, requestClose);

  if (!open) return null;

  const updateValue = (key, value) => {
    setValidationError("");
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const parsedValues = parseNutrientValues(values);
    if (!name.trim() || !Number.isFinite(Number(servings)) || Number(servings) < 0.25 || Number(servings) > 20 || !parsedValues) {
      setValidationError("Enter a food name, servings, calories, protein, and sodium. Use 0 only when the label explicitly shows zero.");
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setSubmissionError("");
    try {
      const saved = await onAdd({
        meal,
        time,
        servings: Number(servings),
        customFood: {
          id: `custom-${Date.now()}`,
          name: name.trim(),
          ...parsedValues,
          method: mode,
          methodLabel: mode === "packaged" ? "Nutrition label" : `Estimate · user-set ±${margin}% range`,
          baseEstimate: { ...parsedValues },
          uncertaintyMargin: mode === "unpackaged" ? Number(margin) : 0,
          estimateRangePercent: mode === "unpackaged" ? Number(margin) : 0,
        },
      });
      if (saved === false) return;
      setMode("packaged");
      setName("");
      setMeal("Snack");
      setServings(1);
      setMargin(25);
      setValues(emptyValues);
      setValidationError("");
      submittingRef.current = false;
      onClose();
    } catch {
      setSubmissionError("Changes could not be saved. Try again.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
      <form ref={dialogRef} className="custom-food-modal" role="dialog" aria-modal="true" aria-labelledby="outside-food-title" tabIndex="-1" aria-busy={pending} onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header className="modal-header"><div><h2 id="outside-food-title">Log food outside the cookbook</h2><p>Use the package label when it exists; otherwise record a transparent conservative estimate.</p></div><button type="button" className="icon-button" disabled={pending} onClick={requestClose} aria-label="Close"><X /></button></header>
        <div className="mode-switch"><button type="button" disabled={pending} className={mode === "packaged" ? "selected" : ""} onClick={() => setMode("packaged")}><Package size={20} /><span><strong>Packaged food</strong><small>Copy the Nutrition Facts label</small></span></button><button type="button" disabled={pending} className={mode === "unpackaged" ? "selected" : ""} onClick={() => setMode("unpackaged")}><Scale size={20} /><span><strong>Unpackaged food</strong><small>Estimate with a safety margin</small></span></button></div>
        <div className="form-grid">
          <label><span>Time eaten</span><input type="time" value={time} onChange={event=>setTime(event.target.value)} /></label>
          <label className="full-field"><span>Food name</span><input data-dialog-initial-focus required disabled={pending} value={name} onChange={(event) => { setValidationError(""); setName(event.target.value); }} placeholder={mode === "packaged" ? "Example: Sea salt potato chips" : "Example: Restaurant noodle soup"} /></label>
          <label><span>Meal</span><select disabled={pending} value={meal} onChange={(event) => setMeal(event.target.value)}>{["Breakfast", "Lunch", "Dinner", "Snack"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Servings eaten</span><input required disabled={pending} type="number" min="0.25" max="20" step="0.25" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
        </div>
        <div className="custom-nutrients"><h3>{mode === "packaged" ? "Per labeled serving" : "Best estimate for one serving"}</h3><div className="nutrient-inputs">{[["calories", "Calories", "kcal", true], ["protein", "Protein", "g", true], ["sodium", "Sodium", "mg", true], ["potassium", "Potassium", "mg", false], ["phosphorus", "Phosphorus", "mg", false]].map(([key, label, unit, required]) => <label key={key}><span>{label}{required ? " *" : " (optional)"}</span><div className="inline-unit"><input required={required} disabled={pending} type="number" min="0" step="0.1" value={values[key]} onChange={(event) => updateValue(key, event.target.value)} /><span>{unit}</span></div></label>)}</div></div>
        {mode === "unpackaged" && <section className="uncertainty-box"><div><label htmlFor="margin"><strong>User-set estimate range</strong></label><p>Your original values remain the recorded estimate. This range is a planning assumption, not a measured error bound or clinical standard.</p></div><select id="margin" disabled={pending} value={margin} onChange={(event) => setMargin(event.target.value)}><option value="10">±10%</option><option value="25">±25%</option><option value="40">±40%</option><option value="50">±50%</option></select><div className="adjusted-values"><span>Sodium per serving <strong>{formatAmount(values.sodium === "" ? null : values.sodium * (1 - Number(margin) / 100), 1)}–{formatAmount(values.sodium === "" ? null : values.sodium * (1 + Number(margin) / 100), 1)} mg</strong></span><span>Protein per serving <strong>{formatAmount(values.protein === "" ? null : values.protein * (1 - Number(margin) / 100), 1)}–{formatAmount(values.protein === "" ? null : values.protein * (1 + Number(margin) / 100), 1)} g</strong></span></div></section>}
        {mode === "packaged" && <p className="ocr-note"><Info size={17} /> Photo OCR is a next-phase feature. For this local MVP, values are entered manually so the patient can verify every number before saving.</p>}
        <footer className="drawer-actions">
          {(validationError || submissionError || saveError) && <p className="storage-alert" role="alert">{validationError || submissionError || saveError}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Add to food history"}</button><button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>Cancel</button>
        </footer>
      </form>
    </div>
  );
}
