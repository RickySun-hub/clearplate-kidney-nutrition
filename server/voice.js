import { readFileSync } from 'node:fs';
export class VoiceError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const fail = (status, code, message) => { throw new VoiceError(status, code, message); };
const MAX_BYTES = 2800000;
export function voiceAllowed(req, env = process.env) {
  if (env.VERCEL || env.NODE_ENV === 'production') return false;
  const address = req.socket?.remoteAddress;
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
  let host;
  try { host = new URL(`http://${req.headers?.host}`).hostname; } catch { return false; }
  return env.VOICE_LOCAL_ENABLED === 'true' && local && ['localhost', '127.0.0.1', '[::1]'].includes(host);
}
export function assertOrigin(req) {
  let origin;
  try { origin = new URL(req.headers?.origin); } catch { fail(403, 'origin_required', 'A same-origin browser request is required.'); }
  if (origin.host !== req.headers?.host || !['http:', 'https:'].includes(origin.protocol)) fail(403, 'origin_denied', 'A same-origin browser request is required.');
}
export async function readVoiceBody(req) {
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > MAX_BYTES) fail(413, 'too_large', 'Recording is too large. Use a shorter recording.'); chunks.push(bytes); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  let serialized;
  try { serialized = typeof body === 'string' ? body : JSON.stringify(body); } catch { fail(400, 'invalid_request', 'Invalid voice request.'); }
  if (!serialized || Buffer.byteLength(serialized) > MAX_BYTES) fail(413, 'too_large', 'Recording is too large.');
  try { return typeof body === 'string' ? JSON.parse(body) : body; } catch { fail(400, 'invalid_request', 'Invalid voice request.'); }
}
export function createVoiceService({ apiKey, fetchImpl = fetch, recipes = [], now = Date.now, throttle = true } = {}) {
  let nextRequestAt = 0; let busy = false;
  async function upstream(path, body, json = false) {
    const response = await fetchImpl(`https://api.openai.com/v1/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: json ? JSON.stringify(body) : body, signal: AbortSignal.timeout(25000) });
    if (!response.ok) fail(503, 'voice_upstream_unavailable', 'Voice service is temporarily unavailable. Try typing instead.');
    return response.json();
  }
  return { async process(body) {
    if (!apiKey) fail(503, 'voice_unavailable', 'Voice is not configured. You can still type and log food manually.');
    if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'invalid_request', 'Invalid voice request.');
    let transcript = body.transcript;
    if (body.audio !== undefined) {
      if (typeof body.audio !== 'string' || body.audio.length > 2700000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio) || !['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'].includes(body.mimeType) || !Number.isFinite(body.duration) || body.duration <= 0 || body.duration > 60) fail(400, 'invalid_audio', 'Use a supported recording under 60 seconds.');
    } else if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 2000) fail(400, 'invalid_transcript', 'Enter up to 2,000 characters.');
    if (throttle && (busy || now() < nextRequestAt)) fail(429, 'voice_rate_limited', 'Wait a few seconds before another voice request.');
    busy = true; nextRequestAt = now() + 10000;
    try {
      if (body.audio !== undefined) {
        const form = new FormData(); form.append('model', 'gpt-4o-mini-transcribe'); form.append('response_format', 'json');
        const extension = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav' }[body.mimeType];
        form.append('file', new Blob([Buffer.from(body.audio, 'base64')], { type: body.mimeType }), `recording.${extension}`);
        transcript = (await upstream('audio/transcriptions', form)).text;
      }
      if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 2000) fail(400, 'invalid_transcript', 'No usable short transcript was returned.');
      const result = await upstream('chat/completions', { model: 'gpt-4o-mini', max_tokens: 240, temperature: 0, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'Interpret food logging or cooking navigation. Return JSON only: {"intent":"food"|"cooking"|"unknown","recipeId":string|null,"foodName":string,"servings":number,"meal":"Breakfast"|"Lunch"|"Dinner"|"Snack","command":"next"|"previous"|"repeat"|"none"}. Never generate nutrient values or cooking instructions. Match recipeId only from this list: ' + JSON.stringify(recipes.map(({ id, name }) => ({ id, name }))) },
        { role: 'user', content: transcript }
      ] }, true);
      let draft; try { draft = JSON.parse(result.choices?.[0]?.message?.content); } catch { fail(503, 'invalid_response', 'Could not interpret the transcript. Please edit and retry.'); }
      if (!draft || typeof draft !== 'object' || Array.isArray(draft)) fail(503, 'invalid_response', 'Could not interpret the transcript. Please edit and retry.');
      return { transcript, draft: { intent: ['food', 'cooking'].includes(draft.intent) ? draft.intent : 'unknown', recipeId: recipes.some(recipe => recipe.id === draft.recipeId) ? draft.recipeId : null, foodName: typeof draft.foodName === 'string' ? draft.foodName.slice(0, 120) : '', servings: Number.isFinite(draft.servings) && draft.servings >= 0.25 && draft.servings <= 20 ? draft.servings : 1, meal: ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(draft.meal) ? draft.meal : 'Snack', command: ['next', 'previous', 'repeat'].includes(draft.command) ? draft.command : 'none' } };
    } catch (error) { if (error instanceof VoiceError) throw error; fail(503, 'voice_unavailable', 'Voice request failed. Please type instead.'); } finally { busy = false; }
  } };
}
let service;
export async function handleVoiceRequest(req, res, statusOnly = false) {
  res.setHeader('Cache-Control', 'no-store');
  const local = voiceAllowed(req);
  try {
    if (statusOnly) {
      if (local) return res.status(200).json({ available: Boolean(process.env.OPENAI_API_KEY), mode:'local' });
      if (!productionVoiceConfigured()) return res.status(200).json({available:false,message:'AI voice is not configured.'});
      await authenticateVoice(req);
      return res.status(200).json({available:true,mode:'authenticated'});
    }
    if (req.method !== 'POST') fail(405, 'method_not_allowed', 'Use POST.');
    assertOrigin(req);
    if (!String(req.headers?.['content-type']).startsWith('application/json')) fail(415, 'invalid_content_type', 'Use JSON.');
    if (!process.env.OPENAI_API_KEY) fail(503,'voice_unavailable','AI voice is not configured.');
    // Reserve quota for every authenticated attempt, including malformed/retried inputs.
    const quota = local ? {maxAudioSeconds:60} : await authenticateVoice(req,{consume:true});
    const body = await readVoiceBody(req);
    if (body?.audio !== undefined && !local) {
      if (body.mimeType !== 'audio/wav' || typeof body.audio !== 'string' || body.audio.length>2700000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio)) fail(400,'invalid_audio','Use a bounded PCM WAV recording.');
      body.duration = validateWav(Buffer.from(body.audio,'base64'),quota.maxAudioSeconds);
    }
    const activeService = local ? (service ??= createVoiceService({ apiKey:process.env.OPENAI_API_KEY, recipes:JSON.parse(readFileSync(new URL('../src/data/recipes.json',import.meta.url),'utf8')) })) : createVoiceService({apiKey:process.env.OPENAI_API_KEY, recipes:JSON.parse(readFileSync(new URL('../src/data/recipes.json',import.meta.url),'utf8')),throttle:false});
    return res.status(200).json(await activeService.process(body));
  } catch (error) { const safe = error instanceof VoiceError ? error : new VoiceError(503, 'voice_unavailable', 'Voice is unavailable.'); return res.status(safe.status).json({ error: { code: safe.code, message: safe.message } }); }
}

export function validateWav(bytes, maxSeconds = 60) {
  const invalid = () => fail(400, 'invalid_audio', 'Use a mono 16 kHz PCM recording under the allowed duration.');
  if (bytes.length < 44 || bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) invalid();
  let position = 12, format = false, dataBytes = 0, dataChunks = 0;
  while (position + 8 <= bytes.length) {
    const name = bytes.toString('ascii',position,position+4), length = bytes.readUInt32LE(position+4), start = position+8;
    if (start+length > bytes.length) invalid();
    if (name === 'fmt ') {
      if (format || length !== 16 || bytes.readUInt16LE(start)!==1 || bytes.readUInt16LE(start+2)!==1 || bytes.readUInt32LE(start+4)!==16000 || bytes.readUInt32LE(start+8)!==32000 || bytes.readUInt16LE(start+12)!==2 || bytes.readUInt16LE(start+14)!==16) invalid();
      format = true;
    } else if (name === 'data') { dataChunks++; dataBytes += length; }
    else invalid();
    position = start+length+(length%2);
  }
  if (!format || dataChunks !== 1 || !dataBytes || dataBytes%2 || position!==bytes.length || dataBytes/32000 > maxSeconds) invalid();
  return dataBytes / 32000;
}
export function productionVoiceConfigured(env = process.env) {
  if (env.VOICE_ENABLED !== 'true' || !env.SUPABASE_ANON_KEY || !env.OPENAI_API_KEY) return false;
  try { const url = new URL(env.SUPABASE_URL); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/'; } catch { return false; }
}
export async function authenticateVoice(req, { env = process.env, fetchImpl = fetch, consume = false } = {}) {
  if (!productionVoiceConfigured(env)) fail(403, 'voice_disabled', 'Authenticated AI voice is not configured.');
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) fail(401, 'sign_in_required', 'Sign in before using AI voice.');
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization };
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) fail(401, 'session_invalid', 'Your session has expired. Sign in again.');
    const user = await response.json();
    if (!user?.id || user.is_anonymous === true || (!user.email_confirmed_at && !user.phone_confirmed_at)) fail(401, 'verified_account_required', 'Use a verified account for AI voice.');
    if (!consume) return { userId: user.id };
    const quotaResponse = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/consume_voice_quota`, { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body:'{}', signal:AbortSignal.timeout(10000) });
    if (!quotaResponse.ok) fail(503,'quota_unavailable','Voice quota is unavailable. Please try manual logging.');
    const quota = await quotaResponse.json();
    if (quota?.allowed !== true) fail(429,'voice_quota_exceeded','Voice limit reached or requests are too close together. Try later or log manually.');
    if (!Number.isInteger(quota.maxAudioSeconds) || quota.maxAudioSeconds<1 || quota.maxAudioSeconds>60) fail(503,'quota_unavailable','Voice quota configuration is invalid.');
    return { userId:user.id,maxAudioSeconds:quota.maxAudioSeconds,remaining:quota.remaining };
  } catch(error) { if(error instanceof VoiceError) throw error; fail(503,'voice_auth_unavailable','Account verification is unavailable. Please use manual logging.'); }
}
