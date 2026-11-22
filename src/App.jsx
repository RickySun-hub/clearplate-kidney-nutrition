import FoodReviewNotice from './components/FoodReviewNotice';
import FoodReviewWorkspace from './components/FoodReviewWorkspace';
import FluidTracker from './components/FluidTracker';
import { samePendingRecord } from './utils/pendingRecord.js';
import { validateFluidRecords, moveLinkedFluids } from './utils/fluids.js';
import { signOutAccount } from './utils/accountNavigation.js';
import VoiceLogDrawer from './components/VoiceLogDrawer';
import EditFoodModal from './components/EditFoodModal';
import { recipeSnapshot } from './utils/entryEditing';
import { patientPageFromHash, writePatientPage, openWorkspacePage, workspaceReturnPage, hasWorkspaceReturn, createReturnClickGuard } from './utils/patientNavigation';
import { captureRDInvitation } from './utils/rdAccess';
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
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import AddMealModal from "./components/AddMealModal";
import CustomFoodModal from "./components/CustomFoodModal";
import HistoryView from "./components/HistoryView";
import Logo from "./components/Logo";
import NutrientProgress from "./components/NutrientProgress";
import Onboarding from "./components/Onboarding";
import RDAccessGate from "./components/RDAccessGate";
import MealIdeas from "./components/MealIdeas";
import { needsOnboarding } from "./utils/onboarding";
import { defaultAccountPage } from "./utils/accountNavigation";
import ProfileDrawer from "./components/ProfileDrawer";
import RecipeLibrary from "./components/RecipeLibrary";
import RecipeDetailView from "./components/RecipeDetailView";
import TodayMeals from "./components/TodayMeals";
import UsdaFoodModal from "./components/UsdaFoodModal";
import VoiceAssistant from "./components/VoiceAssistant";
import { appendVoiceMeal } from "./utils/liveMealTools.js";
import {captureCareInvitation} from './components/CareInvitations';
import CareConnection from "./components/CareConnection";
import AuthLanding from "./components/AuthLanding";
import RecipeImport from "./components/RecipeImport";
import { NUTRIENTS, normalizeNutrientPreferences } from "./utils/nutrientCatalog";
import { nutrientCoverage, formatNutrientCoverage, nutrientDisplay } from "./utils/nutrition";
import baseRecipes from "./data/recipes.json";
import baseRecipeDetails from "./data/recipeDetails.json";
import { defaultProfile } from "./data/seed";
import { mealTimes, nextSortOrder, normalizeEntryOrder, reorderMealEntries } from "./utils/meals";
import { formatAmount, localDateKey, mealTotals, mealTotalBounds } from "./utils/nutrition";
import { daySignature, isDayComplete } from "./utils/recording";

import { normalizeProfileDraft, profileForStorage } from "./utils/profile";

