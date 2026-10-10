import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loginToken,validToken,requireAdmin,adminCookie,adminMutation,saveAddress,contractAddress,addressSchema} from '../lib/silicon/admin';
import {openSQLite} from '../lib/silicon/sqlite.mjs';
import {rateLimitPolicies} from '../lib/silicon/rate-limit';

test('admin login rejects bad credentials, forged/expired sessions and password rotation; mutations reject foreign origins',async()=>{
 const previous=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='test-only-admin-password';
 try {
  const now=1_800_000_000_000;
  await assert.rejects(()=>loginToken('wrong',now),/AUTH_REQUIRED/);
  const token=await loginToken('test-only-admin-password',now);
  assert.equal(await validToken(token,now),true);
  assert.equal(await validToken(token,now+4*60*60*1000),false);
  assert.equal(await validToken(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),now),false);
  process.env.ADMIN_PASSWORD='different-test-password';assert.equal(await validToken(token,now),false);
  await assert.rejects(()=>requireAdmin(new Request('https://world.test/api/admin/address')),/AUTH_REQUIRED/);
  const req=new Request('https://world.test/api/admin/login',{headers:{origin:'https://world.test'}});
  assert.doesNotThrow(()=>adminMutation(req));
  assert.throws(()=>adminMutation(new Request(req.url,{headers:{origin:'https://evil.test'}})),/ORIGIN_REQUIRED/);
  assert.throws(()=>adminMutation(new Request(req.url)),/ORIGIN_REQUIRED/);
  assert.match(adminCookie(req,token),/HttpOnly; SameSite=Strict.*Secure/);
  assert.match(adminCookie(req,''),/Max-Age=0/);
  assert.ok(rateLimitPolicies(req).some(p=>p.bucket==='admin'&&p.limit===10));
  delete process.env.ADMIN_PASSWORD;await assert.rejects(()=>loginToken('anything',now),/Set ADMIN_PASSWORD/);
 } finally {if(previous===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=previous;}
});

test('saved CA overrides environment immediately and survives reopening without a deploy',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'silicon-admin-')),path=join(directory,'world.sqlite');
 let raw=openSQLite(path);const previous=process.env.CONTRACT_ADDRESS;process.env.CONTRACT_ADDRESS='XXXXX';
 try {
  const db=raw as unknown as D1Database;
  assert.equal(await contractAddress(db),'XXXXX');
  const address='0x1234567890abcdef';await saveAddress(address,db);
  assert.equal(await contractAddress(db),address);
  for(const invalid of ['', 'not an address','<script>', 'a'.repeat(129)])assert.equal(addressSchema.safeParse({address:invalid}).success,false);
  raw.close();raw=openSQLite(path);
  assert.equal(await contractAddress(raw as unknown as D1Database),address);
 } finally {raw.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.CONTRACT_ADDRESS;else process.env.CONTRACT_ADDRESS=previous;}
});
