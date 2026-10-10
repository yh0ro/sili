import {safeMotionPath,safeNavigationPosition} from './navigation';
import { WORLD_RADIUS } from './world-layout';
import {isWorldPositionClear,isWorldSegmentClear,safeWorldPosition} from './world-obstacles';

export const MIN_AGENT_SEPARATION = 1.12;
export const MAX_AGENT_SPEED = 1.05;
export const AGENT_BODY_RADIUS = .56;
const STATIC_BODY_RADIUS=.565;
const CLEARANCE = MIN_AGENT_SEPARATION + .002;
const CELL = CLEARANCE;
const EXTENT = WORLD_RADIUS + 2;
const WIDTH = Math.ceil(EXTENT * 2 / CELL) + 1;
const MIN_DISTANCE_SQUARED = CLEARANCE * CLEARANCE;
export type CrowdAgent = {
 id:string;seed:number;position:[number,number];
 movement?:{from:[number,number];to:[number,number];path?:[number,number][];startedAt:number;duration:number};
};
export type CrowdScratch = {
 capacity:number;heads:Int32Array;next:Int32Array;fresh:Uint8Array;previous:Float32Array;sampled:Float32Array;
 ids:string[];order:number[];routes:([number,number][]|undefined)[];cursors:Int32Array;plans:(CrowdAgent['movement'])[];targetX:Float64Array;targetZ:Float64Array;planKeys:string[];speeds:Float32Array;lastTime:number;initialized:boolean;probes:number;
};
export function createCrowdScratch(capacity:number):CrowdScratch {
 return {capacity,heads:new Int32Array(WIDTH*WIDTH),next:new Int32Array(capacity),fresh:new Uint8Array(capacity),previous:new Float32Array(capacity*2),sampled:new Float32Array(capacity*2),ids:[],order:[],routes:[],cursors:new Int32Array(capacity),plans:[],targetX:new Float64Array(capacity),targetZ:new Float64Array(capacity),planKeys:[],speeds:new Float32Array(capacity),lastTime:0,initialized:false,probes:0};
}
// Radius includes the widest procedural arms, rather than only torso geometry.
export function isCrowdPositionSafe(x:number,z:number){
 return Number.isFinite(x)&&Number.isFinite(z)&&x*x+z*z<=(WORLD_RADIUS-.7)**2&&isWorldPositionClear(x,z,STATIC_BODY_RADIUS);
}
function safeSample(out:Float32Array,i:number,x:number,z:number){
 const limit=WORLD_RADIUS-.7,r=Math.hypot(x,z);if(r>limit){x=x/r*limit;z=z/r*limit;}
 const p=safeNavigationPosition(x,z);x=p[0];z=p[1];
 out[i*2]=x;out[i*2+1]=z;
}
function writeSample(out:Float32Array,i:number,x:number,z:number){out[i*2]=x;out[i*2+1]=z;}
function sample(a:CrowdAgent,now:number,out:Float32Array,i:number){
 const m=a.movement;if(!m){writeSample(out,i,a.position[0],a.position[1]);return;}
 const path=m.path?.length?m.path:undefined;
 if(!path){const t=Math.max(0,Math.min(1,(now-m.startedAt)/Math.max(1,m.duration)));writeSample(out,i,m.from[0]+(m.to[0]-m.from[0])*t,m.from[1]+(m.to[1]-m.from[1])*t);return;}
 let total=0;for(let j=1;j<path.length;j++)total+=Math.hypot(path[j][0]-path[j-1][0],path[j][1]-path[j-1][1]);
 let remaining=total*Math.max(0,Math.min(1,(now-m.startedAt)/Math.max(1,m.duration)));
 for(let j=1;j<path.length;j++){const length=Math.hypot(path[j][0]-path[j-1][0],path[j][1]-path[j-1][1]);if(remaining<=length){const t=length?remaining/length:1;writeSample(out,i,path[j-1][0]+(path[j][0]-path[j-1][0])*t,path[j-1][1]+(path[j][1]-path[j-1][1])*t);return;}remaining-=length;}
 writeSample(out,i,m.to[0],m.to[1]);
}
function bucket(x:number,z:number){return Math.floor((z+EXTENT)/CELL)*WIDTH+Math.floor((x+EXTENT)/CELL);}
function clear(x:number,z:number,out:Float32Array,s:CrowdScratch){
 s.probes++;if(!isCrowdPositionSafe(x,z))return false;
 const cx=Math.floor((x+EXTENT)/CELL),cz=Math.floor((z+EXTENT)/CELL);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  let j=s.heads[(cz+dz)*WIDTH+cx+dx];
  while(j>=0){const ox=out[j*2]-x,oz=out[j*2+1]-z;if(ox*ox+oz*oz<MIN_DISTANCE_SQUARED)return false;j=s.next[j];}
 }
 return true;
}
// Precompute dense standing formations once; no arrays, maps or trigonometry per probe.
const offsets:number[]=[];
for(let ring=1;ring<=40;ring++)for(let slot=0;slot<ring*6;slot++){
 const angle=slot*Math.PI*2/(ring*6),r=ring*CLEARANCE;offsets.push(Math.cos(angle)*r,Math.sin(angle)*r);
}
const formationOffsets=new Float32Array(offsets);
function insert(i:number,out:Float32Array,s:CrowdScratch){const cell=bucket(out[i*2],out[i*2+1]);s.next[i]=s.heads[cell];s.heads[cell]=i;}
function remove(i:number,out:Float32Array,s:CrowdScratch){const cell=bucket(out[i*2],out[i*2+1]);let j=s.heads[cell],prior=-1;while(j>=0){if(j===i){if(prior<0)s.heads[cell]=s.next[j];else s.next[prior]=s.next[j];return;}prior=j;j=s.next[j];}}
function sweptClear(ax:number,az:number,bx:number,bz:number,out:Float32Array,s:CrowdScratch){
 if(!isCrowdPositionSafe(bx,bz)||!isWorldSegmentClear(ax,az,bx,bz,STATIC_BODY_RADIUS))return false;
 const minX=Math.floor((Math.min(ax,bx)-CLEARANCE+EXTENT)/CELL),maxX=Math.floor((Math.max(ax,bx)+CLEARANCE+EXTENT)/CELL),minZ=Math.floor((Math.min(az,bz)-CLEARANCE+EXTENT)/CELL),maxZ=Math.floor((Math.max(az,bz)+CLEARANCE+EXTENT)/CELL);
 const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
  let j=s.heads[z*WIDTH+x];while(j>=0){const t=length?Math.max(0,Math.min(1,((out[j*2]-ax)*dx+(out[j*2+1]-az)*dz)/length)):0,ox=out[j*2]-(ax+dx*t),oz=out[j*2+1]-(az+dz*t);s.probes++;if(ox*ox+oz*oz<MIN_DISTANCE_SQUARED)return false;j=s.next[j];}
 }
 return true;
}
const steeringAngles=new Float32Array([Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI*2/3,-Math.PI*2/3,Math.PI*5/6,-Math.PI*5/6,Math.PI]);
/** One monotonic frame-delta speed cap applies to goal following and every avoidance step.
 * All previous bodies remain reserved while each agent moves, so an earlier agent cannot
 * force a later one to teleport. Dense formation placement occurs only on first appearance.
 */
