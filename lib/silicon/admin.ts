import { z } from 'zod';
import { requestUrl, sharedDatabase } from './server';

const cookieName='silicon_admin';
const duration=4*60*60;
const encode=new TextEncoder();
async function key() {
 const password=process.env.ADMIN_PASSWORD;
 if(!password||password.length<16)throw new Error('Set ADMIN_PASSWORD to at least 16 characters to enable admin access.');
 return crypto.subtle.importKey('raw',encode.encode(`silicon-admin-session:${password}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export async function loginToken(password:string,now=Date.now()) {
 const signingKey=await key();
 // Compare fixed-length digests rather than password strings.
 const expected=await crypto.subtle.sign('HMAC',signingKey,encode.encode(process.env.ADMIN_PASSWORD!));
 if(!await crypto.subtle.verify('HMAC',signingKey,expected,encode.encode(password)))throw new Error('AUTH_REQUIRED');
 const expiry=String(Math.floor(now/1000)+duration);
 return `${expiry}.${hex(await crypto.subtle.sign('HMAC',signingKey,encode.encode(expiry)))}`;
}
export async function validToken(token:string,now=Date.now()) {
 const match=/^(\d{10})\.([a-f0-9]{64})$/.exec(token);
 if(!match||Number(match[1])<=now/1000||Number(match[1])>now/1000+duration)return false;
 const signature=Uint8Array.from(match[2].match(/../g)!,x=>parseInt(x,16));
 return crypto.subtle.verify('HMAC',await key(),signature,encode.encode(match[1]));
}
export async function requireAdmin(request:Request) {
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 if(!await validToken(token))throw new Error('AUTH_REQUIRED');
}
export function adminCookie(request:Request,token:string) {
 return `${cookieName}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${token?duration:0}${requestUrl(request).protocol==='https:'?'; Secure':''}`;
}
export function adminMutation(request:Request) {
 if(request.headers.get('origin')!==requestUrl(request).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('ORIGIN_REQUIRED');
}
export const addressSchema=z.object({address:z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9]+$/,'Use only letters and numbers in the contract address.')}).strict();
export async function contractAddress(database?:D1Database) {
 const db=database||await sharedDatabase();
 const row=await db.prepare("SELECT value FROM silicon_settings WHERE key='contract_address'").first<{value:string}>();
 return row?.value||process.env.CONTRACT_ADDRESS?.trim()||'XXXXX';
}
export async function saveAddress(address:string,database?:D1Database) {
 const value=addressSchema.parse({address}).address,db=database||await sharedDatabase();
 await db.prepare("INSERT INTO silicon_settings(key,value) VALUES('contract_address',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(value).run();
 return value;
}
