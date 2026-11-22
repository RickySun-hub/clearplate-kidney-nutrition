import {useEffect,useRef,useState} from 'react';
import {normalizeBarcode,sameBarcode} from '../utils/barcode.js';
let decoderLoading;
function loadDecoder(){
 if(window.ZXingBrowser)return Promise.resolve(window.ZXingBrowser);
 if(!decoderLoading)decoderLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/zxing-browser-0.2.1.min.js';script.onload=()=>resolve(window.ZXingBrowser);script.onerror=()=>{decoderLoading=null;script.remove();reject(Error('Scanner could not load. Enter the barcode below.'));};document.head.append(script);});
 return decoderLoading;
}
function Camera({onCode,onClose}){
 const video=useRef(null),callbacks=useRef({onCode,onClose});callbacks.current={onCode,onClose};
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false,stream,controls,timer;
  const stop=()=>{controls?.stop();stream?.getTracks().forEach(t=>t.stop());clearTimeout(timer);};
  void(async()=>{try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access requires HTTPS and a supported browser. Enter the barcode below.');
   const lib=await loadDecoder();if(cancelled)return;
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(cancelled){stop();return;}
   const reader=new lib.BrowserMultiFormatOneDReader();
   controls=await reader.decodeFromStream(stream,video.current,(result,_error,control)=>{
    if(cancelled||!result)return;
    let code;try{code=normalizeBarcode(result.getText());}catch{return;}
    cancelled=true;control.stop();stop();callbacks.current.onCode(code);
   });
   if(cancelled){stop();return;}
   timer=setTimeout(()=>{cancelled=true;stop();setError('No barcode found. Try better lighting or enter the number below.');},45000);
  }catch(e){if(!cancelled){stop();setError(e.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser or enter the barcode below.':e.name==='NotFoundError'?'No camera was found. Enter the barcode below.':'The camera could not start. Close other camera apps or enter the barcode below.');}}})();
  const hidden=()=>{if(document.hidden){cancelled=true;stop();callbacks.current.onClose();}};document.addEventListener('visibilitychange',hidden);
  return()=>{cancelled=true;stop();document.removeEventListener('visibilitychange',hidden);};
 },[]);
 return <div className="barcode-camera"><video ref={video} muted autoPlay playsInline aria-label="Barcode camera preview"/><p>Place the barcode inside the camera view. Camera images stay on this device.</p>{error&&<p role="alert">{error}</p>}<button type="button" onClick={onClose}>Stop scanning</button></div>;
}
export default function BarcodeLookup({client,onChoose,onBarcode,disabled=false}){
 const [scanning,setScanning]=useState(false),[code,setCode]=useState(''),[result,setResult]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const version=useRef(0),abort=useRef(null);
 useEffect(()=>()=>{version.current++;abort.current?.abort();},[]);
 async function lookup(raw){
  const current=++version.current;abort.current?.abort();abort.current=new AbortController();setResult(null);setMessage('');
  let barcode;try{barcode=normalizeBarcode(raw);}catch(e){setMessage(e.message);setBusy(false);return;}
  setCode(barcode);onBarcode?.(barcode);setBusy(true);
  try{
   if(client?.foodReview){
    const rows=await client.foodReview('search',{query:barcode}).catch(()=>[]);
    if(current!==version.current)return;
    const reviewed=rows.find(r=>sameBarcode(r.food?.barcode,barcode));
    if(reviewed){setResult({...reviewed.food,catalogId:reviewed.id,catalogVersion:reviewed.version,source:'Nepholio reviewed library',reviewStatus:'reviewed',sourceSnapshot:reviewed.food});return;}
   }
   const response=await fetch('/api/barcode?barcode='+encodeURIComponent(barcode),{signal:abort.current.signal,credentials:'omit'});
   const data=await response.json();if(current!==version.current)return;
   if(!response.ok)throw Error(data.error||'Lookup failed. Please enter the label manually.');
   if(!data.product){setMessage('No product found. Enter the label manually, or submit this barcode for review.');return;}
   setResult(data.product);
  }catch(e){if(current===version.current&&e.name!=='AbortError')setMessage(e.message);}
  finally{if(current===version.current)setBusy(false);}
 }
 return <section className="barcode-lookup" aria-label="Scan packaged food"><button type="button" className="secondary-button" disabled={disabled||busy} onClick={()=>{setMessage('');setScanning(true);}}>Scan barcode</button>
 {scanning&&<Camera onClose={()=>setScanning(false)} onCode={value=>{setScanning(false);void lookup(value);}}/>}
 <label>Barcode number<input inputMode="numeric" maxLength={14} value={code} disabled={disabled} onChange={e=>{version.current++;abort.current?.abort();setBusy(false);setResult(null);setMessage('');setCode(e.target.value);onBarcode?.(e.target.value);}} placeholder="Type the number if scanning is unavailable"/></label>
 <button type="button" disabled={disabled||busy||!code.trim()} onClick={()=>lookup(code)}>{busy?'Looking up…':'Look up barcode'}</button>
 <p>Lookup sends only the barcode to the product database. Check the package before recording food.</p>
 {message&&<p role="status">{message}</p>}
 {result&&<div className="barcode-result"><strong>{result.name}</strong><p>{result.brand} · {result.servingDescription||'Serving size unavailable — enter from the package'}</p><p>{result.source}{result.reviewStatus!=='reviewed'?' · Community data, not reviewed by Nepholio':''}</p>
 {result.sourceUrl&&<p><a href={result.sourceUrl} target="_blank" rel="noreferrer">Open Food Facts product</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL attribution</a></p>}
 <button type="button" disabled={disabled} onClick={()=>{onChoose(result);setResult(null);}}>This is my product — use these values</button></div>}
 </section>;
}
