import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessLoader,rdTransitions,captureRDInvitation} from './rdAccess.js';
test('RD access loader drops late approvals, clears on failure and ignores disposed responses',async()=>{
 const pending=[];let state,calls=0;const loader=createAccessLoader(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),s=>{state=s;calls++;});
 const a=loader.refresh(),b=loader.refresh();pending[1].resolve({approved:false,isAdmin:false});await b;
 pending[0].resolve({approved:true,isAdmin:true});await a;assert.equal(state.access.approved,false);
 const c=loader.refresh();pending[2].reject(Error('Offline'));await c;assert.equal(state.access,null);
 const d=loader.refresh();loader.dispose();const before=calls;pending[3].resolve({approved:true,isAdmin:true});await d;assert.equal(calls,before);
});
test('RD transitions offer only reviewable states, not revoked self reinstatement',()=>{
 assert.deepEqual(rdTransitions('pending'),['approved','rejected']);assert.deepEqual(rdTransitions('approved'),['suspended','revoked']);assert.deepEqual(rdTransitions('revoked'),[]);
});
test('RD invitation capture persists only validated identifier and a routing preference',()=>{
 const values={};const browser={location:{hash:'#rd-invite/44444444-4444-4444-8444-444444444444'},sessionStorage:{setItem:(k,v)=>values[k]=v}};
 assert.equal(captureRDInvitation(browser),true);assert.equal(values['renalsync-login-destination'],'rd');
 browser.location.hash='#rd-invite/not-an-id';assert.equal(captureRDInvitation(browser),false);assert.equal(Object.keys(values).length,2);
});
