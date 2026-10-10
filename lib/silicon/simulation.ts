import {isWorldSegmentClear} from './world-obstacles';
import {safeMotionPath} from './navigation';
import {applyEncounter,scriptedEncounter,type Agent,type WorldSnapshot} from './domain';
import {worldNodes,worldEdges,meetingSites,spreadNode,lanePath} from './world-layout';
export const nodes=worldNodes;
const edges=worldEdges;
const dist=(a:[number,number],b:[number,number])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function nearest(p:[number,number]){return nodes.reduce((best,n,j)=>dist(n,p)<dist(nodes[best],p)?j:best,0);}
export function route(from:[number,number],to:[number,number]):[number,number][]{const start=nearest(from),end=nearest(to);const distances=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),remaining=new Set(nodes.map((_,i)=>i));distances[start]=0;while(remaining.size){const u=[...remaining].reduce((a,b)=>distances[a]<distances[b]?a:b);remaining.delete(u);if(u===end)break;for(const v of edges[u]){const d=distances[u]+dist(nodes[u],nodes[v]);if(d<distances[v]){distances[v]=d;previous[v]=u;}}}const path:number[]=[];let u=end;while(u!==-1){path.unshift(u);u=previous[u];}return [from,...path.map(i=>nodes[i]),to].filter((p,i,a)=>i===0||dist(p,a[i-1])>.01);}
export function positionAt(a:Agent,now:number):[number,number]{const m=a.movement;if(!m)return a.position;const path=m.path?.length?m.path:[m.from,m.to];const lengths=path.slice(1).map((p,i)=>dist(path[i],p));let left=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,(now-m.startedAt)/m.duration));for(let i=0;i<lengths.length;i++){if(left<=lengths[i]){const t=lengths[i]?left/lengths[i]:1;return [path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t];}left-=lengths[i];}return m.to;}
const checkedPlans=new Map<string,boolean>();
/** Repair legacy unsafe plans once on the server; duration follows the new remaining distance. */
export function repairMovement(a:Agent,now:number):Agent{
 const m=a.movement;if(!m||now>=m.startedAt+m.duration)return a;
 const path=m.path?.length?m.path:[m.from,m.to],key=JSON.stringify(path);let safe=checkedPlans.get(key);
 if(safe===undefined){safe=path.slice(1).every((p,i)=>isWorldSegmentClear(path[i][0],path[i][1],p[0],p[1],.58));if(checkedPlans.size>2048)checkedPlans.clear();checkedPlans.set(key,safe);}
 if(safe)return a;
 const total=path.slice(1).reduce((sum,p,i)=>sum+dist(path[i],p),0);let remaining=total*Math.max(0,Math.min(1,(now-m.startedAt)/m.duration)),index=0;
 while(index<path.length-1){const length=dist(path[index],path[index+1]);if(remaining<=length)break;remaining-=length;index++;}
 const repaired=safeMotionPath([positionAt(a,now),...path.slice(index+1)]),length=repaired.slice(1).reduce((sum,p,i)=>sum+dist(repaired[i],p),0);
 return {...a,position:repaired[0],movement:repaired.length>1?{from:repaired[0],to:repaired[repaired.length-1],path:repaired,startedAt:now,duration:Math.max(2000,length*1150)}:undefined,activity:repaired.length>1?'Walking':'Observing'};
}
export function plan(a:Agent,to:[number,number],now:number,approaching=false):Agent{const from=positionAt(a,now),path=safeMotionPath(lanePath(route(from,to)));const length=path.slice(1).reduce((s,p,i)=>s+dist(path[i],p),0);return {...a,position:from,activity:approaching?'Approaching':'Walking',movement:{from:path[0],to:path[path.length-1],path,startedAt:now,duration:Math.max(2000,length*1150)}};}
type DemoWorld=WorldSnapshot&{demoJob?:{id:string;a:string;b:string;readyAt:number;location?:string};demoLastTick?:number};
export function simulateDemo(world:WorldSnapshot,now=Date.now()):WorldSnapshot{
 let w:DemoWorld={...world,serverTime:now};const idleGap=now-(w.demoLastTick||now)>60000;w.demoLastTick=now;
 if(!w.agents.length)return w;
 if(idleGap){w={...w,demoJob:undefined,agents:w.agents.map(a=>({...a,position:positionAt(a,now),movement:undefined,activity:'Observing'}))};}
 const job=w.demoJob;
 if(job&&now>=job.readyAt){const a=w.agents.find(a=>a.id===job.a),b=w.agents.find(a=>a.id===job.b);if(a&&b){const e=scriptedEncounter(a,b,job.id,now);e.location=job.location||'The Forum';e.memories=e.memories.map(m=>({...m,text:m.text.replace('the Forum',e.location)}));w=applyEncounter(w,e);w.agents=w.agents.map(a=>job.a===a.id||job.b===a.id?{...a,position:a.movement?.to||a.position,movement:undefined,activity:'Conversing'}:a);}delete w.demoJob;}
 const last=w.encounters[0]?.createdAt||now-31000;
 w.agents=w.agents.map((a,i)=>{if(w.demoJob&&(a.id===w.demoJob.a||a.id===w.demoJob.b))return a;if(a.activity==='Conversing'&&now-last<9000)return a;if(a.movement&&now<a.movement.startedAt+a.movement.duration)return repairMovement(a,now);const current={...a,position:positionAt(a,now),movement:undefined};const cycle=Math.floor(now/12000);if((cycle+i)%7===0)return {...current,activity:a.traits.creativity>=75?'Observing':'Idle'};const n=nearest(current.position),opts=edges[n];const choice=a.traits.sociability>=75&&cycle%3===0?nearest(meetingSites[a.seed%meetingSites.length].center):a.traits.curiosity>=75&&cycle%3===1?11+(a.seed+cycle)%Math.max(1,nodes.length-11):opts[(cycle+a.seed)%opts.length];return plan(current,spreadNode(nodes[choice],a.seed),now);});
 const mine=w.agents.find(a=>a.id===w.mineId);const first=mine&&!mine.memories.length&&now-mine.createdAt>4500;
 if(!w.demoJob&&!idleGap&&(first||now-last>30000)){const a=first?mine:w.agents[Math.floor(now/30000)%w.agents.length];const b=w.agents.filter(b=>b.id!==a.id&&!w.encounters.some(e=>e.participants.includes(a.id)&&e.participants.includes(b.id)&&now-e.createdAt<90000)).sort((b,c)=>dist(positionAt(a,now),positionAt(b,now))-dist(positionAt(a,now),positionAt(c,now)))[0];if(b){const pa=positionAt(a,now),pb=positionAt(b,now),midpoint:[number,number]=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];const site=[...meetingSites].sort((s,t)=>dist(s.center,midpoint)-dist(t.center,midpoint))[0];const aa=plan(a,[site.center[0]-.6,site.center[1]+.4],now,true),bb=plan(b,[site.center[0]+.6,site.center[1]+.4],now,true);w.demoJob={id:crypto.randomUUID(),a:a.id,b:b.id,readyAt:now+Math.max(aa.movement!.duration,bb.movement!.duration),location:site.name};w.agents=w.agents.map(x=>x.id===aa.id?aa:x.id===bb.id?bb:x);}}
 return w;
}
