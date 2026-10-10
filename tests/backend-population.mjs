import {PGlite} from '../.sites-runtime/sql-check/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {worldNodes,worldEdges,spreadNode,meetingSites} from '../lib/silicon/world-layout.ts';
import {route} from '../lib/silicon/simulation.ts';
import {makeAgent} from '../lib/silicon/domain.ts';
const db=new PGlite();
await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('00000000-0000-4000-8000-000000000001');");
await db.exec(readFileSync('supabase/migrations/001_world.sql','utf8').replace('create extension if not exists pgcrypto;',''));
// Real upgrade over existing saved identities, not only an empty schema.
await db.exec(readFileSync('supabase/seed.sql','utf8'));
const founder=(await db.query("select data from silicon_agents where id='founder-0'")).rows[0].data;
await db.exec(readFileSync('supabase/migrations/002_expanded_world.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/002_expanded_world.sql','utf8'));
assert.deepEqual((await db.query("select data from silicon_agents where id='founder-0'")).rows[0].data,founder);
const layout=(await db.query('select silicon_layout() as l')).rows[0].l;
assert.deepEqual(layout.nodes,worldNodes);assert.deepEqual(layout.edges,worldEdges);
for(const [i,j] of [[0,worldNodes.length-1],[10,40],[31,67],[70,2],[80,0]]){const from=worldNodes[i],to=worldNodes[j];const sql=(await db.query('select silicon_route($1,$2) as p',[JSON.stringify(from),JSON.stringify(to)])).rows[0].p;assert.deepEqual(sql,route(from,to),'SQL and TypeScript routes agree');}
for(let seed=0;seed<500;seed++){const node=worldNodes[seed%worldNodes.length];const sql=(await db.query('select silicon_spread($1,$2) as p',[JSON.stringify(node),seed])).rows[0].p;const ts=spreadNode(node,seed);assert.ok(Math.hypot(sql[0]-ts[0],sql[1]-ts[1])<1e-8);}
const agents=Array.from({length:520},(_,i)=>({...makeAgent(`population-${i}`,`Test ${i}`,[i%3,(i+1)%3,(i+2)%3]),position:spreadNode(worldNodes[i%worldNodes.length],i)}));
await db.query("insert into silicon_agents(id,data) select a->>'id',a from jsonb_array_elements($1) a",[JSON.stringify(agents)]);
const started=performance.now();
const tick=(await db.query('select silicon_begin_tick($1,true,100,1,0.01,30,180,60) as j',['00000000-0000-4000-8000-000000000001'])).rows[0].j;
const snapshot=(await db.query('select silicon_snapshot(null) as s')).rows[0].s;
const elapsed=performance.now()-started;
assert.equal(snapshot.totalPopulation,525);assert.equal(snapshot.awakePopulation,500);
assert.ok(snapshot.agents.filter(a=>a.movement).length>350);
const destinations=snapshot.agents.filter(a=>a.movement).map(a=>a.movement.to.join(','));assert.equal(new Set(destinations).size,destinations.length,'seeded destinations do not collapse onto identical graph points');
assert.ok(meetingSites.some(s=>s.name===tick.location));
assert.equal((await db.query('select count(*)::int as n from silicon_usage where paid')).rows[0].n,1);
for(const a of snapshot.agents){if(!a.movement)continue;for(let i=1;i<a.movement.path.length;i++){const from=a.movement.path[i-1],to=a.movement.path[i];for(let t=0;t<=1;t+=.1){const x=from[0]+(to[0]-from[0])*t,z=from[1]+(to[1]-from[1])*t;assert.ok(Math.hypot(x,z)<64);assert.ok(!(x>-2&&x<10&&z>-6&&z<-2));}}}
const resting=snapshot.agents.filter(a=>a.activity==='Resting').map(a=>a.id);
await db.query('select silicon_abort_tick($1)',[tick.id]);
await db.exec("update silicon_agents set data=data-'movement';update silicon_world set last_tick=now()-interval '1 minute';update silicon_presence set tick_at=now()-interval '1 minute';");
await db.query('select silicon_begin_tick($1,false,100,1,0.01,30,180,60)',['00000000-0000-4000-8000-000000000001']);
const rotated=(await db.query('select silicon_snapshot(null) as s')).rows[0].s;
assert.equal(rotated.awakePopulation,500);assert.ok(resting.some(id=>rotated.agents.some(a=>a.id===id&&a.activity!=='Resting')),'resting saved characters rotate into activity');
assert.equal((await db.query('select count(*)::int as n from silicon_usage where paid')).rows[0].n,1);
await db.exec('set role authenticated');await assert.rejects(()=>db.query('select silicon_layout()'),/permission denied/);
console.log(`PASS: idempotent upgrade preserves identities; SQL/TS routes and offsets agree; 525 saved / 500 awake, one global reservation; all movement bounds clear. Embedded tick + snapshot ${Math.round(elapsed)} ms (not a live service benchmark).`);
await db.close();