const appStorageKey = "clearplate-adpkd-mvp-v3";
const detailReturnLabels = {
  today: "today’s meals",
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

const localPreview = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('preview') === 'local';

export default function App({emailNotice=""}) {
  const [logoutNotice, setLogoutNotice] = useState('');
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const [dietitianDemoOpen, setDietitianDemoOpen] = useState(false);
  const [foodReviewBarcode,setFoodReviewBarcode]=useState('');
  const [foodReviewOpen, setFoodReviewOpen] = useState(false);
  const closingWorkspace = useRef(false);
  const returnClickGuard = useMemo(() => createReturnClickGuard(), []);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const previewKind = new URLSearchParams(window.location.search).get('as') === 'dietitian' ? 'dietitian' : 'patient';
  useEffect(() => {
    if (!localPreview) return;
    let live = true;
    import('./utils/localPreview.js').then(({ createLocalPreviewSession }) => {
      if (live) connectSession(createLocalPreviewSession(previewKind));
    });
    return () => { live = false; };
  }, []);
  const [authPage, setAuthPage] = useState(() => {const hash=window.location.hash.slice(1);if(patientPageFromHash(window.location.hash)||window.location.hash==='#food-submissions')return 'signin';if(captureRDInvitation())return 'rd-signin';const pending=captureCareInvitation();if(hash.startsWith('care-invite/'))return 'care-invite';if(/[?&](code|error)=/.test(window.location.search))return pending?'care-invite':'signin';return ['how-it-works','signin','signup','rd-signin'].includes(hash)?hash:'home';});
  function navigateAuth(page) {
    setAuthPage(page);
    try{if(page==='rd-signin')sessionStorage.setItem('renalsync-login-destination','rd');else if(page!=='google')sessionStorage.removeItem('renalsync-login-destination');}catch{}
    const hash = page === 'home' ? '' : `#${page === 'google' ? 'signin' : page}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const restore = () => { const hash = window.location.hash.slice(1); if(patientPageFromHash(window.location.hash)||window.location.hash==='#food-submissions'){setAuthPage('signin');}else if(captureRDInvitation()){setAuthPage('rd-signin');}else if(hash.startsWith('care-invite/')){captureCareInvitation();setAuthPage('care-invite');}else setAuthPage(['how-it-works','signin','signup','rd-signin'].includes(hash)?hash:'home'); };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
  }, []);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const initial = useMemo(() => localPreview ? { profile: defaultProfile, entries: [], raw: null } : loadInitialState(), []);

  const saving = useRef(false);
  const [customRecipes, setCustomRecipes] = useState(initial.customRecipes || []);
  const [customRecipeDetails, setCustomRecipeDetails] = useState(initial.customRecipeDetails || {});
  const recipes = useMemo(()=>[...baseRecipes,...customRecipes],[customRecipes]);
  const recipeDetails = useMemo(()=>({...baseRecipeDetails,...customRecipeDetails}),[customRecipeDetails]);
  const [importOpen,setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => patientPageFromHash(window.location.hash) || "today");
  const [profile, setProfile] = useState(initial.profile);
  const [entries, setEntries] = useState(initial.entries);
  const [dayRecords, setDayRecords] = useState(initial.dayRecords || {});
  const [mealDialog, setMealDialog] = useState({ open: false, recipeId: null, initialMeal: null });
  const [customDialog, setCustomDialog] = useState(false);
  const [usdaDialog, setUsdaDialog] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [actionNotice, setActionNotice] = useState('');
  const [careOpen, setCareOpen] = useState(false);
  const [careInvites,setCareInvites]=useState(0);
  const [careSession, setCareSession] = useState(null);
  const cloud=useRef(null),sessionEpoch=useRef(0);
  const [cloudReady,setCloudReady]=useState(false),[syncStatus,setSyncStatus]=useState(''),[pendingCloud,setPendingCloud]=useState(null);
  const [cloudLoadError,setCloudLoadError]=useState('');
  function applyRecord(record){setProfile(normalizeProfileDraft(record.profile));setEntries(normalizeEntryOrder(record.entries));setDayRecords(record.dayRecords||{});setCustomRecipes(record.customRecipes||[]);setCustomRecipeDetails(record.customRecipeDetails||{});}
  async function connectSession(session){
    returnClickGuard.reset();
    setOnboardingBusy(false);
    setProfileOpen(false);setMealDialog({open:false});setCustomDialog(false);setUsdaDialog(false);setImportOpen(false);setDetailView(null);setCareOpen(false);setDietitianDemoOpen(false);setFoodReviewOpen(false);setFoodReviewBarcode('');closingWorkspace.current=false;
    const epoch=++sessionEpoch.current;cloud.current=null;setCloudReady(false);setCloudLoadError('');setPendingCloud(null);setCareSession(session);setCareInvites(0);setVoiceOpen(false);setEditingEntry(null);setActionNotice('');setStorageError('');
    if(!session){if(patientPageFromHash(window.location.hash)||window.location.hash==='#food-submissions')window.history.replaceState(null,'',window.location.pathname+window.location.search+'#signin');setActiveTab('today');applyRecord({profile:defaultProfile,entries:[],dayRecords:{}});return;}
    let rdRequested=authPage==='rd-signin';try{rdRequested ||= sessionStorage.getItem('renalsync-login-destination')==='rd';sessionStorage.removeItem('renalsync-login-destination');}catch{}
    setSyncStatus('Loading your private cloud record…');
    try{const row=await session.client.own();if(epoch!==sessionEpoch.current)return;const record=row?.record||{profile:defaultProfile,entries:[],dayRecords:{}};
      cloud.current={client:session.client,version:row?.updated_at||null,owner:session.account.id,epoch};
      if (!record.profile.accountRole && (rdRequested || (localPreview && previewKind === 'dietitian'))) record.profile = {...record.profile, accountRole:'dietitian'};
      applyRecord(record);
      const page = defaultAccountPage(record.profile, patientPageFromHash(window.location.hash));
      setActiveTab(page);
      if (window.location.hash === '#food-submissions') setFoodReviewOpen(true);
      else if (page === 'rd') window.history.replaceState(null, '', window.location.pathname + window.location.search + '#rd/patients');
      else writePatientPage(page, window, true);
      setCloudReady(true);setSyncStatus(localPreview ? 'Saved on this device for preview.' : 'Your changes save automatically.');
      try{const draft=JSON.parse(localStorage.getItem('renalsync-pending:'+session.account.id));if(draft?.record)setPendingCloud(draft);}catch{}
    }catch(error){if(epoch===sessionEpoch.current){const message=error.message||'Your record could not be loaded. Please try again.';setSyncStatus(message);setCloudLoadError(message);}}
  }
  const [profileOpen, setProfileOpen] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [detailView, setDetailView] = useState(null);
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

  const saveTarget = cloud.current;
  const persist = async (nextProfile, nextEntries, nextDayRecords = dayRecords, imported = {customRecipes,customRecipeDetails}) => {
    const target=cloud.current;if(target!==saveTarget)return false;
    if(!target||saving.current){setStorageError('The cloud record is still loading or a save is in progress. Please retry.');return false;}
    const record={profile:nextProfile,entries:nextEntries,dayRecords:nextDayRecords,...imported};
    if(pendingCloud&&(pendingCloud.version!==target.version||!samePendingRecord(record,pendingCloud.record))){setStorageError('Use Retry unsynced save to save the retained version before making another change. Download the retained draft if the cloud has newer changes.');return false;}
    saving.current=true;setActionNotice('');setSyncStatus('Saving your changes…');
    // Keep recoverable input under this account only, never import another account's local history.
    const draft={record,version:target.version};
    try{localStorage.setItem('renalsync-pending:'+target.owner,JSON.stringify(draft));}catch{}
    try{
      const saved=await target.client.save(record,target.version);
      if(cloud.current!==target)return false;
      target.version=saved.updated_at;
      try{localStorage.removeItem('renalsync-pending:'+target.owner);}catch{}
      setPendingCloud(null);setStorageError('');setSyncStatus('Saved · '+new Date(saved.updated_at).toLocaleTimeString());return true;
    }catch(error){if(cloud.current===target){setPendingCloud(draft);setStorageError(error.message);setSyncStatus('Not synced. Your confirmed input is retained for retry.');}return false;}
    finally{saving.current=false;}
  };
  async function retryPending(){
    const target=cloud.current,draft=pendingCloud;if(!target||!draft)return;
    if(draft.version!==target.version){setStorageError('The cloud has newer changes. Download the retained draft before combining it with the latest record.');return;}
    const recoveredProfile=profileForStorage(draft.record.profile);
    if(await persist(recoveredProfile,draft.record.entries,draft.record.dayRecords,{customRecipes:draft.record.customRecipes||[],customRecipeDetails:draft.record.customRecipeDetails||{}})){
      applyRecord({...draft.record,profile:recoveredProfile});
      const page = defaultAccountPage(recoveredProfile);
      setActiveTab(page); setFoodReviewOpen(false);
      if(page === 'rd') window.history.replaceState(null,'',window.location.pathname+window.location.search+'#rd/patients');
      else writePatientPage(page,window,true);
    }
  }
  function downloadPending(){const url=URL.createObjectURL(new Blob([JSON.stringify(pendingCloud?.record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nepholio-unsynced-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  async function logOut(client = careSession?.client) {
    let logoutEpoch;
    const result = await signOutAccount(client, () => {
      void connectSession(null);
      logoutEpoch = sessionEpoch.current;
      setLogoutNotice('You have been logged out.');
      setConnectionGeneration(value => value + 1);
      window.history.replaceState(null, '', window.location.pathname + '#signin');
      setAuthPage('signin');
    });
    if (sessionEpoch.current === logoutEpoch && result.warning) setLogoutNotice(result.warning);
    return result;
  }
  async function saveFluids(date, fluids) {
    if (!validateFluidRecords(fluids)) throw Error('Invalid drink record.');
    const next = {...dayRecords, [date]: {...dayRecords[date], fluids, completedAt:null, signature:null}};
    if (!await persist(profile, entries, next)) return false;
    setDayRecords(next); return true;
  }

  const toggleComplete = async () => {
    const next = { ...dayRecords, [today]: complete ? {...dayRecords[today],completedAt:null,signature:null} : {
      ...dayRecords[today],
      completedAt: new Date().toISOString(), signature: daySignature(entries, today), profile: { ...profile },
    } };
    if (await persist(profile, entries, next)) setDayRecords(next);
  };

  const addRecipes = async (items) => {
    const nextByMeal = new Map();
    const nextItems = items.map(({ recipeId, servings, meal, time, date = today, customFood, conversation, inputMethod }, index) => {
      const sortOrder = nextByMeal.get(date + meal) ?? nextSortOrder(entries, date, meal);
      nextByMeal.set(date + meal, sortOrder + 1);
      return {
        id: `recipe-${Date.now()}-${index}`,
        recordedAt: new Date().toISOString(),
        date,
        source: "custom",
        customFood: customFood || recipeSnapshot(recipesById[recipeId], recipeDetails[recipeId]?.servingSize),
        ...(!customFood && recipesById[recipeId]?.imported ? {source:'custom',customFood:{...recipesById[recipeId],method:'imported',methodLabel:'Imported recipe · nutrients unknown'}} : {}),
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
    navigateTo("today");
    if (items.some(item => item.date && item.date !== today)) setActionNotice("Saved to the selected date. Open History to review your meal.");
    return true;
  };

  const addCustomFood = async ({ customFood, servings, meal, time, date = today, conversation, inputMethod }) => {
    const next = [...entries, {
      id: `outside-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      date,
      source: "custom",
      customFood,
      servings,
      meal,
      time: time || new Date().toTimeString().slice(0,5),
      timeSource: time ? 'user-recorded' : 'recording-time',
        ...(conversation ? {conversation, inputMethod, confirmedAt:new Date().toISOString()} : {}),
      sortOrder: nextSortOrder(entries, date, meal),
    }];
    if (!await persist(profile, next)) return false;
    setEntries(next);
    navigateTo("today");
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
    setEntries(next); setActionNotice('Food removed. The day needs a new completeness confirmation.');
  };

  const saveEditedEntry = async (updated) => {
    const previous = entries.find(entry => entry.id === updated.id);
    const nextDays = moveLinkedFluids(dayRecords, previous, updated);
    const next = entries.map(entry => entry.id === updated.id ? updated : entry);
    if (!await persist(profile, next, nextDays)) return false;
    setEntries(next); setDayRecords(nextDays); setEditingEntry(null);
    setActionNotice(`Food record saved for ${updated.date}. Check History for records on other dates.${(dayRecords[previous.date]?.fluids || []).some(record => record.entryId === previous.id) ? ' Linked fluid volume is unchanged; update it in Fluid intake if needed.' : ''}`);
    return true;
  };

  const saveProfile = async (nextProfile) => {
    if (!await persist(nextProfile, entries)) return false;
    setProfile(nextProfile);
    return true;
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

  const openWorkspace = (page) => {
    returnClickGuard.reset();
    closingWorkspace.current = false;
    openWorkspacePage(page, careSession?.account?.id);
    setProfileOpen(false); setVoiceOpen(false); setCareOpen(false);
    setFoodReviewOpen(page === 'food-submissions');
    if (page !== 'food-submissions') setActiveTab(page);
    window.scrollTo(0, 0);
  };
  const returnPage = workspaceReturnPage(careSession?.account?.id, profile.accountRole === 'dietitian');
  const returnLabel = `Back to ${{ today: 'Today', recipes: 'Recipes', history: 'History', connection: 'My dietitian', rd: 'dietitian workspace' }[returnPage]}`;
  const closeWorkspace = (event) => {
    if (closingWorkspace.current) return;
    returnClickGuard.arm(event);
    closingWorkspace.current = true;
    if (hasWorkspaceReturn(careSession?.account?.id)) window.history.back();
    else {
      if (returnPage === 'rd') window.history.replaceState(null, '', window.location.pathname + window.location.search + '#rd/patients');
      else writePatientPage(returnPage, window, true);
      setFoodReviewOpen(false); setCareOpen(false); setActiveTab(returnPage);
      closingWorkspace.current = false;
      window.scrollTo(0, 0);
    }
  };
  const navigateTo = (requested) => {
    returnClickGuard.reset();
    if (requested === 'connection' && profile.accountRole !== 'dietitian') return openWorkspace('connection');
    const tab = defaultAccountPage(profile, requested);
    if (tab === 'rd') window.history.pushState(null, '', window.location.pathname + window.location.search + '#rd/patients');
    else writePatientPage(tab);
    setActiveTab(tab); setFoodReviewOpen(false); closingWorkspace.current = false;
    if (tab !== activeTab) setVoiceOpen(false);
    setCareOpen(false); setImportOpen(false); setEditingEntry(null);
    window.scrollTo(0, 0);
    if (tab !== "recipe-detail") setDetailView(null);
  };

  useEffect(() => {
    const restorePage = () => {
      closingWorkspace.current = false;
      const isFoodReview = window.location.hash === '#food-submissions';
      setFoodReviewOpen(Boolean(careSession && isFoodReview));
      setProfileOpen(false); setCustomDialog(false); setMealDialog({open:false}); setDietitianDemoOpen(false);
      const page = patientPageFromHash(window.location.hash);
      const target = defaultAccountPage(profile, page);
      setActiveTab(target);
      if (careSession && !isFoodReview && target !== 'rd') writePatientPage(target, window, true);
      setDetailView(null); setVoiceOpen(false); setCareOpen(false); setImportOpen(false); setEditingEntry(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', restorePage);
    window.addEventListener('hashchange', restorePage);
    return () => { window.removeEventListener('popstate', restorePage); window.removeEventListener('hashchange', restorePage); };
  }, [profile.accountRole, careSession]);
  useEffect(() => { if (activeTab !== 'today') setVoiceOpen(false); }, [activeTab]);

  const isTabActive = (tab) => activeTab === tab
    || (activeTab === "recipe-detail" && detailView?.returnTab === tab);

  const onboarding = careSession && cloudReady && needsOnboarding(profile);
  async function saveOnboarding(nextProfile) {
    if(cloud.current!==saveTarget)return false;
    nextProfile = profileForStorage(nextProfile);
    setOnboardingBusy(true);
    try {
      if (!await persist(nextProfile, entries)) return false;
      setProfile(nextProfile);
      if (!needsOnboarding(nextProfile)) {
        const page = defaultAccountPage(nextProfile);
        setActiveTab(page); setFoodReviewOpen(false);
        if (page === 'rd') window.history.replaceState(null, '', window.location.pathname + window.location.search + '#rd/patients');
        else writePatientPage(page, window, true);
      }
      return true;
    } finally { if(cloud.current===saveTarget)setOnboardingBusy(false); }
  }
  return (
    <>
    {localPreview && <div className="local-preview-bar"><span><strong>Local preview</strong> · sample data on this device</span><nav aria-label="Preview controls"><a href="/?preview=local">Patient</a><a href="/?preview=local&as=dietitian&demo=1">Dietitian</a><button onClick={() => { const id = previewKind === 'dietitian' ? '10000000-0000-4000-8000-000000000002' : '10000000-0000-4000-8000-000000000001'; localStorage.removeItem('nepholio-local-preview-v1:' + id); window.location.reload(); }}>Restart this preview</button></nav></div>}
    <div onClickCapture={returnClickGuard.capture} className={onboarding ? 'onboarding-root' : careSession ? !cloudReady ? 'cloud-loading-shell' : activeTab === "rd" ? "rd-shell" : "app-shell" : "auth-shell"}>
      <Fragment key={'notices:' + (careSession?.account?.id || 'signed-out')}>
      {!careSession && !localPreview && <AuthLanding googleAvailable={googleAvailable} page={authPage} onNavigate={navigateAuth} />}
      {logoutNotice && <div className="revision-notice" role="status">{logoutNotice}<button type="button" onClick={()=>setLogoutNotice('')}>Dismiss</button></div>}
      {careSession && cloudReady && !onboarding && profile.accountRole === 'dietitian' && !foodReviewOpen && <FoodReviewNotice key={careSession.account.id} client={careSession.client} onOpen={()=>openWorkspace('food-submissions')} />}
      {foodReviewOpen && careSession && cloudReady && !onboarding && <FoodReviewWorkspace key={careSession.account.id} backLabel={returnLabel} initialBarcode={foodReviewBarcode} client={careSession.client} onBack={closeWorkspace} onAddFood={addCustomFood}/> }
      {dietitianDemoOpen && careSession && <><div className="workspace-return"><button type="button" onClick={()=>setDietitianDemoOpen(false)}>Back to my food journal</button><span>Dietitian demo · fictional patients only</span></div><RDAccessGate account={careSession.account} displayName="Demo dietitian" onSignOut={()=>logOut()} /></>}
      </Fragment>
      {!localPreview && <div hidden={foodReviewOpen || onboarding || (careSession && !cloudReady) || (careSession ? activeTab!=='connection' && !careOpen && activeTab!=='rd' && authPage!=='care-invite' : ['home','how-it-works'].includes(authPage))}><CareConnection onBack={closeWorkspace} backLabel={returnLabel} initialNotice={emailNotice} key={connectionGeneration} onSignOut={logOut} profileName={profile.name} onInvitationCount={setCareInvites} onGoogleAvailability={setGoogleAvailable} requestedMode={authPage} onAuthModeChange={navigateAuth} mode={cloudReady && profile.accountRole==='dietitian' && !onboarding ? 'rd' : 'patient'} onSessionChange={connectSession} onSync={()=>connectSession(careSession)} syncStatus={syncStatus} /></div>}
      <Fragment key={careSession?.account?.id || 'signed-out'}>
      {careSession && !cloudReady && <main className="cloud-record-loading" aria-busy={!cloudLoadError}>
        <Logo />
        {cloudLoadError ? <div className="cloud-record-error" role="alert"><h1>We couldn’t open your record.</h1><p>{cloudLoadError}</p><button className="primary-button" type="button" onClick={()=>connectSession(careSession)}>Retry connection</button></div> : <div className="cloud-record-progress" role="status" aria-label="Loading your workspace"><span className="cloud-record-spinner" aria-hidden="true" /><p>Opening your workspace…</p></div>}
      </main>}
      {careSession && cloudReady && pendingCloud && <div className="storage-alert" role="status">{syncStatus}<button onClick={retryPending}>Retry unsynced save</button><button onClick={downloadPending}>Download retained draft</button></div>}
      {onboarding && <Onboarding profile={profile} onDraft={saveOnboarding} onComplete={saveOnboarding} busy={onboardingBusy} error={storageError} />}
      {localPreview && careSession && cloudReady && !onboarding && profile.accountRole === 'dietitian' && !foodReviewOpen && <RDAccessGate displayName="Stacy" client={careSession.client} account={careSession.account} onSignOut={() => logOut()} />}
      {careSession && cloudReady && !onboarding && !foodReviewOpen && !dietitianDemoOpen && profile.accountRole !== 'dietitian' && <>

      <header className="topbar">
        <button className="logo-button" type="button" onClick={() => navigateTo("today")}><Logo /></button>
        <nav aria-label="Primary navigation">
          <button aria-current={isTabActive("today") ? "page" : undefined} className={isTabActive("today") ? "active" : ""} type="button" onClick={() => navigateTo("today")}><CalendarDays /> Today</button>
          <button aria-current={isTabActive("recipes") ? "page" : undefined} className={isTabActive("recipes") ? "active" : ""} type="button" onClick={() => navigateTo("recipes")}><BookOpen /> Recipes</button>
          <button aria-current={isTabActive("history") ? "page" : undefined} className={isTabActive("history") ? "active" : ""} type="button" onClick={() => navigateTo("history")}><History /> History</button>
          <button type="button" onClick={() => setProfileOpen(true)}><Settings2 /> Profile</button>
        </nav>
        <FoodReviewNotice key={careSession.account.id} client={careSession.client} onOpen={()=>{setFoodReviewBarcode('');openWorkspace('food-submissions');}} />
        <div className="sidebar-profile"><button className="avatar-button" type="button" onClick={() => setProfileOpen(true)} aria-label="Open profile">{profile.name?.slice(0, 1).toUpperCase() || "P"}</button><div><strong>{profile.name || "Your profile"}</strong><span>Your nutrition profile</span></div></div>
      </header>

      {storageError && !mealDialog.open && !customDialog && !profileOpen && <p className="storage-alert" role="alert">{storageError}</p>}
      {careInvites>0&&activeTab!=='rd'&&!careOpen&&<div className="care-invite-banner"><strong>{careInvites} care invitation{careInvites===1?'':'s'}</strong><span>Review who would like to connect with you.</span><button onClick={()=>{openWorkspace('connection');}}>Review invitation</button></div>}
      {actionNotice && <p className="action-notice" role="status">{actionNotice}<button onClick={() => setActionNotice('')} aria-label="Dismiss message">Dismiss</button></p>}
      {importOpen && <RecipeImport onClose={()=>setImportOpen(false)} onImport={async({recipe,details})=>{const nextRecipes=[...customRecipes,recipe],nextDetails={...customRecipeDetails,[recipe.id]:details};if(!await persist(profile,entries,dayRecords,{customRecipes:nextRecipes,customRecipeDetails:nextDetails}))return false;setCustomRecipes(nextRecipes);setCustomRecipeDetails(nextDetails);navigateTo('recipes');return true;}} />}

      {activeTab === "today" && voiceOpen && <VoiceLogDrawer onClose={() => setVoiceOpen(false)}><VoiceAssistant fullScreen autoStart profile={profile} recipeDetails={recipeDetails} onSaveMeal={saveVoiceMeal} logOnly key={`${careSession?.account?.id || "local"}-${today}`} entries={entries} date={today} mealReviews={dayRecords[today]?.mealReviews || {}} onReviewMeal={reviewMeal} onSignIn={()=>{openWorkspace('connection');}} accessToken={careSession?.accessToken} recipes={recipes} recipe={detailView?recipesById[detailView.recipeId]:null} details={detailView?recipeDetails[detailView.recipeId]:null} onAddFood={payload=>payload.recipeId?addRecipes([payload]):addCustomFood(payload)} /></VoiceLogDrawer>}
      {activeTab === "today" && <TodayView
        profile={profile}
        recipes={recipes}
        recipeDetails={recipeDetails}
        fluidRecords={dayRecords[today]?.fluids || []}
        today={today}
        onSaveFluids={saveFluids}
        onHistory={() => navigateTo("history")}
        entries={todayEntries}
        recipesById={recipesById}
        totals={totals}
        complete={complete}
        onToggleComplete={toggleComplete}
        onOpenMeal={openMealDialog}
        onOpenCustom={() => setCustomDialog(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenRecipe={(entry) => openRecipeDetails(entry, "today")}
        onEdit={setEditingEntry}
        onVoice={() => setVoiceOpen(true)}
        onUsda={() => setUsdaDialog(true)}
        onRemove={removeEntry}
        onReorder={reorderMealEntry}
      />}
      {activeTab === "recipes" && <RecipeLibrary key={careSession?.account?.id || "local"} accessToken={careSession?.accessToken} onImport={() => setImportOpen(true)} recipes={recipes} details={recipeDetails} onChoose={(recipe) => openMealDialog(recipe.id)} onOpenRecipe={(recipe) => openRecipeDetails(recipe, "recipes")} />}
      {localPreview && activeTab === 'connection' && <main className="preview-account"><h1>My dietitian</h1><p>This local preview saves only on this device. No account is connected and no invitations are sent.</p><button type="button" className="secondary-button" onClick={closeWorkspace}>{returnLabel}</button></main>}
      {activeTab === "history" && <HistoryView onSaveFluids={saveFluids} onEdit={setEditingEntry} entries={entries} recipesById={recipesById} profile={profile} dayRecords={dayRecords} />}

      {activeTab === "recipe-detail" && detailView && (
        <RecipeDetailView
          recipe={recipesById[detailView.recipeId]}
          details={recipeDetails[detailView.recipeId]}
          servings={detailView.servings}
          backLabel={detailReturnLabels[detailView.returnTab] || detailReturnLabels.today}
          onBack={() => navigateTo(detailView.returnTab || "today")}
        />
      )}

      <footer className="medical-footer"><Info size={20} strokeWidth={1.8} /><div><p>Other nutrient consideration (Ca, Phos, K) should be made individually based on medical conditions. Targets should be reviewed with your kidney care team. This app does not diagnose kidney disease. Clinical notes are informational and are not used as target-setting rules.</p><p>Some recipes may not yet have permission from their original publishers for use on this website.</p></div></footer>

      {editingEntry && <EditFoodModal key={editingEntry.id} recipeDetails={recipeDetails} entry={editingEntry} recipesById={recipesById} onSave={saveEditedEntry} onClose={() => setEditingEntry(null)} />}
      <AddMealModal recipeDetails={recipeDetails} open={mealDialog.open} recipes={recipes} initialRecipeId={mealDialog.recipeId} initialMeal={mealDialog.initialMeal} todayTotals={totals} profile={profile} saveError={storageError} onClose={() => setMealDialog({ open: false, recipeId: null, initialMeal: null })} onAdd={addRecipes} />
      <CustomFoodModal client={careSession?.client} onOpenLibrary={(draft)=>{setFoodReviewBarcode(draft?.barcode||'');setCustomDialog(false);openWorkspace('food-submissions');}} open={customDialog} saveError={storageError} onClose={() => setCustomDialog(false)} onAdd={addCustomFood} />
      <UsdaFoodModal open={usdaDialog} onClose={() => setUsdaDialog(false)} onAdd={addCustomFood} />
      <ProfileDrawer onOpenFoodReview={()=>{setFoodReviewBarcode('');openWorkspace('food-submissions');}} onSignOut={() => logOut()} onOpenDietitian={()=>{setProfileOpen(false);setDietitianDemoOpen(true);}} onOpenAccount={() => {setProfileOpen(false);navigateTo("connection");}} open={profileOpen} profile={profile} saveError={storageError} onClose={() => setProfileOpen(false)} onSave={saveProfile} />
      </>}
      </Fragment>
    </div>
    </>
  );
}

function TodayView({ fluidRecords, today, onSaveFluids, profile, recipes, recipeDetails, onHistory, entries, recipesById, totals, complete, onToggleComplete, onOpenMeal, onOpenCustom, onOpenProfile, onOpenRecipe, onRemove, onReorder, onEdit, onVoice, onUsda }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const preferences = normalizeNutrientPreferences(profile);
  const coverage = nutrientCoverage(entries, recipesById);

  return (
    <main className="dashboard-layout patient-today">
      <section className="dashboard-main">
        <header className="dashboard-heading">
          <button className="today-date" onClick={onHistory}><CalendarDays size={20} /> {displayDate}<ChevronRight size={17} /></button>
          <div><h1>{greeting}{profile.name ? `, ${profile.name}` : ""}.</h1><p>A little awareness, one meal at a time.</p></div>
        </header>
        <section className="today-overview tracked-nutrition-overview" aria-label="Today’s recorded nutrition">
          {preferences.trackedNutrients.includes('sodium') && <NutrientProgress empty={!entries.length} type="sodium" coverage={coverage.sodium} value={entries.length ? totals.sodium : null} target={profile.sodiumTargetMg} complete={complete} estimated={totals.estimatedCount > 0} />}
          {preferences.trackedNutrients.includes('protein') && <NutrientProgress empty={!entries.length} type="protein" coverage={coverage.protein} value={entries.length ? totals.protein : null} range={{ min: profile.proteinMinG, max: profile.proteinMaxG }} complete={complete} estimated={totals.estimatedCount > 0} />}
          {NUTRIENTS.filter(n=>preferences.trackedNutrients.includes(n.key)&&!['sodium','protein'].includes(n.key)).map(n=>{const info=coverage[n.key];const target=preferences.nutrientTargets[n.key];return <section className="additional-nutrient" key={n.key}><strong>{n.label}</strong><span>{formatNutrientCoverage(info,n.unit,2)}</span><small>{entries.length&&!info.complete?info.knownCount ? `Known subtotal ${formatAmount(info.knownSubtotal,2)} ${n.unit} · ${info.knownCount}/${info.itemCount} items have data` : 'No nutrient data for recorded foods':'Recorded foods only'}{target && ` · Saved target: ${target.min ?? '—'}–${target.max ?? '—'} ${n.unit}/day`}</small></section>;})}
          {!preferences.trackedNutrients.length && <p>No nutrients selected. <button type="button" className="text-button" onClick={onOpenProfile}>Choose nutrients in your profile</button></p>}
        </section>
        <section className="record-entry" aria-label="Record what you ate">
          <div className="record-entry-title"><h2>What did you eat?</h2><p>Speak or choose a food. Review before saving.</p></div>
          <div className="record-entry-buttons"><button className="primary-button voice-entry-highlight" type="button" onClick={onVoice}><Mic size={20} /> Speak</button><button className="primary-button" type="button" onClick={() => onOpenMeal()}><Plus size={20} /> Record food</button></div>
          <div className="record-entry-links"><button type="button" onClick={onUsda}>Search USDA foods</button><button type="button" onClick={onOpenCustom}>Enter a food label</button></div>
        </section>
        <FluidTracker key={today} date={today} records={fluidRecords} entries={entries} targetMl={profile.fluidTargetMl} onSave={onSaveFluids} />
        <TodayMeals entries={entries} recipesById={recipesById} onAddMeal={(meal) => onOpenMeal(null, meal)} onOpenRecipe={onOpenRecipe} onRemove={onRemove} onReorder={onReorder} onEdit={onEdit} />
        <section className="record-completeness"><div><strong>{complete ? 'Day confirmed' : 'Still recording your day?'}</strong><p>{complete ? 'You confirmed all food and drinks. You can reopen this day to make changes.' : 'Include snacks, drinks and sauces before confirming.'}</p></div><button className="secondary-button" disabled={!entries.length} onClick={onToggleComplete}>{complete ? 'Reopen today' : "I’ve logged everything"}</button></section>
        <MealIdeas recipes={recipes} recipeDetails={recipeDetails} profile={profile} onOpenRecipe={onOpenRecipe} onRecord={recipe => onOpenMeal(recipe.id)} />
        {totals.estimatedCount > 0 && <p className="estimate-note">Includes estimated food matches. Actual preparation and portions may differ. Unknown nutrients are not counted as zero.{entries.some(entry=>entry.customFood?.method==='unpackaged') && <> User-set ranges: sodium {formatAmount(totals.lower.sodium, 2)}–{formatAmount(totals.upper.sodium, 2)} mg; protein {formatAmount(totals.lower.protein, 2)}–{formatAmount(totals.upper.protein, 2)} g. These are planning assumptions, not measured confidence intervals.</>}</p>}

      </section>

      <aside className="dashboard-rail"><details className="saved-targets-details"><summary>Your saved targets & profile</summary>
        <section className="plan-summary">
          <header><h2>Your saved targets</h2><button type="button" onClick={onOpenProfile}>Edit</button></header>
          <p className="field-note">{profile.useGuidelineProteinRange ? "Guideline starting values" : "User-entered values"} · care-team review is not verified.</p>
          <p className="plan-context">{profile.condition} · CKD {profile.stage} · {formatAmount(profile.weightKg, 1)} kg</p>
          <div className="plan-detail"><span className="plan-icon"><Target size={21} /></span><div><strong>Sodium maximum</strong><small>Daily upper limit</small></div><b>{formatAmount(profile.sodiumTargetMg)} mg/day</b></div>
          <div className="plan-detail protein-detail"><span className="plan-icon"><Scale size={21} /></span><div><strong>Protein range</strong><small>{profile.useGuidelineProteinRange ? "Weight-based starting point" : "Custom saved target"}</small></div><b>{formatAmount(profile.proteinMinG)}–{formatAmount(profile.proteinMaxG)} g/day</b></div>
          <div className="plan-detail"><span className="plan-icon"><CircleUserRound size={21} /></span><div><strong>Treatment status</strong><small>Changes target logic</small></div><b>{profile.treatment === "dialysis" ? "Dialysis" : profile.treatment === "not-dialysis" ? "Not on dialysis" : "Not recorded"}</b></div>
          <a className="source-button" href="https://kdigo.org/guidelines/autosomal-dominant-polycystic-kidney-disease-adpkd/" target="_blank" rel="noreferrer">Review source guidance <ChevronRight size={18} /></a>
        </section>
      </details></aside>
    </main>
  );
}
