import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parseRecipeSource, validateSourceUrl } from '../src/utils/recipeImport.js';
export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0 || (b===88 && c===99))) || (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113));
  }
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:/i.test(address) && !/^2002:/i.test(address);
  return false;
}
export async function resolvePublicUrl(value, resolver = lookup) {
  const url = new URL(validateSourceUrl(value));
  if (isIP(url.hostname)) throw new Error('IP-address recipe URLs are not supported.');
  const addresses = await resolver(url.hostname, { all:true, verbatim:true });
  if (!addresses.length || addresses.some(({address}) => !isPublicAddress(address))) throw new Error('Recipe URL must resolve only to public addresses.');
  return {url, address:addresses[0]};
}
export function downloadPinned({url,address}, remainingMs, transport = https.request) {
  return new Promise((resolve,reject) => {
    let settled = false;
    let timer;
    const finish = (error,value) => { if (settled) return; settled=true; clearTimeout(timer); if (error) reject(error); else resolve(value); };
    const req = transport(url, { method:'GET', agent:false, headers:{Accept:'text/html,application/ld+json,application/json','Accept-Encoding':'identity','User-Agent':'RenalSync-RecipeImporter/1.0'}, lookup:(_host,options,callback) => options?.all ? callback(null,[address]) : callback(null,address.address,address.family) }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode)) { res.destroy(); finish(null,{redirect:res.headers.location}); return; }
      if (res.statusCode !== 200 || !/^(?:text\/html|application\/(?:ld\+json|json))(?:;|$)/i.test(res.headers['content-type'] || '') || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) { res.destroy(); finish(new Error('Source page is unavailable or unsupported.')); return; }
      if (Number(res.headers['content-length']) > 1000000) { res.destroy(); finish(new Error('Source page exceeds 1 MB.')); return; }
      const chunks = []; let size=0;
      res.on('data',(chunk) => { size+=chunk.length; if (size>1000000) { res.destroy(); finish(new Error('Source page exceeds 1 MB.')); } else chunks.push(chunk); });
      res.on('end',() => finish(null,{text:Buffer.concat(chunks).toString('utf8')}));
      res.on('error',() => finish(new Error('Could not read the source page.')));
    });
    if (!settled) timer = setTimeout(() => { req.destroy(); finish(new Error('Source request timed out.')); },Math.max(1,remainingMs));
    req.on('error',() => finish(new Error('Could not fetch the source page.')));
    req.end();
  });
}
export async function importRecipeUrl(value, { resolver = lookup, download = downloadPinned, timeoutMs = 5000 } = {}) {
  let target = value;
  const deadline = Date.now()+timeoutMs;
  const work = async () => {
    for (let hop=0;hop<=3;hop++) {
      const pinned = await resolvePublicUrl(target,resolver);
      if (Date.now()>=deadline) throw new Error('Source request timed out.');
      const page = await download(pinned,deadline-Date.now());
      if (page.redirect) { if (hop===3) throw new Error('Too many source redirects.'); target = new URL(page.redirect,pinned.url).href; continue; }
      return parseRecipeSource(page.text,pinned.url.href);
    }
    throw new Error('Source request failed.');
  };
  let timer;
  try { return await Promise.race([work(),new Promise((_,reject) => { timer=setTimeout(()=>reject(new Error('Source request timed out.')),timeoutMs); })]); } finally { clearTimeout(timer); }
}
export async function handleRecipeImport(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:{message:'Use POST.'}});
  try {
    const origin = new URL(req.headers?.origin);
    if (origin.host !== req.headers?.host || !['http:','https:'].includes(origin.protocol)) throw new Error();
  } catch { return res.status(403).json({error:{message:'Use the recipe import form on this site.'}}); }
  if (!String(req.headers?.['content-type']).startsWith('application/json')) return res.status(415).json({error:{message:'Use JSON.'}});
  try {
    let body = req.body;
    if (body === undefined) { let text=''; for await (const chunk of req) { text+=chunk; if (Buffer.byteLength(text)>5000) throw new Error(); } body=text; }
    if (typeof body === 'string') { if (Buffer.byteLength(body)>5000) throw new Error(); body=JSON.parse(body); }
    if (!body || typeof body.url !== 'string') throw new Error();
    const draft = await importRecipeUrl(body.url);
    return res.status(200).json({draft});
  } catch { return res.status(422).json({error:{message:'Could not import this public recipe page. Paste its Recipe JSON-LD or ingredients and steps below.'}}); }
}
