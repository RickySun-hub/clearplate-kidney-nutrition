import {
  BookOpen,
  Mic,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  History,
  Info,
  PackagePlus,
  Plus,
  Scale,
  Settings2,
  Target,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AddMealModal from "./components/AddMealModal";
import CustomFoodModal from "./components/CustomFoodModal";
import HistoryView from "./components/HistoryView";
import Logo from "./components/Logo";
import NutrientProgress from "./components/NutrientProgress";
import PlannerView from "./components/PlannerView";
import ProfileDrawer from "./components/ProfileDrawer";
import RecipeLibrary from "./components/RecipeLibrary";
import RecipeDetailView from "./components/RecipeDetailView";
import TodayMeals from "./components/TodayMeals";
import UsdaFoodModal from "./components/UsdaFoodModal";
import VoiceAssistant from "./components/VoiceAssistant";
import { appendVoiceMeal } from "./utils/liveMealTools.js";
import RDDashboard from "./components/RDDashboard";
import {captureCareInvitation} from './components/CareInvitations';
import CareConnection from "./components/CareConnection";
import AuthLanding from "./components/AuthLanding";
import RecipeImport from "./components/RecipeImport";
import { NUTRIENTS, normalizeNutrientPreferences } from "./utils/nutrientCatalog";
import { nutrientCoverage } from "./utils/nutrition";
import baseRecipes from "./data/recipes.json";
import baseRecipeDetails from "./data/recipeDetails.json";
import { defaultProfile, recipeImages } from "./data/seed";
import { mealTimes, nextSortOrder, normalizeEntryOrder, reorderMealEntries } from "./utils/meals";
import { formatAmount, localDateKey, mealTotals, mealTotalBounds } from "./utils/nutrition";
import { daySignature, isDayComplete } from "./utils/recording";

import { normalizeProfileDraft } from "./utils/profile";

const appStorageKey = "clearplate-adpkd-mvp-v3";
const detailReturnLabels = {
  today: "today’s meals",
  planner: "plan",
  recipes: "recipes",
};

function loadInitialState(rawOverride) {
  let raw = null;
  try {
    raw = rawOverride === undefined ? localStorage.getItem(appStorageKey) : rawOverride;
    const saved = JSON.parse(raw);
    if (saved?.profile && Array.isArray(saved.entries)) return {
      ...saved, raw, profile: normalizeProfileDraft(saved.profile), entries: normalizeEntryOrder(saved.entries),
    };
  } catch {
    // Start without invented meals if no usable saved record is available.
  }
  return { profile: defaultProfile, entries: [], raw };
}

export default function App() {
  const [authPage, setAuthPage] = useState(() => {const hash=window.location.hash.slice(1);const pending=captureCareInvitation();if(hash.startsWith('care-invite/'))return 'care-invite';if(/[?&](code|error)=/.test(window.location.search))return pending?'care-invite':'signin';return ['how-it-works','signin','signup','rd-signin'].includes(hash)?hash:'home';});
  function navigateAuth(page) {
    setAuthPage(page);
    try{if(page==='rd-signin')sessionStorage.setItem('renalsync-login-destination','rd');else if(page!=='google')sessionStorage.removeItem('renalsync-login-destination');}catch{}
    const hash = page === 'home' ? '' : `#${page === 'google' ? 'signin' : page}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const restore = () => { const hash = window.location.hash.slice(1); if(hash.startsWith('care-invite/')){captureCareInvitation();setAuthPage('care-invite');}else setAuthPage(['how-it-works','signin','signup','rd-signin'].includes(hash)?hash:'home'); };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
  }, []);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const initial = useMemo(loadInitialState, []);

  const saving = useRef(false);
  const [customRecipes, setCustomRecipes] = useState(initial.customRecipes || []);
  const [customRecipeDetails, setCustomRecipeDetails] = useState(initial.customRecipeDetails || {});
  const recipes = useMemo(()=>[...baseRecipes,...customRecipes],[customRecipes]);
  const recipeDetails = useMemo(()=>({...baseRecipeDetails,...customRecipeDetails}),[customRecipeDetails]);
  const [importOpen,setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("today");
  const [profile, setProfile] = useState(initial.profile);
  const [entries, setEntries] = useState(initial.entries);
  const [dayRecords, setDayRecords] = useState(initial.dayRecords || {});
  const [mealDialog, setMealDialog] = useState({ open: false, recipeId: null, initialMeal: null });
  const [customDialog, setCustomDialog] = useState(false);
  const [usdaDialog, setUsdaDialog] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  const [careInvites,setCareInvites]=useState(0);
  const [careSession, setCareSession] = useState(null);
  const cloud=useRef(null),sessionEpoch=useRef(0);
  const [cloudReady,setCloudReady]=useState(false),[syncStatus,setSyncStatus]=useState(''),[pendingCloud,setPendingCloud]=useState(null);
  function applyRecord(record){setProfile(normalizeProfileDraft(record.profile));setEntries(normalizeEntryOrder(record.entries));setDayRecords(record.dayRecords||{});setCustomRecipes(record.customRecipes||[]);setCustomRecipeDetails(record.customRecipeDetails||{});}
  async function connectSession(session){
    const epoch=++sessionEpoch.current;cloud.current=null;setCloudReady(false);setPendingCloud(null);setCareSession(session);setCareInvites(0);setVoiceOpen(false);setSharedRecord(null);setSharedIdentity('local');
    if(!session){setActiveTab('today');applyRecord({profile:defaultProfile,entries:[],dayRecords:{}});return;}
    setSyncStatus('Loading your private cloud record…');
    try{const row=await session.client.own();if(epoch!==sessionEpoch.current)return;const record=row?.record||{profile:defaultProfile,entries:[],dayRecords:{}};
      cloud.current={client:session.client,version:row?.updated_at||null,owner:session.account.id,epoch};applyRecord(record);setCloudReady(true);setSyncStatus('Connected to Supabase. Confirmed changes save automatically.');
      let rdRequested=authPage==='rd-signin';try{rdRequested ||= sessionStorage.getItem('renalsync-login-destination')==='rd';sessionStorage.removeItem('renalsync-login-destination');}catch{}
      if(rdRequested){try{const shared=await session.client.shared();if(epoch!==sessionEpoch.current)return;setActiveTab('rd');}catch{if(epoch===sessionEpoch.current)setActiveTab('today');}}
      try{const draft=JSON.parse(localStorage.getItem('renalsync-pending:'+session.account.id));if(draft?.record)setPendingCloud(draft);}catch{}
    }catch(error){if(epoch===sessionEpoch.current)setSyncStatus(error.message);}
  }
  const [sharedRecord, setSharedRecord] = useState(null);
  const [sharedIdentity, setSharedIdentity] = useState('local');
  const [profileOpen, setProfileOpen] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [detailView, setDetailView] = useState(null);
  const [plannerSession, setPlannerSession] = useState({
    selectedMeals: null,
    caloriesPerMeal: 450,
    activeObjective: "balanced",
  });
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    const refresh = () => setToday(localDateKey());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const todayEntries = useMemo(() => entries.filter((entry) => entry.date === today), [entries, today]);
  const totals = useMemo(() => ({ ...mealTotals(todayEntries, recipesById), ...mealTotalBounds(todayEntries, recipesById) }), [recipesById, todayEntries]);
  const complete = isDayComplete(dayRecords, entries, today);

  const persist = async (nextProfile, nextEntries, nextDayRecords = dayRecords, imported = {customRecipes,customRecipeDetails}) => {
    const target=cloud.current;if(!target||saving.current){setStorageError('The cloud record is still loading or a save is in progress. Please retry.');return false;}
    if(pendingCloud&&nextEntries!==pendingCloud.record.entries){setStorageError('Retry or download the unsynced draft before saving another change.');return false;}
    saving.current=true;setSyncStatus('Saving to Supabase…');
    const record={profile:nextProfile,entries:nextEntries,dayRecords:nextDayRecords,...imported};
    // Keep recoverable input under this account only, never import another account's local history.
    const draft={record,version:target.version};
    try{localStorage.setItem('renalsync-pending:'+target.owner,JSON.stringify(draft));}catch{}
    try{
      const saved=await target.client.save(record,target.version);
      if(cloud.current!==target)return false;
      target.version=saved.updated_at;
      try{localStorage.removeItem('renalsync-pending:'+target.owner);}catch{}
      setPendingCloud(null);setStorageError('');setSyncStatus('Saved to Supabase · '+new Date(saved.updated_at).toLocaleTimeString());return true;
    }catch(error){if(cloud.current===target){setPendingCloud(draft);setStorageError(error.message);setSyncStatus('Not synced. Your confirmed input is retained for retry.');}return false;}
    finally{saving.current=false;}
  };
  async function retryPending(){
    const target=cloud.current,draft=pendingCloud;if(!target||!draft)return;
    if(draft.version!==target.version){setStorageError('The cloud has newer changes. Download the retained draft before combining it with the latest record.');return;}
    if(await persist(draft.record.profile,draft.record.entries,draft.record.dayRecords,{customRecipes:draft.record.customRecipes||[],customRecipeDetails:draft.record.customRecipeDetails||{}}))applyRecord(draft.record);
  }
  function downloadPending(){const url=URL.createObjectURL(new Blob([JSON.stringify(pendingCloud?.record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='renalsync-unsynced-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  const toggleComplete = async () => {
    const next = { ...dayRecords, [today]: complete ? {...dayRecords[today],completedAt:null,signature:null} : {
      ...dayRecords[today],
      completedAt: new Date().toISOString(), signature: daySignature(entries, today), profile: { ...profile },
    } };
    if (await persist(profile, entries, next)) setDayRecords(next);
  };

  const addRecipes = async (items) => {
    const nextByMeal = new Map();
    const nextItems = items.map(({ recipeId, servings, meal, time, conversation, inputMethod }, index) => {
      const sortOrder = nextByMeal.get(meal) ?? nextSortOrder(entries, today, meal);
      nextByMeal.set(meal, sortOrder + 1);
      return {
        id: `recipe-${Date.now()}-${index}`,
        recordedAt: new Date().toISOString(),
        date: today,
        source: "recipe",
        ...(recipesById[recipeId]?.imported ? {source:'custom',customFood:{...recipesById[recipeId],method:'imported',methodLabel:'Imported recipe · nutrients unknown'}} : {}),
        recipeId,
        servings,
        meal,
        time: time || new Date().toTimeString().slice(0,5),
        timeSource: time ? 'user-recorded' : 'recording-time',
        ...(conversation ? {conversation, inputMethod, confirmedAt:new Date().toISOString()} : {}),
        sortOrder,
      };
    });
    const next = [...entries, ...nextItems];
    if (!await persist(profile, next)) return false;
    setEntries(next);
    setMealDialog({ open: false, recipeId: null, initialMeal: null });
    setActiveTab("today");
  };

  const addCustomFood = async ({ customFood, servings, meal, time, conversation, inputMethod }) => {
    const next = [...entries, {
      id: `outside-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      date: today,
      source: "custom",
      customFood,
      servings,
      meal,
      time: time || new Date().toTimeString().slice(0,5),
      timeSource: time ? 'user-recorded' : 'recording-time',
        ...(conversation ? {conversation, inputMethod, confirmedAt:new Date().toISOString()} : {}),
      sortOrder: nextSortOrder(entries, today, meal),
    }];
    if (!await persist(profile, next)) return false;
    setEntries(next);
    setActiveTab("today");
    return true;
  };

  const saveVoiceMeal = async (batch) => {
    const next=appendVoiceMeal(entries,batch,today);
    if(next===entries)return true;
    if(!await persist(profile,next))return false;
    setEntries(next);return true;
  };

  const reviewMeal = async (meal, status, conversation) => {
    const next = {...dayRecords,[today]:{...dayRecords[today],mealReviews:{...dayRecords[today]?.mealReviews,[meal]:{status,conversation,reviewedAt:new Date().toISOString()}}}};
    if (!await persist(profile,entries,next)) return false;
    setDayRecords(next); return true;
  };

  const removeEntry = async (id) => {
    const next = entries.filter((entry) => entry.id !== id);
    if (!await persist(profile, next)) return false;
    setEntries(next);
  };

  const saveProfile = async (nextProfile) => {
    if (!await persist(nextProfile, entries)) return false;
    setProfile(nextProfile);
    setProfileOpen(false);
  };

  const addPlan = async (items) => {
    const mealNames = ["Breakfast", "Lunch", "Dinner", "Snack"];
    const nextByMeal = new Map();
    const nextItems = items.map((item, index) => {
      const meal = item.meal || mealNames[index % mealNames.length];
      const sortOrder = nextByMeal.get(meal) ?? nextSortOrder(entries, today, meal);
      nextByMeal.set(meal, sortOrder + 1);
      return {
        id: `plan-${Date.now()}-${index}`,
        date: today,
        source: "recipe",
        recipeId: item.recipeId || item.id,
        servings: item.servings || 1,
        meal,
        time: mealTimes[meal],
        sortOrder,
      };
    });
    const next = [...entries, ...nextItems];
    if (!await persist(profile, next)) return false;
    setEntries(next);
    setActiveTab("today");
  };

  const openRecipeDetails = (recipeOrEntry, returnTab = "today") => {
    const recipeId = recipeOrEntry.recipeId || recipeOrEntry.id;
    if (!recipeId) return;
    setDetailView({
      recipeId,
      servings: recipeOrEntry.servings || 1,
      returnTab,
    });
    setActiveTab("recipe-detail");
  };

  const openMealDialog = (recipeId = null, initialMeal = null) => {
    setMealDialog({ open: true, recipeId, initialMeal });
  };

  const reorderMealEntry = async ({ entryId, targetMeal, targetEntryId = null, targetIndex = null }) => {
    const next = reorderMealEntries(entries, today, { entryId, targetMeal, targetEntryId, targetIndex });
    if (next === entries) return;
    if (!await persist(profile, next)) return false;
    setEntries(next);
  };

  const navigateTo = (tab) => {
    setActiveTab(tab);
    if (tab !== "recipe-detail") setDetailView(null);
  };

  const isTabActive = (tab) => activeTab === tab
    || (activeTab === "recipe-detail" && detailView?.returnTab === tab);

  return (
    <div className={careSession ? "app-shell" : "auth-shell"}>
      {!careSession && <AuthLanding googleAvailable={googleAvailable} page={authPage} onNavigate={navigateAuth} />}
      <div hidden={careSession ? !careOpen && activeTab!=='rd' && authPage!=='care-invite' : ['home','how-it-works'].includes(authPage)}><CareConnection onInvitationCount={setCareInvites} onGoogleAvailability={setGoogleAvailable} requestedMode={authPage} onAuthModeChange={navigateAuth} mode={activeTab==='rd'?'rd':'patient'} getRecord={()=>({profile,entries,dayRecords})} onSessionChange={connectSession} onSync={()=>connectSession(careSession)} syncStatus={syncStatus} rdContent={sharedRecord ? <RDDashboard key={sharedIdentity} entries={sharedRecord.entries} recipesById={Object.fromEntries([...baseRecipes,...(sharedRecord.customRecipes || [])].map(r=>[r.id,r]))} profile={sharedRecord.profile} sharedIdentity={sharedIdentity} dayRecords={sharedRecord.dayRecords} /> : null} onReviewRecord={(record,meta)=>{setSharedRecord(record);setSharedIdentity(meta?.ownerId || 'local');}} /></div>
      {careSession && <div className="storage-alert" role="status">{syncStatus}{!cloudReady&&<button onClick={()=>connectSession(careSession)}>Retry connection</button>}{pendingCloud&&<><button onClick={retryPending}>Retry unsynced save</button><button onClick={downloadPending}>Download retained draft</button></>}</div>}
      {careSession && cloudReady && <>

      <header className="topbar">
        <button className="logo-button" type="button" onClick={() => navigateTo("today")}><Logo /></button>
        <nav aria-label="Primary navigation">
          <button className={isTabActive("today") ? "active" : ""} type="button" onClick={() => navigateTo("today")}><CalendarDays /> Today</button>
          <button className={isTabActive("planner") ? "active" : ""} type="button" onClick={() => navigateTo("planner")}><Utensils /> Plan</button>
          <button className={isTabActive("recipes") ? "active" : ""} type="button" onClick={() => navigateTo("recipes")}><BookOpen /> Recipes</button>
          <button className={activeTab === "history" ? "active" : ""} type="button" onClick={() => navigateTo("history")}><History /> History</button>
          <button className={activeTab === "rd" ? "active" : ""} type="button" onClick={() => navigateTo("rd")}><BookOpen /> RD dashboard</button>
          <button type="button" onClick={() => setProfileOpen(true)}><CircleUserRound /> Profile</button>
        </nav>
        <div className="sidebar-profile"><button className="avatar-button" type="button" onClick={() => setProfileOpen(true)} aria-label="Open profile">{profile.name.slice(0, 1).toUpperCase()}</button><div><strong>{profile.name}</strong><span>Your nutrition profile</span></div></div>
      </header>

      {storageError && !mealDialog.open && !customDialog && !profileOpen && <p className="storage-alert" role="alert">{storageError}</p>}
      {careInvites>0&&activeTab!=='rd'&&!careOpen&&<div className="care-invite-banner"><strong>{careInvites} care invitation{careInvites===1?'':'s'}</strong><span>Review who would like to connect with you.</span><button onClick={()=>{setCareOpen(true);window.scrollTo(0,0);}}>Review invitation</button></div>}
      <section className="assist-launch" aria-label="Food logging tools" hidden={activeTab==='rd'}>
        {!voiceOpen && <div className="voice-feature"><div className="voice-feature-icon"><Mic size={30} /></div><div className="voice-feature-copy"><span className="feature-eyebrow">YOUR VOICE, LESS TYPING</span><h2>Say it. Review it. Log it.</h2><p>Tell us what you ate, or follow a recipe hands-free.</p></div><button className="voice-feature-button" type="button" aria-expanded={voiceOpen} onClick={()=>setVoiceOpen(!voiceOpen)}><Mic size={20} />{voiceOpen?'Close voice assistant':'Voice Assistant'}<ChevronRight size={20} /></button></div>}
        <div className="assist-secondary"><button type="button" onClick={()=>setUsdaDialog(true)}>Find a USDA food</button><button type="button" onClick={()=>setCareOpen(!careOpen)}>{careSession ? "Account & care sharing" : "Sign in / Create account"}</button><button type="button" onClick={()=>setImportOpen(!importOpen)}>Import recipe</button></div>
      </section>
      {importOpen && <RecipeImport onClose={()=>setImportOpen(false)} onImport={async({recipe,details})=>{const nextRecipes=[...customRecipes,recipe],nextDetails={...customRecipeDetails,[recipe.id]:details};if(!await persist(profile,entries,dayRecords,{customRecipes:nextRecipes,customRecipeDetails:nextDetails}))return false;setCustomRecipes(nextRecipes);setCustomRecipeDetails(nextDetails);navigateTo('recipes');return true;}} />}

      {voiceOpen && <VoiceAssistant profile={profile} recipeDetails={recipeDetails} onSaveMeal={saveVoiceMeal} autoStart key={`${careSession?.account?.id || "local"}-${today}`} entries={entries} date={today} mealReviews={dayRecords[today]?.mealReviews || {}} onReviewMeal={reviewMeal} onSignIn={()=>{setCareOpen(true);setTimeout(()=>document.getElementById("care-connection-title")?.scrollIntoView({behavior:"smooth",block:"start"}),0);}} onClose={()=>setVoiceOpen(false)} accessToken={careSession?.accessToken} recipes={recipes} recipe={detailView?recipesById[detailView.recipeId]:null} details={detailView?recipeDetails[detailView.recipeId]:null} onAddFood={payload=>payload.recipeId?addRecipes([payload]):addCustomFood(payload)} />}
      {activeTab === "today" && <TodayView
        profile={profile}
        entries={todayEntries}
        recipesById={recipesById}
        totals={totals}
        complete={complete}
        onToggleComplete={toggleComplete}
        onOpenMeal={openMealDialog}
        onOpenCustom={() => setCustomDialog(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenRecipe={(entry) => openRecipeDetails(entry, "today")}
        onRemove={removeEntry}
        onReorder={reorderMealEntry}
      />}
      {activeTab === "planner" && <PlannerView recipes={recipes} recipeDetails={recipeDetails} profile={profile} todayEntries={todayEntries} todayTotals={totals} plannerSession={plannerSession} onPlannerSessionChange={setPlannerSession} onAddPlan={addPlan} onOpenRecipe={(recipe) => openRecipeDetails(recipe, "planner")} />}
      {activeTab === "recipes" && <RecipeLibrary recipes={recipes} details={recipeDetails} onChoose={(recipe) => openMealDialog(recipe.id)} onOpenRecipe={(recipe) => openRecipeDetails(recipe, "recipes")} />}
      {activeTab === "history" && <HistoryView entries={entries} recipesById={recipesById} profile={profile} dayRecords={dayRecords} />}

      {activeTab === "recipe-detail" && detailView && (
        <RecipeDetailView
          recipe={recipesById[detailView.recipeId]}
          details={recipeDetails[detailView.recipeId]}
          servings={detailView.servings}
          backLabel={detailReturnLabels[detailView.returnTab] || detailReturnLabels.today}
          onBack={() => navigateTo(detailView.returnTab || "today")}
        />
      )}

      <footer className="medical-footer"><Info size={20} strokeWidth={1.8} /><span>Other nutrient consideration (Ca, Phos, K) should be made individually based on medical conditions. Targets should be reviewed with your kidney care team. This app does not diagnose kidney disease.</span></footer>

      <AddMealModal open={mealDialog.open} recipes={recipes} initialRecipeId={mealDialog.recipeId} initialMeal={mealDialog.initialMeal} todayTotals={totals} profile={profile} saveError={storageError} onClose={() => setMealDialog({ open: false, recipeId: null, initialMeal: null })} onAdd={addRecipes} />
      <CustomFoodModal open={customDialog} saveError={storageError} onClose={() => setCustomDialog(false)} onAdd={addCustomFood} />
      <UsdaFoodModal open={usdaDialog} onClose={() => setUsdaDialog(false)} onAdd={addCustomFood} />
      <ProfileDrawer open={profileOpen} profile={profile} saveError={storageError} onClose={() => setProfileOpen(false)} onSave={saveProfile} />
      </>}
    </div>
  );
}

function TodayView({ profile, entries, recipesById, totals, complete, onToggleComplete, onOpenMeal, onOpenCustom, onOpenProfile, onOpenRecipe, onRemove, onReorder }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const lowSodiumIds = ["roasted-garlic", "quinoa-with-black-beans-and-avocado"];
  const ideas = lowSodiumIds.map((id) => recipesById[id]).filter(Boolean);
  const preferences = normalizeNutrientPreferences(profile);
  const coverage = nutrientCoverage(entries, recipesById);

  return (
    <main className="dashboard-layout">
      <section className="dashboard-main">
        <header className="dashboard-heading">
          <div><h1>{greeting}, {profile.name}</h1><p>Record what you ate. See how it compares with your saved targets.</p></div>
          <span><CalendarDays size={20} /> {displayDate}</span>
        </header>
        <div className="dashboard-actions">
          <button className="primary-button" type="button" onClick={() => onOpenMeal()}><Plus size={20} /> Add a meal</button>
          <button className="secondary-button" type="button" onClick={onOpenCustom}><PackagePlus size={20} /> Log outside food</button>
          <button className="secondary-button" type="button" onClick={onOpenProfile}><Settings2 size={20} /> Adjust targets</button>
        </div>
        <section className="daily-record-summary" aria-label="Daily recording summary">
          <div><span>Energy recorded</span><strong>{formatAmount(totals.calories)} <small>kcal</small></strong><small>{entries.length} food items · {totals.estimatedCount} estimated</small></div>
          <div><strong>{complete ? "Recording complete" : "Recording in progress"}</strong><p>{complete ? "You confirmed all food and drinks for today. This does not certify nutritional adequacy." : "Totals reflect logged foods only. Include drinks, sauces and snacks before confirming."}</p><button className="secondary-button" type="button" disabled={!entries.length} onClick={onToggleComplete}>{complete ? "Reopen today's record" : "I've logged everything today"}</button></div>
        </section>
        <div className="nutrient-stack">
          {preferences.trackedNutrients.includes('sodium') && <NutrientProgress type="sodium" value={totals.sodium} target={profile.sodiumTargetMg} complete={complete} estimated={totals.estimatedCount > 0} />}
          {preferences.trackedNutrients.includes('protein') && <NutrientProgress type="protein" value={totals.protein} range={{ min: profile.proteinMinG, max: profile.proteinMaxG }} complete={complete} estimated={totals.estimatedCount > 0} />}
          {NUTRIENTS.filter(n=>preferences.trackedNutrients.includes(n.key)&&!['sodium','protein'].includes(n.key)).map(n=>{const info=coverage[n.key];const target=preferences.nutrientTargets[n.key];return <section className="additional-nutrient" key={n.key}><strong>{n.label}</strong><span>{entries.length ? formatAmount(info.total,2) : '0'} {n.unit}</span><small>{entries.length&&!info.complete?`Known subtotal ${formatAmount(info.knownSubtotal,2)} ${n.unit} · ${info.knownCount}/${info.itemCount} items have data`:'Recorded foods only'}{target && ` · Saved target: ${target.min ?? '—'}–${target.max ?? '—'} ${n.unit}/day`}</small></section>;})}
        </div>
        {totals.estimatedCount > 0 && <p className="estimate-note">Includes estimated food matches. Actual preparation and portions may differ. Unknown nutrients are not counted as zero.{entries.some(entry=>entry.customFood?.method==='unpackaged') && <> User-set ranges: sodium {formatAmount(totals.lower.sodium, 2)}–{formatAmount(totals.upper.sodium, 2)} mg; protein {formatAmount(totals.lower.protein, 2)}–{formatAmount(totals.upper.protein, 2)} g. These are planning assumptions, not measured confidence intervals.</>}</p>}
        <TodayMeals entries={entries} recipesById={recipesById} onAddMeal={(meal) => onOpenMeal(null, meal)} onOpenRecipe={onOpenRecipe} onRemove={onRemove} onReorder={onReorder} />
      </section>

      <aside className="dashboard-rail">
        <section className="idea-list"><header><h2>Low-sodium ideas</h2><button type="button" onClick={() => onOpenMeal()}>View all</button></header>{ideas.map((recipe) => <button className="idea-row" type="button" key={recipe.id} onClick={() => onOpenMeal(recipe.id)}>{recipeImages[recipe.id] ? <img src={recipeImages[recipe.id]} alt="" loading="lazy" decoding="async" /> : <span className="recipe-placeholder">{recipe.name.slice(0, 1)}</span>}<span><strong>{recipe.name}</strong><small>{formatAmount(recipe.sodium, 1)} mg sodium · {formatAmount(recipe.protein, 1)} g protein</small></span><ChevronRight size={19} /></button>)}</section>
        <section className="plan-summary">
          <header><h2>Your saved targets</h2><button type="button" onClick={onOpenProfile}>Edit</button></header>
          <p className="field-note">{profile.useGuidelineProteinRange ? "Guideline starting values" : "User-entered values"} · care-team review is not verified.</p>
          <p className="plan-context">{profile.condition} · CKD {profile.stage} · {formatAmount(profile.weightKg, 1)} kg</p>
          <div className="plan-detail"><span className="plan-icon"><Target size={21} /></span><div><strong>Sodium maximum</strong><small>Daily upper limit</small></div><b>{formatAmount(profile.sodiumTargetMg)} mg/day</b></div>
          <div className="plan-detail protein-detail"><span className="plan-icon"><Scale size={21} /></span><div><strong>Protein range</strong><small>{profile.useGuidelineProteinRange ? "Weight-based starting point" : "Custom saved target"}</small></div><b>{formatAmount(profile.proteinMinG)}–{formatAmount(profile.proteinMaxG)} g/day</b></div>
          <div className="plan-detail"><span className="plan-icon"><CircleUserRound size={21} /></span><div><strong>Treatment status</strong><small>Changes target logic</small></div><b>{profile.treatment === "dialysis" ? "Dialysis" : "Not on dialysis"}</b></div>
          <a className="source-button" href="https://kdigo.org/guidelines/autosomal-dominant-polycystic-kidney-disease-adpkd/" target="_blank" rel="noreferrer">Review source guidance <ChevronRight size={18} /></a>
        </section>
      </aside>
    </main>
  );
}
