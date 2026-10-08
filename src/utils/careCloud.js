import { validConversation, MEALS } from './mealConversation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isAccountId = (value) => typeof value === 'string' && UUID.test(value.trim());
import { NUTRIENT_KEYS, validNutrientValue } from './nutrientCatalog.js';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const textFields = (value, keys) => keys.every((key) => value[key] == null || (typeof value[key] === 'string' && value[key].length <= 10000));
const nutrientFields = (value) => NUTRIENT_KEYS.every((key) => value[key] == null || validNutrientValue(value[key]));
const profileValid = (profile) => object(profile)
  && textFields(profile, ['name', 'condition', 'stage', 'treatment', 'reviewedAt'])
  && ['weightKg', 'heightCm', 'sodiumTargetMg', 'proteinMinG', 'proteinMaxG'].every((key) => profile[key] == null || validNutrientValue(profile[key]))
  && (profile.trackedNutrients === undefined || (Array.isArray(profile.trackedNutrients) && profile.trackedNutrients.every((key) => NUTRIENT_KEYS.includes(key))))
  && (profile.nutrientTargets === undefined || (object(profile.nutrientTargets) && Object.entries(profile.nutrientTargets).every(([key, target]) => NUTRIENT_KEYS.includes(key) && object(target) && ['min','max'].every((bound) => target[bound] == null || validNutrientValue(target[bound])))));
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validateCareRecord(value) {
  const invalid = () => { throw new Error('The record contains invalid fields and cannot be opened or uploaded.'); };
  if (!object(value) || !profileValid(value.profile) || !Array.isArray(value.entries) || value.entries.length > 10000 || !object(value.dayRecords) || Object.keys(value.dayRecords).length > 10000) invalid();
  for (const entry of value.entries) {
    if (!object(entry) || !validDate(entry.date) || !validNutrientValue(entry.servings) || Number(entry.servings) <= 0
      || !textFields(entry, ['id','meal','time','timeSource','recordedAt','createdAt','recipeId']) || !['recipe','custom'].includes(entry.source)) invalid();
    if (entry.conversation !== undefined && !validConversation(entry.conversation)) invalid();
    if (!textFields(entry,['inputMethod','confirmedAt'])) invalid();
    if (entry.source === 'recipe' && (typeof entry.recipeId !== 'string' || !entry.recipeId.trim())) invalid();
    if (entry.source === 'custom') {
      const food = entry.customFood;
      if (!object(food) || !textFields(food, ['name','title','sourceLabel','method']) || !nutrientFields(food)
        || (food.baseEstimate !== undefined && (!object(food.baseEstimate) || !nutrientFields(food.baseEstimate)))) invalid();
    }
  }
  for (const [date, day] of Object.entries(value.dayRecords)) {
    if (day?.mealReviews !== undefined && (!object(day.mealReviews) || Object.entries(day.mealReviews).some(([meal,r])=> !MEALS.includes(meal) || !object(r) || !['reviewed','not-eaten'].includes(r.status) || !validConversation(r.conversation) || typeof r.reviewedAt !== 'string' || !Number.isFinite(Date.parse(r.reviewedAt))))) invalid();
    if (!validDate(date) || (day !== null && (!object(day) || !textFields(day, ['completedAt','signature']) || (day.profile !== undefined && !profileValid(day.profile))))) invalid();
  }
  let serialized;
  try {
    serialized = JSON.stringify({ profile: value.profile, entries: value.entries, dayRecords: value.dayRecords }, (key, item) => {
      if (['__proto__','constructor','prototype'].includes(key) || ['function','symbol','bigint'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item))) invalid();
      return item;
    });
  } catch { invalid(); }
  if (new TextEncoder().encode(serialized).length > 2000000) throw new Error('This record is too large to upload.');
  return JSON.parse(serialized);
}
export function createCareCloud(config, fetcher = fetch) {
  const base = new URL(config?.url || config?.supabaseUrl || 'https://invalid.example');
  const key = config?.publishableKey;
  if (base.protocol !== 'https:' || base.username || base.password || !key?.startsWith('sb_publishable_')) throw new Error('Cloud connection is not configured.');
  const origin = base.origin;
  let session = null;
  let disposed = false;
  let generation = 0;
  async function request(path, { method = 'GET', body, prefer, authenticated = true } = {}) {
    if (disposed) throw new Error('Cloud connection was closed.');
    const requestGeneration = generation;
    if (authenticated && (!session || session.expiresAt <= Date.now())) { session = null; throw new Error('Please sign in again.'); }
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (authenticated) headers.Authorization = `Bearer ${session.token}`;
    if (prefer) headers.Prefer = prefer;
    let response;
    try { response = await fetcher(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', credentials: 'omit' }); }
    catch { throw new Error('Cloud connection failed. Please try again.'); }
    if (disposed) throw new Error('Cloud connection was closed.');
    if (generation !== requestGeneration) throw new Error('Account changed. Please retry.');
    if (!response.ok) {
      let problem = {}; try { problem = await response.json(); } catch {}
      if (!authenticated && problem.code === 'email_not_confirmed') throw new Error('Confirm your email before signing in. Open the confirmation message, then return here.');
      if (!authenticated && problem.code === 'invalid_credentials') throw new Error('Email or password is incorrect. New here? Choose Create account first.');
      if (!authenticated && ['email_address_not_authorized','over_email_send_rate_limit'].includes(problem.code)) throw new Error('Confirmation email could not be sent. The email service needs configuration or has reached its sending limit.');
      if (response.status === 401) { session = null; throw new Error('Please sign in again. Check your email and password.'); }
      if (!authenticated && problem.code === 'otp_expired') throw new Error('This code is invalid or expired. Please request a new code.');
      if (response.status === 429) throw new Error('Too many requests. Please wait and try again.');
      throw new Error(authenticated ? 'Cloud action could not be completed. Check account access and try again.' : 'Account action failed. Check your email, password and confirmation email.');
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (disposed) throw new Error('Cloud connection was closed.');
    if (generation !== requestGeneration) throw new Error('Account changed. Please retry.');
    try { return text ? JSON.parse(text) : null; } catch { throw new Error('Cloud returned an unexpected response.'); }
  }
  const account = () => session?.verified ? { id: session.user.id, email: session.user.email, ...(session.user.phone ? {phone:session.user.phone} : {}) } : null;
  async function acceptSession(result, authGeneration) {
    if (!result?.access_token) return null;
    session = { token: result.access_token, expiresAt: Date.now() + Math.min(Number(result.expires_in) || 3600, 3600) * 1000 };
    try {
      const user = await request('/auth/v1/user');
      if (!isAccountId(user?.id)) throw new Error('Account response could not be verified.');
      if (generation !== authGeneration) throw new Error('Account changed. Please retry.');
      session.user = { id: user.id, email: typeof user.email === 'string' ? user.email : undefined, phone: typeof user.phone === 'string' ? user.phone : undefined }; session.verified = true;
      return account();
    } catch (error) { if (generation === authGeneration) session = null; throw error; }
  }
  async function authenticate(email, password, signup) {
    session = null;
    const authGeneration = ++generation;
    const result = await request(signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', { method: 'POST', authenticated: false, body: { email: email.trim(), password } });
    return acceptSession(result, authGeneration);
  }
  return {
    account,
    async phoneAvailable() {
      const settings=await request('/auth/v1/settings',{authenticated:false});
      return settings?.external?.phone === true;
    },
    async sendPhoneCode(phone) {
      const normalized=String(phone).replace(/[\s()-]/g,'');
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('Enter a phone number with its country code, such as +1.');
      if (!await this.phoneAvailable()) throw new Error('Phone sign-in is not available yet. Please use Google or email.');
      await request('/auth/v1/otp',{method:'POST',authenticated:false,body:{phone:normalized,channel:'sms',create_user:true}});
    },
    async verifyPhoneCode(phone,token) {
      if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(token)) throw new Error('Enter the six-digit code from your text message.');
      session=null;
      const authGeneration=++generation;
      const result=await request('/auth/v1/verify',{method:'POST',authenticated:false,body:{phone,token,type:'sms'}});
      const user=await acceptSession(result,authGeneration);
      if(!user)throw new Error('The code could not be verified. Please request a new code.');
      return user;
    },
    async googleAvailable() {
      const settings = await request('/auth/v1/settings', { authenticated: false });
      return settings?.external?.google === true;
    },
    async signInWithGoogle(browser = window) {
      if (!await this.googleAvailable()) throw new Error('Google sign-in is being set up. Please use email for now.');
      const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const redirect = new URL('/', browser.location.href);
      browser.sessionStorage.setItem('clearplate-google-pkce', JSON.stringify({ verifier, createdAt: Date.now(), origin: redirect.origin }));
      const url = new URL('/auth/v1/authorize', origin);
      url.search = new URLSearchParams({ provider: 'google', redirect_to: redirect.href, code_challenge: challenge, code_challenge_method: 's256', prompt: 'select_account' }).toString();
      browser.location.assign(url.href);
    },
    async finishGoogleSignIn(browser = window) {
      const url = new URL(browser.location.href);
      if (!url.searchParams.has('code') && !url.searchParams.has('error')) return null;
      const code = url.searchParams.get('code');
      const denied = url.searchParams.has('error');
      for (const name of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(name);
      browser.history.replaceState(null, '', url.pathname + url.search);
      let pending;
      try { pending = JSON.parse(browser.sessionStorage.getItem('clearplate-google-pkce')); } catch {}
      browser.sessionStorage.removeItem('clearplate-google-pkce');
      if (denied) throw new Error('Google sign-in was not completed. Please try again or use email.');
      if (!pending || !/^[a-f0-9]{64}$/.test(pending.verifier) || pending.origin !== url.origin || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > 600000 || pending.createdAt > Date.now()) throw new Error('This sign-in link has expired. Start Google sign-in again in this tab.');
      session = null;
      const authGeneration = ++generation;
      const result = await request('/auth/v1/token?grant_type=pkce', { method: 'POST', authenticated: false, body: { auth_code: code, code_verifier: pending.verifier } });
      const user = await acceptSession(result, authGeneration);
      if (!user) throw new Error('Google sign-in could not be completed. Please try again.');
      return user;
    },
    accessToken: () => session?.verified && session.expiresAt > Date.now() ? session.token : null,
    clearSession: () => { generation++; session = null; },
    dispose: () => { generation++; disposed = true; session = null; },
    signIn: (email, password) => authenticate(email, password, false),
    signUp: (email, password) => authenticate(email, password, true),
    async signOut() {
      const token = session?.token;
      generation++; session = null;
      if (!token || disposed) return;
      let response;
      try { response = await fetcher(`${origin}/auth/v1/logout`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit' }); }
      catch { throw new Error('Signed out on this device. Cloud logout could not be confirmed.'); }
      if (!response.ok) throw new Error('Signed out on this device. Cloud logout could not be confirmed.');
    },
    async upload(record) {
      const snapshot = validateCareRecord(record);
      const owner = account();
      if (!owner) throw new Error('Please sign in again.');
      return request('/rest/v1/care_records?on_conflict=owner_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: { owner_id: owner.id, record: snapshot, updated_at: new Date().toISOString() } });
    },
    async grant(readerId) {
      if (!isAccountId(readerId) || readerId.trim().toLowerCase() === account()?.id.toLowerCase()) throw new Error('Enter your RD’s account ID.');
      return request('/rest/v1/care_grants?on_conflict=owner_id,reader_id', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', body: { owner_id: account()?.id, reader_id: readerId.trim() } });
    },
    async grants() {
      const rows = await request(`/rest/v1/care_grants?owner_id=eq.${account()?.id}&select=reader_id,created_at`);
      if (!Array.isArray(rows) || rows.some((row) => !isAccountId(row?.reader_id))) throw new Error('Cloud returned an unexpected access list.');
      return rows.map(({reader_id,created_at}) => ({reader_id,created_at}));
    },
    async revoke(readerId) {
      if (!isAccountId(readerId)) throw new Error('Invalid account ID.');
      return request(`/rest/v1/care_grants?owner_id=eq.${account()?.id}&reader_id=eq.${readerId.trim()}`, { method: 'DELETE' });
    },
    async shared() {
      const rows = await request(`/rest/v1/care_records?owner_id=neq.${account()?.id}&select=owner_id,updated_at&order=updated_at.desc`);
      if (!Array.isArray(rows) || rows.some((row) => !isAccountId(row?.owner_id) || typeof row.updated_at !== 'string')) throw new Error('Cloud returned an unexpected patient list.');
      return rows.map(({owner_id,updated_at}) => ({owner_id,updated_at}));
    },
    async read(ownerId) {
      if (!isAccountId(ownerId)) throw new Error('Invalid patient account ID.');
      const rows = await request(`/rest/v1/care_records?owner_id=eq.${ownerId}&select=owner_id,record,updated_at`);
      if (!Array.isArray(rows)) throw new Error('Cloud returned an unexpected record.');
      if (!rows.length) throw new Error('This record is no longer shared with your account.');
      if (rows.length !== 1 || rows[0]?.owner_id !== ownerId || typeof rows[0].updated_at !== 'string') throw new Error('Cloud returned an unexpected record.');
      return { owner_id: rows[0].owner_id, updated_at: rows[0].updated_at, record: validateCareRecord(rows[0].record) };
    },
  };
}
