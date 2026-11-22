import {nutrientCoverage,detailedNutritionFor} from './nutrition.js';
import {NUTRIENT_KEYS,normalizeNutrientPreferences} from './nutrientCatalog.js';
import {isUnspecifiedFood, resolveEatenPortion, usdaFoodSnapshot, householdPortionLabel, validHouseholdPortion} from './usdaSelection.js';
const scaled=(food,factor)=>Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,typeof food[k]==='number'&&Number.isFinite(food[k])&&food[k]>=0?food[k]*factor:null]));
export function createFoodGuide({recipes=[],details={},getContext=()=>({}),fetcher=fetch,onRecipe=()=>{},id=()=>crypto.randomUUID()}){
 const sources=new Map(),foods=new Map(),inspected=new Set(),retrievedRecipes=new Set();let selected=null;let searches=0;
 const remember=value=>{const source_ref=id();sources.set(source_ref,structuredClone(value));return{source_ref,name:value.name,portion:value.servingDescription,nutrition:value.method==='unmeasured'?'unknown':'source-based estimate',requires_match_confirmation:true,matchType:value.matchType||'candidate',instruction:`Read the matched food and source portion to the user before preparing a meal. ${value.matchType==='unspecified'?'This FNDDS candidate has unspecified preparation details: explain that it is an unspecified-food estimate and get the user to confirm it fits. ':''}Never describe an estimate as measured. Save only after a fresh confirmation of the meal summary.`};};
 async function run(name,args){
  if(name==='search_foods'){
   const q=String(args.query||'').trim();if(!q||q.length>120)throw Error('Use a short food name.');
   if(searches>=8)return {foods:[],instruction:'Search limit reached for this call. Ask for a label or retain the description with unknown nutrients. Do not search again.'};
   const search=async query=>{searches++;const r=await fetcher('/api/fdc-search?'+new URLSearchParams({q:query,pageSize:6,dataTypes:'Foundation,SR Legacy,Survey (FNDDS),Branded'}),{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error('Food search unavailable. Keep the description with unknown nutrients.');return(data.foods||[]).filter(f=>f.basis==='per100g');};
   let matches=await search(q),relaxed=false;
   const shorter=q.toLowerCase().replace(/\b(plain|without|with|salt|unsalted|please|some|a|the)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
   if(!matches.length&&shorter&&shorter!==q.toLowerCase()&&searches<8){matches=await search(shorter);relaxed=true;}
   return {relaxed,foods:matches.map(f=>{inspected.delete(String(f.fdcId));foods.set(String(f.fdcId),f);return{fdc_id:f.fdcId,name:f.description,dataType:f.dataType||null,matchType:isUnspecifiedFood(f)?'unspecified':'candidate',portions:(f.portions||[]).slice(0,10)};}),instruction:'These are candidates, not confirmed matches. A relaxed search may differ in salt or preparation. Ask which preparation/brand fits. FNDDS NFS means details are unspecified: offer it only as a user-confirmed estimate, never as an exact match. Use inspect_food for portions. No match is acceptable; never force a cookbook recipe. After two unsuccessful queries for one food, clarify or retain unknown nutrients.'};
  }
  if(name==='inspect_food'){
   if(!foods.has(String(args.fdc_id)))throw Error('Search for this food first.');
   const key=String(args.fdc_id);inspected.delete(key);
   const r=await fetcher('/api/fdc-food?fdcId='+encodeURIComponent(args.fdc_id),{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok||!data.food||data.food.basis!=='per100g'||String(data.food.fdcId)!==key||!data.food.nutrients||!Array.isArray(data.food.portions))throw Error('Food details unavailable or identity does not match.');foods.set(key,data.food);inspected.add(key);
   return {fdc_id:data.food.fdcId,name:data.food.description,dataType:data.food.dataType||null,matchType:isUnspecifiedFood(data.food)?'unspecified':'candidate',portions:data.food.portions.flatMap((p,index)=>validHouseholdPortion(p)?[{index,...p,label:householdPortionLabel(p)}]:[]),instruction:'Prefer a source household portion. Quantity multiplies that ENTIRE labeled source portion, including its stated amount. Otherwise use only the user stated gram weight. Do not invent grams from a bowl or plate. Ask one short question if the portion or preparation is unclear.'};
  }
  if(name==='match_food'){
   const food=foods.get(String(args.fdc_id));if(!food||!inspected.has(String(args.fdc_id)))throw Error('Search and inspect the food first.');
   if(args.grams != null && args.portion_index != null)throw Error('Choose either the source household portion or measured grams.');
   const portion=resolveEatenPortion(food,args.grams===null?{kind:'household',portionIndex:args.portion_index,quantity:args.quantity}:{kind:'grams',grams:args.grams});
   return remember({...usdaFoodSnapshot(food,portion),sourceDescription:'USDA food candidate; save only after the user confirms the matched food and personal portion'});
  }
  if(name==='usual_foods'){
   const {entries=[]}=getContext();const seen=new Set();const recent=[];
   for(const entry of [...entries].reverse()){
    const raw=entry.source==='custom'?entry.customFood:recipes.find(r=>r.id===entry.recipeId);if(!raw?.name||seen.has(raw.name))continue;seen.add(raw.name);
    const amounts=detailedNutritionFor(raw,entry.servings ?? 1);
    const food={...raw,...amounts,...(raw.method==='unpackaged'&&raw.baseEstimate?{baseEstimate:{...amounts}}:{}),...(typeof raw.grams==='number'?{grams:raw.grams*(entry.servings ?? 1)}:{}),servingDescription:`Previously: ${entry.servings ?? 1} × ${raw.servingDescription||'source serving'}`,method:raw.method||'recipe-estimate'};
    recent.push({...remember(food),previousMeal:entry.meal});if(recent.length===4)break;
   }
   return {foods:recent,instruction:'These are previous records, not today intake. Ask whether food, preparation and quantity are the same and already eaten before reuse. Changed portions require a fresh match.'};
  }
  if(name==='find_recipes'){
   const terms=String(args.query||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2).slice(0,12);
   const found=recipes.map(r=>({r,score:terms.reduce((n,t)=>n+(JSON.stringify([r.name,details[r.id]?.ingredients]).toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
   const {entries=[],date,profile={}}=getContext();const today=entries.filter(e=>e.date===date);const coverage=nutrientCoverage(today,Object.fromEntries(recipes.map(r=>[r.id,r])));
   const targets={...normalizeNutrientPreferences(profile).nutrientTargets};if(!targets.sodium&&typeof profile.sodiumTargetMg==='number')targets.sodium={max:profile.sodiumTargetMg};
   const checks=r=>Object.entries(targets).filter(([,t])=>Number.isFinite(t.max)).map(([key,t])=>({nutrient:key,max:t.max,knownIntake:coverage[key]?.knownSubtotal??0,complete:today.length>0&&coverage[key]?.complete===true,recipePerServing:r[key]??null,exceedsKnownBudget:typeof r[key]==='number'&&r[key]+(coverage[key]?.knownSubtotal??0)>t.max}));
   found.sort((a,b)=>Number(checks(a.r).some(c=>c.exceedsKnownBudget))-Number(checks(b.r).some(c=>c.exceedsKnownBudget))||b.score-a.score);
   return {recipes:found.slice(0,3).map(({r})=>{retrievedRecipes.add(r.id);return{id:r.id,name:r.name,targetChecks:checks(r),servingSize:details[r.id]?.servingSize,ingredients:details[r.id]?.ingredients,calories:r.calories??null,sodium:r.sodium??null,protein:r.protein??null};}),instruction:'For food already eaten, ask if this is the same recipe with unchanged ingredients and confirm the personal source servings, then use recipe_portion. For cooking, open the chosen recipe. Compare saved targets using targetChecks: incomplete intake or missing recipe nutrients cannot establish a safe remaining budget. These match ingredients, not clinical suitability. Never say safe for a condition.'};
  }
  if(name==='open_recipe'){
   const recipe=recipes.find(r=>r.id===args.recipe_id),detail=details[args.recipe_id];if(!recipe||!detail?.steps?.length)throw Error('No source cooking instructions available.');selected={recipe,detail};onRecipe({id:recipe.id,name:recipe.name,...detail});
   return {id:recipe.id,name:recipe.name,...detail,instruction:'Read one source step at a time and wait for the user. Keep track of ingredient changes. Opening or finishing cooking NEVER means eaten. When ready ask whether they actually ate it and their own portion. Modified recipes must be recorded from actual ingredients or as unknown, not unchanged recipe nutrition.'};
  }
  if(name==='recipe_portion'){
   const recipe=selected?.recipe.id===args.recipe_id?selected.recipe:retrievedRecipes.has(args.recipe_id)?recipes.find(r=>r.id===args.recipe_id):null;
   const detail=recipe?details[recipe.id]:null;
   if(!recipe||!detail)throw Error('Find or open this recipe first.');
   if(!args.eaten||args.modified)throw Error('Do not log planned food. For modifications use actual ingredients or an unknown-nutrition description.');
   if(typeof args.servings!=='number'||!Number.isFinite(args.servings)||args.servings<=0||args.servings>30)throw Error('Clarify the personal portion against the source serving size.');
   return remember({name:recipe.name,...scaled(recipe,args.servings),method:'recipe-estimate',methodLabel:'Cookbook recipe · unchanged ingredients',sourceRecipeId:recipe.id,sourceLabel:recipe.name,sourceBasis:`${args.servings} source servings`,servingDescription:`${args.servings} × ${detail.servingSize||'source serving'}`,recipeSnapshot:{id:recipe.id,servings:args.servings,servingSize:detail.servingSize??null,ingredients:detail.ingredients??[],nutrients:scaled(recipe,1)}});
  }
  return null;
 }
 return{resolve:ref=>sources.has(ref)?structuredClone(sources.get(ref)):null,async run(name,args){try{return await run(name,args);}catch(e){return{status:'needs_clarification',message:e.message};}}};
}
