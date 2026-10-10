import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {SharedWorld} from '../lib/silicon/d1';
import {pkceChallenge,xHash,xConfiguration,verifyX,xEndpoint,xStart,xAgentSchema,xCallback} from '../lib/silicon/x';

async function fixture(){const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-15',d1Databases:['DB']});const raw=await mf.getD1Database('DB');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){await raw.batch(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8').split('--> statement-breakpoint').filter(s=>s.trim()).map(s=>raw.prepare(s.trim())));}return{mf,db:raw,world:new SharedWorld(raw as unknown as D1Database)};}
const account={id:'123456789',username:'aster_test',name:'Aster Example',linkedAt:'2026-10-10T12:00:00.000Z'};
test('X PKCE uses S256; credentials are unavailable by default; starts reject foreign origins',async()=>{
 assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');assert.equal((await xHash('secret')).length,64);
 assert.equal(xConfiguration(),null);assert.equal(xAgentSchema.safeParse({agentId:'not-a-uuid'}).success,false);
 const result=await xEndpoint(()=>xStart(new Request('https://world.test/api/x/start',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'})));assert.equal(result.status,403);
 const missingOrigin=await xEndpoint(()=>xStart(new Request('https://world.test/api/x/start',{method:'POST',body:'{}'})));assert.equal(missingOrigin.status,403);
 const invalidCallback=await xCallback(new Request('https://world.test/api/x/callback?state=invalid&returnTo=https://evil.test'));assert.equal(invalidCallback.headers.get('location'),'/world?x=failed');assert.equal(invalidCallback.headers.get('referrer-policy'),'no-referrer');
});
test('real D1 linking is owner-only, single-use, expiring, unique, and preserved by simulation writes',async()=>{
 const {mf,db,world}=await fixture();try{
  const a=await world.create('owner-a','Aster',[0,1,2,0,1]),b=await world.create('owner-b','Beryl',[1,2,0,1,2]),now=Date.now();
  await assert.rejects(()=>world.beginX('owner-b',a.id,'state-wrong','verifier',now),/X_OWNER_REQUIRED/);
  await world.beginX('owner-a',a.id,'state-a','secret-verifier',now);
  assert.equal(await world.consumeX('owner-b','state-a',now+1),null);
  const claims=await Promise.all([world.consumeX('owner-a','state-a',now+1),world.consumeX('owner-a','state-a',now+1)]);assert.equal(claims.filter(Boolean).length,1);
  assert.equal(await world.finishX('owner-a','state-a',account,now+2),true);assert.equal(await world.finishX('owner-a','state-a',account,now+3),false);
  const publicState=await world.snapshot('owner-b');assert.deepEqual(publicState.agents.find(x=>x.id===a.id)?.xAccount,account);assert.ok(!JSON.stringify(publicState).includes('secret-verifier'));assert.ok(!JSON.stringify(publicState).includes('owner-a'));
  await world.tick('owner-a',now+5000);assert.deepEqual((await world.snapshot()).agents.find(x=>x.id===a.id)?.xAccount,account);
  await world.beginX('owner-b',b.id,'state-b','other-verifier',now);await world.consumeX('owner-b','state-b',now+1);await assert.rejects(()=>world.finishX('owner-b','state-b',account,now+2),/X_ALREADY_LINKED/);await world.discardX('owner-b','state-b');assert.equal((await world.snapshot()).agents.find(x=>x.id===b.id)?.xAccount,undefined);
  await world.beginX('owner-b',b.id,'expired','old-verifier',now);const expired=await world.consumeX('owner-b','expired',now+600001);assert.ok(expired!.expires_at<=now+600001);assert.equal(await world.finishX('owner-b','expired',{...account,id:'987'},now+600001),false);
  await assert.rejects(()=>world.unlinkX('owner-b',a.id),/X_OWNER_REQUIRED/);
  await world.beginX('owner-a',a.id,'pending','verifier',now);await world.consumeX('owner-a','pending',now+1);await world.unlinkX('owner-a',a.id);assert.equal(await world.finishX('owner-a','pending',account,now+2),false);assert.equal((await world.snapshot()).agents.find(x=>x.id===a.id)?.xAccount,undefined);
  await world.beginX('owner-a',a.id,'old','verifier',now);await world.consumeX('owner-a','old',now+1);await world.beginX('owner-a',a.id,'new','verifier',now+2);assert.equal(await world.finishX('owner-a','old',account,now+3),false);
  assert.equal((await db.prepare('SELECT x_id FROM silicon_x_links').all()).results.length,0);
 }finally{await mf.dispose();}
});
test('X verification exchanges code with confidential authentication and verifies /users/me, without refresh scope',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];const mock=(async(url:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(url),init});return calls.length===1?Response.json({access_token:'ephemeral-only',token_type:'bearer'}):Response.json({data:{id:account.id,username:account.username,name:account.name}});}) as typeof fetch;
 const result=await verifyX('code','verifier',{clientId:'client',clientSecret:'secret',callback:'https://world.test/api/x/callback'},mock);assert.equal(result.id,account.id);assert.equal(calls[0].url,'https://api.x.com/2/oauth2/token');assert.equal(new Headers(calls[0].init?.headers).get('Authorization'),'Basic '+btoa('client:secret'));assert.equal(new URLSearchParams(calls[0].init?.body as URLSearchParams).get('code_verifier'),'verifier');assert.equal(calls[1].url,'https://api.x.com/2/users/me');assert.ok(!JSON.stringify(result).includes('ephemeral-only'));assert.ok(!String(calls[0].init?.body).includes('offline.access'));
 const malformed=(async()=>Response.json({access_token:'token',token_type:'bearer',data:{id:'abc',username:'unsafe/url',name:'Name'}})) as typeof fetch;await assert.rejects(()=>verifyX('code','verifier',{clientId:'c',clientSecret:'s',callback:'https://world.test/api/x/callback'},malformed));
});
