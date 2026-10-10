import { z } from 'zod';
import { makeAgent, type WorldSnapshot, type Agent, scriptedEncounter } from './domain';
import { generateEncounter } from './openrouter';
export const creationSchema=z.object({answers:z.array(z.number().int().min(0).max(2)).length(5),name:z.string().trim().min(2).max(24).regex(/^\p{L}[\p{L}\p{N} '\-]*$/u,'Start with a letter; use letters, numbers, spaces, apostrophes or hyphens.').refine(x=>!/[\u0000-\u001f]/.test(x))}).strict();
export function config(){
 const anyDatabase=!!(process.env.SUPABASE_URL||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_PUBLISHABLE_KEY);
 const database=!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.SUPABASE_PUBLISHABLE_KEY);
 const ai=database&&process.env.WORLD_MODE==='shared-ai'&&!!(process.env.OPENROUTER_API_KEY&&process.env.OPENROUTER_MODEL);
 return {mode:ai?'shared-ai':'shared-scripted',storage:anyDatabase?'supabase':'d1',supabaseUrl:anyDatabase?process.env.SUPABASE_URL??null:null,publishableKey:anyDatabase?process.env.SUPABASE_PUBLISHABLE_KEY??null:null,...(anyDatabase&&!database?{configurationError:'The shared world configuration is incomplete. Please configure all three Supabase variables.'}:{})} as const;
}
export async function sharedDatabase(){if(process.env.SQLITE_PATH){const {getSQLiteDatabase}=await import('./sqlite.mjs');return getSQLiteDatabase() as unknown as D1Database;}const {env}=await import('cloudflare:workers');if(!env.DB)throw new Error('The global world database is unavailable. Please retry shortly.');return env.DB;}
export async function sharedD1(){const {SharedWorld}=await import('./d1');return new SharedWorld(await sharedDatabase());}
const COOKIE='silicon_guest';
async function tokenHash(token:string){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');}
export function requestUrl(req:Request){const url=new URL(req.url),publicUrl=process.env.SITE_URL||process.env.RENDER_EXTERNAL_URL;return process.env.SQLITE_PATH&&publicUrl?new URL(url.pathname+url.search,publicUrl):url;}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==requestUrl(req).origin)throw new Error('ORIGIN_REQUIRED');if(req.headers.get('sec-fetch-site')==='cross-site')throw new Error('ORIGIN_REQUIRED');}
export async function guest(req:Request,establish=false):Promise<{owner:string;cookie?:string}>{
 const db=await sharedD1(),token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(token&&/^[a-f0-9]{64}$/.test(token)){const owner=await tokenHash(token);if(await db.hasSession(owner)){await db.touch(owner);return {owner};}}
 if(!establish)throw new Error('AUTH_REQUIRED');
 const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),owner=await tokenHash(raw);await db.touch(owner);
 return {owner,cookie:`${COOKIE}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${requestUrl(req).protocol==='https:'?'; Secure':''}`};
}
export async function worldResponse(req:Request){return endpoint(async()=>{if(config().storage==='supabase')return snapshot(req.headers.has('authorization')?await identity(req):undefined);const session=await guest(req,true);const result=await snapshot(session.owner);return response(result,200,session.cookie?{'Set-Cookie':session.cookie}:{});});}
export async function db<T>(path:string,body?:unknown):Promise<T>{if(config().configurationError)throw new Error(config().configurationError);const secret=process.env.SUPABASE_SECRET_KEY!;const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:secret,...(secret?.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${secret}`}), 'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('The shared world is temporarily unavailable. Your saved successor is safe.');return r.json();}
export async function identity(req:Request){sameOrigin(req);if(config().storage==='d1')return (await guest(req)).owner;if(config().configurationError)throw new Error(config().configurationError);const token=req.headers.get('authorization');if(!token?.startsWith('Bearer '))throw new Error('AUTH_REQUIRED');const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY!,Authorization:token},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('AUTH_REQUIRED');const u=await r.json() as {id:string};if(!u.id)throw new Error('AUTH_REQUIRED');return u.id;}
export async function snapshot(owner?:string){if(config().storage==='d1')return (await sharedD1()).snapshot(owner);const s=await db<WorldSnapshot>('rpc/silicon_snapshot',{p_owner:owner??null});return {...s,mode:config().mode};}
export async function create(owner:string,input:unknown){const v=creationSchema.parse(input);if(config().storage==='d1')return (await sharedD1()).create(owner,v.name,v.answers);const agent=makeAgent(crypto.randomUUID(),v.name,v.answers);return db<Agent>('rpc/silicon_create',{p_owner:owner,p_agent:agent});}
export async function tick(owner:string){
 if(config().storage==='d1')return (await sharedD1()).tick(owner);
 const job=await db<{id:string;agents:[Agent,Agent];ai:boolean;location?:string}|null>('rpc/silicon_begin_tick',{p_owner:owner,p_ai:config().mode==='shared-ai',p_daily_requests:Number(process.env.AI_DAILY_REQUESTS||100),p_daily_usd:Number(process.env.AI_DAILY_USD||1),p_estimate:Number(process.env.AI_RESERVATION_USD||0.01),p_interval:Number(process.env.AI_INTERVAL_SECONDS||30),p_pair_cooldown:Number(process.env.AI_PAIR_COOLDOWN_SECONDS||180),p_character_cooldown:Number(process.env.AI_CHARACTER_COOLDOWN_SECONDS||60)});
 if(job){
  try{
   let encounter=scriptedEncounter(job.agents[0],job.agents[1],job.id);encounter.location=job.location||'The Forum';encounter.memories=encounter.memories.map(m=>({...m,text:m.text.replace('the Forum',encounter.location)}));let usage:unknown=null;let reason:string|null=null;
   if(job.ai){try{const result=await generateEncounter(job.agents[0],job.agents[1],job.id,encounter.location);encounter=result.encounter;usage=result.usage;}catch(e){reason=e instanceof Error?e.message:'AI paused';}}
   await db('rpc/silicon_finish_tick',{p_job:job.id,p_encounter:encounter,p_usage:usage,p_failure:reason});
  }catch(error){
   // Best-effort awaited cleanup; a DB outage still safely expires the matching lease.
   // It never releases a possibly billable reservation or retries the provider.
   try{await db('rpc/silicon_abort_tick',{p_job:job.id});}catch{ /* durable lease expiry is the fallback */ }
   throw error;
  }
 }
 return snapshot(owner);
}
export function response(data:unknown,status=200,headers:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...headers}});}
export async function endpoint(run:()=>Promise<unknown>){try{const value=await run();return value instanceof Response?value:response(value);}catch(e){if(e instanceof SyntaxError)return response({error:'Please send a valid successor submission.'},400);if(e instanceof z.ZodError)return response({error:'Please check your successor details.',fields:e.flatten().fieldErrors},400);const message=e instanceof Error?e.message:'Unable to connect to the shared world.';return response({error:message==='AUTH_REQUIRED'?'Your guest session needs to be renewed.':message},message==='AUTH_REQUIRED'?401:message==='ORIGIN_REQUIRED'?403:503);}}



export const importSchema=z.object({id:z.string().uuid(),name:creationSchema.shape.name,answers:z.array(z.number().int().min(0).max(2)).length(3)}).strict();
export async function importLegacy(owner:string,input:unknown){const v=importSchema.parse(input);if(config().storage!=='d1')throw new Error('Legacy import is available in the global D1 world.');return (await sharedD1()).create(owner,v.name,v.answers,v.id,true);}

export async function agentHistory(id:string,before?:number){if(config().storage==='d1')return (await sharedD1()).history(id,before);const world=await snapshot();return {encounters:world.encounters.filter(e=>e.participants.includes(id)),nextBefore:null};}

export async function readSubmission(req:Request){if(Number(req.headers.get('content-length'))>2048)throw new Error('Please keep your submission small.');const reader=req.body?.getReader();if(!reader)throw new SyntaxError('Missing submission.');const chunks:Uint8Array[]=[];let bytes=0;while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>2048){await reader.cancel();throw new Error('Please keep your submission small.');}chunks.push(item.value);}const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(body));}
