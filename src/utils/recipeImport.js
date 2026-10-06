const LIMIT = 1000000;
const plain = (text) => typeof text === 'string' ? text.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (entity) => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[entity])).replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code) => { const value = /^x/i.test(code) ? parseInt(code.slice(1),16) : Number(code); return value <= 0x10ffff ? String.fromCodePoint(value) : entity; }).trim() : '';
export function validateSourceUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a public HTTPS recipe URL.'); }
  if (typeof value !== 'string' || value.length > 2000 || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/i.test(url.hostname)) throw new Error('Enter a public HTTPS recipe URL.');
  url.hash = '';
  return url.href;
}
export function validateRecipeDraft(draft) {
  const sourceUrl = validateSourceUrl(draft?.sourceUrl);
  const name = plain(draft?.name);
  const ingredients = Array.isArray(draft?.ingredients) ? draft.ingredients.map(plain) : [];
  const steps = Array.isArray(draft?.steps) ? draft.steps.map(plain) : [];
  if (!name || name.length > 200 || !ingredients.length || ingredients.length > 200 || !steps.length || steps.length > 200 || [...ingredients,...steps].some((line) => !line || line.length > 10000)) throw new Error('Add a recipe name, ingredients and instructions from the source.');
  const servings = draft.servings === null || draft.servings === undefined || draft.servings === '' ? null : Number(draft.servings);
  if (servings !== null && (!Number.isFinite(servings) || servings <= 0 || servings > 1000)) throw new Error('Enter a source serving count between 0 and 1,000.');
  return { name, ingredients, steps, servings, sourceUrl, sourceYield: plain(draft.sourceYield).slice(0, 200) || null };
}
export function parseRecipeSource(input, sourceUrl) {
  if (typeof input !== 'string' || new TextEncoder().encode(input).length > LIMIT) throw new Error('Recipe source must be smaller than 1 MB.');
  const blocks = [...input.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => match[1]);
  if (!blocks.length) blocks.push(input);
  const recipes = [];
  function walk(value, depth = 0) {
    if (depth > 20 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((item) => walk(item, depth + 1)); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some((type) => typeof type === 'string' && /^(?:https?:\/\/schema\.org\/)?Recipe$/i.test(type))) recipes.push(value);
    for (const [key, child] of Object.entries(value)) if (key !== '@context') walk(child, depth + 1);
  }
  for (const block of blocks) { try { walk(JSON.parse(block)); } catch { /* Other unrelated JSON-LD blocks can be malformed. */ } }
  function instructions(value, depth = 0) {
    if (depth > 20) return [];
    if (typeof value === 'string') return value.split(/\r?\n/).map(plain).filter(Boolean);
    if (Array.isArray(value)) return value.flatMap((item) => instructions(item, depth + 1));
    if (value && typeof value === 'object') return value.itemListElement ? instructions(value.itemListElement, depth + 1) : value.text ? instructions(value.text, depth + 1) : [];
    return [];
  }
  for (const recipe of recipes) {
    const yields = Array.isArray(recipe.recipeYield) ? recipe.recipeYield : [recipe.recipeYield];
    const yieldText = yields.find((item) => typeof item === 'number' || typeof item === 'string');
    const match = typeof yieldText === 'number' ? [null,String(yieldText)] : String(yieldText || '').match(/^\s*(\d+(?:\.\d+)?)\s*(?:servings?|people|portions?)?\s*$/i);
    try { return validateRecipeDraft({name:recipe.name,ingredients:recipe.recipeIngredient,steps:instructions(recipe.recipeInstructions),servings:match ? Number(match[1]) : null,sourceUrl,sourceYield:String(yieldText || '')}); } catch { /* Try the next complete Recipe object. */ }
  }
  throw new Error('No complete Recipe JSON-LD found. Paste the source ingredients and steps instead.');
}
export function buildImportedRecipe(draft, id = `imported-${crypto.randomUUID()}`) {
  const valid = validateRecipeDraft(draft);
  if (valid.servings === null) throw new Error('Confirm the source serving count before saving.');
  return {
    recipe: { id, name: valid.name, category: 'Imported recipes', calories:null, protein:null, sodium:null, potassium:null, phosphorus:null, sourceLabel:'Imported source · nutrition unknown', sourceUrl:valid.sourceUrl, imported:true },
    details: { servings:valid.servings, servingSize:'Source serving (user confirmed)', ingredients:valid.ingredients, steps:valid.steps, notes:'Imported draft. Verify the source quantities and preparation before cooking. Nutrition has not been calculated.', source: { publisher:new URL(valid.sourceUrl).hostname,title:valid.name,url:valid.sourceUrl,printedPage:null,imported:true,sourceYield:valid.sourceYield } },
  };
}
