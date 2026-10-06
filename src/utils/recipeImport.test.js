import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeSource, buildImportedRecipe, validateSourceUrl } from './recipeImport.js';
const url='https://recipes.example.org/soup';
const source={ '@type':'Recipe',name:'Vegetable <b>soup</b>',recipeIngredient:['1 cup water','1 carrot'],recipeInstructions:[{'@type':'HowToSection',itemListElement:[{'@type':'HowToStep',text:'Chop the carrot.'},{'@type':'HowToStep',text:'Cook in water.'}]}],recipeYield:'4 servings',nutrition:{calories:'999 calories'}};
test('loads graph Recipe with source instructions and no imported nutrient invention',()=>{
 const draft=parseRecipeSource(`<script type="application/ld+json">${JSON.stringify({'@graph':[source]})}</script>`,url);
 assert.equal(draft.name,'Vegetable soup');assert.deepEqual(draft.steps,['Chop the carrot.','Cook in water.']);assert.equal(draft.servings,4);
 const imported=buildImportedRecipe(draft,'imported-test');assert.equal(imported.recipe.calories,null);assert.equal(imported.recipe.sodium,null);assert.equal(imported.details.source.url,url);
});
test('ambiguous yield stays unknown and requires user confirmation',()=>{
 const draft=parseRecipeSource(JSON.stringify({...source,recipeYield:'4–6 bowls'}),url);
 assert.equal(draft.servings,null);assert.throws(()=>buildImportedRecipe(draft),/Confirm/);
 assert.equal(buildImportedRecipe({...draft,servings:5},'test').details.servings,5);
});
test('rejects invalid source and incomplete or oversized Recipe payloads',()=>{
 for(const value of ['http://example.org','https://user:pass@example.org','https://example.org:8443','https://localhost','https://host.internal']) assert.throws(()=>validateSourceUrl(value));
 assert.throws(()=>parseRecipeSource(JSON.stringify({...source,recipeInstructions:[]}),url),/No complete/);
 assert.throws(()=>parseRecipeSource('a'.repeat(1000001),url),/1 MB/);
});
