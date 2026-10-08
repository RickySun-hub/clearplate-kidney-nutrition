import {nutrientCoverage} from './nutrition.js';
import {NUTRIENT_KEYS,normalizeNutrientPreferences} from './nutrientCatalog.js';
const scaled=(food,factor)=>Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,typeof food[k]==='number'&&Number.isFinite(food[k])?food[k]*factor:null]));
export function createFoodGuide({recipes=[],details={},getContext=()=>({}),fetcher=fetch,onRecipe=()=>{},id=()=>crypto.randomUUID()}){
 const sources=new Map(),foods=new Map();let selected=null;let searches=0;
 const remember=value=>{const source_ref=id();sources.set(source_ref,value);return{source_ref,name:value.name,portion:value.servingDescription,nutrition:value.method==='unmeasured'?'unknown':'source-based estimate',instruction:'Read the matched food and portion to the user before preparing a meal. Never describe an estimate as measured.'};};
 async function run(name,args){
  if(name==='search_foods'){
   const q=String(args.query||'').trim();if(!q||q.length>120)throw Error('Use a short food name.');
   if(searches>=8)return {foods:[],instruction:'Search limit reached for this call. Ask for a label or retain the description with unknown nutrients. Do not search again.'};
   const search=async query=>{searches++;const r=await fetcher('/api/fdc-search?'+new URLSearchParams({q:query,pageSize:6,dataTypes:'Foundation,SR Legacy,Survey (FNDDS),Branded'}),{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error('Food search unavailable. Keep the description with unknown nutrients.');return(data.foods||[]).filter(f=>f.basis==='per100g');};
   let matches=await search(q),relaxed=false;
   const shorter=q.toLowerCase().replace(/\b(plain|without|with|salt|unsalted|please|some|a|the)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
   if(!matches.length&&shorter&&shorter!==q.toLowerCase()&&searches<8){matches=await search(shorter);relaxed=true;}
   return {relaxed,foods:matches.map(f=>{foods.set(String(f.fdcId),f);return{fdc_id:f.fdcId,name:f.description,portions:(f.portions||[]).slice(0,10)};}),instruction:'These are candidates, not confirmed matches. A relaxed search may differ in salt or preparation. Ask which preparation/brand fits. Use inspect_food for portions. No match is acceptable; never force a cookbook recipe. After two unsuccessful queries for one food, clarify or retain unknown nutrients.'};
  }
  if(name==='inspect_food'){
   if(!foods.has(String(args.fdc_id)))throw Error('Search for this food first.');
   const r=await fetcher('/api/fdc-food?fdcId='+encodeURIComponent(args.fdc_id),{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok||!data.food||data.food.basis!=='per100g')throw Error('Food details unavailable.');foods.set(String(args.fdc_id),data.food);
   return {fdc_id:data.food.fdcId,name:data.food.description,portions:data.food.portions.map((p,index)=>({index,...p})),instruction:'Use a source household portion or the user stated gram weight. Do not invent grams from a bowl or plate.'};
  }
  if(name==='match_food'){
   const food=foods.get(String(args.fdc_id));if(!food)throw Error('Search and inspect the food first.');
   let grams=args.grams;
   if(grams===null){const portion=Number.isInteger(args.portion_index)?food.portions?.[args.portion_index]:null;if(!portion||!(args.quantity>0))throw Error('Ask for a supported household portion or weight.');grams=portion.gramWeight*args.quantity;}
   if(typeof grams!=='number'||!Number.isFinite(grams)||grams<=0||grams>10000)throw Error('Invalid eaten weight.');
   return remember({name:food.description,...scaled(food.nutrients||{},grams/100),method:'usda-estimate',methodLabel:'USDA food match · estimate',fdcId:food.fdcId,sourceUrl:food.sourceUrl,dataType:food.dataType,sourceRelease:food.release,sourceBasis:'per100g',grams,servingDescription:`${Number(grams.toFixed(2))} g`,sourceDescription:'USDA food match; preparation and portion confirmed in conversation'});
  }
  if(name==='usual_foods'){
   const {entries=[]}=getContext();const seen=new Set();const recent=[];
   for(const entry of [...entries].reverse()){
    const raw=entry.source==='custom'?entry.customFood:recipes.find(r=>r.id===entry.recipeId);if(!raw?.name||seen.has(raw.name))continue;seen.add(raw.name);
    const food={...raw,...scaled(raw,entry.servings||1),servingDescription:`Previously: ${raw.servingDescription||entry.servings+' serving(s)'}`,method:raw.method||'recipe-estimate'};
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
   return {recipes:found.slice(0,3).map(({r})=>({id:r.id,name:r.name,targetChecks:checks(r),servingSize:details[r.id]?.servingSize,ingredients:details[r.id]?.ingredients,calories:r.calories??null,sodium:r.sodium??null,protein:r.protein??null})),instruction:'Compare saved targets using targetChecks. Prioritize options not exceeding known remaining amounts, but incomplete intake or missing recipe nutrients cannot establish a safe remaining budget. These match ingredients, not clinical suitability. Ask about allergies and preparation time. Never say safe for a condition. Open the chosen recipe before cooking.'};
  }
  if(name==='open_recipe'){
   const recipe=recipes.find(r=>r.id===args.recipe_id),detail=details[args.recipe_id];if(!recipe||!detail?.steps?.length)throw Error('No source cooking instructions available.');selected={recipe,detail};onRecipe({id:recipe.id,name:recipe.name,...detail});
   return {id:recipe.id,name:recipe.name,...detail,instruction:'Read one source step at a time and wait for the user. Keep track of ingredient changes. Opening or finishing cooking NEVER means eaten. When ready ask whether they actually ate it and their own portion. Modified recipes must be recorded from actual ingredients or as unknown, not unchanged recipe nutrition.'};
  }
  if(name==='recipe_portion'){
   if(!selected||selected.recipe.id!==args.recipe_id)throw Error('Open the recipe first.');
   if(!args.eaten||args.modified)throw Error('Do not log planned food. For modifications use actual ingredients or an unknown-nutrition description.');
   if(typeof args.servings!=='number'||args.servings<=0||args.servings>30)throw Error('Clarify the personal portion against the source serving size.');
   return remember({name:selected.recipe.name,...scaled(selected.recipe,args.servings),method:'recipe-estimate',methodLabel:'Cookbook recipe · unchanged ingredients',sourceLabel:selected.recipe.name,sourceBasis:`${args.servings} source servings`,servingDescription:`${args.servings} × ${selected.detail.servingSize||'source serving'}`,recipeSnapshot:{id:selected.recipe.id,servings:args.servings,ingredients:selected.detail.ingredients}});
  }
  return null;
 }
 return{resolve:ref=>sources.get(ref),async run(name,args){try{return await run(name,args);}catch(e){return{status:'needs_clarification',message:e.message};}}};
}
