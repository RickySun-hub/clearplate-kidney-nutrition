import { MEALS, validConversation } from './mealConversation.js';
import { NUTRIENT_KEYS } from './nutrientCatalog.js';
const clean = value => String(value || '').trim().replace(/\s+/g,' ');
const normalized = value => clean(value).toLowerCase().replace(/[.,!?，。！’']/g,'');
const saveAction='(?:please )?(?:save(?: it| that| the meal)?|go ahead(?: and save(?: it| that)?)?|confirm(?: it)?)';
const agreement='(?:correct|thats right|that is right|thats correct|that is correct|sounds right)';
const affirmative=new RegExp(`^(?:(?:yes|yeah|yep)(?: (?:please|${agreement}|${saveAction}))?|${agreement}|${saveAction}|(?:okay|ok) save(?: it| that)?)(?: thank you)?$`);
export function mealDraft(value) {
  if(!value || !MEALS.includes(value.meal) || !Array.isArray(value.foods) || value.foods.length<1 || value.foods.length>12) throw Error('Describe 1–12 foods and the meal first.');
  if(value.time!==null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw Error('Use a stated meal time or leave it unknown.');
  const foods=value.foods.map(f=>{
    if(!f || typeof f.name!=='string' || !f.name.trim() || f.name.length>120 || typeof f.portion!=='string' || !f.portion.trim() || f.portion.length>300) throw Error('Each food needs its name and the amount this person ate, or explicitly unknown.');
    return {name:clean(f.name),portion:clean(f.portion)};
  });
  if(foods.reduce((n,f)=>n+f.name.length+f.portion.length,0)>1000)throw Error('Split a long meal description into smaller drafts.');
  return {meal:value.meal,time:value.time,foods};
}
export function confirmsDraft(quote,turns,preparedCount) {
  const latest=turns.findLastIndex(t=>t.role==='user');
  if(latest<preparedCount || normalized(turns[latest]?.content)!==normalized(quote)) return false;
  const sincePrepared=turns.slice(preparedCount,latest);
  if(!sincePrepared.some(t=>t.role==='assistant')) return false;
  // Any added detail, correction or refusal invalidates this draft, even if the user later says yes.
  // A new prepare_meal call must incorporate it and start a new confirmation window.
  if(sincePrepared.some(t=>t.role==='user' && !affirmative.test(normalized(t.content)))) return false;
  return affirmative.test(normalized(quote));
}
// Tool outputs never contain calculated nutrients. Writes are atomic batches after fresh spoken consent.
export function createMealTools({getTurns,onSave,onDraft=()=>{},onSaved=()=>{},resolveSource=()=>null,id=()=>crypto.randomUUID()}) {
  let pending=null;const completed=new Map();const calls=new Map();let queue=Promise.resolve();
  async function execute(name,args) {
    if(name==='prepare_meal') {
      const draft=mealDraft(args);const turns=getTurns();
      draft.foods=draft.foods.map((f,i)=>{const ref=args.foods[i].source_ref;if(!ref)return f;const source=resolveSource(ref);if(!source)throw Error('Unknown food match. Search again.');return {...f,matchedFood:structuredClone(source)};});
      if(!validConversation(turns)) return {status:'needs_shorter_conversation'};
      const signature=JSON.stringify(draft);
      pending={...draft,id:id(),signature,preparedCount:turns.length};
      onDraft(pending);
      return {status:'awaiting_spoken_confirmation',draft_id:pending.id,meal:draft.meal,time:draft.time,foods:draft.foods.map(f=>({name:f.matchedFood?.name||f.name,reported_portion:f.portion,source_portion:f.matchedFood?.servingDescription??null,match_type:f.matchedFood?.matchType??null,nutrition:f.matchedFood?'source-based estimate':'unknown'})),instruction:'Read back the matched food, source portion and personal reported portion. Explicitly describe an unspecified match as a USDA unspecified-food estimate. Ask: Does that match what you ate, and should I save it? Wait for a NEW affirmative reply before calling confirm_meal. If the source does not fit, search again or keep nutrients unknown.'};
    }
    if(name==='confirm_meal') {
      if(completed.has(args.draft_id))return completed.get(args.draft_id);
      if(!pending || pending.id!==args.draft_id)return {status:'draft_not_found',instruction:'Prepare the meal first.'};
      const turns=getTurns();
      if(!validConversation(turns)||!confirmsDraft(args.confirmation_quote,turns,pending.preparedCount))return {status:'not_saved',instruction:'A fresh unambiguous spoken confirmation after the readback is required. After any added detail, correction or unclear answer, prepare the updated draft and read it back again. Captions may still be arriving; never claim saved.'};
      const result=await onSave({...pending,conversation:turns});
      if(result===false)return {status:'save_failed',instruction:'The record was not saved. Ask whether to retry. Keep the draft.'};
      const saved={status:'saved',draft_id:pending.id,meal:pending.meal,foods:pending.foods,nutrition:pending.foods.some(f=>f.matchedFood)?'source-based estimates; missing values unknown':'unknown',instruction:'Tell the user this meal was saved. Ask what else they had, then continue to the next due meal. Do not ask them to press buttons.'};
      completed.set(pending.id,saved);pending=null;onDraft(null);onSaved(saved);return saved;
    }
    return {status:'unsupported_tool'};
  }
  return {run(callId,name,args){
    if(calls.has(callId))return calls.get(callId);
    const result=queue.then(()=>execute(name,args)).catch(()=>({status:'save_failed',instruction:'Nothing was saved. Ask to retry or clarify the food and portion.'}));
    queue=result;calls.set(callId,result);return result;
  }};
}
export function appendVoiceMeal(entries,batch,date,now=new Date().toISOString()) {
  const draft=mealDraft(batch);
  if(typeof batch.id!=='string'||!batch.id||!validConversation(batch.conversation))throw Error('Invalid confirmed meal.');
  const prefix=`voice-${batch.id}-`;
  if(entries.some(e=>e.id?.startsWith(prefix)))return entries;
  return [...entries,...draft.foods.map((food,index)=>({
    id:prefix+index,recordedAt:now,confirmedAt:now,date,source:'custom',servings:1,meal:draft.meal,
    time:draft.time||new Date(now).toTimeString().slice(0,5),timeSource:draft.time?'user-recorded':'recording-time',
    sortOrder:Math.max(-1,...entries.filter(e=>e.date===date&&e.meal===draft.meal).map(e=>Number.isFinite(e.sortOrder)?e.sortOrder:-1))+1+index,
    customFood:batch.foods[index].matchedFood ? {...structuredClone(batch.foods[index].matchedFood),reportedPortion:food.portion,matchConfirmed:true} : {name:`${food.name} — ${food.portion}`,...Object.fromEntries(NUTRIENT_KEYS.map(key=>[key,null])),grams:null,method:'unmeasured',methodLabel:'Voice-confirmed food · nutrition unknown',servingDescription:food.portion},
    inputMethod:'voice-conversation',conversation:batch.conversation,
  }))];
}
