import test from 'node:test';
import assert from 'node:assert/strict';
import {liveConfig} from './liveVoice.js';
import {runDiscoveryTool,discoveryPreferences} from '../src/utils/discoveryVoice.js';
import {responseToolBridge} from '../src/utils/liveToolBridge.js';
for (const mode of ['recipes','plan']) test(`${mode} has only draft discovery tools; never exposes record or target writes`,()=>{
 const c=liveConfig({sdp:'v=0',meal:'Snack',mode,conversation:[]});
 assert.deepEqual(c.delegation.responses.tools.map(t=>t.name),['prepare_discovery_preferences']);
 assert.match(c.instructions,/Never log food/);assert.equal(c.store,false);
 let called=false;assert.equal(runDiscoveryTool(mode,'confirm_meal',{},()=>called=true).status,'unsupported_tool');assert.equal(called,false);
});
test('discovery input is bounded and strips arbitrary fields',()=>{
 assert.throws(()=>liveConfig({sdp:'v=0',meal:'Snack',mode:'planner'}),/Unsupported voice mode/);
 assert.deepEqual(discoveryPreferences('recipes',{search:' chicken ',calories:999,save:true}),{search:'chicken'});
 for(const v of [{search:''},{search:'x'.repeat(201)},null])assert.throws(()=>discoveryPreferences('recipes',v));
 assert.deepEqual(discoveryPreferences('plan',{selectedMeals:['Lunch','Lunch'],activeObjective:'simplest',proteinTarget:0}),{selectedMeals:['Lunch'],activeObjective:'simplest'});
 for(const v of [{selectedMeals:[],activeObjective:'balanced'},{selectedMeals:['tomorrow'],activeObjective:'balanced'},{selectedMeals:['Dinner'],activeObjective:'medical'}])assert.throws(()=>discoveryPreferences('plan',v));
});
test('completed voice tools prepare editable conditions once and never auto apply',async()=>{
 const drafts=[],sent=[];
 const bridge=responseToolBridge({send:e=>sent.push(e),run:(_,name,args)=>runDiscoveryTool('recipes',name,args,p=>drafts.push(p))});
 await bridge({event:{type:'response.created',response:{id:'r'}}});
 await bridge({event:{type:'response.output_item.done',response_id:'r',item:{type:'function_call',call_id:'c',name:'prepare_discovery_preferences',arguments:'{"search":"chicken"}'}}});
 assert.equal(drafts.length,0);
 await bridge({event:{type:'response.completed',response:{id:'r'}}});
 await bridge({event:{type:'response.completed',response:{id:'r'}}});
 assert.deepEqual(drafts,[{search:'chicken'}]);assert.equal(JSON.parse(sent[0].item.output).status,'review_required');
});
