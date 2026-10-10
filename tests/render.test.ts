import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSQLite } from '../lib/silicon/sqlite.mjs';
import { SharedWorld } from '../lib/silicon/d1';
import { checkRateLimit } from '../lib/silicon/rate-limit';
import { requestUrl, sameOrigin } from '../lib/silicon/server';

test('Render validates origins against the configured HTTPS site behind the TLS proxy', () => {
 const previousPath=process.env.SQLITE_PATH,previousUrl=process.env.SITE_URL;
 process.env.SQLITE_PATH='data/test.sqlite';process.env.SITE_URL='https://silicon.test';
 try {
  const request=new Request('http://localhost:3000/api/x/start',{headers:{origin:'https://silicon.test'}});
  assert.equal(requestUrl(request).href,'https://silicon.test/api/x/start');
  assert.doesNotThrow(()=>sameOrigin(request));
  assert.throws(()=>sameOrigin(new Request(request.url,{headers:{origin:'https://evil.test'}})),/ORIGIN_REQUIRED/);
 } finally {
  if(previousPath===undefined)delete process.env.SQLITE_PATH;else process.env.SQLITE_PATH=previousPath;
  if(previousUrl===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=previousUrl;
 }
});

test('Render SQLite retains ownership, world, X links and limits after reopening; batches roll back', async () => {
 const directory = mkdtempSync(join(tmpdir(), 'silicon-render-'));
 const path = join(directory, 'world.sqlite');
 let raw = openSQLite(path);
 try {
  let db = raw as unknown as D1Database, world = new SharedWorld(db);
  await world.touch('owner-a');
  const agent = await world.create('owner-a', 'Aster', [0,1,2,0,1]);
  const creations = await Promise.all([world.create('owner-a','Retry',[1,1,1,1,1]),world.create('owner-a','Retry',[1,1,1,1,1])]);
  assert.ok(creations.every(a => a.id === agent.id));
  await assert.rejects(()=>world.beginX('owner-b',agent.id,'bad','verifier'),/X_OWNER_REQUIRED/);
  const now = Date.now();
  await world.beginX('owner-a',agent.id,'state','verifier',now);
  const claims = await Promise.all([world.consumeX('owner-a','state',now+1),world.consumeX('owner-a','state',now+1)]);
  assert.equal(claims.filter(Boolean).length,1);
  assert.equal(await world.finishX('owner-a','state',{id:'123',username:'aster',name:'Aster',linkedAt:new Date(now).toISOString()},now+2),true);
  await world.tick('owner-a',now+5000);
  const request = new Request('https://world.test/api/successor',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.10'}});
  const limits = await Promise.all(Array.from({length:8},()=>checkRateLimit(request,db,now)));
  assert.equal(limits.filter(r=>!r).length,5);
  await assert.rejects(()=>raw.batch([raw.prepare("INSERT INTO silicon_sessions VALUES('rollback',0,0)"),raw.prepare('INSERT INTO nonexistent VALUES(1)')]));
  assert.equal(await raw.prepare("SELECT * FROM silicon_sessions WHERE hash='rollback'").first(),null);
  raw.close(); raw = openSQLite(path); db = raw as unknown as D1Database; world = new SharedWorld(db);
  assert.equal(await world.hasSession('owner-a'),true);
  const snapshot = await world.snapshot('owner-a',now+6000);
  assert.equal(snapshot.mineId,agent.id);
  assert.equal(snapshot.agents.find(a=>a.id===agent.id)?.xAccount?.username,'aster');
  assert.equal((await checkRateLimit(request,db,now))?.status,429);
  await world.unlinkX('owner-a',agent.id);
  assert.equal((await world.snapshot()).agents.find(a=>a.id===agent.id)?.xAccount,undefined);
 } finally { raw.close(); rmSync(directory,{recursive:true,force:true}); }
});
