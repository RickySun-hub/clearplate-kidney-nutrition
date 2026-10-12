import test from 'node:test';
import assert from 'node:assert/strict';
import {PATIENT_PAGES,patientPageFromHash,patientPageHash,writePatientPage} from './patientNavigation.js';
test('patient deep links accept only actual primary pages and never RD/auth routes',()=>{
 for(const page of PATIENT_PAGES)assert.equal(patientPageFromHash(patientPageHash(page)),page);
 for(const hash of ['#rd-signin','#rd-invite/id','#care-invite/id','#patient/admin','#patient/history/extra',''])assert.equal(patientPageFromHash(hash),null);
 assert.throws(()=>patientPageHash('rd'));
});
test('navigation preserves query parameters, replaces login location and avoids duplicate history',()=>{
 const calls=[];const browser={location:{hash:'#signin',pathname:'/',search:'?test=1'},history:{pushState:(_,__,url)=>calls.push(['push',url]),replaceState:(_,__,url)=>calls.push(['replace',url])}};
 writePatientPage('history',browser,true);writePatientPage('planner',browser);
 assert.deepEqual(calls,[['replace','/?test=1#patient/history'],['push','/?test=1#patient/planner']]);
 browser.location.hash='#patient/planner';assert.equal(writePatientPage('planner',browser),false);assert.equal(calls.length,2);
});
