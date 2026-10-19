// Stored recipe nutrients describe one serving. Batch yield is metadata, not
// another nutrition multiplier; old saved serving counts retain their meaning.
const positive = value => ['number','string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value)>0;
export function recipeYield(recipe, details) {
  const value = recipe?.calculation?.servings ?? details?.servings;
  return positive(value) ? Number(value) : null;
}
export function resolveRecipeServings(recipe, details, amount=1, basis='servings') {
  if (basis==='whole') {
    const count=recipeYield(recipe,details);
    if(count===null)throw Error('How many servings does the whole recipe make? Confirm its yield first.');
    return count;
  }
  if(basis!=='servings'||!positive(amount))throw Error('Enter a positive number of recipe servings.');
  return Number(amount);
}
// Only source-declared units are shown; never infer grams or a person's meal size.
export function recipeServingLabel(recipe, details) {
  const size = details?.servingSize?.trim();
  return size ? `1 serving = ${size}` : '1 recipe serving';
}
export function recipeWholeLabel(recipe, details) {
  const count = recipeYield(recipe, details);
  if (count === null) return 'Whole recipe yield unknown';
  const size = details?.servingSize?.trim();
  // A source explicitly declaring one countable item permits exact count display.
  const unit = /^1 (wonton|wrap|piece|muffin|cookie|pancake|slice)$/i.exec(size || '')?.[1];
  return unit ? `Whole recipe = ${count} ${unit}${count === 1 ? '' : 's'}` : `Whole recipe = ${count} recipe servings`;
}
export function recipePortionLabel(recipe, details) {
  return `${recipeServingLabel(recipe, details)} · ${recipeWholeLabel(recipe, details)}`;
}
