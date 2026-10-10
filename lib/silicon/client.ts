'use client';
import {foundingAgents,makeAgent,personality,type WorldSnapshot} from './domain';
import {simulateDemo} from './simulation';
const KEY='silicon-world-v1'; const AUTH='silicon-auth-v1';
type Session={access_token:string;refresh_token:string;expires_at:number};
export type Config={mode:WorldSnapshot['mode'];storage?:'d1'|'supabase';supabaseUrl?:string;supabaseKey?:string;publishableKey?:string;status?:string;contractAddress?:string};
let config:Config={mode:'local-demo'};
let session:Session|null=null;
export function initialWorld():WorldSnapshot {const now=Date.now();return {agents:foundingAgents(now),events:[],encounters:[],serverTime:now,mode:'local-demo',totalPopulation:5,awakePopulation:5};}
export function loadDemo():WorldSnapshot {try {const raw=localStorage.getItem(KEY);if(raw){const w=JSON.parse(raw);if(w.mode==='local-demo'&&Array.isArray(w.agents)&&w.agents.length<=100&&w.agents.every((a:unknown)=>{const x=a as Record<string,unknown>;return x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.seed==='number'&&typeof x.accent==='string'&&Array.isArray(x.position)&&Array.isArray(x.memories)&&Array.isArray(x.relationships)&&x.traits&&['curiosity','creativity','sociability','empathy','assertiveness'].every(k=>Number.isFinite((x.traits as Record<string,unknown>)[k]));})&&Array.isArray(w.encounters)&&Array.isArray(w.events))return w;}}catch{} return initialWorld();}
export function saveDemo(w:WorldSnapshot){try{localStorage.setItem(KEY,JSON.stringify(w));}catch{throw new Error('Your browser could not save this world. Enable site storage and try again.');}}
export async function getConfig():Promise<Config>{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)throw new Error('Unable to connect to the world. Please retry.');config=await r.json();return config;}
async function auth(){if(!session){try{session=JSON.parse(localStorage.getItem(AUTH)||'null');}catch{}}
 const key=config.supabaseKey||config.publishableKey;
 if(!config.supabaseUrl||!key)throw new Error('Shared authentication is not configured.');
 if(!session||session.expires_at<Date.now()/1000+60){const refresh=session?.refresh_token;const r=await fetch(`${config.supabaseUrl}/auth/v1/${refresh?'token?grant_type=refresh_token':'signup'}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(refresh?{refresh_token:refresh}:{})});const data=await r.json() as {msg?:string;error_description?:string;access_token:string;refresh_token:string;expires_in:number};if(!r.ok)throw new Error(data.msg||data.error_description||'Guest sign-in is unavailable. Enable anonymous sign-in in Supabase.');session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()/1000+data.expires_in};localStorage.setItem(AUTH,JSON.stringify(session));}
 return session.access_token;
}
async function request(path:string,body?:unknown):Promise<WorldSnapshot>{const token=config.storage==='d1'?null:await auth();const r=await fetch(path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json() as WorldSnapshot & {error?:string};if(!r.ok)throw new Error(data.error||'The shared world is temporarily unavailable. Your last view is preserved.');return data;}
export async function snapshot():Promise<WorldSnapshot>{return request('/api/world');}
export async function sharedTick():Promise<WorldSnapshot>{return request('/api/world/tick',{});}
export async function createShared(name:string,answers:number[]):Promise<WorldSnapshot>{await request('/api/successor',{name,answers});return snapshot();}
export function createDemo(w:WorldSnapshot,name:string,answers:number[]):WorldSnapshot {const saved=loadDemo();if(saved.mineId)return saved;if(w.mineId)return w;const now=Date.now();const id=crypto.randomUUID();const a=makeAgent(id,name,answers,false,now);a.accent='#D65B35';const next={...w,agents:[...w.agents,a],mineId:id,serverTime:now,totalPopulation:w.agents.length+1,awakePopulation:w.agents.length+1,events:[{id:crypto.randomUUID(),type:'arrival' as const,text:`${name} opened their eyes near the First Body.`,agentId:id,createdAt:now},...w.events]};saveDemo(next);return next;}
export function advanceDemo(w:WorldSnapshot,now=Date.now()):WorldSnapshot{const next=simulateDemo(w,now);saveDemo(next);return next;}

export function legacyImportCandidate(){const w=loadDemo(),a=w.agents.find(a=>a.id===w.mineId);if(!a||a.founding||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id))return null;for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++){const answers=[x,y,z],p=personality(answers);if(Object.keys(p.traits).every(k=>p.traits[k as keyof typeof p.traits]===a.traits[k as keyof typeof a.traits]))return {id:a.id,name:a.name,answers};}return null;}
export async function importLegacyShared():Promise<WorldSnapshot>{const candidate=legacyImportCandidate();if(!candidate)throw new Error('This browser profile cannot be imported automatically. Its saved history remains on this device.');await request('/api/successor/import',candidate);return snapshot();}

async function xRequest<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as T & {error?:string};
 if(!response.ok)throw new Error(result.error||'Unable to link your X account. Please try again.');
 return result;
}
export async function xLinkStatus():Promise<{configured:boolean}>{return xRequest('/api/x/status');}
export async function startXLink(agentId:string):Promise<string>{
 const {authorizationUrl}=await xRequest<{authorizationUrl:string}>('/api/x/start',{agentId});
 const url=new URL(authorizationUrl);
 if(url.protocol!=='https:'||url.hostname!=='x.com'||url.pathname!=='/i/oauth2/authorize')throw new Error('Unable to open X sign-in. Please try again.');
 return url.href;
}
export async function unlinkXAccount(agentId:string):Promise<WorldSnapshot>{return xRequest('/api/x/unlink',{agentId});}

export async function agentHistory(id:string,before?:number):Promise<{encounters:import('./domain').Encounter[];nextBefore:number|null}>{const response=await fetch(`/api/history?agent=${encodeURIComponent(id)}${before?`&before=${before}`:''}`,{cache:'no-store',credentials:'same-origin'});const result=await response.json() as {encounters:import('./domain').Encounter[];nextBefore:number|null;error?:string};if(!response.ok)throw new Error(result.error||'Unable to load conversation history.');return result;}
