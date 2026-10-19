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
  if(basis!=='servings'||!positive(amount))throw Error('Enter a positive number of personal servings.');
  return Number(amount);
}
export function recipePortionLabel(recipe, details) {
  const count=recipeYield(recipe,details);
  return count===null ? '1 personal serving · whole recipe yield unknown' : `1 personal serving · whole recipe makes ${count} serving${count===1?'':'s'}`;
}
