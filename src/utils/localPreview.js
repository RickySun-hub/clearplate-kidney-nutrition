import {createFoodReviewDemo,createFoodReviewDemoStore} from './foodReviewDemo.js';
const foodStore=createFoodReviewDemoStore();
// This module is loaded only by the Vite development build on loopback.
// It never authenticates, sends requests, or reads real account storage.
import { defaultProfile } from '../data/seed.js';
import { validateCareRecord } from './careCloud.js';
import { createDietitianDemo } from './rdDemo.js';

const prefix = 'nepholio-local-preview-v1:';
const patientId = '10000000-0000-4000-8000-000000000001';
const dietitianId = '10000000-0000-4000-8000-000000000002';
export function createLocalPreviewSession(kind = 'patient') {
  if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw Error('Local preview is unavailable.');
  if (kind === 'dietitian' && new URLSearchParams(location.search).get('demo') === '1') { const demo=createDietitianDemo(); demo.client.foodReview=createFoodReviewDemo({store:foodStore,reviewer:true}).foodReview; return demo; }
  const id = kind === 'dietitian' ? dietitianId : patientId;
  const key = prefix + id;
  const load = (storageKey = key) => { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } };
  const isDietitian = () => load()?.record?.profile?.accountRole === 'dietitian';
  const account = { id, email: kind === 'dietitian' ? 'dietitian@example.invalid' : 'preview@example.invalid' };
  const initial = () => ({ profile: { ...defaultProfile }, entries: [], dayRecords: {} });
  const deny = async () => { throw Error('Sharing and invitations are unavailable in this local preview. No message was sent.'); };
  const client = {
    foodReview:createFoodReviewDemo({store:foodStore,reviewer:kind==='dietitian'}).foodReview,
    own: async () => load() || { record: initial(), updated_at: null },
    save: async (record, version) => {
      const previous = load();
      if ((previous?.updated_at || null) !== version) throw Error('This preview changed in another tab. Reload to continue.');
      const row = { record: validateCareRecord(record), updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(row)); return row;
    },
    rdAccess: async action => {
      if (action !== 'status') return deny();
      return { approved: isDietitian(), isAdmin: false, email: account.email, emailVerified: true };
    },
    shared: async () => {
      if (!isDietitian()) throw Error('Patient access is unavailable.');
      const row = load(prefix + patientId);
      return id !== patientId && row?.record?.profile?.onboarding?.completedAt
        ? [{ owner_id: patientId, updated_at: row.updated_at, profile: { ...row.record.profile, name: 'Local sample patient' } }] : [];
    },
    read: async requested => {
      if (!isDietitian() || id === patientId || requested !== patientId) throw Error('Patient access is unavailable.');
      const row = load(prefix + patientId);
      if (!row) throw Error('No local patient record yet.');
      return { ...row, owner_id: patientId, record: { ...row.record, profile: { ...row.record.profile, name: 'Local sample patient' } } };
    },
    invitations: async (action = 'list') => action === 'list' ? [] : deny(),
    grants: async () => [], grant: deny, revoke: deny, sendInvitationEmail: deny,
    signOut: async () => {}, accessToken: () => null,
  };
  return { account, client, accessToken: null, localPreview: true };
}

