// Exercise the database without returning records or changing user data.
export function createCloudHealthHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function cloudHealth(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false });
    }
    if (!env.CRON_SECRET || req.headers?.authorization !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ ok: false });
    }
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL || '')
      || !env.SUPABASE_ANON_KEY?.startsWith('sb_publishable_')) {
      return res.status(503).json({ ok: false, error: 'Cloud health check is not configured.' });
    }
    const headers = { apikey: env.SUPABASE_ANON_KEY };
    try {
      const auth = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/health`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!auth.ok) throw new Error();
      // This dedicated SQL function returns only true and never accesses tables.
      // A few database requests per day follow Supabase's low-activity guidance.
      for (let i = 0; i < 3; i++) {
        const database = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/cloud_healthcheck`, {
          method: 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(5000),
        });
        if (!database.ok || await database.json() !== true) throw new Error();
      }
      return res.status(200).json({ ok: true, databaseChecks: 3, checkedAt: new Date().toISOString() });
    } catch {
      return res.status(503).json({ ok: false, error: 'Cloud health check failed.' });
    }
  };
}