export function resolveCrowdPositions(agents:readonly CrowdAgent[],now:number,out:Float32Array,s:CrowdScratch,frameDeltaSeconds?:number):Float32Array {
 if(agents.length>s.capacity||out.length<agents.length*2)throw new Error('Crowd buffer capacity is too small.');
 let changed=s.ids.length!==agents.length;for(let i=0;!changed&&i<agents.length;i++)changed=s.ids[i]!==agents[i].id;
 let newCount=0;s.fresh.fill(0);
 if(changed){
  const old=new Map(s.ids.map((id,i)=>[id,{x:s.previous[i*2],z:s.previous[i*2+1],route:s.routes[i],cursor:s.cursors[i],plan:s.plans[i],key:s.planKeys[i],speed:s.speeds[i],tx:s.targetX[i],tz:s.targetZ[i]}]));
  s.routes=[];s.plans=[];s.cursors.fill(0);s.targetX.fill(NaN);s.targetZ.fill(NaN);
  s.ids=agents.map(a=>a.id);s.order=agents.map((_,i)=>i).sort((a,b)=>agents[a].id<agents[b].id?-1:agents[a].id>agents[b].id?1:0);
  for(let i=0;i<agents.length;i++){const p=old.get(agents[i].id);if(p){s.previous[i*2]=p.x;s.previous[i*2+1]=p.z;s.routes[i]=p.route;s.cursors[i]=p.cursor;s.plans[i]=p.plan;s.planKeys[i]=p.key;s.speeds[i]=p.speed;s.targetX[i]=p.tx;s.targetZ[i]=p.tz;}else{sample(agents[i],now,s.previous,i);safeSample(s.previous,i,s.previous[i*2],s.previous[i*2+1]);s.fresh[i]=1;newCount++;}}
 }
 s.heads.fill(-1);s.probes=0;
 // Reserve every existing center, not just those processed earlier this frame.
 for(let i=0;i<agents.length;i++){out[i*2]=s.previous[i*2];out[i*2+1]=s.previous[i*2+1];if(s.initialized&&!s.fresh[i])insert(i,out,s);}
 if(!s.initialized||newCount){
  for(const i of s.order){if(s.initialized&&!s.fresh[i])continue;
   let x=out[i*2],z=out[i*2+1],found=clear(x,z,out,s);
   if(!found)for(let j=0;j<formationOffsets.length;j+=2){const qx=x+formationOffsets[j],qz=z+formationOffsets[j+1];if(clear(qx,qz,out,s)){x=qx;z=qz;found=true;break;}}
   if(!found)throw new Error('The crowd exceeds the available safe world area.');out[i*2]=x;out[i*2+1]=z;insert(i,out,s);
  }
 }
 const delta=frameDeltaSeconds===undefined?(now-s.lastTime)/1000:frameDeltaSeconds;
 const step=MAX_AGENT_SPEED*Math.min(.05,Math.max(0,Number.isFinite(delta)?delta:0));
 if(s.initialized&&step>0){
  for(const i of s.order){
   const agent=agents[i],m=agent.movement,px=out[i*2],pz=out[i*2+1];
   if(s.plans[i]!==m||s.targetX[i]!==agent.position[0]||s.targetZ[i]!==agent.position[1]){
    const key=m?`${m.startedAt}:${m.duration}:${JSON.stringify(m.path||[m.from,m.to])}`:'';
    if(key!==s.planKeys[i]||s.targetX[i]!==agent.position[0]||s.targetZ[i]!==agent.position[1]){
     // Wayfinding runs only for a logically new plan, never on steady frames or identical polling snapshots.
     const path=m?(m.path?.length?m.path:[m.from,m.to]):undefined;
     const finish=!!s.plans[i]||Number.isFinite(s.targetX[i])&&(s.targetX[i]!==agent.position[0]||s.targetZ[i]!==agent.position[1]);
     s.routes[i]=path?safeMotionPath([[px,pz],...path.slice(1)]):finish?safeMotionPath([[px,pz],agent.position]):[[px,pz]];
     s.cursors[i]=1;let length=0;if(path)for(let k=1;k<path.length;k++)length+=Math.hypot(path[k][0]-path[k-1][0],path[k][1]-path[k-1][1]);
     s.speeds[i]=m?Math.min(MAX_AGENT_SPEED,length/Math.max(1,m.duration)*1000):finish?.85:0;s.planKeys[i]=key;
    }
    s.plans[i]=m;s.targetX[i]=agent.position[0];s.targetZ[i]=agent.position[1];
   }
   if(m&&now<m.startedAt)continue;
   const route=s.routes[i];if(!route||s.cursors[i]>=route.length)continue;
   let target=route[s.cursors[i]];
   while(s.cursors[i]<route.length-1&&Math.hypot(target[0]-px,target[1]-pz)<.04){s.cursors[i]++;target=route[s.cursors[i]];}
   const gx=target[0]-px,gz=target[1]-pz,distance=Math.hypot(gx,gz);if(distance<1e-5)continue;
   const speed=s.speeds[i],travel=Math.min(step,speed*Math.min(.05,Math.max(0,delta)),distance),dx=gx/distance,dz=gz/distance;if(travel<=0)continue;remove(i,out,s);
   let x=px+dx*travel,z=pz+dz*travel,found=sweptClear(px,pz,x,z,out,s);
   if(!found){
    for(let j=0;j<steeringAngles.length;j++){const angle=steeringAngles[j],cos=Math.cos(angle),sin=Math.sin(angle),qx=px+(dx*cos-dz*sin)*travel,qz=pz+(dx*sin+dz*cos)*travel;if(sweptClear(px,pz,qx,qz,out,s)){x=qx;z=qz;found=true;break;}}
   }
   if(found){out[i*2]=x;out[i*2+1]=z;}insert(i,out,s);
  }
 }
 for(let i=0;i<agents.length*2;i++)s.previous[i]=out[i];s.lastTime=now;s.initialized=true;return out;
}


