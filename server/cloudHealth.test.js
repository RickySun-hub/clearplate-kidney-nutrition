import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudHealthHandler } from './cloudHealth.js';

const env = { CRON_SECRET: 'synthetic-cron-secret', SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_synthetic' };
const request = () => ({ method: 'GET', headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
const response = () => ({ statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });

test('scheduled check verifies auth and makes three row-free database queries', async () => {
  const calls = [];
  const handler = createCloudHealthHandler({ env, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(true), { status: 200 });
  } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.databaseChecks, 3);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(calls.length, 4);
  assert.ok(calls[0].url.endsWith('/auth/v1/health'));
  for (const call of calls.slice(1)) {
    assert.equal(call.options.method, 'GET');
    assert.ok(call.url.endsWith('/rest/v1/rpc/cloud_healthcheck'));
    assert.ok(!call.url.includes('care_records'));
    assert.equal(call.options.headers.Authorization, undefined);
    assert.equal(call.options.body, undefined);
  }
  assert.ok(!JSON.stringify(res.body).includes('synthetic'));
});

test('missing or incorrect cron authorization never contacts Supabase', async () => {
  const fetchImpl = () => { assert.fail('Must not fetch'); };
  for (const req of [{ method: 'GET', headers: {} }, { method: 'GET', headers: { authorization: 'Bearer wrong' } }]) {
    const res = response();
    await createCloudHealthHandler({ env, fetchImpl })(req, res);
    assert.equal(res.statusCode, 401);
  }
  const res = response();
  await createCloudHealthHandler({ env: { ...env, CRON_SECRET: undefined }, fetchImpl })(request(), res);
  assert.equal(res.statusCode, 401);
});

test('non-GET requests and unsafe cloud configuration fail before network access', async () => {
  const fetchImpl = () => { assert.fail('Must not fetch'); };
  const res = response();
  await createCloudHealthHandler({ env, fetchImpl })({ ...request(), method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  for (const config of [{ ...env, SUPABASE_URL: 'https://evil.example' }, { ...env, SUPABASE_ANON_KEY: 'service_role_synthetic' }]) {
    const result = response();
    await createCloudHealthHandler({ env: config, fetchImpl })(request(), result);
    assert.equal(result.statusCode, 503);
  }
});

test('auth failure stops database queries and does not report success', async () => {
  let calls = 0;
  const res = response();
  await createCloudHealthHandler({ env, fetchImpl: async () => { calls++; return new Response('private upstream details', { status: 521 }); } })(request(), res);
  assert.equal(calls, 1);
  assert.equal(res.statusCode, 503);
  assert.ok(!JSON.stringify(res.body).includes('private'));
});

test('database failures and network failures produce sanitized failure responses', async () => {
  for (const networkFailure of [false, true]) {
    let calls = 0;
    const res = response();
    await createCloudHealthHandler({ env, fetchImpl: async () => {
      if (++calls === 1) return new Response(null);
      if (networkFailure) throw new Error('private network details');
      return new Response('private database details', { status: 403 });
    } })(request(), res);
    assert.equal(calls, 2);
    assert.equal(res.statusCode, 503);
    assert.ok(!JSON.stringify(res.body).includes('private'));
  }
});

test('an unexpected database response cannot be mistaken for a healthy query', async () => {
  for (const body of ['false', '{}', '"true"', 'not-json']) {
    let calls = 0;
    const res = response();
    await createCloudHealthHandler({ env, fetchImpl: async () => new Response(++calls === 1 ? '{}' : body) })(request(), res);
    assert.equal(calls, 2);
    assert.equal(res.statusCode, 503);
  }
});
