import { normalizeBarcode,sameBarcode } from '../src/utils/barcode.js';
const mapping={calories:['energy-kcal',1],protein:['proteins',1],carbs:['carbohydrates',1],fat:['fat',1],fiber:['fiber',1],sugars:['sugars',1],addedSugars:['added-sugars',1],saturatedFat:['saturated-fat',1],sodium:['sodium',1000],potassium:['potassium',1000],phosphorus:['phosphorus',1000],calcium:['calcium',1000],magnesium:['magnesium',1000],iron:['iron',1000],zinc:['zinc',1000],cholesterol:['cholesterol',1000]};
const text=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
export function normalizeBarcodeProduct(raw,code){
 if(raw.status!==1||!raw.product)return null;
 const p=raw.product;if(!sameBarcode(p.code??raw.code,code))throw Error('Product barcode mismatch');
 const name=text(p.product_name,150);if(!name)return null;
 const hasServing=typeof p.serving_quantity==='number'&&p.serving_quantity>0&&!!text(p.serving_size,200);
 const unit=['g','ml'].includes(p.serving_quantity_unit)?p.serving_quantity_unit:null;
 // A source basis is required. Never treat unknown composition or prepared nutrition as zero.
 const basis=hasServing?'serving':unit&&p.nutrition_data_per==='100g'?'100'+unit:null;
 const suffix=hasServing?'_serving':'_100g';
 const nutrients=Object.fromEntries(Object.entries(mapping).map(([key,[id,factor]])=>{
  const n=p.nutriments?.[id+suffix];
  const modifier=p.nutriments?.[id+'_modifier'];
  return [key,basis&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&!['<','>','≤','≥'].includes(modifier)?Math.round(n*factor*1e6)/1e6:null];
 }));
 return {name,brand:text(p.brands,150),barcode:code,servingDescription:hasServing?text(p.serving_size,200):basis?'100 '+unit:'',nutrients,
  measuredUnit:!hasServing&&basis?unit:null,source:'Open Food Facts',sourceUrl:'https://world.openfoodfacts.org/product/'+code,
  license:'ODbL 1.0',retrievedAt:new Date().toISOString(),reviewStatus:'external-unreviewed'};
}
export function createBarcodeService(fetcher=fetch){
 const cache=new Map();let windowStart=0,requests=0;
 return async function lookup(input){
  const code=normalizeBarcode(input),now=Date.now();const old=cache.get(code);if(old&&old.until>now)return old.product;
  if(now-windowStart>60000){windowStart=now;requests=0;}if(++requests>12)throw Error('Barcode lookup is busy. Please wait a minute.');
  const url='https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields=code,product_name,brands,serving_size,serving_quantity,serving_quantity_unit,nutriments,nutrition_data_per';
  const response=await fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{Accept:'application/json','User-Agent':'Nepholio/1.0 (https://nepholio.com)'}});
  if(response.status!==404&&!response.ok)throw Error('Product database is temporarily unavailable.');
  if(Number(response.headers.get('content-length'))>1000000)throw Error('Product response too large');
  const reader=response.body.getReader();let chunks=[],size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw Error('Product response too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const product=normalizeBarcodeProduct(JSON.parse(new TextDecoder().decode(bytes)),code);
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(code,{until:now+300000,product});return product;
 };
}
const lookup=createBarcodeService();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET.'});}
 let code;try{code=normalizeBarcode(req.query?.barcode);}catch(e){return res.status(400).json({error:e.message});}
 try{return res.status(200).json({product:await lookup(code)});}catch{return res.status(503).json({error:'Barcode lookup is temporarily unavailable. You can enter the package label manually.'});}
}
