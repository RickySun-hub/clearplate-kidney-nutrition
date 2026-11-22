import { NUTRIENT_KEYS, validNutrientValue } from './nutrientCatalog.js';
export function normalizeFoodSubmission(value) {
  const name=String(value.name || '').trim(), brand=String(value.brand || '').trim();
  const barcode=String(value.barcode || '').trim(), servingDescription=String(value.servingDescription || '').trim();
  if (!name || name.length>150 || brand.length>150 || !servingDescription || servingDescription.length>200) throw Error('Enter the food name and the serving described on its label.');
  if (barcode && !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)) throw Error('Enter an 8, 12, 13 or 14 digit barcode, or leave it blank.');
  const nutrients=Object.fromEntries(NUTRIENT_KEYS.map(key=>{
    const raw=value.nutrients?.[key];
    if (raw==null || String(raw).trim()==='') return [key,null];
    if (!validNutrientValue(raw)) throw Error('Nutrition values must be nonnegative; leave unlisted values blank.');
    return [key,Number(raw)];
  }));
  return {name,brand,barcode,servingDescription,nutrients};
}
export function catalogFoodSnapshot(row) {
  const food=normalizeFoodSubmission(row.food);
  return {name:food.name,brand:food.brand,barcode:food.barcode,...food.nutrients,servingDescription:food.servingDescription,
    method:'reviewed-label',methodLabel:'Reviewed food label · saved when logged',catalogId:row.id,catalogVersion:row.version,
    sourceSnapshot:JSON.parse(JSON.stringify(food))};
}
