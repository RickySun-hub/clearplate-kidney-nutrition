import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecipe, ingredientGrams, editRecipeIngredients, buildCalculatedRecipe, recipePortion } from './recipeCalculation.js';
const food={fdcId:1,description:'Synthetic raw ingredient',basis:'per100g',dataType:'SR Legacy',nutrients:{sodium:125,phosphorus:20},portions:[{amount:1,gramWeight:200,description:'cup'}]};
const row={food,quantity:'800',unit:'g',state:'raw'};
const draft={name:'Synthetic dish',ingredients:[row],servings:'4',finishedGrams:'800',yieldConfirmed:true};
test('total, equal servings, per100g and gram portion use one precise batch',()=>{
 const r=calculateRecipe(draft);assert.equal(r.nutrients.sodium.total,1000);assert.equal(r.nutrients.sodium.perServing,250);assert.equal(r.nutrients.sodium.per100g,125);
 assert.equal(recipePortion(draft,'grams',200).sodium,250);
 const changed=calculateRecipe({...draft,finishedGrams:'1000'});assert.equal(changed.nutrients.sodium.total,1000);assert.equal(changed.nutrients.sodium.perServing,250);assert.equal(changed.nutrients.sodium.per100g,100);
 const doubled=calculateRecipe({...draft,ingredients:[{...row,quantity:'1600'}],finishedGrams:'1600'});assert.equal(doubled.nutrients.sodium.per100g,125);
});
test('unknown stays null and known subtotals have nutrient-specific coverage',()=>{
 const r=calculateRecipe({...draft,ingredients:[row,{...row,food:{...food,nutrients:{sodium:0,phosphorus:null}}}]});
 assert.equal(r.nutrients.phosphorus.total,null);assert.equal(r.nutrients.phosphorus.knownSubtotal,160);assert.equal(r.nutrients.phosphorus.knownCount,1);assert.equal(r.nutrients.phosphorus.complete,false);assert.equal(r.nutrients.potassium.knownSubtotal,null);
});
test('food-specific quantities resolve; no generic volumes or missing weights',()=>{
 assert.equal(ingredientGrams({...row,quantity:2,unit:'portion:0'}),400);
 assert.equal(ingredientGrams({...row,unit:'ml'}),null);
 assert.equal(ingredientGrams({...row,quantity:''}),null);
 assert.equal(ingredientGrams({...row,food:{...food,basis:'per100ml'}}),null);
 assert.equal(calculateRecipe({...draft,finishedGrams:''}).weightBasis,'Estimated ingredient weight (pre-cooking)');
 assert.equal(calculateRecipe({...draft,finishedGrams:'',ingredients:[{...row,quantity:''}]}).weightGrams,null);
});
test('ingredient edits invalidate measured yield until reconfirmed',()=>{
 const changed=editRecipeIngredients(draft,[{...row,quantity:'400'}]);assert.equal(changed.yieldConfirmed,false);assert.equal(calculateRecipe(changed).weightGrams,null);assert.equal(calculateRecipe(changed).nutrients.sodium.total,500);
});
test('sums unrounded values and saved revisions do not mutate prior snapshots',()=>{
 const precise={...draft,ingredients:[{...row,quantity:'0.001'}, {...row,quantity:'0.001'}]};assert.equal(calculateRecipe(precise).nutrients.sodium.total,0.0025);
 const old=buildCalculatedRecipe(draft,'first');const log=recipePortion(old.calculation,'servings',1);
 const next=buildCalculatedRecipe({...draft,ingredients:[{...row,quantity:'400'}]},'second');
 assert.equal(old.sodium,250);assert.equal(next.sodium,125);assert.equal(log.sodium,250);assert.notEqual(old.id,next.id);
 draft.ingredients[0].quantity='700';assert.equal(old.calculation.ingredients[0].quantity,'800');draft.ingredients[0].quantity='800';
});

test('logged portions retain precision until display and validate without a schema change',async()=>{
 const {nutrientCoverage}=await import('./nutrition.js');const {validateCareRecord}=await import('./careCloud.js');
 const recipe=buildCalculatedRecipe({...draft,ingredients:[{...row,quantity:'0.001'}]},'precise');
 const entries=[1,2].map(id=>({id:String(id),date:'2026-10-16',source:'custom',servings:1,customFood:recipe}));
 assert.equal(nutrientCoverage(entries).sodium.total,0.000625);
 const record=validateCareRecord({profile:{},entries,dayRecords:{},customRecipes:[recipe],customRecipeDetails:{}});
 assert.equal(record.customRecipes[0].calculation.ingredients[0].food.fdcId,1);
});
