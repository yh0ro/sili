export const WORLD_RADIUS=64;
export type District={id:string;name:string;center:[number,number];radius:number;kind:'forum'|'workshop'|'garden'|'observatory'};
export const districts:District[]=[
 {id:'west-garden',name:'West Garden',center:[-28,4],radius:8,kind:'garden'},
 {id:'east-forum',name:'East Forum',center:[28,8],radius:8,kind:'forum'},
 {id:'north-observatory',name:'Observatory',center:[0,-28],radius:8,kind:'observatory'},
 {id:'south-workshop',name:'Workshop',center:[-5,30],radius:8,kind:'workshop'},
 {id:'ridge-forum',name:'Ridge Forum',center:[30,-28],radius:8,kind:'forum'},
];
export const meetingSites:{center:[number,number];name:string}[]=[{center:[4,4],name:'The Forum'},...districts.filter(d=>d.kind==='forum'||d.kind==='garden'||d.kind==='workshop').map(d=>({center:d.center,name:d.name}))];
// Preserve the original eleven indices. A wide, connected lattice surrounds the sculpture.
export const worldNodes:[number,number][]=[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3]];
export const worldEdges:number[][]=[[1,9],[0,2,7],[1,3,6],[2,4],[3,5],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10],[9]];
function add(p:[number,number]){const old=worldNodes.findIndex(n=>n[0]===p[0]&&n[1]===p[1]);if(old>=0)return old;worldNodes.push(p);worldEdges.push([]);return worldNodes.length-1;}
function link(a:number,b:number){if(a!==b&&!worldEdges[a].includes(b)){worldEdges[a].push(b);worldEdges[b].push(a);}}
const grid=new Map<string,number>();
for(let z=-48;z<=48;z+=12)for(let x=-48;x<=48;x+=12){if(Math.hypot(x,z)>60||(x===0&&z===0))continue;grid.set(`${x},${z}`,add([x,z]));}
for(const [key,i] of grid){const [x,z]=key.split(',').map(Number);for(const [dx,dz] of [[12,0],[0,12]]){const j=grid.get(`${x+dx},${z+dz}`);if(j!==undefined)link(i,j);}}
// Connect the compact arrival graph to clear north/south/west/east corridors.
for(const [a,p] of [[0,[-12,12]],[2,[0,12]],[3,[12,12]],[4,[12,12]],[4,[12,0]],[9,[-12,0]],[10,[-12,-12]]] as [number,[number,number]][])link(a,grid.get(p.join(','))!);
for(const d of districts){const i=add(d.center);const nearest=[...grid.values()].sort((a,b)=>Math.hypot(worldNodes[a][0]-d.center[0],worldNodes[a][1]-d.center[1])-Math.hypot(worldNodes[b][0]-d.center[0],worldNodes[b][1]-d.center[1])).slice(0,2);nearest.forEach(j=>link(i,j));}
export function crowdOffset(seed:number):[number,number]{const angle=(seed%997)*2.39996323;const radius=.35+((Math.floor(seed/997)%101)/100)*1.2;return [Math.cos(angle)*radius,Math.sin(angle)*radius];}
export function spreadNode(p:[number,number],seed:number):[number,number]{const o=crowdOffset(seed);const q:[number,number]=[p[0]+o[0],p[1]+o[1]];if(q[0]>-2&&q[0]<10&&q[1]>-6&&q[1]<-2)q[1]=-.7;return q;}
export function arrivalPosition(seed:number):[number,number]{const slot=seed%300;const angle=slot*2.39996323;const radius=1.1+Math.sqrt(slot/300)*4;return [-6+Math.cos(angle)*radius,6+Math.sin(angle)*radius];}


/** Directed right-hand lanes keep agents travelling in opposite directions apart. */
export function lanePath(path:[number,number][]):[number,number][]{
 const shifted=path.map((p,i)=>{
  if(i===0||i===path.length-1)return [...p] as [number,number];
  const before=path[i-1],after=path[i+1],dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz)||1;
  const q:[number,number]=[p[0]-dz/length*.58,p[1]+dx/length*.58];
  if(q[0]>-2.6&&q[0]<10.6&&q[1]>-6.6&&q[1]<-1.4)q[1]=-1.35;
  return q;
 });
 const result:[number,number][]=[shifted[0]];
 for(let i=1;i<shifted.length;i++){
  const from=result[result.length-1],to=shifted[i];
  if(!clearBodySegment(from,to)){
   const corners:[number,number][]=[[-2.65,-6.65],[-2.65,-1.35],[10.65,-1.35],[10.65,-6.65]];
   let best:[number,number][]|undefined,bestLength=Infinity;
   for(const a of corners)for(const b of corners){
    if(!clearBodySegment(from,a)||!clearBodySegment(a,b)||!clearBodySegment(b,to))continue;
    const length=Math.hypot(a[0]-from[0],a[1]-from[1])+Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(to[0]-b[0],to[1]-b[1]);
    if(length<bestLength){bestLength=length;best=a===b?[a]:[a,b];}
   }
   if(best)result.push(...best);
  }
  result.push(to);
 }
 return result;
}
function clearBodySegment(a:[number,number],b:[number,number]){
 let low=0,high=1;
 for(const [axis,min,max] of [[0,-2.6,10.6],[1,-6.6,-1.4]]){
  const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<=min||a[axis]>=max)return true;continue;}
  const t0=(min-a[axis])/d,t1=(max-a[axis])/d;low=Math.max(low,Math.min(t0,t1));high=Math.min(high,Math.max(t0,t1));
 }
 return !(low<high&&high>0&&low<1);
}