/** Reserve a new arrival against canonical occupied positions without moving existing records. */
export function freeCrowdPosition(agents:readonly CrowdAgent[],now:number,desired:[number,number]):[number,number]{
 const scratch=createCrowdScratch(agents.length),occupied=new Float32Array(agents.length*2);scratch.heads.fill(-1);
 for(let i=0;i<agents.length;i++){sample(agents[i],now,occupied,i);const cell=bucket(occupied[i*2],occupied[i*2+1]);scratch.next[i]=scratch.heads[cell];scratch.heads[cell]=i;}
 const candidate=new Float32Array(2);safeSample(candidate,0,desired[0],desired[1]);const x=candidate[0],z=candidate[1];
 if(clear(x,z,occupied,scratch))return [x,z];
 for(let j=0;j<formationOffsets.length;j+=2){const qx=x+formationOffsets[j],qz=z+formationOffsets[j+1];if(clear(qx,qz,occupied,scratch))return [qx,qz];}
 throw new Error('No safe arrival position is available.');
}

/** Preserve per-identity position, path progress and clock state when a scene buffer grows. */
export function growCrowdScratch(s:CrowdScratch,capacity:number):CrowdScratch{
 if(capacity<=s.capacity)return s;const grown=createCrowdScratch(capacity);
 grown.previous.set(s.previous);grown.sampled.set(s.sampled);grown.fresh.set(s.fresh);grown.cursors.set(s.cursors);grown.targetX.set(s.targetX);grown.targetZ.set(s.targetZ);grown.speeds.set(s.speeds);
 grown.ids=[...s.ids];grown.order=[...s.order];grown.routes=[...s.routes];grown.plans=[...s.plans];grown.planKeys=[...s.planKeys];grown.lastTime=s.lastTime;grown.initialized=s.initialized;return grown;
}
