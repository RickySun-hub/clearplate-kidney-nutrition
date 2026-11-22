import test from 'node:test';
import assert from 'node:assert/strict';
import { createPatientReview, patientDirectory, filterPatients, pendingInvitations } from './rdWorkspace.js';
const row=id=>({owner_id:id,updated_at:'2026-10-10T10:00:00Z',profile:{name:id}});
const record=id=>({owner_id:id,updated_at:'2026-10-10T10:00:00Z',record:{profile:{name:id},entries:[],dayRecords:{}}});
test('pending, unrelated and revoked invitations do not add readable directory files',()=>{
  const invitations=[{reader_id:'rd',owner_id:'pending',status:'pending',active:true},{reader_id:'other-rd',owner_id:'other',status:'accepted',active:true},{reader_id:'rd',owner_id:'revoked',status:'accepted',active:false},{reader_id:'rd',owner_id:'waiting',status:'accepted',active:true,responded_at:'2026-10-10'}];
  const directory=patientDirectory([row('visible')],invitations,'rd');
  assert.deepEqual(directory.map(p=>p.owner_id),['visible','waiting']);assert.equal(directory[1].updated_at,null);assert.equal(directory[1].noRecord,true);
  assert.equal(filterPatients(directory,'VISI').length,1);assert.equal(filterPatients(directory,'','waiting').length,1);
});
test('selection ignores duplicate clicks and late responses after back or another patient',async()=>{
  let state,calls=0;const pending={};
  const controller=createPatientReview({shared:async()=>[row('A'),row('B')],invitations:async()=>[],read:id=>{calls++;return new Promise(r=>pending[id]=r);}},s=>state=s);
  await controller.refresh();const a=controller.open('A');await controller.open('A');assert.equal(calls,1);
  const b=controller.open('B');pending.A(record('A'));await a;assert.equal(state.record,null);
  pending.B(record('B'));await b;assert.equal(state.record.profile.name,'B');
  const again=controller.open('A');controller.close();pending.A(record('A'));await again;assert.equal(state.selectedId,null);assert.equal(state.record,null);
});
test('revocation, refresh error and disposal clear or suppress patient content',async()=>{
  let rows=[row('A')],state,fail=false,late;
  const controller=createPatientReview({shared:async()=>{if(fail)throw Error('Offline');return rows;},invitations:async()=>[],read:async()=>record('A')},s=>state=s);
  await controller.refresh();await controller.open('A');rows=[];await controller.refresh();assert.equal(state.record,null);assert.equal(state.selectedId,null);
  rows=[row('A')];await controller.refresh();await controller.open('A');fail=true;await controller.refresh();assert.equal(state.record,null);assert.deepEqual(state.patients,[]);
  let emissions=0;const stale=createPatientReview({shared:()=>new Promise(r=>late=r),invitations:async()=>[]},()=>emissions++);
  const request=stale.refresh();stale.dispose();late([row('A')]);await request;assert.equal(emissions,0);
});
test('unauthorized selection and mismatched patient responses fail closed',async()=>{
  let state,reads=0;
  const controller=createPatientReview({shared:async()=>[row('A')],invitations:async()=>[{owner_id:'pending',status:'pending'}],read:async()=>{reads++;return record('B');}},s=>state=s);
  await controller.refresh();await controller.open('pending');assert.equal(reads,0);await controller.open('A');assert.equal(state.record,null);assert.match(state.error,/did not match/);
});

test('late read failure cannot close a newer patient, and disposed reads emit nothing',async()=>{
  let state,rejectA,resolveB,emissions=0;
  const controller=createPatientReview({shared:async()=>[row('A'),row('B')],invitations:async()=>[],read:id=>new Promise((resolve,reject)=>{if(id==='A')rejectA=reject;else resolveB=resolve;})},s=>{state=s;emissions++;});
  await controller.refresh();const a=controller.open('A');const b=controller.open('B');
  rejectA(Error('Old request failed'));await a;assert.equal(state.selectedId,'B');assert.equal(state.error,'');
  controller.dispose();const before=emissions;resolveB(record('B'));await b;assert.equal(emissions,before);
});
test('older directory response cannot restore revoked access',async()=>{
  let state;const pending=[];
  const controller=createPatientReview({shared:()=>new Promise(r=>pending.push(r)),invitations:async()=>[],read:async()=>record('A')},s=>state=s);
  const first=controller.refresh();pending[0]([row('A')]);await first;await controller.open('A');
  const old=controller.refresh();const newer=controller.refresh();pending[2]([]);await newer;
  pending[1]([row('A')]);await old;assert.deepEqual(state.patients,[]);assert.equal(state.record,null);assert.equal(state.selectedId,null);
});

test('email lookup requires complete normalized equality and only searches connected rows', () => {
  const patients = [{owner_id:'file-one', profile:{name:'Synthetic Alice'}, email:' Patient@Example.test ', noRecord:false}];
  assert.equal(filterPatients(patients, ' patient@example.TEST ').length, 1);
  for (const partial of ['patient@', 'example.test', 'patient']) assert.equal(filterPatients(patients, partial).length, 0);
  assert.equal(filterPatients(patients, 'ALIC').length, 1);
  assert.equal(filterPatients(patients, 'file-one').length, 1);
  assert.equal(filterPatients(patients, 'unconnected@example.test').length, 0);
  assert.equal(filterPatients(patients, 'Alice', 'waiting').length, 0);
});
test('follow-up counts only this RD pending invitations with a future expiry', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  const pending = {reader_id:'rd',status:'pending',expires_at:'2026-10-15T00:00:00Z'};
  assert.equal(pendingInvitations([pending, {...pending, reader_id:'other'}, {...pending,status:'revoked'}, {...pending,expires_at:'2026-10-14T11:00:00Z'}, {...pending, expires_at:'invalid'}, {...pending, expires_at:undefined}], 'rd', now).length, 1);
});
