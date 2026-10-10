import {WORLD_RADIUS,districts,worldNodes,worldEdges} from './world-layout';
export type SolidObstacle={id:string;kind:'circle'|'box';x:number;z:number;radius?:number;halfX?:number;halfZ?:number;yaw?:number};
export const SCENE_ANCHORS={body:[2,-4],forum:[4,4],archive:[-6,-3]} as const;
export function clearOfRoutes(x:number,z:number,margin:number){return !worldEdges.some((neighbors,i)=>neighbors.some(j=>{if(j<i)return false;const a=worldNodes[i],b=worldNodes[j],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<margin}));}
const nearRoute=(x:number,z:number,margin:number)=>!clearOfRoutes(x,z,margin);
function safeDistrictOffset(center:[number,number],candidates:[number,number][],margin:number){return candidates.find(p=>clearOfRoutes(center[0]+p[0],center[1]+p[1],margin))??candidates[0]}
export const centralWorkshops=[{position:[9,0,4.5] as [number,number,number],yaw:-.7},{position:[-10,0,-5.5] as [number,number,number],yaw:.5},{position:[7,0,-9] as [number,number,number],yaw:.15}];
export const centralLanterns:[[number,number,number],... [number,number,number][]]=[[1,0,6.3],[6.5,0,5.5],[-4.2,0,4.8],[-7.9,0,.3],[-4.6,0,-2.4],[9.5,0,-3.5]];
export const centralTrees:[number,number][]=[[-9,-2],[11,-4],[10,8],[-10,5],[-3,8],[7,-8]];
export const terrainMounds=[[-9,-6,5,2],[12,-8,6,2.4],[13,7,5,1.5],[-12,8,6,2]];
export const ponds=[{position:[-4,9] as [number,number],radius:2.5},{position:[-3,-8] as [number,number],radius:2}];
export const forumSeats=Array.from({length:6},(_,i)=>({index:i,position:[Math.cos(i*1.047)*2.05,0,Math.sin(i*1.047)*2.05] as [number,number,number],yaw:-i*1.047})).filter(p=>clearOfRoutes(p.position[0]+4,p.position[2]+4,.8));
export const centralRocks=Array.from({length:18},(_,i)=>{const angle=i*2.4,radius=9+(i%4)*1.1,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius*.65;return{seed:i,x,z,scale:[.35+(i%3)*.17,.3,.45] as [number,number,number],plant:i%2===0&&Math.hypot(x-4,z-4)>3.7&&!(Math.abs(z-4)<1.1&&x>-6&&x<7)&&!(x>-2&&x<10&&z>-6.8&&z<-1.6)}}).filter(p=>clearOfRoutes(p.x,p.z,1.2));
export const districtPlans=new Map(districts.map(d=>[d.id,{building:safeDistrictOffset(d.center,[[2,-3],[-4,-3],[4,-3],[3,4],[-4,3]],2.4),lamps:[safeDistrictOffset(d.center,[[-3.5,2.5],[-5,1],[-4,-4],[-1,-5]],1),safeDistrictOffset(d.center,[[3.5,2.5],[5,1],[4,-4],[1,-5]],1)]}]));
export const districtTrees=districts.flatMap(d=>Array.from({length:8},(_,i)=>[d.center[0]+Math.cos(i*.785+.3)*(d.radius-1),d.center[1]+Math.sin(i*.785+.3)*(d.radius-1)])).filter(p=>clearOfRoutes(p[0],p[1],1.8));
export const districtBenches=[-1,1].map(side=>[side*3,0] as [number,number]);
export const mineralFeatures=(()=>{
  const minerals:number[][]=[],shrubs:number[][]=[],terraces:number[][]=[];
  for(let z=-42;z<=42;z+=12)for(let x=-42;x<=42;x+=12){if(Math.hypot(x,z)>54||(x>-12&&x<12&&z>-12&&z<12))continue;if(!nearRoute(x,z,4))terraces.push([x,z,2.5+(Math.abs(x+z)%3)]);for(let i=0;i<3;i++){const px=x+Math.sin(x*7+z*3+i*2.3)*3,pz=z+Math.cos(z*5+x+i*3.7)*3;if(nearRoute(px,pz,1.9)||districts.some(d=>Math.hypot(px-d.center[0],pz-d.center[1])<d.radius+1))continue;minerals.push([px,pz,.4+(i%3)*.18]);if(i%2===0)shrubs.push([px+.35,pz+.2,.6+(i%2)*.2])}}
  const homes=districts.flatMap(d=>Array.from({length:4},(_,i)=>{const angle=i*Math.PI/2+.8;return[d.center[0]+Math.cos(angle)*6,d.center[1]+Math.sin(angle)*6,i]})).filter(p=>!nearRoute(p[0],p[1],2.2));
  const lamps=worldNodes.filter((p,i)=>i>10&&(p[0]===0||p[1]===12||p[1]===-24)).map(p=>[p[0]+1.5,p[1]+1.5,1]);return[minerals,shrubs,[],homes,homes,homes,lamps,lamps];

})();
export const meadowFields=(()=>{const moss:number[][]=[],grass:number[][]=[],flowers:number[][]=[],bushes:number[][]=[];for(let i=0;i<1100;i++){const angle=i*2.39996323,radius=Math.sqrt((i+.5)/1100)*59;const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;if(!clearOfRoutes(x,z,.85)||(x>-2&&x<10&&z>-6.8&&z<-1.6)||districts.some(d=>Math.hypot(x-d.center[0],z-d.center[1])<4)||Math.hypot(x+4,z-9)<3.3||Math.hypot(x+3,z+8)<2.7)continue;grass.push([x,z,.45+(i%7)*.07]);if(i%5===0)moss.push([x,z,.6+(i%4)*.25]);if(i%4===0)flowers.push([x+.15,z+.12,.3+(i%3)*.09]);if(i%23===0&&clearOfRoutes(x,z,1.7))bushes.push([x,z,.65+(i%4)*.1])}for(let i=0;i<90;i++){const angle=i*2.4,radius=7.5+(i%5)*.65,x=Math.cos(angle)*radius,z=7+Math.sin(angle)*radius*.6;if(!clearOfRoutes(x,z,1)||(x>-2&&x<10&&z>-6.8&&z<-1.6)||Math.hypot(x+4,z-9)<3.1)continue;grass.push([x,z,.6]);flowers.push([x,z,.4])}return[moss,grass,flowers,flowers,bushes]})();

