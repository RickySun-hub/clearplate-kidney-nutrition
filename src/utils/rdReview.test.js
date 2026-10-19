import test from 'node:test';import assert from 'node:assert/strict';import {reviewDays} from './rdReview.js';
const date='2026-10-19';
function review(values,target){const entries=values.map(sodium=>({date,source:'custom',servings:1,customFood:{name:'Synthetic',sodium}}));return reviewDays(entries,{}, {nutrientTargets:{sodium:target}},{[date]:{}},date,date)[0].nutrients.sodium;}
test('an upper limit is a ceiling: zero and equality are within only with complete nutrition data',()=>{
 for(const value of [0,99,100]){const v=review([value],{max:100});assert.equal(v.status,'Within saved limit');assert.equal(v.attention,false);assert.equal(v.complete,true);}
 assert.equal(review([101],{max:100}).status,'Above saved limit');
 assert.equal(review([0],{max:100}).knownSubtotal,0);
});
test('unknown or partial data cannot establish within-limit or below-minimum status',()=>{
 for(const values of [[],[null],[0,null],[50,null],[100,null]]){const v=review(values,{min:80,max:100});assert.equal(v.status,'Cannot assess full total');assert.equal(v.attention,false);assert.equal(v.total,null);}
 assert.equal(review([null],{max:100}).dataStatus,'Nutrition data missing');
 assert.equal(review([0,null],{max:100}).dataStatus,'Partial nutrition data');
 const above=review([101,null],{max:100});assert.equal(above.status,'Known amount above saved limit');assert.equal(above.attention,true);assert.equal(above.knownCount,1);assert.equal(above.itemCount,2);assert.equal(above.total,null);
});
test('configured minimum and range remain distinct from a maximum-only limit',()=>{
 assert.equal(review([79],{min:80}).status,'Below saved minimum (recorded foods)');
 assert.equal(review([80],{min:80}).status,'Meets saved minimum (recorded foods)');
 for(const value of [80,100])assert.equal(review([value],{min:80,max:100}).status,'Within saved range (recorded foods)');
 assert.equal(review([79],{min:80,max:100}).status,'Below saved minimum (recorded foods)');
 assert.equal(review([101],{min:80,max:100}).status,'Above saved limit');
 assert.equal(review([0],{}).status,'No saved target');
});
