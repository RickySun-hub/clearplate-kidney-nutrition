import { FdcError } from '../server/fdc.js';
import { getCalculationService, readCalculationBody } from '../server/calculation.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST for recipe calculations.' } });
  }
  try { return res.status(200).json(getCalculationService().calculate(await readCalculationBody(req))); }
  catch (error) {
    const safe = error instanceof FdcError ? error : new FdcError(503, 'calculation_unavailable', 'Recipe calculation is unavailable.');
    return res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  }
}
