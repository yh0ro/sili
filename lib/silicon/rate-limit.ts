type Policy = { bucket: string; limit: number; windowMs: number };
const minute = 60_000;

export function rateLimitPolicies(request: Request): Policy[] {
 const path = new URL(request.url).pathname;
 if (!path.startsWith('/api/')) return [];
 const policies: Policy[] = [{ bucket: 'api', limit: 240, windowMs: minute }];
 if (path.startsWith('/api/admin/')) {
  policies.push({bucket:'admin',limit:10,windowMs:minute});
 } else if (request.method === 'POST' && ['/api/successor', '/api/successor/import'].includes(path)) {
  policies.push({ bucket: 'creation', limit: 5, windowMs: 60 * minute });
 } else if (path.startsWith('/api/x/') && path !== '/api/x/status') {
  policies.push({ bucket: 'x', limit: 10, windowMs: minute });
 } else if (path === '/api/history') {
  policies.push({ bucket: 'history', limit: 60, windowMs: minute });
 }
 return policies;
}

// Called at the Worker entry point: Cloudflare supplies CF-Connecting-IP there.
// Local previews share one bucket and ignore caller-supplied forwarding headers.
export function rateLimitAddress(request: Request): string {
 const host = new URL(request.url).hostname;
 if (['localhost', '127.0.0.1', '[::1]'].includes(host)) return 'local';
 return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export async function checkRateLimit(request: Request, db: D1Database, now = Date.now()): Promise<Response | null> {
 const policies = rateLimitPolicies(request);
 if (!policies.length) return null;
 const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(rateLimitAddress(request)))), byte => byte.toString(16).padStart(2, '0')).join('');
 // Atomic capped upserts serialize concurrent requests across Worker instances.
 // A bounded cleanup prevents expired IP buckets accumulating indefinitely.
 const windows = policies.map(policy => ({ ...policy, start: Math.floor(now / policy.windowMs) * policy.windowMs }));
 const results = await db.batch<{ count: number }>([
  db.prepare('DELETE FROM silicon_rate_limits WHERE key IN (SELECT key FROM silicon_rate_limits WHERE expires_at<=? LIMIT 20)').bind(now),
  ...windows.map(policy => db.prepare(`INSERT INTO silicon_rate_limits(key,count,expires_at) VALUES(?,1,?)
   ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count`)
   .bind(`${policy.bucket}:${hash}:${policy.start}`, policy.start + policy.windowMs, policy.limit)),
 ]);
 let retryAfter = 0;
 for (let i = 0; i < windows.length; i++) {
  if (!results[i + 1].results.length) retryAfter = Math.max(retryAfter,
   Math.ceil((windows[i].start + windows[i].windowMs - now) / 1000));
 }
 return retryAfter ? Response.json({ error: 'Too many requests. Please try again later.' }, {
  status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'private, no-store' },
 }) : null;
}
