import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMeal,validConversation,conversationText} from './mealConversation.js';
import {validateCareRecord} from './careCloud.js';
import {validateDeviceReport} from './rdReport.js';
import {reviewDays} from './rdReview.js';
const turn={role:'user',content:'Two eggs. Actually, only one.',source:'voice',at:'2026-10-07T20:00:00Z'};
test('meal prompts use local time and do not re-ask logged or reviewed meals',()=>{
 assert.equal(nextMeal([],{},'2026-10-07',19),'Breakfast');
 assert.equal(nextMeal([{date:'2026-10-07',meal:'Breakfast'}],{},'2026-10-07',13),'Lunch');
 assert.equal(nextMeal([],{Breakfast:{status:'not-eaten'},Lunch:{status:'reviewed'}},'2026-10-07',19),'Dinner');
});
test('bounded original turns survive cloud round trip and report export import',()=>{
 const entry={date:'2026-10-07',source:'custom',servings:1,customFood:{name:'Egg'},conversation:[turn]};
 const record={profile:{},entries:[entry],dayRecords:{'2026-10-07':{mealReviews:{Breakfast:{status:'reviewed',conversation:[turn],reviewedAt:turn.at}}}}};
 assert.deepEqual(validateCareRecord(JSON.parse(JSON.stringify(record))),record);
 assert.equal(conversationText(validateDeviceReport({schema:'renalsync-device-report',version:1,rows:[{...entry,name:'Egg',nutrients:{}}]}).rows[0].conversation),turn.content);
 assert.equal(validConversation([{...turn,role:'system'}]),false);
 assert.equal(validConversation([{...turn,content:'x'.repeat(2001)}]),false);
 assert.throws(()=>validateCareRecord({...record,entries:[{...entry,conversation:[{...turn,role:'system'}]}]}));
});
test('daily targets never compare multi-day totals; missing nutrients stay unknown',()=>{
 const entries=[{date:'2026-10-07',source:'custom',servings:1,customFood:{name:'A',sodium:1200}},{date:'2026-10-08',source:'custom',servings:1,customFood:{name:'B',sodium:1200}}];
 const days=reviewDays(entries,{}, {sodiumTargetMg:2000},{},'2026-10-07','2026-10-08');
 assert.equal(days[0].nutrients.sodium.status,'Within saved range (recorded foods)');
 assert.equal(days[0].nutrients.protein.total,null);
 const unknown=reviewDays([...entries,{date:'2026-10-07',source:'custom',servings:1,customFood:{name:'Unknown'}}],{},{sodiumTargetMg:1000},{},'2026-10-07','2026-10-07')[0];
 assert.equal(unknown.nutrients.sodium.status,'Above saved limit');assert.equal(unknown.nutrients.sodium.complete,false);
 const reviewOnly=reviewDays([],{}, {},{'2026-10-07':{mealReviews:{Breakfast:{status:'not-eaten'}}}},'2026-10-07','2026-10-07')[0];
 assert.equal(reviewOnly.nutrients.calories.total,null);
});
