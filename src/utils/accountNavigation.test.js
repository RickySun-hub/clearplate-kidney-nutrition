import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAccountPage, signOutAccount, profileHasUnsavedChanges } from './accountNavigation.js';
test('synthetic preview client without clearSession still logs out', async () => {
  let cleared=false;
  await signOutAccount({signOut:async()=>{}},()=>{cleared=true;});
  assert.equal(cleared,true);
});
test('patient preference cannot open the professional route, including old links', () => {
  for (const page of ['rd', 'rd-signin', 'planner']) assert.equal(defaultAccountPage({ accountRole: 'patient' }, page), 'today');
  assert.equal(defaultAccountPage({ accountRole: 'patient' }, 'history'), 'history');
});
test('dietitians always land in the patient directory rather than their own food log', () => {
  assert.equal(defaultAccountPage({ accountRole: 'dietitian' }, 'today'), 'rd');
});
test('logout clears the UI even if remote revocation fails and returns a visible warning', async () => {
  const events = [];
  const result = await signOutAccount({ signOut: async () => { events.push('logout'); throw Error('offline'); }, clearSession: () => events.push('clear') }, result => events.push(result));
  assert.match(result.warning, /Cloud logout could not be confirmed/);
  assert.deepEqual(events, ['logout', 'clear', { warning: '', pending: true }]);
});
test('logout clears private UI immediately and its late result never clears a newer account', async () => {
  let finish;
  const remote = new Promise(resolve => { finish = resolve; });
  const calls = [];
  let visibleAccount = 'synthetic-A';
  const result = signOutAccount({ signOut: () => remote, clearSession: () => calls.push('memory cleared') }, state => { calls.push(state); visibleAccount = null; });
  assert.equal(visibleAccount, null);
  assert.deepEqual(calls, ['memory cleared', { warning: '', pending: true }]);
  visibleAccount = 'synthetic-B';
  finish();
  assert.deepEqual(await result, { warning: '' });
  assert.equal(visibleAccount, 'synthetic-B');
  assert.equal(calls.length, 2);
});
test('unchanged profile does not need confirmation; changed raw activity answers do', () => {
  const profile = { name: 'Sample', activitySurvey: { work: 'mostly-seated', leisure: 'weekend-light' } };
  assert.equal(profileHasUnsavedChanges(profile, { activitySurvey: { ...profile.activitySurvey }, name: 'Sample' }), false);
  assert.equal(profileHasUnsavedChanges(profile, { ...profile, activitySurvey: { ...profile.activitySurvey, work: 'frequent-carrying' } }), true);
});
