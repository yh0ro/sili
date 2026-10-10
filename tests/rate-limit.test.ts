import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { checkRateLimit, rateLimitAddress, rateLimitPolicies } from '../lib/silicon/rate-limit';

function request(ip = '192.0.2.1', path = '/api/successor', cookie = 'a') {
 return new Request(`https://world.test${path}`, { method: 'POST', headers: {
  'CF-Connecting-IP': ip, cookie: `silicon_guest=${cookie}`, 'X-Forwarded-For': 'spoofed',
 } });
}

test('rate limits use the edge IP, share creation/import budgets, and ignore local spoofing', () => {
 assert.equal(rateLimitAddress(request()), '192.0.2.1');
 assert.equal(rateLimitAddress(new Request('http://127.0.0.1:5173/api/world', { headers: {'CF-Connecting-IP': 'spoofed'} })), 'local');
 assert.equal(rateLimitAddress(new Request('https://world.test/api/world', {headers: {'X-Forwarded-For': 'spoofed'}})), 'unknown');
 assert.deepEqual(rateLimitPolicies(request('ip', '/api/successor/import')), rateLimitPolicies(request()));
 assert.deepEqual(rateLimitPolicies(new Request('https://world.test/world')), []);
});

test('real D1 rate limits concurrent creation attempts across instances, cookie changes, expiry and cleanup', async () => {
 const mf = new Miniflare({modules: true, script: 'export default {fetch(){return new Response("ok")}}', compatibilityDate: '2026-05-15', d1Databases: ['DB']});
 try {
  const raw = await mf.getD1Database('DB');
  const db = raw as unknown as D1Database;
  await raw.batch(readFileSync(new URL('../drizzle/0003_free_thunderbolts.sql', import.meta.url), 'utf8')
   .split('--> statement-breakpoint').filter(s => s.trim()).map(s => raw.prepare(s)));
  const now = 3_600_000 + 1000;
  const results = await Promise.all(Array.from({length: 12}, (_, i) =>
   checkRateLimit(request('192.0.2.1', i % 2 ? '/api/successor/import' : '/api/successor', String(i)), db, now)));
  assert.equal(results.filter(r => !r).length, 5);
  for (const result of results.filter(r => r !== null)) {
   assert.equal(result.status, 429);
   assert.equal(result.headers.get('retry-after'), '3599');
   assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(await checkRateLimit(request('192.0.2.2'), db, now), null);
  const rows = await raw.prepare('SELECT key,count FROM silicon_rate_limits').all();
  assert.ok(!JSON.stringify(rows).includes('192.0.2.1'));
  assert.ok(rows.results.some(r => String(r.key).startsWith('creation:') && r.count === 5));
  assert.equal(await checkRateLimit(request(), db, 7_200_000), null);
  assert.equal((await raw.prepare('SELECT count(*) AS n FROM silicon_rate_limits WHERE expires_at<=7200000').first())!.n, 0);
 } finally { await mf.dispose(); }
});

test('real D1 allows polling and limits aggregate API, history and OAuth traffic', async () => {
 const mf = new Miniflare({modules: true, script: 'export default {fetch(){return new Response("ok")}}', compatibilityDate: '2026-05-15', d1Databases: ['DB']});
 try {
  const raw = await mf.getD1Database('DB'), db = raw as unknown as D1Database;
  await raw.batch(readFileSync(new URL('../drizzle/0003_free_thunderbolts.sql', import.meta.url), 'utf8')
   .split('--> statement-breakpoint').filter(s => s.trim()).map(s => raw.prepare(s)));
  for (const [path, limit] of [['/api/world', 240], ['/api/history', 60], ['/api/x/start', 10]] as const) {
   for (let i = 0; i < limit; i++) assert.equal(await checkRateLimit(request(path, path), db, 60_000), null);
   const blocked = await checkRateLimit(request(path, path), db, 60_000);
   assert.equal(blocked?.status, 429);
   assert.equal(blocked?.headers.get('retry-after'), '60');
   assert.equal(await checkRateLimit(request(path, path), db, 120_000), null);
  }
 } finally { await mf.dispose(); }
});
