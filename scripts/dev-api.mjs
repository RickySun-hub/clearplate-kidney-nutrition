import { createServer } from 'node:http';
import searchHandler from '../api/fdc-search.js';
import foodHandler from '../api/fdc-food.js';
import calculationHandler from '../api/recipe-calculate.js';
import auditHandler from '../api/recipe-audit.js';
import liveHandler from '../api/voice-live.js';
import voiceHandler from '../api/voice.js';
import voiceStatusHandler from '../api/voice-status.js';
import careConfigHandler from '../api/care-config.js';
import recipeImportHandler from '../api/recipe-import.js';

const handlers = new Map([['/api/fdc-search', searchHandler], ['/api/fdc-food', foodHandler], ['/api/recipe-calculate', calculationHandler], ['/api/recipe-audit', auditHandler]]);
handlers.set('/api/voice-live', liveHandler);
handlers.set('/api/voice', voiceHandler);
handlers.set('/api/voice-status', voiceStatusHandler);
handlers.set('/api/care-config', careConfigHandler);
handlers.set('/api/recipe-import', recipeImportHandler);
const server = createServer(async (req, res) => {
  res.status = status => { res.statusCode = status; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); return res; };
  try {
    const url = new URL(req.url, 'http://127.0.0.1:8787');
    const handler = handlers.get(url.pathname);
    if (!handler) return res.status(404).json({ error: { code: 'not_found', message: 'API route not found.' } });
    req.query = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => {
      const values = url.searchParams.getAll(key);
      return [key, values.length === 1 ? values[0] : values];
    }));
    await handler(req, res);
  } catch {
    if (!res.headersSent) res.status(503).json({ error: { code: 'unavailable', message: 'Nutrition API is unavailable.' } });
    else res.end();
  }
});
server.requestTimeout = 65000;
server.headersTimeout = 10000;
server.listen(8787, '127.0.0.1', () => console.log('Nutrition API listening at http://127.0.0.1:8787 (public USDA snapshot unless a server key is configured).'));
server.on('error', () => { console.error('Nutrition API could not bind to 127.0.0.1:8787.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
