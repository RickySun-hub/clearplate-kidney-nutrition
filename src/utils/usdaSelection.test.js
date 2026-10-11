import test from 'node:test';
import assert from 'node:assert/strict';
import {createUsdaSelection, portionDescription} from './usdaSelection.js';
const summary = {fdcId:123, description:'Synthetic ice cream', basis:'per100g', portions:[], nutrients:{calories:200}};
const full = {...summary, portions:[{amount:1,gramWeight:80,unit:'cup',modifier:''},{amount:1,gramWeight:25,unit:'scoop',modifier:''}]};
const response = food => ({ok:true,json:async()=>({food,provenance:{live:true}})});
function harness(fetchImpl) {
  const state={food:null,busy:false,error:'',updates:0};
  const selection=createUsdaSelection({fetchImpl,onStart(){state.food=null;state.busy=true;state.error='';},onFood(data){state.food=data.food;state.updates++;},onError(message){state.error=message;},onEnd(){state.busy=false;}});
  return {state,...selection};
}
test('loads detail-only household portions rather than selecting the search summary',async()=>{
  let url; const h=harness(async u=>{url=u;return response(full);});
  await h.select(summary);
  assert.equal(h.state.food.portions.length,2);
  assert.equal(url,'/api/fdc-food?fdcId=123');
  assert.equal(h.state.food.nutrients.calories,200);
});
test('household labels retain a source unit when description and modifier are absent',()=>{
  assert.equal(portionDescription(full.portions[0]),'cup');
  assert.equal(portionDescription({description:'cup, melted',modifier:'cup',unit:'cup'}),'cup, melted');
});
test('an older detail response cannot overwrite a newer selection',async()=>{
  const resolvers=[];const h=harness(()=>new Promise(resolve=>resolvers.push(resolve)));
  const first=h.select(summary);const second=h.select({...summary,fdcId:124});
  resolvers[1](response({...full,fdcId:124}));await second;
  resolvers[0](response(full));await first;
  assert.equal(h.state.food.fdcId,124);assert.equal(h.state.updates,1);assert.equal(h.state.busy,false);
});
test('failed details clear the previous food and never fall back to incomplete search data',async()=>{
  let fail=false;const h=harness(async()=>{if(fail)throw Error('network');return response(full);});
  await h.select(summary);fail=true;await h.select({...summary,fdcId:124});
  assert.equal(h.state.food,null);assert.match(h.state.error,/details/i);assert.equal(h.state.busy,false);
});
test('cancel suppresses a response even when fetch ignores abort',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));const request=h.select(summary);
  h.cancel();resolve(response(full));await request;assert.equal(h.state.updates,0);
});
test('mismatched food identity is rejected',async()=>{
  const h=harness(async()=>response({...full,fdcId:999}));await h.select(summary);
  assert.equal(h.state.food,null);assert.match(h.state.error,/details/i);
});
test('no household portions stays empty without fabricated conversion',async()=>{
  const h=harness(async()=>response(summary));await h.select(summary);assert.deepEqual(h.state.food.portions,[]);
});
test('HTTP failures do not select an error response',async()=>{
  const h=harness(async()=>({ok:false,json:async()=>({error:{message:'upstream'}})}));await h.select(summary);
  assert.equal(h.state.food,null);assert.equal(h.state.busy,false);assert.match(h.state.error,/details/i);
});
