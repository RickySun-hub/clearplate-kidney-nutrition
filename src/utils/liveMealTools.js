import { MEALS, validConversation } from './mealConversation.js';
const clean = value => String(value || '').trim().replace(/\s+/g,' ');
const normalized = value => clean(value).toLowerCase().replace(/[.,!?，。！’']/g,'');
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
  const words=normalized(quote);
  if(/\b(no|not|dont|wait|but|actually|instead|change|correction|wrong)\b/.test(words)) return false;
  return /^(yes|yeah|yep|correct|thats right|that is right|sounds right|go ahead|save it|please save|okay save|ok save|confirm)(\b|$)/.test(words);
}
// Tool outputs never contain calculated nutrients. Writes are atomic batches after fresh spoken consent.
export function createMealTools({getTurns,onSave,onDraft=()=>{},onSaved=()=>{},id=()=>crypto.randomUUID()}) {
  let pending=null;const completed=new Map();const calls=new Map();let queue=Promise.resolve();
  async function execute(name,args) {
    if(name==='prepare_meal') {
      const draft=mealDraft(args);const turns=getTurns();
      if(!validConversation(turns)) return {status:'needs_shorter_conversation'};
      const signature=JSON.stringify(draft);
      if(pending?.signature!==signature)pending={...draft,id:id(),signature,preparedCount:turns.length};
      onDraft(pending);
      return {status:'awaiting_spoken_confirmation',draft_id:pending.id,meal:draft.meal,time:draft.time,foods:draft.foods,instruction:'Read back these foods and personal portions. Ask: Should I save that? Wait for a NEW affirmative reply before calling confirm_meal. Nutrition will be marked unknown.'};
    }
    if(name==='confirm_meal') {
      if(completed.has(args.draft_id))return completed.get(args.draft_id);
      if(!pending || pending.id!==args.draft_id)return {status:'draft_not_found',instruction:'Prepare the meal first.'};
      const turns=getTurns();
      if(!validConversation(turns)||!confirmsDraft(args.confirmation_quote,turns,pending.preparedCount))return {status:'not_saved',instruction:'A fresh unambiguous spoken confirmation is required. If the user corrected details, prepare the corrected draft and ask again. Captions may still be arriving; never claim saved.'};
      const result=await onSave({...pending,conversation:turns});
      if(result===false)return {status:'save_failed',instruction:'The record was not saved. Ask whether to retry. Keep the draft.'};
      const saved={status:'saved',draft_id:pending.id,meal:pending.meal,foods:pending.foods,nutrition:'unknown',instruction:'Tell the user this meal was saved. Ask what else they had, then continue to the next due meal. Do not ask them to press buttons.'};
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
    customFood:{name:`${food.name} — ${food.portion}`,method:'unmeasured',methodLabel:'Voice-confirmed food · nutrition unknown',servingDescription:food.portion},
    inputMethod:'voice-conversation',conversation:batch.conversation,
  }))];
}
