export function normalizeBarcode(value) {
 const code=String(value??'').trim();
 if(!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))throw Error('Enter an 8, 12, 13 or 14 digit product barcode.');
 let sum=0;for(let i=code.length-2,m=3;i>=0;i--,m=4-m)sum+=Number(code[i])*m;
 if((10-sum%10)%10!==Number(code.at(-1)))throw Error('The barcode check digit does not match. Please scan again or check the number.');
 return code;
}
export const sameBarcode=(a,b)=>String(a).padStart(14,'0')===String(b).padStart(14,'0');
