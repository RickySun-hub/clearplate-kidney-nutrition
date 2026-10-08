import { useEffect, useRef, useState } from 'react';
import { parseNutrientValues, formatAmount } from '../utils/nutrition';
import './VoiceAssistant.css';
import { Mic, Pause, Play, ArrowUp, X } from 'lucide-react';
import { recordingToWav } from '../utils/voiceAudio';
const emptyNutrients = { calories: '', protein: '', sodium: '', potassium: '', phosphorus: '' };
export default function VoiceAssistant({ recipes = [], recipe = null, details = null, accessToken = null, onSignIn, onClose, onAddFood }) {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('Checking voice availability…');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState(null);
  const [nutrients, setNutrients] = useState(emptyNutrients);
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(Array(36).fill(4));
  const [typing, setTyping] = useState(false);
  const audioContext = useRef(null), frame = useRef(null), clock = useRef(null), elapsedRef = useRef(0);
  function stopMeter() { cancelAnimationFrame(frame.current); clearInterval(clock.current); audioContext.current?.close().catch(() => {}); audioContext.current = null; }
  const [speech, setSpeech] = useState(false);
  const [step, setStep] = useState(0);
  const [outsideMode, setOutsideMode] = useState('usda');
  const [candidates, setCandidates] = useState([]);
  const [usdaFood, setUsdaFood] = useState(null);
  const [grams, setGrams] = useState('');
  const [usdaSource, setUsdaSource] = useState('');
  const searchVersion = useRef(0);
  const [searching, setSearching] = useState(false);
  function clearMatches() { searchVersion.current++; setCandidates([]); setUsdaFood(null); setGrams(''); setSearching(false); }
  async function searchUsda(query) {
    const version = ++searchVersion.current;
    const sessionGeneration = generation.current;
    setSearching(true); setCandidates([]); setUsdaFood(null); setGrams('');
    try {
      const response = await fetch(`/api/fdc-search?q=${encodeURIComponent(query.trim())}&pageSize=8`, {signal:AbortSignal.timeout(15000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'USDA search unavailable.');
      if (!alive.current || generation.current !== sessionGeneration || searchVersion.current !== version) return;
      setCandidates((data.foods || []).filter(food => food.basis === 'per100g'));
      setUsdaSource(data.provenance?.live ? 'USDA live food data' : 'USDA public-download snapshot');
      setMessage(data.foods?.length ? 'Select the closest USDA match, confirm its portion weight, then save.' : 'No USDA match. Try a simpler food name or use label values.');
    } catch(error) { if (alive.current && generation.current === sessionGeneration && searchVersion.current === version) setMessage(error.message || 'USDA search unavailable. Use label values instead.'); }
    finally { if (alive.current && generation.current === sessionGeneration && searchVersion.current === version) setSearching(false); }
  }
  const recorder = useRef(null), stream = useRef(null), timer = useRef(null), alive = useRef(true), cancelled = useRef(false), sendRequested = useRef(false), saving = useRef(false), generation = useRef(0);
  const steps = Array.isArray(details?.steps) ? details.steps.filter(item => typeof item === 'string') : [];
  useEffect(() => { setStep(0); }, [recipe?.id]);
  useEffect(() => {
    alive.current = true;
    const sessionGeneration = ++generation.current;
    clearMatches(); setAvailable(false); setDraft(null); setTranscript(''); setRecording(false); setPaused(false); setPending(false);
    fetch('/api/voice-status', { signal: AbortSignal.timeout(15000), headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }).then(response => response.json()).then(data => { if (alive.current && generation.current === sessionGeneration) { setAvailable(data.available === true); setMessage(data.available ? 'Microphone is off. Review every draft before saving.' : (data.message || data.error?.message || 'Sign in with a verified account to use AI voice. Manual logging is always available.')); } }).catch(() => { if (alive.current && generation.current === sessionGeneration) setMessage('Could not check AI voice. Reload to retry, or type and create a manual draft.'); });
    return () => { alive.current = false; generation.current++; cancelled.current = true; clearTimeout(timer.current); stopMeter(); if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); window.speechSynthesis?.cancel(); };
  }, [accessToken]);
  function speak(text) { if (speech && window.speechSynthesis) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
  function navigate(command) {
    if (!steps.length) { setMessage('Source cooking instructions are unavailable for this recipe.'); return; }
    const next = command === 'next' ? Math.min(step + 1, steps.length - 1) : command === 'previous' ? Math.max(step - 1, 0) : step;
    setStep(next); speak(steps[next]); setMessage(`Source step ${next + 1} of ${steps.length}.`);
  }
  async function interpret(payload) {
    const sessionGeneration = generation.current;
    setPending(true); setMessage('Preparing a draft…');
    try {
      const response = await fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Voice request failed.');
      if (!alive.current || generation.current !== sessionGeneration) return;
      setTranscript(data.transcript); setNutrients(emptyNutrients);
      if (data.draft.intent === 'cooking') { if (data.draft.command !== 'none') navigate(data.draft.command); else setMessage('Use next, previous, or repeat for source cooking steps.'); clearMatches(); setDraft(null); }
      else if (data.draft.intent === 'food' && (data.draft.recipeId || data.draft.foodName?.trim())) {
        clearMatches(); setDraft(data.draft); setOutsideMode('usda');
        setMessage('Review the food, portion, and meal. Nutrition comes only from selected source data.');
        if (!data.draft.recipeId && data.draft.foodName?.trim()) searchUsda(data.draft.foodName);
      } else { clearMatches(); setDraft(null); setMessage('No food or cooking command recognized. Edit your transcript or create a manual food draft.'); }
    } catch (error) { if (alive.current && generation.current === sessionGeneration) setMessage(error.message || 'Voice is unavailable. Please type instead.'); }
    finally { if (alive.current && generation.current === sessionGeneration) setPending(false); }
  }
  async function start() {
    const sessionGeneration = generation.current;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setMessage('This browser cannot record audio. Please type instead.'); return; }
    setPending(true);
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || generation.current !== sessionGeneration) { audioStream.getTracks().forEach(track => track.stop()); return; }
      stream.current = audioStream; cancelled.current = false; sendRequested.current = false;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('No supported audio recording format. Please type instead.');
      const capture = new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 32000 }); const chunks = []; let size = 0;
      capture.onerror = () => {
        if (!alive.current || generation.current !== sessionGeneration) return;
        cancelled.current = true; stopMeter(); audioStream.getTracks().forEach(track => track.stop());
        setRecording(false); setPaused(false); setPending(false); setLevels(Array(36).fill(4));
        setMessage('Recording was interrupted. Nothing was sent. Please try again or type instead.');
      };
      capture.ondataavailable = event => { size += event.data.size; if (size <= 1800000) chunks.push(event.data); else { cancelled.current = true; if (capture.state !== 'inactive') capture.stop(); setMessage('Recording is too large. Try a shorter recording.'); } };
      capture.onstop = async () => {
        clearTimeout(timer.current); stopMeter(); audioStream.getTracks().forEach(track => track.stop()); if (!alive.current || generation.current !== sessionGeneration) return; setRecording(false); setPaused(false); setLevels(Array(36).fill(4));
        if (cancelled.current) { setPending(false); return; }
        if (!sendRequested.current) { setPending(false); setMessage('Recording was interrupted. Nothing was sent. Please try again or type instead.'); return; }
        try {
          setPending(true);
          const wav = await recordingToWav(new Blob(chunks, { type: mimeType }));
          if (!alive.current || generation.current !== sessionGeneration) return;
          const reader = new FileReader(); reader.onload = () => { if (alive.current && generation.current === sessionGeneration) interpret({ audio: String(reader.result).split(',')[1], mimeType:'audio/wav', duration:wav.duration }); };
          reader.onerror = () => { if (alive.current && generation.current === sessionGeneration) { setPending(false); setMessage('Could not prepare audio. Please type instead.'); } };
          reader.readAsDataURL(wav.blob);
        } catch(error) { if (alive.current && generation.current === sessionGeneration) { setPending(false); setMessage(error.message || 'Could not prepare audio. Please type instead.'); } }
      };
      recorder.current = capture; capture.start(1000); setRecording(true); setPaused(false); setTyping(false); setElapsed(0); elapsedRef.current = 0;
      setMessage('Listening. Send when you are ready.');
      clock.current = setInterval(() => {
        if (capture.state !== 'recording') return;
        elapsedRef.current += 1; setElapsed(elapsedRef.current);
        if (elapsedRef.current >= 60) { capture.pause(); setPaused(true); setMessage('60-second limit reached. Send this recording or discard it.'); }
      }, 1000);
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext(); audioContext.current = context;
          const analyser = context.createAnalyser(); analyser.fftSize = 128;
          context.createMediaStreamSource(audioStream).connect(analyser);
          const values = new Uint8Array(analyser.frequencyBinCount);
          const draw = () => {
            if (capture.state === 'recording') { analyser.getByteFrequencyData(values); setLevels(Array.from({length:36}, (_, i) => Math.max(4, values[i + 2] / 255 * 52))); }
            frame.current = requestAnimationFrame(draw);
          };
          context.resume().catch(() => {}); draw();
        }
      } catch { /* Recording works even when audio visualization is unavailable. */ }
    } catch { stopMeter(); stream.current?.getTracks().forEach(track => track.stop()); if (alive.current && generation.current === sessionGeneration) setMessage('Microphone unavailable or permission declined. Please type instead.'); }
    finally { if (alive.current && generation.current === sessionGeneration) setPending(false); }
  }
  async function save() {
    if (saving.current || !draft || !onAddFood) return;
    const servings = Number(draft.servings);
    if (!Number.isFinite(servings) || servings < 0.25 || servings > 20) { setMessage('Use 0.25–20 servings.'); return; }
    const selectedRecipe = recipes.find(item => item.id === draft.recipeId);
    const weight = Number(grams);
    const useUsda = !selectedRecipe && outsideMode === 'usda';
    if (useUsda && (!usdaFood || usdaFood.basis !== 'per100g' || !Number.isFinite(weight) || weight <= 0 || weight * servings > 10000)) { setMessage('Select a USDA food and confirm its grams per serving; total eaten weight must be at most 10,000 g.'); return; }
    const values = useUsda ? Object.fromEntries(Object.entries(usdaFood.nutrients || {}).map(([key,value]) => [key, typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value * weight / 100 : null])) : parseNutrientValues(nutrients);
    if (!selectedRecipe && (!draft.foodName?.trim() || !values)) { setMessage('Enter a food name and label calories, protein, and sodium per serving. Unknown potassium and phosphorus can stay blank.'); return; }
    saving.current = true; setPending(true);
    try {
      const payload = { servings, meal: draft.meal, ...(selectedRecipe ? { recipeId: selectedRecipe.id } : { customFood: { id: `custom-${Date.now()}`, name: draft.foodName.trim(), ...values, ...(useUsda ? { name:usdaFood.description, method:'usda-estimate', methodLabel:'USDA food match · estimate', fdcId:usdaFood.fdcId, sourceUrl:usdaFood.sourceUrl, dataType:usdaFood.dataType, sourceRelease:usdaFood.release, sourceDescription:usdaSource, grams:weight, servingDescription:`${formatAmount(weight,2)} g per serving` } : {method:'packaged',methodLabel:'User-entered nutrition label'}), baseEstimate: { ...values }, uncertaintyMargin: 0, estimateRangePercent: 0 } }) };
      if (await onAddFood(payload) === false) { setMessage('The food could not be saved. Review and retry.'); return; }
      setDraft(null); setTranscript(''); setMessage('Food saved after your confirmation.');
    } catch { setMessage('Food could not be saved. Please retry.'); }
    finally { saving.current = false; setPending(false); }
  }
  return <section className="voice-assistant" aria-label="Voice and typed assistant">
    <header className="voice-heading">{onClose && <button className="voice-close" type="button" aria-label="Close voice assistant" onClick={onClose}><X size={24}/></button>}<h2>Tell me about your meal.</h2><p>Speak naturally. Review before saving.</p>{!accessToken && <button className="voice-sign-in" type="button" onClick={onSignIn}>Sign in or create an account</button>}</header>
    <p className="voice-status" role="status">{message}</p>
    <div className={`voice-composer ${paused ? 'is-paused' : ''}`}>
      <button className="voice-mic" type="button" aria-label="Start microphone" disabled={!available || pending || recording} onClick={start}><Mic size={44} strokeWidth={1.8} /></button>
      <div className="voice-recording-label"><strong>{pending ? 'Please wait…' : recording ? paused ? 'Paused' : 'Listening…' : 'Tap to speak'}</strong><span>{recording ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : 'Up to 60 seconds'}</span></div>
      <div className="voice-waveform" aria-hidden="true">{levels.map((height,i)=><span key={i} style={{height:`${height}px`}} />)}</div>
      {recording && <div className="voice-record-controls"><div><button className="voice-round" type="button" aria-label={paused ? 'Resume recording' : 'Pause recording'} disabled={pending || (paused && elapsed >= 60)} onClick={()=>{if (recorder.current?.state === 'paused') {recorder.current.resume();setPaused(false);setMessage('Listening. Send when you are ready.');} else if (recorder.current?.state === 'recording') {recorder.current.pause();setPaused(true);setMessage('Recording paused. Resume or send when ready.');}}}>{paused ? <Play size={30} /> : <Pause size={30} />}</button><span>{paused?'Resume':'Pause'}</span></div><div><button className="voice-round voice-send" type="button" aria-label="Send recording" onClick={()=>{if (recorder.current && recorder.current.state !== 'inactive') {sendRequested.current=true;setPending(true);recorder.current.stop();}}} disabled={pending}><ArrowUp size={34} /></button><span>Send</span></div></div>}
    </div>
    <div className="voice-underbar"><p>Audio is sent to OpenAI when you send. Nothing is logged until you confirm.</p>{recording ? <button type="button" className="voice-text-button" disabled={pending} onClick={()=>{cancelled.current=true;if (recorder.current?.state !== 'inactive') recorder.current?.stop();setMessage('Recording discarded.');}}><X size={16}/>Discard recording</button> : <button type="button" className="voice-text-button" disabled={pending} onClick={()=>setTyping(!typing)}>{typing?'Hide text':'Type instead'}</button>}</div>
    {(typing || transcript) && <div className="voice-text-entry"><label>Message<textarea maxLength={2000} value={transcript} disabled={pending || recording} onChange={event => { setTranscript(event.target.value); setDraft(null); clearMatches(); }} placeholder="Tell me what you ate…" /></label>
    <div className="voice-actions"><button type="button" disabled={!available || pending || recording || !transcript.trim()} onClick={() => interpret({ transcript })}>Send message</button><button type="button" disabled={pending || recording || !transcript.trim()} onClick={() => { setDraft({ foodName: transcript.slice(0, 120), recipeId: null, servings: 1, meal: 'Snack' }); setNutrients(emptyNutrients); clearMatches(); setOutsideMode('usda'); searchUsda(transcript.slice(0,120)); }}>Create manual draft</button></div></div>}
    {draft && <div className="voice-draft"><h3>Confirm food draft</h3>
      <label>Cookbook recipe<select disabled={pending || recording} value={draft.recipeId || ''} onChange={event => { setDraft({ ...draft, recipeId:event.target.value || null }); clearMatches(); }}><option value="">Outside food — USDA match or label</option>{recipes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!draft.recipeId && <>
        <label>Food name<input disabled={pending || recording} maxLength={120} value={draft.foodName} onChange={event => { setDraft({ ...draft,foodName:event.target.value }); clearMatches(); }} /></label>
        <label>Nutrition source<select disabled={pending || recording} value={outsideMode} onChange={event => setOutsideMode(event.target.value)}><option value="usda">USDA food match</option><option value="label">My nutrition label</option></select></label>
        {outsideMode === 'usda' ? <>
          <button type="button" disabled={pending || recording || searching || !draft.foodName.trim()} onClick={() => searchUsda(draft.foodName)}>Search USDA</button>
          {searching && <p role="status">Searching USDA source…</p>}
          {!!candidates.length && <div className="voice-actions" aria-label="USDA food candidates">{candidates.map(food => <button type="button" key={food.fdcId} disabled={pending || recording} aria-pressed={usdaFood?.fdcId === food.fdcId} onClick={() => { setUsdaFood(food); setGrams(''); }}><strong>{food.description}</strong> · {food.dataType} · FDC {food.fdcId}</button>)}</div>}
          {usdaFood && <><p>{usdaSource}. Match and portion are estimates; actual brands and preparation can differ.</p><a href={`https://fdc.nal.usda.gov/food-details/${usdaFood.fdcId}/nutrients`} target="_blank" rel="noreferrer noopener">View USDA source</a>
            {!!usdaFood.portions?.length && <label>Choose a USDA household portion per serving<select disabled={pending || recording} defaultValue="" key={usdaFood.fdcId} onChange={event => { if (event.target.value !== '') setGrams(String(usdaFood.portions[Number(event.target.value)].gramWeight)); }}><option value="">Choose the portion you ate</option>{usdaFood.portions.map((portion,index) => <option value={index} key={index}>{formatAmount(portion.amount,2)} {portion.description || portion.modifier || portion.unit} ({formatAmount(portion.gramWeight,2)} g)</option>)}</select></label>}
            <label>Grams per serving<input disabled={pending || recording} type="number" min="0.01" max="10000" step="0.01" value={grams} onChange={event => setGrams(event.target.value)} /></label>
            <p>Total eaten: {grams ? formatAmount(Number(grams)*Number(draft.servings),2) : 'Unknown'} g</p>
            <p>{Object.keys(emptyNutrients).map(key => `${key}: ${formatAmount(grams && typeof usdaFood.nutrients?.[key] === 'number' ? usdaFood.nutrients[key]*Number(grams)/100*Number(draft.servings) : null,2)} ${key === 'calories' ? 'kcal' : key === 'protein' ? 'g' : 'mg'}`).join(' · ')}</p><p>Missing nutrients remain unknown; they are never treated as zero.</p>
          </>}
        </> : <><p>Per-serving values from your nutrition label. AI does not supply these values.</p><div className="voice-nutrients">{Object.keys(emptyNutrients).map(key => <label key={key}>{key} ({key === 'calories' ? 'kcal' : key === 'protein' ? 'g' : 'mg'})<input disabled={pending || recording} type="number" min="0" step="0.01" value={nutrients[key]} onChange={event => setNutrients({ ...nutrients,[key]:event.target.value })} /></label>)}</div></>}
      </>}
      <label>Servings<input disabled={pending || recording} type="number" min="0.25" max="20" step="0.25" value={draft.servings} onChange={event => setDraft({ ...draft,servings:event.target.value })} /></label>
      <label>Meal<select disabled={pending || recording} value={draft.meal} onChange={event => setDraft({ ...draft,meal:event.target.value })}>{['Breakfast','Lunch','Dinner','Snack'].map(meal => <option key={meal}>{meal}</option>)}</select></label>
      <button type="button" disabled={pending || recording || searching} onClick={save}>Confirm & save food</button><button type="button" disabled={pending} onClick={() => { setDraft(null); clearMatches(); }}>Discard draft</button>
    </div>}
    {recipe && <div className="voice-cooking"><h3>Cook {recipe.name}</h3>{steps.length ? <><p>Source step {step + 1} of {steps.length}: {steps[Math.min(step, steps.length - 1)]}</p><div className="voice-actions">{['previous', 'repeat', 'next'].map(command => <button key={command} type="button" onClick={() => navigate(command)}>{command}</button>)}</div></> : <p>Source cooking steps are unavailable.</p>}</div>}
    {recipe && <label className="voice-speech"><input type="checkbox" checked={speech} onChange={event => { setSpeech(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel(); }} />Read source steps aloud using the browser voice</label>}
  </section>;
}
