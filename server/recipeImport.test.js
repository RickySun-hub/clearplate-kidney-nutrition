import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, resolvePublicUrl, importRecipeUrl, downloadPinned, handleRecipeImport } from './recipeImport.js';
import { EventEmitter } from 'node:events';
const url='https://recipes.example.org/soup';
const resolver=async()=>[{address:'93.184.216.34',family:4}];
const source=JSON.stringify({'@type':'Recipe',name:'Soup',recipeIngredient:['1 carrot'],recipeInstructions:['Cook carrot.'],recipeYield:'2 servings'});
test('private, reserved, mapped and mixed DNS addresses are rejected',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','192.0.2.1','198.51.100.2','203.0.113.3','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1']) assert.equal(isPublicAddress(address),false,address);
 assert.equal(isPublicAddress('93.184.216.34'),true);
 await assert.rejects(()=>resolvePublicUrl('https://127.0.0.1/',resolver));
 await assert.rejects(()=>resolvePublicUrl(url,async()=>[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}]),/public/);
});
test('every redirect revalidates destination before download and redirect limit is bounded',async()=>{
 let calls=0;
 await assert.rejects(()=>importRecipeUrl(url,{resolver,download:async()=>{calls++;return{redirect:'https://127.0.0.1/private'};}}));assert.equal(calls,1);
 await assert.rejects(()=>importRecipeUrl(url,{resolver,download:async()=>({redirect:'/loop'})}),/redirects/);
 const draft=await importRecipeUrl(url,{resolver,download:async(pinned)=>{assert.equal(pinned.address.address,'93.184.216.34');return{text:source};}});assert.equal(draft.name,'Soup');
});
test('DNS timeout fails closed without any download',async()=>{
 let calls=0;
 await assert.rejects(()=>importRecipeUrl(url,{timeoutMs:10,resolver:()=>new Promise(()=>{}),download:async()=>{calls++;}}),/timed out/);assert.equal(calls,0);
});
test('transport uses pinned lookup, no cookies, and enforces download limit',async()=>{
 const transport=(_url,options,callback)=>{
  const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{
    assert.equal(options.agent,false);assert.equal(options.headers.Cookie,undefined);
    options.lookup('recipes.example.org',{all:true},(_error,addresses)=>assert.deepEqual(addresses,[{address:'93.184.216.34',family:4}]));
    const response=new EventEmitter();response.statusCode=200;response.headers={'content-type':'text/html'};response.destroy=()=>{};
    callback(response);response.emit('data',Buffer.alloc(1000001));response.emit('end');
  });req.destroy=()=>{};return req;
 };
 await assert.rejects(async()=>downloadPinned(await resolvePublicUrl(url,resolver),1000,transport),/1 MB/);
});

test('redirect DNS rebinding is rejected before the second HTTP request',async()=>{
 let resolutions=0,downloads=0;
 await assert.rejects(()=>importRecipeUrl(url,{resolver:async()=>[{address:++resolutions===1?'93.184.216.34':'10.1.2.3',family:4}],download:async()=>{downloads++;return{redirect:'/next'};}}),/public/);
 assert.equal(downloads,1);
});
test('endpoint rejects cross-origin and invalid methods before URL fetching',async()=>{
 const response=()=>({statusCode:null,payload:null,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.payload=body;return this;}});
 let res=response();await handleRecipeImport({method:'GET',headers:{}},res);assert.equal(res.statusCode,405);
 res=response();await handleRecipeImport({method:'POST',headers:{host:'clearplate.example.org',origin:'https://attacker.example.org','content-type':'application/json'},body:{url}},res);assert.equal(res.statusCode,403);
 res=response();await handleRecipeImport({method:'POST',headers:{host:'clearplate.example.org',origin:'https://clearplate.example.org','content-type':'application/json'},body:{url:'https://127.0.0.1/'}},res);assert.equal(res.statusCode,422);assert.ok(!JSON.stringify(res.payload).includes('127.0.0.1'));
});
