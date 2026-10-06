export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  // Only publishable/anon keys are public. Never return service_role credentials.
  let safe = typeof key === 'string' && key.startsWith('sb_publishable_');
  if (!safe && typeof key === 'string') {
    try { safe = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  }
  if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !safe) return res.status(200).json({ configured:false });
  return res.status(200).json({ configured:true, url, publishableKey:key });
}
