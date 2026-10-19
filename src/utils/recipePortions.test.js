import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeYield,resolveRecipeServings,recipePortionLabel} from './recipePortions.js';
import {nutritionFor} from './nutrition.js';
import {buildCalculatedRecipe,recipePortion} from './recipeCalculation.js';
test('six-serving batch uses personal servings and scales exactly once',()=>{
 const recipe={calories:100,protein:5,sodium:0,potassium:null};const detail={servings:6};
 assert.equal(resolveRecipeServings(recipe,detail),1);
 assert.equal(resolveRecipeServings(recipe,detail,6,'whole'),6,'server-resolved batch is not multiplied again');
 assert.equal(nutritionFor(recipe,resolveRecipeServings(recipe,detail,1,'whole')).calories,600);
 assert.equal(nutritionFor(recipe,resolveRecipeServings(recipe,detail,.5)).calories,50);
 assert.equal(nutritionFor(recipe,2).potassium,null);assert.equal(nutritionFor(recipe,2).sodium,0);
 assert.match(recipePortionLabel(recipe,detail),/whole recipe makes 6/);
});
test('unknown yield cannot become one whole batch; legacy personal servings remain valid',()=>{
 for(const value of [undefined,'',0,-1,NaN]){assert.equal(recipeYield({}, {servings:value}),null);assert.throws(()=>resolveRecipeServings({}, {servings:value},1,'whole'),/yield/);}
 assert.equal(resolveRecipeServings({},null,2),2);for(const value of ['',0,-1,null])assert.throws(()=>resolveRecipeServings({},null,value));
});
test('calculated recipe saved per serving remains compatible with personal and whole portions',()=>{
 const draft={name:'Synthetic soup',servings:6,ingredients:[{food:{basis:'per100g',nutrients:{calories:100,sodium:0}},quantity:600,unit:'g'}]};
 const recipe=buildCalculatedRecipe(draft,'test');assert.equal(recipe.calories,100);
 assert.equal(nutritionFor(recipe,resolveRecipeServings(recipe,null,1,'whole')).calories,600);
 assert.equal(recipePortion(draft,'servings',.5).calories,50);assert.equal(recipePortion(draft,'grams',50).calories,50);
});
import {createFoodGuide} from './foodGuide.js';
test('voice whole recipe resolves known yield and rejects unknown without creating nutrition',async()=>{
 const recipe={id:'soup',name:'Synthetic soup',calories:100,sodium:0,potassium:null};
 const guide=createFoodGuide({recipes:[recipe],details:{soup:{servings:6,ingredients:['6 cups water'],steps:['Simmer.']}}});
 const opened=await guide.run('open_recipe',{recipe_id:'soup'});assert.equal(opened.wholeRecipeServings,6);assert.match(opened.ingredients[0],/1 cup/);
 const whole=await guide.run('recipe_portion',{recipe_id:'soup',servings:1,portion_basis:'whole',eaten:true,modified:false});
 assert.equal(guide.resolve(whole.source_ref).calories,600);assert.equal(guide.resolve(whole.source_ref).potassium,null);
 const personal=await guide.run('recipe_portion',{recipe_id:'soup',servings:1,eaten:true,modified:false});assert.equal(guide.resolve(personal.source_ref).calories,100);
 assert.equal((await guide.run('recipe_portion',{recipe_id:'soup',eaten:true,modified:false})).status,'needs_clarification');
 const unknown=createFoodGuide({recipes:[recipe],details:{soup:{ingredients:[],steps:['Simmer.']}}});await unknown.run('open_recipe',{recipe_id:'soup'});
 assert.equal((await unknown.run('recipe_portion',{recipe_id:'soup',servings:1,portion_basis:'whole',eaten:true,modified:false})).status,'needs_clarification');
});
