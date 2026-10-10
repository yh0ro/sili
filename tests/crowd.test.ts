import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAgent,type Agent} from '../lib/silicon/domain';
import {createCrowdScratch,resolveCrowdPositions,MIN_AGENT_SEPARATION,isCrowdPositionSafe,freeCrowdPosition,type CrowdAgent} from '../lib/silicon/crowd';
import {safeMotionPath,safeNavigationPosition} from '../lib/silicon/navigation';
import {MAX_AGENT_SPEED} from '../lib/silicon/crowd';
import {isWorldSegmentClear,safeWorldPosition,worldObstacles} from '../lib/silicon/world-obstacles';
import {lanePath,worldNodes,worldEdges} from '../lib/silicon/world-layout';

function separated(output:Float32Array,count:number){
 let closest=Infinity;
 for(let i=0;i<count;i++){assert.ok(isCrowdPositionSafe(output[i*2],output[i*2+1]));for(let j=0;j<i;j++)closest=Math.min(closest,Math.hypot(output[i*2]-output[j*2],output[i*2+1]-output[j*2+1]));}
 assert.ok(closest>=MIN_AGENT_SEPARATION-.00001,`Closest bodies were ${closest} apart`);return closest;
}
function moving(id:string,from:[number,number],to:[number,number],path?:[number,number][]):CrowdAgent{return {id,seed:id.charCodeAt(0),position:from,movement:{from,to,path,startedAt:0,duration:10000}};}

test('crossing walkers yield continuously with body clearance at every sampled frame',()=>{
 const agents=[moving('east',[-29,12],[-19,12]),moving('north',[-24,7],[-24,17]),moving('west',[-19,12],[-29,12]),moving('south',[-24,17],[-24,7])];
 const out=new Float32Array(8),scratch=createCrowdScratch(4);let previous:Float32Array|undefined;
 for(let now=0;now<=20000;now+=16){resolveCrowdPositions(agents,now,out,scratch);separated(out,4);if(previous)for(let i=0;i<4;i++)assert.ok(Math.hypot(out[i*2]-previous[i*2],out[i*2+1]-previous[i*2+1])<=MAX_AGENT_SPEED*.016+.00001,'Every crossing correction must respect the speed cap');previous=out.slice();}
 assert.ok(Math.hypot(out[0]+19,out[1]-12)<.2&&Math.hypot(out[4]+29,out[5]-12)<.2,'Crossing walkers must eventually reach their endpoints');
});
test('opposite walking lanes remain separated and sampled paths avoid the sculpture',()=>{
 const a=lanePath([[-12,12],[-6,12],[6,12],[12,12]]),b=lanePath([[12,12],[6,12],[-6,12],[-12,12]]);
 assert.ok(Math.abs(a[1][1]-b[2][1])>=1.15);
 const agents=[moving('a',a[0],a[a.length-1],a),moving('b',b[0],b[b.length-1],b)],out=new Float32Array(4),scratch=createCrowdScratch(2);
 for(let now=0;now<=10000;now+=32){resolveCrowdPositions(agents,now,out,scratch);separated(out,2);}
 for(let n=0;n<worldNodes.length;n++)for(const j of worldEdges[n]){
  const path=safeMotionPath(lanePath([worldNodes[n],worldNodes[n],worldNodes[j],worldNodes[j]]));
  for(let segment=1;segment<path.length;segment++)for(let k=0;k<=30;k++){const t=k/30,x=path[segment-1][0]*(1-t)+path[segment][0]*t,z=path[segment-1][1]*(1-t)+path[segment][1]*t;assert.ok(isCrowdPositionSafe(x,z),`${n}->${j} clipped the body at ${x},${z}`);}
 }
});
test('500 crowded standing bodies resolve deterministically with bounded spatial probes and retain identity positions',()=>{
 const agents=Array.from({length:500},(_,i)=>({id:`person-${String(i).padStart(3,'0')}`,seed:i,position:[-12,15] as [number,number]}));
 const out=new Float32Array(1000),scratch=createCrowdScratch(500),started=performance.now();resolveCrowdPositions(agents,0,out,scratch);separated(out,500);const first=out.slice(),initialProbes=scratch.probes;
 assert.ok(initialProbes<1500000,`Dense resolution took ${initialProbes} probes`);
 for(let frame=1;frame<=30;frame++){resolveCrowdPositions(agents,frame*16,out,scratch);separated(out,500);assert.ok(scratch.probes<100000,'Steady frames should reuse settled positions');}
 const other=new Float32Array(1000);resolveCrowdPositions(agents,0,other,createCrowdScratch(500));assert.deepEqual(first,other);
 const reversed=[...agents].reverse();resolveCrowdPositions(reversed,496,out,scratch);separated(out,500);assert.ok(performance.now()-started<10000,'500-agent stress exceeds the bounded test allowance');
});
test('occupied arrivals and a crowd alongside the First Body receive safe, separate centers',()=>{
 const occupied:Agent[]=Array.from({length:30},(_,i)=>({...makeAgent(`arrival-${i}`,`Agent ${i}`,[0,1,2,0,1]),position:[-6+(i%6)*1.13,6+Math.floor(i/6)*1.13] as [number,number]}));
 const arrival=freeCrowdPosition(occupied,0,[-6,6]);assert.ok(occupied.every(a=>Math.hypot(arrival[0]-a.position[0],arrival[1]-a.position[1])>=MIN_AGENT_SEPARATION));
 const crowded=Array.from({length:60},(_,i)=>({id:`body-${i}`,seed:i,position:[-2,-1] as [number,number]}));
 const out=new Float32Array(120);resolveCrowdPositions(crowded,0,out,createCrowdScratch(60));separated(out,60);
});

