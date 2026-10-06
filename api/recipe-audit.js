import { readFileSync } from 'node:fs';
let audits;
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET for recipe audits.' } }); }
  const id = req.query?.id;
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,120}$/.test(id)) return res.status(400).json({ error: { code: 'invalid_recipe', message: 'Supply a recipe ID.' } });
  try {
    audits ??= JSON.parse(readFileSync(new URL('../src/data/usdaRecipeAudit.json', import.meta.url), 'utf8'));
    if (!Object.hasOwn(audits, id)) return res.status(404).json({ error: { code: 'recipe_not_found', message: 'Recipe not found.' } });
    return res.status(200).json({ recipeId: id, ...audits[id], provenance: { mode: 'snapshot', live: false } });
  } catch { return res.status(503).json({ error: { code: 'audit_unavailable', message: 'Recipe audit unavailable.' } }); }
}
