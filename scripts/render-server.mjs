import { createServer } from 'node:http';
import { isIP } from 'node:net';
import next from 'next';
import { getSQLiteDatabase } from '../lib/silicon/sqlite.mjs';
import { checkRateLimit } from '../lib/silicon/rate-limit.ts';

const port = Number(process.env.PORT || 3000);
const configured = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;
if (!configured) throw new Error('Set SITE_URL to the public HTTPS origin.');
const site = new URL(configured);
if (site.pathname !== '/' || site.search || site.hash || site.username || site.password ||
 !(site.protocol === 'https:' || (site.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(site.hostname)))) {
 throw new Error('SITE_URL must be an HTTPS origin (HTTP is allowed on localhost).');
}
if (process.env.RENDER && !process.env.SQLITE_PATH?.startsWith('/var/data/')) {
 throw new Error('Render SQLITE_PATH must be under the persistent disk at /var/data/.');
}
if (process.env.SUPABASE_URL || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY) {
 throw new Error('The Render setup uses SQLite. Remove Supabase variables.');
}
if (process.env.X_CALLBACK_URL && process.env.X_CALLBACK_URL !== `${site.origin}/api/x/callback`) {
 throw new Error('X_CALLBACK_URL must match SITE_URL + /api/x/callback.');
}
const database = getSQLiteDatabase(); // Runtime migrations run on the mounted disk.
const app = next({ dev: false, hostname: '0.0.0.0', port });
await app.prepare();
const handler = app.getRequestHandler();
const server = createServer(async (req, res) => {
 try {
  const url = new URL(req.url || '/', site.origin);
  if (url.origin !== site.origin) { res.writeHead(400); res.end(); return; }
  if (url.pathname === '/healthz') {
   await database.prepare('SELECT 1').first();
   res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return;
  }
  // Only trust Render's edge forwarding header when actually running on Render.
  const forwarded = process.env.RENDER ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const ip = isIP(forwarded) ? forwarded : req.socket.remoteAddress || 'unknown';
  const limited = await checkRateLimit(new Request(url, {method: req.method,
   headers: {'CF-Connecting-IP': ip}}), database);
  if (limited) { res.writeHead(limited.status, Object.fromEntries(limited.headers)); res.end(await limited.text()); return; }
  // Next builds route Request URLs from these values. Use the configured public
  // origin so HTTPS cookies and OAuth origin checks survive Render's TLS proxy.
  req.headers.host = site.host;
  req.headers['x-forwarded-host'] = site.host;
  req.headers['x-forwarded-proto'] = site.protocol.slice(0, -1);
  req.headers['x-forwarded-port'] = site.port || (site.protocol === 'https:' ? '443' : '80');
  await handler(req, res);
 } catch (error) {
  console.error('Request failed:', error instanceof Error ? error.message : 'unknown');
  if (!res.headersSent) res.writeHead(503, {'Content-Type': 'application/json', 'Retry-After': '30', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify({error: 'The service is temporarily unavailable. Please retry shortly.'}));
 }
});
server.listen(port, '0.0.0.0', () => console.log(`Ready on port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
 server.close(() => { database.close(); process.exit(0); });
 setTimeout(() => process.exit(0), 10_000).unref();
});
