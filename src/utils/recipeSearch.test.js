import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRecipes } from './recipeSearch.js';
const recipes=[{id:'a',name:'Breakfast bowl'},{id:'b',name:'Banana'},{id:'c',name:'Bananna loaf'},{id:'d',name:'Rice pot',calculation:{ingredients:[{food:{description:'Tomatoes, raw'}}]}}];
const details={a:{ingredients:['1 ripe banana','2 tablespoons yogurt']},c:{ingredients:['Flour']}};
test('searches actual ingredient text and saved food descriptions',()=>{
 const matches=searchRecipes(recipes,details,'yogurt');assert.deepEqual(matches.map(m=>m.recipe.id),['a']);assert.equal(matches[0].ingredientHint,'2 tablespoons yogurt');
 assert.deepEqual(searchRecipes(recipes,details,'tomato').map(m=>m.recipe.id),['d']);
});
test('supports partial terms, case, whitespace and explicit spelling variants',()=>{
 assert.equal(searchRecipes(recipes,details,'  YOGHURT  ')[0].recipe.id,'a');
 assert.equal(searchRecipes(recipes,details,'breakf')[0].recipe.id,'a');
 assert.equal(searchRecipes(recipes,details,'tomat')[0].recipe.id,'d');
});
test('small typo and transposition match with approximate flag',()=>{
 assert.equal(searchRecipes(recipes,details,'yogrt')[0].recipe.id,'a');assert.equal(searchRecipes(recipes,details,'yogrt')[0].approximate,true);
 assert.equal(searchRecipes(recipes,details,'baanna')[0].recipe.id,'b');
});
test('exact title and exact ingredient rank above fuzzy titles',()=>{
 assert.deepEqual(searchRecipes(recipes,details,'banana').map(m=>m.recipe.id),['b','a','c']);
});
test('no match, short typo, absent ingredients and unrelated languages stay unmatched',()=>{
 for(const query of ['quartz','rz','香蕉','salmon'])assert.equal(searchRecipes(recipes,details,query).length,0);
 assert.equal(searchRecipes(recipes,details,'banana quinoa').length,0);
});
