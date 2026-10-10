import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {SharedWorld} from '../lib/silicon/d1';
import {makeAgent,personality} from '../lib/silicon/domain';
import {worldviewQuestions} from '../lib/silicon/worldview';
import {config,sameOrigin,creationSchema} from '../lib/silicon/server';

async function fixture(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-15',d1Databases:['DB']});
 const raw=await mf.getD1Database('DB');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){const sql=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8');await raw.batch(sql.split('--> statement-breakpoint').filter(sql=>sql.trim()).map(sql=>raw.prepare(sql.trim())));}
 return {mf,db:raw as unknown as D1Database,world:new SharedWorld(raw as unknown as D1Database)};
}
test('five worldview choices derive reproducible traits and stored beliefs; legacy derivation stays available',()=>{
 assert.equal(worldviewQuestions.length,5);assert.ok(worldviewQuestions.every(q=>q.options.length===3));
 for(let i=0;i<243;i++){let n=i;const answers=Array.from({length:5},()=>{const a=n%3;n=Math.floor(n/3);return a;});assert.deepEqual(personality(answers),personality(answers));assert.ok(Object.values(personality(answers).traits).every(v=>v>=0&&v<=100));const agent=makeAgent('test','Test',answers);assert.equal(agent.beliefs?.length,5);}
 assert.equal(creationSchema.safeParse({name:'Legacy',answers:[0,0,0]}).success,false);assert.equal(personality([0,0,0]).archetype,'Explorer');assert.equal(config().storage,'d1');assert.equal(config().mode,'shared-scripted');assert.throws(()=>sameOrigin(new Request('https://world/api',{headers:{origin:'https://evil.test'}})),/ORIGIN_REQUIRED/);
});
test('real D1 shares new identities across sessions, prevents duplicate ownership and rejects collision claims',async()=>{
 const {mf,world}=await fixture();try{
  await world.touch('session-one');await world.touch('session-two');assert.equal(await world.hasSession('missing'),false);
  const [a,b]=await Promise.all([world.create('session-one','Aster',[0,1,2,0,1]),world.create('session-two','Beryl',[1,2,0,1,2])]);
  assert.notEqual(a.id,b.id);const second=await world.snapshot('session-two');assert.ok(second.agents.some(x=>x.id===a.id));assert.equal(second.mineId,b.id);assert.equal(second.agents.length,7);assert.ok(!JSON.stringify(second).includes('session-one'));
  const [again,also]=await Promise.all([world.create('session-one','Again',[0,0,0,0,0]),world.create('session-one','Other',[2,2,2,2,2])]);assert.equal(again.id,a.id);assert.equal(also.id,a.id);assert.equal((await world.snapshot()).agents.length,7);
  await assert.rejects(()=>world.create('attacker','Stolen',[0,0,0],a.id,true),/already exists/);
  const legacy=await world.create('session-three','Legacy',[0,0,0],'b43aa272-2b0d-45a0-8eb8-281881a24520',true);assert.deepEqual(legacy.traits,personality([0,0,0]).traits);
 }finally{await mf.dispose();}
});
test('real D1 concurrent ticks keep arrivals, pair by proximity, persist speech and expose canonical history',async()=>{
 const {mf,db,world}=await fixture();try{
  const now=Date.now();await world.snapshot();
  const people=Array.from({length:20},(_,i)=>({...makeAgent(`crowd-${i}`,`Mind ${i}`,[0,1,2,0,1],false,now),position:[-20+(i%5)*1.2,20+Math.floor(i/5)*1.2] as [number,number]}));
  await db.prepare("INSERT INTO silicon_agents(id,data,created_at,last_awake) SELECT json_extract(value,'$.id'),value,?,? FROM json_each(?)").bind(now,now,JSON.stringify(people)).run();
  const [one,two,arrival]=await Promise.all([world.tick('viewer-one',now+4001),world.tick('viewer-two',now+4001),world.create('late-viewer','Late',[2,1,0,2,1])]);
  const state=await world.snapshot('late-viewer',now+4002);assert.equal(state.mineId,arrival.id);assert.ok(state.agents.some(a=>a.id===arrival.id));assert.ok(state.encounters.length>=4);assert.ok(state.encounters.length<=6);
  const viewerOne=await world.snapshot('viewer-one',now+4002),viewerTwo=await world.snapshot('viewer-two',now+4002);assert.deepEqual(viewerOne.encounters.map(e=>e.id).sort(),viewerTwo.encounters.map(e=>e.id).sort());assert.ok(one.encounters.length<=6&&two.encounters.length<=6);
  for(const e of state.encounters){assert.equal(e.source,'scripted');assert.equal(e.duration,24000);assert.equal(e.lines.length,4);const [a,b]=e.participants.map(id=>state.agents.find(a=>a.id===id)!);assert.equal(a.activity,'Conversing');assert.equal(b.activity,'Conversing');const pairDistance=Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1]);assert.ok(pairDistance<=3.01);assert.ok(pairDistance>=1.12);assert.ok(a.thoughts?.some(t=>t.encounterId===e.id));}
  const selected=state.encounters[0].participants[0];assert.ok((await world.history(selected)).encounters.some(e=>e.id===state.encounters[0].id));
  const beforeIds=state.encounters.map(e=>e.id);const next=await world.tick('viewer-one',now+8002);assert.deepEqual(next.encounters.filter(e=>beforeIds.includes(e.id)).map(e=>e.id),beforeIds);
 }finally{await mf.dispose();}
});
test('real D1 keeps all 600 visitors public while limiting each wake cohort to 500',async()=>{
 const {mf,db,world}=await fixture();try{
  const now=Date.now();await world.snapshot();const people=Array.from({length:600},(_,i)=>makeAgent(`large-${i}`,`Person ${i}`,[0,1,2,0,1],false,now));
  await db.prepare("INSERT INTO silicon_agents(id,data,created_at) SELECT json_extract(value,'$.id'),value,? FROM json_each(?)").bind(now,JSON.stringify(people)).run();
  const started=Date.now(),first=await world.tick('first-viewer',now+4001);assert.equal(first.agents.length,605);assert.equal(first.awakePopulation,500);assert.equal(first.agents.filter(a=>a.activity!=='Resting').length,500);assert.ok(Date.now()-started<10000);
  const second=await world.tick('second-viewer',now+8002);assert.equal(second.agents.length,605);assert.equal(second.awakePopulation,500);assert.ok(second.agents.some(a=>a.id==='large-599'&&a.activity!=='Resting'));
 }finally{await mf.dispose();}
});
