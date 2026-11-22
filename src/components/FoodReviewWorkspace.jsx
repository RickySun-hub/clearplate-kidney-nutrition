import { useEffect, useRef, useState } from 'react';
import { compressLabelPhoto } from '../utils/labelPhoto.js';
import { NUTRIENTS } from '../utils/nutrientCatalog.js';
import { normalizeFoodSubmission, catalogFoodSnapshot } from '../utils/foodSubmission.js';
import { localDateKey } from '../utils/nutrition.js';
import { suggestedMeal, validateMealMoment } from '../utils/meals.js';
import MealMomentFields from './MealMomentFields';
import './revision-20261104.css';

const blank = () => ({name:'',brand:'',barcode:'',servingDescription:'',nutrients:{}});
export default function FoodReviewWorkspace({ client, onBack, backLabel="Back to Today", onAddFood, initialBarcode="" }) {
  const [access,setAccess]=useState(null),[rows,setRows]=useState([]),[matches,setMatches]=useState([]);
  const [draft,setDraft]=useState(()=>({...blank(),barcode:initialBarcode})),[photo,setPhoto]=useState(''),[query,setQuery]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[working,setBusy]=useState(false),[selected,setSelected]=useState(null);
  const [photoBusy,setPhotoBusy]=useState(false);
  const busy=working||photoBusy;
  const photoVersion=useRef(0);
  const [reason,setReason]=useState(''),[mergeId,setMergeId]=useState(''),[recording,setRecording]=useState(null),[servings,setServings]=useState('1');
  const [moment,setMoment]=useState(()=>{const time=new Date().toTimeString().slice(0,5);return {date:localDateKey(),time,meal:suggestedMeal(time)};});
  const mounted=useRef(false),locked=useRef(false);
  const rpc=async(action,payload={})=>{
    if (!client?.foodReview) throw Error('Food submissions are not enabled in this workspace. Your food journal is still available.');
    try {return await client.foodReview(action,payload);} catch(e) {
      if (/food_review_action|schema cache|not found|404/i.test(e.message)) throw Error('Food submissions are not enabled yet. An administrator must enable the reviewed food library.');
      throw e;
    }
  };
  async function run(fn) { if(locked.current||photoBusy)return;locked.current=true;setBusy(true);setError('');setNotice('');try{await fn();window.dispatchEvent(new Event('food-review-updated'));}catch(e){if(mounted.current)setError(e.message);}finally{locked.current=false;if(mounted.current)setBusy(false);} }
  const reload=async()=>{const next=await rpc('list');if(mounted.current)setRows(next);};
  useEffect(()=>{mounted.current=true;void run(async()=>{const status=await rpc('status');if(mounted.current)setAccess(status);await reload();});return()=>{mounted.current=false;photoVersion.current++;};},[client]);
  async function decide(action) {
    await rpc(action,{id:selected.id,version:selected.version,reason,mergeId,food:normalizeFoodSubmission(draft)});
    setSelected(null);setDraft(blank());setPhoto('');setReason('');setMergeId('');await reload();setNotice('Review saved. Existing food history was not changed.');
  }
  return <main className="food-review-workspace"><button type="button" className="secondary-button" onClick={onBack}>{backLabel}</button><h1>Food submissions</h1><p>Find reviewed foods, or submit a new food for review. Only approved foods appear in the shared library.</p>
    {error&&<p className="storage-alert" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await rpc('search',{query:query.trim()});setMatches(result);if(!result.length)setNotice('No reviewed match. Submit its label below.');});}}><label>Food name or barcode<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Scan with a barcode reader, or type the code"/></label><button disabled={busy||!access||!query.trim()}>Search reviewed foods</button></form>
    <ul>{matches.map(row=><li key={row.id}><strong>{row.food.name}</strong> · {row.food.brand} · {row.food.servingDescription}<button disabled={busy} onClick={()=>{setRecording(row);setServings('1');}}>Log this food</button>{access?.reviewer&&<button onClick={()=>setMergeId(row.id)}>Use as merge target</button>}</li>)}</ul>
    {recording&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{validateMealMoment(moment,localDateKey());if(!Number.isFinite(Number(servings))||Number(servings)<=0||Number(servings)>1000)throw Error('Enter a positive number of servings up to 1,000.');const saved=await onAddFood({...moment,servings:Number(servings),customFood:catalogFoodSnapshot(recording)});if(saved===false)throw Error('Food could not be saved.');setRecording(null);setNotice('Food saved to your journal.');});}}><h2>{recording.food.name}</h2><p>One serving: {recording.food.servingDescription}</p><label>Servings eaten<input required type="number" min="0.001" max="1000" step="any" value={servings} onChange={e=>setServings(e.target.value)}/></label><MealMomentFields value={moment} onChange={setMoment} disabled={busy}/><button disabled={busy}>Confirm and record food</button><button type="button" onClick={()=>setRecording(null)}>Cancel</button></form>}
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{await rpc('submit',{food:normalizeFoodSubmission(draft),photo,...(selected?{id:selected.id,version:selected.version}:{})});setDraft(blank());setSelected(null);setPhoto('');await reload();setNotice('Submitted for review. This food is not in the shared library yet.');});}}>
      <h2>{selected?'Review food submission':'Submit a new food'}</h2><p>Include food packaging only. Do not include names, faces, prescriptions or patient information.</p>
      <div className="form-grid">{[['name','Food name',150],['brand','Brand (optional)',150],['barcode','Barcode (optional)',14],['servingDescription','Nutrition basis / serving size',200]].map(([key,label,max])=><label key={key}>{label}<input maxLength={max} required={['name','servingDescription'].includes(key)} disabled={busy||!access} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}</div>
      <details><summary>Nutrition values per labeled serving</summary><p>Leave unlisted nutrients blank. Enter zero only when the label says zero.</p><div className="form-grid">{NUTRIENTS.map(n=><label key={n.key}>{n.label} ({n.unit})<input type="number" min="0" step="any" disabled={busy||!access} value={draft.nutrients[n.key]??''} onChange={e=>setDraft({...draft,nutrients:{...draft.nutrients,[n.key]:e.target.value}})}/></label>)}</div></details>
      <label>Nutrition label photo (JPEG/PNG/WebP, up to 20 MB; compressed on this device)<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||!access} onChange={async e=>{const f=e.target.files?.[0],version=++photoVersion.current;setPhoto('');setError('');if(!f)return;setPhotoBusy(true);try{const data=await compressLabelPhoto(f);if(mounted.current&&version===photoVersion.current)setPhoto(data);}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current&&version===photoVersion.current)setPhotoBusy(false);}}}/></label>
      {photoBusy&&<p role="status">Preparing label photo on this device…</p>}
      {photo&&<p>Check that the numbers in this preview are readable before submitting. If not, crop closer to the label and upload again.</p>}
      {photo&&<><img className="label-photo-preview" src={photo} alt="Submitted nutrition label"/><button type="button" onClick={()=>setPhoto('')}>Remove photo</button></>}
      {!selected||!access?.reviewer ? <button className="primary-button" disabled={busy||!access}>Submit for review</button> : <><label>Review note<input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><label>Merge target ID (select from search above)<input value={mergeId} onChange={e=>setMergeId(e.target.value)}/></label><div className="care-actions">{[['approve','Approve for library'],['needs-info','Request more information'],['reject','Reject'],['merge','Merge with existing']].map(([action,label])=><button type="button" key={action} disabled={busy||!reason.trim()||(action==='merge'&&!mergeId)} onClick={()=>run(()=>decide(action))}>{label}</button>)}</div></>}
      {selected&&<button type="button" onClick={()=>{setSelected(null);setDraft(blank());setPhoto('');}}>Cancel selection</button>}
    </form>
    <section><h2>{access?.reviewer?'Review queue':'My submissions'}</h2><p>{access?.reviewer?'Up to 100 oldest pending submissions. Refresh after reviewing to load the next items.':'Your 100 most recent submissions.'}</p><button disabled={busy||!access} onClick={()=>run(reload)}>Refresh</button>{rows.map(row=><article key={row.id}><h3>{row.food.name}</h3><p>{row.status} · {row.review_note || 'Awaiting review'}</p>{(access?.reviewer&&['pending','needs-info'].includes(row.status)||!access?.reviewer&&row.status==='needs-info')&&<button disabled={busy} onClick={()=>{setSelected(row);setDraft(row.food);setPhoto(row.photo||'');setReason('');}}>Open submission</button>}</article>)}</section>
  </main>;
}
