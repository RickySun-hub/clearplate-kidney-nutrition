import LiveVoice from './LiveVoice';
import { useEffect, useState } from 'react';
import { Mic, X } from 'lucide-react';
import useDialogFocus from '../hooks/useDialogFocus';

export default function DiscoveryVoice({ kind, onApply, accessToken }) {
  const [open, setOpen] = useState(false);
  const title = kind === 'recipes' ? 'Tell us what you’d like to eat' : 'Plan meals with your voice';
  return <><button className="discovery-voice-trigger" onClick={() => setOpen(true)}><Mic size={18} />{title}</button>{open && <DiscoveryDialog accessToken={accessToken} kind={kind} title={title} onClose={() => setOpen(false)} onApply={onApply} />}</>;
}

function DiscoveryDialog({ kind, title, onClose, onApply, accessToken }) {
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
  const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[voiceMessage,setVoiceMessage]=useState('Checking voice availability…');
  useEffect(()=>{const controller=new AbortController();setAvailable(false);fetch('/api/voice-status',{headers:accessToken ? {Authorization:`Bearer ${accessToken}`} : {},signal:controller.signal}).then(r=>r.json()).then(data=>{if(controller.signal.aborted)return;setAvailable(data.available===true);setVoiceMessage(data.available ? '' : data.message || data.error?.message || 'Sign in with a verified account to use voice. You can edit conditions below.');}).catch(()=>{if(!controller.signal.aborted)setVoiceMessage('Voice is unavailable. You can edit conditions below.');});return ()=>controller.abort();},[accessToken]);
  const ref = useDialogFocus(true, onClose);
  const [search, setSearch] = useState('');
  const [meals, setMeals] = useState(['Lunch', 'Dinner']);
  const [objective, setObjective] = useState('balanced');
  return <div className="voice-log-backdrop"><section ref={ref} className="voice-log-drawer voice-fullscreen discovery-dialog" role="dialog" aria-modal="true" aria-labelledby="discovery-title" tabIndex={-1}>
    <header className="voice-log-header"><h2 id="discovery-title">{title}</h2><button className="icon-button" aria-label="Close voice preferences" onClick={onClose}><X /></button></header>
    <p>{kind === 'recipes' ? 'Find recipes by ingredients you enjoy. Review your search before applying it.' : 'Choose the meals you want to prepare and how to compare the ideas.'}</p>
    {available ? <LiveVoice immersive autoStart key={accessToken || 'local'} accessToken={accessToken} meal="Snack" mode={kind} onBusy={setBusy} onPreferences={preferences=>{if(kind==='recipes')setSearch(preferences.search);else {setMeals(preferences.selectedMeals);setObjective(preferences.activeObjective);}}} /> : <p role="status">{voiceMessage}</p>}
    <p className="field-note">AI voice uses OpenAI. Review your conditions below after the conversation. Preferences stay on this page until you apply them.</p>
    <h3>Review conditions</h3>{busy && <p role="status">End the conversation to edit and apply these conditions.</p>}
    {kind === 'recipes' ? <label>Recipe names or ingredients<input disabled={busy} value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. chicken rice" /><small>Searches all these words in existing recipe names and ingredients.</small></label> : <><fieldset disabled={busy}><legend>Meals to plan</legend>{['Breakfast','Lunch','Dinner','Snack'].map(meal => <label key={meal}><input type="checkbox" checked={meals.includes(meal)} onChange={e => setMeals(current => e.target.checked ? [...current,meal] : current.filter(m => m !== meal))} />{meal}</label>)}</fieldset><label>Compare ideas by<select disabled={busy} value={objective} onChange={e => setObjective(e.target.value)}><option value="balanced">Balanced</option><option value="lowest-sodium">Lowest sodium</option><option value="simplest">Fewest known cooking steps</option></select></label><p className="field-note">Uses your saved targets and the existing meal planner. Shared-ingredient preferences and cooking-time estimates are not supported in this preview.</p></>}
    <footer><button className="primary-button" disabled={busy || (kind === 'recipes' ? !search.trim() : !meals.length)} onClick={() => {onApply(kind === 'recipes' ? {search:search.trim()} : {selectedMeals:meals,activeObjective:objective});onClose();}}>{kind === 'recipes' ? 'Find matching recipes' : 'Show meal ideas'}</button><button className="secondary-button" onClick={onClose}>Cancel</button></footer><p className="field-note">This does not add anything to your food record.</p>
  </section></div>;
}