// Every solid placement is generated above and consumed directly by both the renderer and navigation.
export const worldObstacles:SolidObstacle[]=[];
const circle=(id:string,x:number,z:number,radius:number)=>worldObstacles.push({id,kind:'circle',x,z,radius});
const box=(id:string,x:number,z:number,halfX:number,halfZ:number,yaw=0)=>worldObstacles.push({id,kind:'box',x,z,halfX,halfZ,yaw});
box('first-body',4,-4,6.6,2.6,-.12);
circle('archive',-6,-3,1.8);
centralWorkshops.forEach((p,i)=>box(`central-workshop-${i}`,p.position[0],p.position[2],1.25,.95,p.yaw));
centralLanterns.forEach((p,i)=>circle(`lantern-${i}`,p[0],p[2],.18));
centralTrees.forEach((p,i)=>circle(`tree-${i}`,p[0]+.15,p[1],1.65));
centralRocks.forEach(p=>{circle(`rock-${p.seed}`,p.x,p.z,.76);if(p.plant)circle(`plant-${p.seed}`,p.x+.5,p.z+.3,.48)});
ponds.forEach((p,i)=>circle(`pond-${i}`,p.position[0],p.position[1],p.radius*1.33));
terrainMounds.forEach((p,i)=>circle(`mound-${i}`,p[0],p[1],p[2]));
forumSeats.forEach(p=>box(`forum-seat-${p.index}`,p.position[0]+4,p.position[2]+4,.46,.25,p.yaw));
circle('forum-centrepiece',4,4,.65);
districtTrees.forEach((p,i)=>circle(`district-tree-${i}`,p[0],p[1],1.12));
districts.forEach((d,i)=>{const plan=districtPlans.get(d.id)!;if(d.kind==='observatory')circle(`${d.id}-observatory`,d.center[0]+4,d.center[1]-3,2.4);else box(`${d.id}-workshop`,d.center[0]+plan.building[0],d.center[1]+plan.building[1],1.25,.95,i*.6);if(d.kind==='garden')circle(`${d.id}-water`,d.center[0]-3.2,d.center[1]-3.2,1.75);plan.lamps.forEach((p,j)=>circle(`${d.id}-lamp-${j}`,d.center[0]+p[0],d.center[1]+p[1],.18));districtBenches.forEach((p,j)=>box(`${d.id}-bench-${j}`,d.center[0]+p[0],d.center[1]+p[1],.4,1));});
mineralFeatures[0].forEach((p,i)=>circle(`mineral-${i}`,p[0],p[1],p[2]*1.15));
mineralFeatures[1].forEach((p,i)=>circle(`shrub-${i}`,p[0],p[1],p[2]));
mineralFeatures[3].forEach((p,i)=>box(`house-${i}`,p[0],p[1],1.1,.9));
mineralFeatures[6].forEach((p,i)=>circle(`avenue-lamp-${i}`,p[0],p[1],.12));
meadowFields[4].forEach((p,i)=>circle(`meadow-bush-${i}`,p[0],p[1],p[2]));
// Small spatial buckets keep per-frame swept collision work local, including dense crowds.
const CELL=4, buckets=new Map<number,SolidObstacle[]>(),EMPTY:SolidObstacle[]=[];
const bucketKey=(x:number,z:number)=>(z+32)*64+x+32;
function extent(o:SolidObstacle){return o.kind==='circle'?o.radius!:Math.hypot(o.halfX!,o.halfZ!)}
for(const o of worldObstacles){const r=extent(o);for(let z=Math.floor((o.z-r)/CELL);z<=Math.floor((o.z+r)/CELL);z++)for(let x=Math.floor((o.x-r)/CELL);x<=Math.floor((o.x+r)/CELL);x++){const key=bucketKey(x,z),items=buckets.get(key);if(items)items.push(o);else buckets.set(key,[o]);}}
function pointBlocked(o:SolidObstacle,x:number,z:number,r:number){const dx=x-o.x,dz=z-o.z;if(o.kind==='circle')return dx*dx+dz*dz<(o.radius!+r)**2;const c=Math.cos(o.yaw??0),s=Math.sin(o.yaw??0),lx=dx*c-dz*s,lz=dx*s+dz*c;return Math.abs(lx)<o.halfX!+r&&Math.abs(lz)<o.halfZ!+r;}
export function isWorldPositionClear(x:number,z:number,radius=0){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>WORLD_RADIUS-.4-radius)return false;for(let bz=Math.floor((z-radius)/CELL);bz<=Math.floor((z+radius)/CELL);bz++)for(let bx=Math.floor((x-radius)/CELL);bx<=Math.floor((x+radius)/CELL);bx++)for(const o of buckets.get(bucketKey(bx,bz))??EMPTY)if(pointBlocked(o,x,z,radius))return false;return true;}
function segmentBlocked(o:SolidObstacle,ax:number,az:number,bx:number,bz:number,r:number){
 if(o.kind==='circle'){const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((o.x-ax)*dx+(o.z-az)*dz)/length)):0;return (ax+dx*t-o.x)**2+(az+dz*t-o.z)**2<(o.radius!+r)**2;}
 const c=Math.cos(o.yaw??0),s=Math.sin(o.yaw??0),x=(ax-o.x)*c-(az-o.z)*s,z=(ax-o.x)*s+(az-o.z)*c,dx=(bx-ax)*c-(bz-az)*s,dz=(bx-ax)*s+(bz-az)*c,hx=o.halfX!+r,hz=o.halfZ!+r;
 let lo=0,hi=1;if(Math.abs(dx)<1e-10){if(Math.abs(x)>=hx)return false}else{const a=(-hx-x)/dx,b=(hx-x)/dx;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}if(Math.abs(dz)<1e-10){if(Math.abs(z)>=hz)return false}else{const a=(-hz-z)/dz,b=(hz-z)/dz;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}return lo<hi;
}
export function isWorldSegmentClear(ax:number,az:number,bx:number,bz:number,radius=0){if(!isWorldPositionClear(ax,az,radius)||!isWorldPositionClear(bx,bz,radius))return false;for(let z=Math.floor((Math.min(az,bz)-radius)/CELL);z<=Math.floor((Math.max(az,bz)+radius)/CELL);z++)for(let x=Math.floor((Math.min(ax,bx)-radius)/CELL);x<=Math.floor((Math.max(ax,bx)+radius)/CELL);x++)for(const o of buckets.get(bucketKey(x,z))??EMPTY)if(segmentBlocked(o,ax,az,bx,bz,radius))return false;return true;}
export function safeWorldPosition(x:number,z:number,radius=.56):[number,number]{if(isWorldPositionClear(x,z,radius))return[x,z];for(let ring=1;ring<200;ring++){const r=ring*.3,slots=Math.max(12,Math.ceil(r*18));for(let i=0;i<slots;i++){const angle=i*Math.PI*2/slots,qx=x+Math.cos(angle)*r,qz=z+Math.sin(angle)*r;if(isWorldPositionClear(qx,qz,radius))return[qx,qz];}}throw new Error('No clear position in the world.');}
