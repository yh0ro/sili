import {isWorldPositionClear,isWorldSegmentClear,safeWorldPosition} from './world-obstacles';
const RADIUS=.58,GRID=1.5,EXTENT=63,WIDTH=85;
const cache=new Map<string,[number,number][]>();
const point=(id:number):[number,number]=>[(id%WIDTH)*GRID-EXTENT,Math.floor(id/WIDTH)*GRID-EXTENT];
const idAt=(x:number,z:number)=>Math.round((z+EXTENT)/GRID)*WIDTH+Math.round((x+EXTENT)/GRID);
let components:Int16Array|undefined,mainComponent=0;
function accessible(id:number){
 if(!components){
  components=new Int16Array(WIDTH*WIDTH);const walkable=new Uint8Array(WIDTH*WIDTH),queue=new Int32Array(WIDTH*WIDTH);
  for(let i=0;i<walkable.length;i++){const p=point(i);walkable[i]=isWorldPositionClear(p[0],p[1],RADIUS)?1:0;}
  let component=0,largest=0;
  for(let seed=0;seed<walkable.length;seed++){
   if(!walkable[seed]||components[seed])continue;component++;let head=0,tail=1;queue[0]=seed;components[seed]=component;
   while(head<tail){const id=queue[head++],p=point(id),x=id%WIDTH,z=Math.floor(id/WIDTH);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,nz=z+dz;if(!(dx||dz)||nx<0||nz<0||nx>=WIDTH||nz>=WIDTH)continue;const next=nz*WIDTH+nx;if(!walkable[next]||components[next])continue;const q=point(next);if(!isWorldSegmentClear(p[0],p[1],q[0],q[1],RADIUS))continue;components[next]=component;queue[tail++]=next;}
   }
   if(tail>largest){largest=tail;mainComponent=component;}
  }
 }
 return components[id]===mainComponent;
}
function anchor(p:[number,number]){
 const center=idAt(p[0],p[1]),cx=center%WIDTH,cz=Math.floor(center/WIDTH);let best=-1,length=Infinity;
 for(let ring=0;ring<=3;ring++)for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++){
  const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=WIDTH||z>=WIDTH)continue;const id=z*WIDTH+x,q=point(id),d=Math.hypot(q[0]-p[0],q[1]-p[1]);
  if(d<length&&accessible(id)&&isWorldPositionClear(q[0],q[1],RADIUS)&&isWorldSegmentClear(p[0],p[1],q[0],q[1],RADIUS)){best=id;length=d;}
 }
 return best;
}
export function safeNavigationPosition(x:number,z:number):[number,number]{
 const p=isWorldPositionClear(x,z,RADIUS)?[x,z] as [number,number]:safeWorldPosition(x,z,RADIUS);
 if(anchor(p)>=0)return p;
 // A nearest clear point can be an enclosed sliver between overlapping props.
 // Initial placement chooses a nearby traversable grid location instead.
 const center=idAt(p[0],p[1]),cx=center%WIDTH,cz=Math.floor(center/WIDTH);let best:[number,number]|undefined,distance=Infinity;
 for(let ring=1;ring<16&&!best;ring++)for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++){
  const nx=cx+dx,nz=cz+dz;if(nx<0||nz<0||nx>=WIDTH||nz>=WIDTH)continue;const q=point(nz*WIDTH+nx),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<distance&&accessible(nz*WIDTH+nx)&&isWorldPositionClear(q[0],q[1],RADIUS)){best=q;distance=d;}
 }
 return best||p;
}
function detour(from:[number,number],to:[number,number]):[number,number][]{
 if(isWorldSegmentClear(from[0],from[1],to[0],to[1],RADIUS))return [from,to];
 const key=`${from.join(',')}:${to.join(',')}`;const previous=cache.get(key);if(previous)return previous;
 const start=anchor(from),end=anchor(to);if(start<0||end<0)return [from];
 const distances=new Float64Array(WIDTH*WIDTH);distances.fill(Infinity);const parents=new Int32Array(WIDTH*WIDTH);parents.fill(-1);
 const closed=new Uint8Array(WIDTH*WIDTH),heap:{id:number;priority:number}[]=[];
 function push(id:number,priority:number){heap.push({id,priority});let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].priority<=priority)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}}
 function pop(){const first=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].priority<heap[c].priority)c++;if(heap[i].priority<=heap[c].priority)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return first.id;}
 distances[start]=0;push(start,0);let visits=0;
 while(heap.length&&visits++<5000){const id=pop();if(closed[id])continue;closed[id]=1;if(id===end)break;const p=point(id),x=id%WIDTH,z=Math.floor(id/WIDTH);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const nx=x+dx,nz=z+dz;if(!(dx||dz)||nx<0||nz<0||nx>=WIDTH||nz>=WIDTH)continue;const next=nz*WIDTH+nx;if(closed[next])continue;const q=point(next);
   if(!isWorldPositionClear(q[0],q[1],RADIUS)||!isWorldSegmentClear(p[0],p[1],q[0],q[1],RADIUS))continue;
   const d=distances[id]+Math.hypot(dx,dz)*GRID;if(d>=distances[next])continue;distances[next]=d;parents[next]=id;push(next,d+Math.hypot(q[0]-to[0],q[1]-to[1]));
  }
 }
 if(!closed[end])return [from];
 const ids:number[]=[];let at=end;while(at>=0){ids.push(at);at=parents[at];}ids.reverse();
 const path:[number,number][]=[from,...ids.map(point),to],simplified:[number,number][]=[from];
 for(let i=0;i<path.length-1;){let next=path.length-1;while(next>i+1&&!isWorldSegmentClear(path[i][0],path[i][1],path[next][0],path[next][1],RADIUS))next--;simplified.push(path[next]);i=next;}
 if(cache.size>=1024)cache.delete(cache.keys().next().value!);cache.set(key,simplified);return simplified;
}
/** Repair authored lanes around the exact solid scenery used by the renderer. */
export function safeMotionPath(path:[number,number][]):[number,number][]{
 if(!path.length)return path;
 const safe=path.map(p=>safeNavigationPosition(p[0],p[1]));
 const result:[number,number][]=[safe[0]];
 for(let i=1;i<safe.length;i++){const segment=detour(result[result.length-1],safe[i]);if(segment.length===1)break;result.push(...segment.slice(1));}
 return result.filter((p,i)=>!i||Math.hypot(p[0]-result[i-1][0],p[1]-result[i-1][1])>.001);
}
