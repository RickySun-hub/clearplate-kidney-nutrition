import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateRecipeAudit, auditNutrients } from '../src/utils/recipeAudit.js';
import { resolveIngredientWeight } from '../src/utils/usdaPortions.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, ''));
const write = (p, data) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + '\n'); };
const catalog = read('output/usda/catalog.json');
const foods = Object.fromEntries(catalog.foods.map((f) => [f.fdcId, f]));
const matches = read('src/data/usdaIngredientMatches.json');
const recipes = read('src/data/recipes.json');
const details = read('src/data/recipeDetails.json');
const audits = {}, selectedFoods = {}, ingredientRows = [], comparisons = [];
for (const recipe of recipes) {
  const detail = details[recipe.id];
  const ingredients = (detail?.ingredients || []).map((original) => {
    const match = matches[original];
    const food = foods[match?.fdcId];
    const weight = resolveIngredientWeight(original, food, match);
    if (food) selectedFoods[food.fdcId] = food;
    const item = { ...weight, fdcId: food?.fdcId ?? null, foodDescription: food?.description ?? null, sourceUrl: food?.sourceUrl ?? null, dataType: food?.dataType ?? null, release: food?.release ?? null, matchNote: match?.matchNote ?? null };
    ingredientRows.push({ recipeId: recipe.id, recipeName: recipe.name, sourceYield: detail.servings, ...item });
    return item;
  });
  const audit = calculateRecipeAudit(detail, ingredients.filter((i) => i.kind !== 'heading'), foods);
  const workbook = Object.fromEntries(auditNutrients.map((n) => [n, recipe[n] ?? null]));
  audits[recipe.id] = { ingredients, audit, workbook, sourceServingSize: detail?.servingSize ?? null, source: detail?.source ?? null, reviewStatus: 'needs-review' };
  comparisons.push({ recipeId: recipe.id, name: recipe.name, sourceYield: audit.yieldServings, status: audit.status, ingredients: audit.ingredientCount, weighted: audit.weightedIngredientCount, ...Object.fromEntries(auditNutrients.flatMap((n) => [[`workbook_${n}`, workbook[n]], [`usda_${n}`, audit.perServing[n]], [`known_lower_${n}`, audit.knownPerServing[n]], [`missing_${n}`, audit.missingByNutrient[n]]])) });
}
write('src/data/usdaFoods.json', selectedFoods);
write('src/data/usdaRecipeAudit.json', audits);
const manifest = { schemaVersion: 1, sources: catalog.sources, archives: catalog.archives, method: 'Ingredient mass (g) × USDA nutrient per100g / 100; sum then divide by original recipe yield. No retention or cooking-yield adjustment.', reviewStatus: 'needs-review', recipeCount: recipes.length, recipesWithIngredients: Object.keys(details).length, uniqueTextMatches: Object.keys(matches).length, selectedFoodCount: Object.keys(selectedFoods).length, ingredientRows: ingredientRows.length, weightedRows: ingredientRows.filter((i) => i.grams !== null).length, statuses: Object.fromEntries(['calculated', 'range', 'partial', 'unavailable'].map((s) => [s, comparisons.filter((r) => r.status === s).length])) };
write('public/data/usda-manifest.json', manifest);
write('public/data/usda-recipe-audit.json', audits);
const csv = (rows, columns) => '\uFEFF' + [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ''))].map((row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(root, 'public/data/usda-ingredient-review.csv'), csv(ingredientRows, ['recipeId','recipeName','sourceYield','original','quantity','quantityMax','unit','fdcId','foodDescription','dataType','release','grams','gramsMax','portionId','weightNote','matchNote','issue','sourceUrl']));
fs.writeFileSync(path.join(root, 'public/data/usda-workbook-comparison.csv'), csv(comparisons, Object.keys(comparisons[0])));
console.log(JSON.stringify(manifest, null, 2));