test('coincident movement endpoints keep different avatar personalities apart at the same server clock',()=>{
 const agents=Array.from({length:150},(_,i)=>{
  const a=makeAgent(`endpoint-${i}`,`Agent ${i}`,[i%3,Math.floor(i/3)%3,Math.floor(i/9)%3,i%3,(i+1)%3]);
  a.position=[-15+(i%15),25+Math.floor(i/15)];
  a.movement={from:a.position,to:[4,4],startedAt:0,duration:1000};return a;
 });
 const out=new Float32Array(300),scratch=createCrowdScratch(150);
 resolveCrowdPositions(agents,1000,out,scratch);separated(out,150);
 for(let now=1016;now<=1800;now+=16){resolveCrowdPositions(agents,now,out,scratch);separated(out,150);}
 assert.ok(new Set(agents.map(a=>a.archetype)).size>=4);assert.ok(agents.every(a=>a.movement!.to[0]===4&&a.movement!.to[1]===4));
});

test('frame-rate changes, clock corrections, pauses and polling never bypass the speed cap',()=>{
 const distances:number[]=[];
 for(const fps of [30,60,144]){
  const a=moving('speed',[-24,12],[-4,12]),out=new Float32Array(2),scratch=createCrowdScratch(1);resolveCrowdPositions([a],0,out,scratch,0);const origin=out.slice();
  for(let frame=1;frame<=fps*2;frame++){const before=out.slice();resolveCrowdPositions([a],frame*1000/fps,out,scratch,1/fps);assert.ok(Math.hypot(out[0]-before[0],out[1]-before[1])<=MAX_AGENT_SPEED/fps+.00001);}
  distances.push(Math.hypot(out[0]-origin[0],out[1]-origin[1]));
  for(const clock of [10000000,-5000,20000000]){const before=out.slice();resolveCrowdPositions([{...a,movement:{...a.movement!}}],clock,out,scratch,.016);assert.ok(Math.hypot(out[0]-before[0],out[1]-before[1])<=MAX_AGENT_SPEED*.016+.00001);}
  const paused=out.slice();resolveCrowdPositions([a],999999999,out,scratch,10);assert.ok(Math.hypot(out[0]-paused[0],out[1]-paused[1])<=MAX_AGENT_SPEED*.05+.00001);
 }
 assert.ok(Math.max(...distances)-Math.min(...distances)<.001);
});
test('lagged and paused agents complete repaired routes around the pond and workshop',()=>{
 for(const [from,to] of [[[-12,16],[3,9]],[[5,4.5],[13,4.5]]] as [number,number][][]){
  const path=safeMotionPath([safeWorldPosition(from[0],from[1],.58),safeWorldPosition(to[0],to[1],.58)]),length=path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0);
  const agent=moving('detour',path[0],path[path.length-1],path);agent.movement!.duration=length/.85*1000;
  const out=new Float32Array(2),scratch=createCrowdScratch(1);resolveCrowdPositions([agent],0,out,scratch,0);
  for(let frame=1;frame<=Math.ceil((length/.85+10)*60);frame++){
   const before=out.slice(),clock=frame<60?frame*1000/60:600000+frame*1000/60;resolveCrowdPositions([agent],clock,out,scratch,1/60);
   assert.ok(Math.hypot(out[0]-before[0],out[1]-before[1])<=MAX_AGENT_SPEED/60+.00001);assert.ok(isWorldSegmentClear(before[0],before[1],out[0],out[1],.56));
  }
  assert.ok(Math.hypot(out[0]-path[path.length-1][0],out[1]-path[path.length-1][1])<.1,'The repaired route must finish despite a server-clock jump');
 }
});
test('navigation repairs routes crossing every registered solid footprint',()=>{
 for(const obstacle of worldObstacles){
  const extent=obstacle.kind==='circle'?obstacle.radius!:Math.hypot(obstacle.halfX!,obstacle.halfZ!),from=safeWorldPosition(obstacle.x-extent-2,obstacle.z,.58),to=safeWorldPosition(obstacle.x+extent+2,obstacle.z,.58),path=safeMotionPath([from,to]);
  const target=safeNavigationPosition(to[0],to[1]);assert.ok(path.length&&Math.hypot(path[path.length-1][0]-target[0],path[path.length-1][1]-target[1])<.01,`${obstacle.id} must retain a complete reachable route`);
  for(let i=1;i<path.length;i++)assert.ok(isWorldSegmentClear(path[i-1][0],path[i-1][1],path[i][0],path[i][1],.58),`${obstacle.id} has an unsafe detour`);
 }
});
