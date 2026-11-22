import BarcodeLookup from './BarcodeLookup';
import { NUTRIENTS } from '../utils/nutrientCatalog.js';
import { normalizeFoodSubmission } from '../utils/foodSubmission.js';
import { Info, Package, Scale, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import { formatAmount, parseNutrientValues, localDateKey } from "../utils/nutrition";
import { suggestedMeal, validateMealMoment } from '../utils/meals';
import MealMomentFields from './MealMomentFields';
import './mealRecording.css';

const emptyValues = { calories: "", protein: "", sodium: "", potassium: "", phosphorus: "" };

export default function CustomFoodModal({ open, saveError, onClose, onAdd, onOpenLibrary, client }) {
  const [barcode,setBarcode]=useState(''),[lookupSource,setLookupSource]=useState(null);
  const [mode, setMode] = useState("packaged");
  const [name, setName] = useState("");
  const [servingDescription,setServingDescription] = useState("");
  const [moment, setMoment] = useState(()=>{const time=new Date().toTimeString().slice(0,5);return {date:localDateKey(),time,meal:suggestedMeal(time),mealManuallyChosen:false};});
  const { date, meal, time } = moment;
  useEffect(() => { if (open) { const time = new Date().toTimeString().slice(0, 5); setMoment({ date: localDateKey(), time, meal: suggestedMeal(time), mealManuallyChosen: false }); } }, [open]);
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
    let parsedValues;
    try { parsedValues = mode === 'packaged' ? normalizeFoodSubmission({name,servingDescription,nutrients:values}).nutrients : parseNutrientValues(values); }
    catch(error) {setValidationError(error.message);return;}
    try { validateMealMoment(moment, localDateKey()); } catch (err) { setValidationError(err.message); return; }
    if (!name.trim() || !Number.isFinite(Number(servings)) || Number(servings) <= 0 || Number(servings) > 1000 || !parsedValues) {
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
        date,
        servings: Number(servings),
        customFood: {
          ...(mode==='packaged'?{barcode,brand:lookupSource?.brand||'',...(lookupSource?{sourceSnapshot:lookupSource,methodSource:lookupSource.source}:{})}:{}),
          id: `custom-${Date.now()}`,
          name: name.trim(),
          servingDescription:servingDescription.trim(),
          reviewStatus:"private-unreviewed",
          ...parsedValues,
          method: mode,
          methodLabel: mode === "packaged" ? "Personal label · not reviewed" : `Estimate · user-set ±${margin}% range`,
          baseEstimate: { ...parsedValues },
          uncertaintyMargin: mode === "unpackaged" ? Number(margin) : 0,
          estimateRangePercent: mode === "unpackaged" ? Number(margin) : 0,
        },
      });
      if (saved === false) return;
      setMode("packaged");setLookupSource(null);setBarcode('');
      setName("");setServingDescription("");
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
        {mode==='packaged'&&<BarcodeLookup client={client} disabled={pending} onBarcode={code=>{setBarcode(code);if(lookupSource){setLookupSource(null);setValues(emptyValues);setName('');setServingDescription('');setServings('');}}} onChoose={product=>{setName(product.name);setServingDescription(product.servingDescription);setValues(product.nutrients);setServings('');setLookupSource(product);setBarcode(product.barcode);setValidationError('');}}/>}
        {mode==='packaged'&&lookupSource&&<p className="ocr-note">Values loaded from {lookupSource.source}. Check the label and enter the amount eaten. Edits remain personal values; they do not change the shared library.</p>}
        <div className="form-grid">
          <label className="full-field"><span>Food name</span><input data-dialog-initial-focus required disabled={pending} value={name} onChange={(event) => { setValidationError(""); setName(event.target.value); }} placeholder={mode === "packaged" ? "Example: Sea salt potato chips" : "Example: Restaurant noodle soup"} /></label>
          <label><span>{mode==='packaged'&&lookupSource?.measuredUnit?`Amount eaten (${lookupSource.measuredUnit})`:'Servings eaten'}</span><input required disabled={pending} type="number" min="0.000001" max={lookupSource?.measuredUnit?100000:1000} step="any" value={mode==='packaged'&&lookupSource?.measuredUnit&&servings!==''?Number(servings)*100:servings} onChange={(event) => setServings(event.target.value===''?'':mode==='packaged'&&lookupSource?.measuredUnit?Number(event.target.value)/100:event.target.value)} /></label>
        </div>
        <label>Serving size / nutrition basis<input required={mode === 'packaged'} maxLength={200} disabled={pending} value={servingDescription} onChange={e=>setServingDescription(e.target.value)} placeholder="For example, 1 cup or 1 muffin"/></label>
        <MealMomentFields value={moment} onChange={setMoment} disabled={pending} />
        <div className="custom-nutrients"><h3>{mode === "packaged" ? "Per labeled serving" : "Best estimate for one serving"}</h3><div className="nutrient-inputs">{NUTRIENTS.map(n=>[n.key,n.label,n.unit,mode !== 'packaged' && ['calories','protein','sodium'].includes(n.key)]).map(([key, label, unit, required]) => <label key={key}><span>{label}{required ? " *" : " (optional)"}</span><div className="inline-unit"><input required={required} disabled={pending} type="number" min="0" step="any" value={values[key] ?? ''} onChange={(event) => updateValue(key, event.target.value)} /><span>{unit}</span></div></label>)}</div></div>
        {mode === "unpackaged" && <section className="uncertainty-box"><div><label htmlFor="margin"><strong>User-set estimate range</strong></label><p>Your original values remain the recorded estimate. This range is a planning assumption, not a measured error bound or clinical standard.</p></div><select id="margin" disabled={pending} value={margin} onChange={(event) => setMargin(event.target.value)}><option value="10">±10%</option><option value="25">±25%</option><option value="40">±40%</option><option value="50">±50%</option></select><div className="adjusted-values"><span>Sodium per serving <strong>{formatAmount(values.sodium === "" ? null : values.sodium * (1 - Number(margin) / 100), 1)}–{formatAmount(values.sodium === "" ? null : values.sodium * (1 + Number(margin) / 100), 1)} mg</strong></span><span>Protein per serving <strong>{formatAmount(values.protein === "" ? null : values.protein * (1 - Number(margin) / 100), 1)}–{formatAmount(values.protein === "" ? null : values.protein * (1 + Number(margin) / 100), 1)} g</strong></span></div></section>}
        {mode === "packaged" && <p className="ocr-note"><Info size={17} /> Personal label values are not reviewed. Leave unlisted nutrients blank; zero means the label explicitly reports zero.</p>}
        {onOpenLibrary && <button type="button" className="secondary-button" disabled={pending} onClick={()=>onOpenLibrary({barcode})}>Find or submit a food for review</button>}
        <footer className="drawer-actions">
          {(validationError || submissionError || saveError) && <p className="storage-alert" role="alert">{validationError || submissionError || saveError}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Add to food history"}</button><button className="secondary-button" type="button" disabled={pending} onClick={requestClose}>Cancel</button>
        </footer>
      </form>
    </div>
  );
}
