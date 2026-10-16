// Deliberately small English variation list. No translation or inferred ingredients.
const variations={bananas:'banana',tomatoes:'tomato',potatoes:'potato',onions:'onion',apples:'apple',carrots:'carrot',eggs:'egg',lemons:'lemon',limes:'lime',beans:'bean',peppers:'pepper',yoghurt:'yogurt',chilli:'chili',chillies:'chili',chilies:'chili'};
const tokens=text=>String(text || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.map(word=>variations[word] || word) || [];
function oneEdit(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0;while(i<a.length&&a[i]===b[i])i++;
  if(i===a.length)return b.length-a.length<=1;
  if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  return a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
function matchTerm(term,words){
  if(words.includes(term))return 0;
  if(term.length>=2&&words.some(word=>word.startsWith(term)))return 1;
  if(term.length>=4&&words.some(word=>word.length>=4&&oneEdit(term,word)))return 2;
  return Infinity;
}
export function searchRecipes(recipes,details={},query=''){
  const terms=tokens(query.trim().slice(0,160));
  return recipes.map(recipe=>{
    const title=tokens(recipe.name);
    const ingredients=[...new Set([...(Array.isArray(details[recipe.id]?.ingredients)?details[recipe.id].ingredients:[]),...(recipe.calculation?.ingredients || []).map(row=>row.food?.description)].filter(text=>typeof text==='string'&&text.trim()))];
    const ingredientTokens=ingredients.map(tokens);
    const all=[...title,...ingredientTokens.flat()];
    const matches=terms.map(term=>matchTerm(term,all));
    if(matches.some(value=>!Number.isFinite(value)))return null;
    const level=Math.max(0,...matches);
    const exactTitle=title.join(' ')===terms.join(' ');
    const inTitle=terms.every(term=>title.includes(term));
    const hintIndex=ingredientTokens.findIndex(words=>terms.some(term=>matchTerm(term,words)===level));
    const score=terms.length?level*10+(exactTitle?0:inTitle?1:2):0;
    return {recipe,score,approximate:level===2,ingredientHint:terms.length&&!inTitle&&hintIndex>=0?ingredients[hintIndex]:null};
  }).filter(Boolean).sort((a,b)=>a.score-b.score||a.recipe.name.localeCompare(b.recipe.name));
}
