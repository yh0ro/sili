import {z} from 'zod';
import {config,guest,readSubmission,response,sharedD1,sameOrigin,requestUrl} from './server';

export const xAgentSchema=z.object({agentId:z.string().uuid()}).strict();
export function xConfiguration(){
 const {X_CLIENT_ID:clientId,X_CLIENT_SECRET:clientSecret,X_CALLBACK_URL:callback}=process.env;
 if(config().storage!=='d1'||!clientId||!clientSecret||!callback)return null;
 try{const url=new URL(callback);if(url.pathname!=='/api/x/callback'||url.search||url.hash||url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))return null;}catch{return null;}
 return {clientId,clientSecret,callback};
}
export async function xHash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function random(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function pkceChallenge(verifier:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function mutation(req:Request){sameOrigin(req);if(req.headers.get('origin')!==requestUrl(req).origin)throw new Error('ORIGIN_REQUIRED');}
function settings(req:Request){const value=xConfiguration();if(!value||new URL(value.callback).origin!==requestUrl(req).origin)throw new Error('X_NOT_CONFIGURED');return value;}
export function xStatus(){return response({configured:!!xConfiguration()});}
export async function xStart(req:Request){
 mutation(req);const value=settings(req),session=await guest(req),{agentId}=xAgentSchema.parse(await readSubmission(req));
 const state=random(),verifier=random();await (await sharedD1()).beginX(session.owner,agentId,await xHash(state),verifier);
 const url=new URL('https://x.com/i/oauth2/authorize');url.search=new URLSearchParams({response_type:'code',client_id:value.clientId,redirect_uri:value.callback,scope:'tweet.read users.read',state,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256'}).toString();
 return response({authorizationUrl:url.toString()});
}
export async function xUnlink(req:Request){mutation(req);const session=await guest(req),{agentId}=xAgentSchema.parse(await readSubmission(req)),world=await sharedD1();await world.unlinkX(session.owner,agentId);return response(await world.snapshot(session.owner));}

const profileSchema=z.object({data:z.object({id:z.string().regex(/^\d{1,25}$/),username:z.string().regex(/^[A-Za-z0-9_]{1,15}$/),name:z.string().min(1).max(100)})});
// No provider body or error text is logged or sent to a browser. Tokens live only in this call.
async function boundedJson(r:Response){if(!r.ok)throw new Error('X_PROVIDER_FAILED');const reader=r.body?.getReader();if(!reader)throw new Error('X_PROVIDER_FAILED');let bytes=0;const chunks:Uint8Array[]=[];while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>16384){await reader.cancel();throw new Error('X_PROVIDER_FAILED');}chunks.push(item.value);}const output=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(output));}
export async function verifyX(code:string,verifier:string,value:NonNullable<ReturnType<typeof xConfiguration>>,request:typeof fetch=fetch){
 const tokenResponse=await request('https://api.x.com/2/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:`Basic ${btoa(`${encodeURIComponent(value.clientId)}:${encodeURIComponent(value.clientSecret)}`)}`},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:value.callback,code_verifier:verifier}),signal:AbortSignal.timeout(10000),redirect:'error'});
 const token=z.object({access_token:z.string().min(1).max(8192),token_type:z.string().transform(s=>s.toLowerCase()).refine(s=>s==='bearer')}).parse(await boundedJson(tokenResponse));
 const profile=await request('https://api.x.com/2/users/me',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10000),redirect:'error'});
 return profileSchema.parse(await boundedJson(profile)).data;
}
export async function xCallback(req:Request){
 let agentId:string|undefined,owner:string|undefined,hash:string|undefined;let outcome='failed';
 try{
  const value=settings(req),url=new URL(req.url),state=url.searchParams.get('state');
  if(!state||!/^[a-f0-9]{64}$/.test(state))throw new Error('X_STATE_INVALID');
  owner=(await guest(req)).owner;hash=await xHash(state);const world=await sharedD1(),attempt=await world.consumeX(owner,hash);
  if(!attempt)throw new Error('X_STATE_INVALID');agentId=attempt.agent_id;
  if(attempt.expires_at<=Date.now())outcome='expired';
  else if(url.searchParams.get('error')==='access_denied')outcome='cancelled';
  else{
   const code=url.searchParams.get('code');if(!code||code.length>4096||url.searchParams.has('error'))throw new Error('X_PROVIDER_FAILED');
   const account=await verifyX(code,attempt.verifier,value);
   if(!await world.finishX(owner,hash,{...account,linkedAt:new Date().toISOString()}))throw new Error('X_STATE_INVALID');outcome='linked';
  }
 }catch(error){outcome=error instanceof Error&&error.message==='X_ALREADY_LINKED'?'already_linked':'failed';}
 finally{if(owner&&hash)try{await (await sharedD1()).discardX(owner,hash);}catch{/* Expiry bounds abandoned attempts when the database is unavailable. */}}
 // Only a database-owned UUID can select the profile; all outcomes use a fixed local path.
 const path=agentId&&z.string().uuid().safeParse(agentId).success?`/successor/${agentId}`:'/world';
 return new Response(null,{status:303,headers:{Location:`${path}?x=${outcome}`,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
export async function xEndpoint(run:()=>Promise<Response>){try{return await run();}catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return response({error:'Please choose a valid agent.'},400);const key=e instanceof Error?e.message:'';return response({error:key==='AUTH_REQUIRED'?'Your guest session needs to be renewed.':key==='X_OWNER_REQUIRED'?'Only this agent’s owner can manage its X account.':key==='ORIGIN_REQUIRED'?'Please connect from this site.':key==='X_NOT_CONFIGURED'?'X account linking is not configured yet.':'Unable to connect X. Please try again.'},key==='AUTH_REQUIRED'?401:key==='X_OWNER_REQUIRED'||key==='ORIGIN_REQUIRED'?403:503);}}
