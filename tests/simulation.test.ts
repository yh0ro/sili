import {isWorldSegmentClear} from '../lib/silicon/world-obstacles';
import test from 'node:test';
import assert from 'node:assert/strict';
import {foundingAgents,makeAgent,type WorldSnapshot} from '../lib/silicon/domain';
import {route,simulateDemo,positionAt,repairMovement} from '../lib/silicon/simulation';
test('waypoint routes go around the First Body and interpolate without teleportation',()=>{const path=route([-5,4],[6,1]);assert.ok(path.length>=4);for(const p of path)assert.ok(p[1]>=0);const a=makeAgent('test','Aster',[0,0,1],false,1000);a.movement={from:[-5,4],to:[6,1],path,startedAt:1000,duration:10000};assert.deepEqual(positionAt(a,1000),[-5,4]);assert.deepEqual(positionAt(a,11000),[6,1]);assert.notDeepEqual(positionAt(a,6000),[6,1]);});
test('local first encounter approaches, saves once, forms bounded memories and resumes without backlog',()=>{const t=100000;const a=makeAgent('mine','Aster',[0,0,1],false,t);let w:WorldSnapshot={agents:[...foundingAgents(t),a],events:[],encounters:[],serverTime:t,mode:'local-demo',mineId:a.id};w=simulateDemo(w,t+5000);assert.equal(w.encounters.length,0);assert.equal(w.agents.find(x=>x.id===a.id)?.activity,'Approaching');const readyAt=(w as WorldSnapshot&{demoJob?:{readyAt:number}}).demoJob?.readyAt;assert.ok(readyAt&&readyAt<t+90000);for(let now=t+9000;now<readyAt!;now+=4000)w=simulateDemo(w,now);w=simulateDemo(w,readyAt!-1);assert.equal(w.encounters.length,0);w=simulateDemo(w,readyAt!);assert.equal(w.encounters.length,1);assert.equal(w.agents.find(x=>x.id===a.id)?.memories.length,1);const count=w.encounters.length;w=simulateDemo(w,t+3600000);assert.equal(w.encounters.length,count);assert.equal(w.agents.find(x=>x.id===a.id)?.memories.length,1);});

test('active legacy unsafe plans repair remaining waypoints with distance-derived normal speed',()=>{
 const a=makeAgent('unsafe-plan','Aster',[0,1,2,0,1],false,0);a.position=[-12,16];a.movement={from:a.position,to:[3,9],path:[a.position,[3,9]],startedAt:0,duration:10000};
 const repaired=repairMovement(a,2000);assert.notEqual(repaired,a);assert.equal(repaired.movement!.startedAt,2000);assert.notDeepEqual(repaired.position,[3,9]);
 const path=repaired.movement!.path!,distance=path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0);
 assert.equal(repaired.movement!.duration,Math.max(2000,distance*1150));
 for(let i=1;i<path.length;i++)assert.ok(isWorldSegmentClear(path[i-1][0],path[i-1][1],path[i][0],path[i][1],.58));
 assert.equal(a.movement!.duration,10000);assert.equal(a.movement!.startedAt,0);
});
