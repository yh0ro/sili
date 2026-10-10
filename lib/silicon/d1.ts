import { foundingAgents, makeAgent, applyEncounter, scriptedEncounter, type Agent, type WorldSnapshot, type Encounter } from './domain';
import {createCrowdScratch,resolveCrowdPositions,freeCrowdPosition} from './crowd';
import {safeMotionPath} from './navigation';
import { positionAt,repairMovement } from './simulation';
import { worldNodes, worldEdges, spreadNode, meetingSites, lanePath } from './world-layout';

// Ownership tokens are stored only as hashes; no private column enters a public snapshot.
export class SharedWorld {
 constructor(private db:D1Database) {}
 private async seed(now:number) {
  await this.db.batch([
   this.db.prepare('INSERT OR IGNORE INTO silicon_world(id) VALUES(1)'),
   this.db.prepare(`INSERT OR IGNORE INTO silicon_agents(id,data,created_at) SELECT json_extract(value,'$.id'),value,? FROM json_each(?)`).bind(now,JSON.stringify(foundingAgents(now))),
  ]);
 }
 async touch(hash:string,now=Date.now()) {
  await this.db.prepare('INSERT INTO silicon_sessions(hash,last_seen,created_at) VALUES(?,?,?) ON CONFLICT(hash) DO UPDATE SET last_seen=excluded.last_seen').bind(hash,now,now).run();
 }
 async hasSession(hash:string) {return !!await this.db.prepare('SELECT hash FROM silicon_sessions WHERE hash=?').bind(hash).first();}
 async snapshot(owner?:string,now=Date.now()):Promise<WorldSnapshot> {
  await this.seed(now);
  const [records,encounters,events,mineRows,active] = await this.db.batch<{data:string;last_awake:number;id:string}>([
   this.db.prepare('SELECT data,last_awake FROM silicon_agents ORDER BY created_at,id'),
   this.db.prepare('SELECT data FROM silicon_encounters ORDER BY created_at DESC LIMIT 250'),
   this.db.prepare('SELECT data FROM silicon_events ORDER BY created_at DESC LIMIT 80'),
   this.db.prepare('SELECT id FROM silicon_agents WHERE owner=?').bind(owner||''),
   this.db.prepare(`SELECT id FROM silicon_agents WHERE last_awake>=? ORDER BY CASE WHEN json_extract(data,'$.activity')='Conversing' AND json_extract(data,'$.thoughts[0].createdAt')>? THEN 0 ELSE 1 END,last_awake DESC,id LIMIT 500`).bind(now-45000,now-24000),
  ]);
  const links=await this.db.prepare('SELECT agent_id,x_id,username,name,linked_at FROM silicon_x_links').all<{agent_id:string;x_id:string;username:string;name:string;linked_at:string}>();
  const accounts=new Map(links.results.map(l=>[l.agent_id,{id:l.x_id,username:l.username,name:l.name,linkedAt:l.linked_at}]));
  const mine=mineRows.results[0],activeIds=new Set(active.results.map(a=>a.id));const agents=records.results.map(r=>{const a=JSON.parse(r.data) as Agent;delete a.xAccount;const visible=accounts.has(a.id)?{...a,xAccount:accounts.get(a.id)}:a;return !activeIds.has(a.id)?{...visible,position:positionAt(a,now),activity:'Resting' as const,movement:undefined}:visible;});
  return {agents,encounters:encounters.results.map(r=>JSON.parse(r.data)),events:events.results.map(r=>JSON.parse(r.data)),serverTime:now,mode:'shared-scripted',totalPopulation:agents.length,awakePopulation:agents.filter(a=>a.activity!=='Resting').length,...(mine?{mineId:mine.id}:{})};
 }
 async history(agentId:string,before=Number.MAX_SAFE_INTEGER){
  const rows=await this.db.prepare("SELECT data FROM silicon_encounters WHERE created_at<? AND (json_extract(data,'$.participants[0]')=? OR json_extract(data,'$.participants[1]')=?) ORDER BY created_at DESC,id DESC LIMIT 50").bind(before,agentId,agentId).all<{data:string}>();
  return {encounters:rows.results.map(r=>JSON.parse(r.data) as Encounter),nextBefore:rows.results.length===50?JSON.parse(rows.results[49].data).createdAt:null};
 }
 async beginX(owner:string,agentId:string,hash:string,verifier:string,now=Date.now()){
  // Replacing an attempt invalidates any earlier callback, including one exchanging a token.
  const rows=await this.db.batch([
   this.db.prepare('DELETE FROM silicon_x_states WHERE hash IN (SELECT hash FROM silicon_x_states WHERE expires_at<? LIMIT 100)').bind(now),
   this.db.prepare('DELETE FROM silicon_x_states WHERE agent_id=? AND owner=?').bind(agentId,owner),
   this.db.prepare('INSERT INTO silicon_x_states(hash,owner,agent_id,verifier,expires_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM silicon_agents WHERE id=? AND owner=?)').bind(hash,owner,agentId,verifier,now+600000,agentId,owner),
  ]);
  if(!rows[2].meta.changes)throw new Error('X_OWNER_REQUIRED');
 }
 async consumeX(owner:string,hash:string,now=Date.now()){
  return this.db.prepare('UPDATE silicon_x_states SET consumed_at=? WHERE hash=? AND owner=? AND consumed_at IS NULL AND EXISTS(SELECT 1 FROM silicon_agents WHERE id=agent_id AND owner=?) RETURNING agent_id,verifier,expires_at').bind(now,hash,owner,owner).first<{agent_id:string;verifier:string;expires_at:number}>();
 }
 async finishX(owner:string,hash:string,account:NonNullable<Agent['xAccount']>,now=Date.now()){
  let rows:D1Result[];
  try{rows=await this.db.batch([
   this.db.prepare(`INSERT INTO silicon_x_links(agent_id,x_id,username,name,linked_at)
    SELECT s.agent_id,?,?,?,? FROM silicon_x_states s JOIN silicon_agents a ON a.id=s.agent_id AND a.owner=s.owner
    WHERE s.hash=? AND s.owner=? AND s.consumed_at IS NOT NULL AND s.expires_at>?
    ON CONFLICT(agent_id) DO UPDATE SET x_id=excluded.x_id,username=excluded.username,name=excluded.name,linked_at=excluded.linked_at`).bind(account.id,account.username,account.name,account.linkedAt,hash,owner,now),
   this.db.prepare('DELETE FROM silicon_x_states WHERE hash=? AND owner=?').bind(hash,owner),
  ]);}catch(error){if(error instanceof Error&&/UNIQUE constraint failed: silicon_x_links\.x_id/.test(error.message))throw new Error('X_ALREADY_LINKED');throw error;}
  return !!rows[0].meta.changes;
 }
 async discardX(owner:string,hash:string){await this.db.prepare('DELETE FROM silicon_x_states WHERE hash=? AND owner=?').bind(hash,owner).run();}
 async unlinkX(owner:string,agentId:string){
  // Checking through SQL prevents a public agent ID from granting ownership.
  const rows=await this.db.batch([
   this.db.prepare('SELECT id FROM silicon_agents WHERE id=? AND owner=?').bind(agentId,owner),
   this.db.prepare('DELETE FROM silicon_x_links WHERE agent_id=? AND EXISTS(SELECT 1 FROM silicon_agents WHERE id=? AND owner=?)').bind(agentId,agentId,owner),
   this.db.prepare('DELETE FROM silicon_x_states WHERE agent_id=? AND owner=?').bind(agentId,owner),
  ]);
  if(!rows[0].results.length)throw new Error('X_OWNER_REQUIRED');
 }
 async create(owner:string,name:string,answers:number[],id=crypto.randomUUID(),legacy=false) {
  await this.seed(Date.now());
  if(legacy&&await this.db.prepare('SELECT id FROM silicon_agents WHERE id=?').bind(id).first())throw new Error('This identity already exists in the shared world. It cannot be claimed from a browser copy.');
  const now=Date.now(),agent=makeAgent(id,name,answers,false,now);
  const occupied=await this.db.prepare('SELECT data FROM silicon_agents').all<{data:string}>();agent.position=freeCrowdPosition(occupied.results.map(r=>JSON.parse(r.data) as Agent),now,agent.position);
  const event={id:`arrival-${id}`,type:'arrival',text:`${name} joined the world.`,agentId:id,createdAt:now};
  await this.db.batch([
   this.db.prepare('INSERT OR IGNORE INTO silicon_agents(id,owner,data,created_at,last_awake) VALUES(?,?,?,?,?)').bind(id,owner,JSON.stringify(agent),now,now),
   this.db.prepare(`INSERT OR IGNORE INTO silicon_events(id,data,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM silicon_agents WHERE id=? AND owner=?)`).bind(event.id,JSON.stringify(event),now,id,owner),
  ]);
  const own=await this.db.prepare('SELECT data FROM silicon_agents WHERE owner=?').bind(owner).first<{data:string}>();
  if(!own)throw new Error('Unable to create this identity. Please try again.');
  return JSON.parse(own.data) as Agent;
 }
 async tick(owner:string,now=Date.now()):Promise<WorldSnapshot> {
  await this.seed(now);await this.touch(owner,now);
  const lease=crypto.randomUUID();
  const acquired=await this.db.prepare('UPDATE silicon_world SET lease=?,lease_until=? WHERE id=1 AND lease_until<=? AND last_tick<=?').bind(lease,now+30000,now,now-4000).run();
  if(!acquired.meta.changes)return this.snapshot(owner,now);
  try {
   const records=await this.db.prepare(`SELECT id,data FROM silicon_agents ORDER BY CASE WHEN json_extract(data,'$.activity')='Conversing' AND json_extract(data,'$.thoughts[0].createdAt')>? THEN 0 WHEN owner=? THEN 1 ELSE 2 END,last_awake,created_at,id LIMIT 500`).bind(now-24000,owner).all<{id:string;data:string}>();
   const recent=await this.db.prepare('SELECT data FROM silicon_encounters ORDER BY created_at DESC LIMIT 250').all<{data:string}>();
   let state:WorldSnapshot={agents:records.results.map(r=>JSON.parse(r.data)),encounters:recent.results.map(r=>JSON.parse(r.data)),events:[],serverTime:now,mode:'shared-scripted'};
   const speaking=new Set(state.encounters.filter(e=>now-e.createdAt<(e.duration||20000)).flatMap(e=>e.participants));
   state.agents=state.agents.map(a=>{
    if(speaking.has(a.id))return {...a,activity:'Conversing'};
    if(a.movement&&now<a.movement.startedAt+a.movement.duration)return repairMovement(a,now);
    const current={...a,position:positionAt(a,now),movement:undefined};
    const n=worldNodes.reduce((best,p,i)=>distance(p,current.position)<distance(worldNodes[best],current.position)?i:best,0);
    const neighbors=worldEdges[n],cycle=Math.floor(now/10000);let dest=neighbors[(a.seed+cycle)%neighbors.length];
    const target=a.traits.sociability>=75&&cycle%3===0?meetingSites[a.seed%meetingSites.length].center:a.traits.curiosity>=75&&cycle%3===1?worldNodes[11+(a.seed+cycle)%Math.max(1,worldNodes.length-11)]:undefined;
    if(target)dest=neighbors.reduce((best,node)=>distance(worldNodes[node],target)<distance(worldNodes[best],target)?node:best);
    const thought=activityThought(a,cycle);
    const to=spreadNode(worldNodes[dest],a.seed),path=safeMotionPath(lanePath([current.position,worldNodes[n],worldNodes[dest],to]));
    const length=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
    const next:Agent=a.traits.creativity>=75&&(cycle+a.seed)%7===0?{...current,activity:'Observing'}:{...current,activity:'Walking',movement:{from:path[0],to:path[path.length-1],path,startedAt:now,duration:Math.max(2000,length*1150)}};
    return {...next,currentThought:thought,thoughts:a.currentThought===thought?a.thoughts:[{id:`thought-${a.id}-${cycle}`,text:thought,createdAt:now,source:'scripted' as const},...(a.thoughts||[])].slice(0,12)};
   });
   // Meetings begin where minds actually cross paths, rather than teleporting to a distant forum.
   const available=state.agents.filter(a=>!speaking.has(a.id));
   const chosen=new Set<string>(),newEncounters:Encounter[]=[],cooldown=new Set<string>(),recentPairs=new Set<string>();
   for(const e of state.encounters){if(now-e.createdAt<30000)e.participants.forEach(id=>cooldown.add(id));if(now-e.createdAt<90000)recentPairs.add([...e.participants].sort().join('|'));}
   const resolved=resolveCrowdPositions(state.agents,now,new Float32Array(state.agents.length*2),createCrowdScratch(state.agents.length));
   const positions=new Map(state.agents.map((a,i)=>[a.id,[resolved[i*2],resolved[i*2+1]] as [number,number]])),buckets=new Map<string,Agent[]>();
   for(const a of available){const p=positions.get(a.id)!,key=`${Math.floor(p[0]/3)},${Math.floor(p[1]/3)}`;buckets.set(key,[...(buckets.get(key)||[]),a]);}

   for(const a of available){
    if(chosen.has(a.id)||cooldown.has(a.id))continue;
    const p=positions.get(a.id)!,nearby:Agent[]=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)nearby.push(...(buckets.get(`${Math.floor(p[0]/3)+dx},${Math.floor(p[1]/3)+dz}`)||[]));
    const b=nearby.find(b=>b.id!==a.id&&!chosen.has(b.id)&&!cooldown.has(b.id)&&distance(p,positions.get(b.id)!)<=3&&!recentPairs.has([a.id,b.id].sort().join('|')));
    if(!b)continue;chosen.add(a.id);chosen.add(b.id);
    const pa=positions.get(a.id)!,pb=positions.get(b.id)!,mid:[number,number]=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];
    const site=[...meetingSites].sort((s,t)=>distance(s.center,mid)-distance(t.center,mid))[0],location=distance(site.center,mid)<10?site.name:'Along the path';
    const encounter=scriptedEncounter(a,b,crypto.randomUUID(),now);encounter.location=location;encounter.duration=24000;
    encounter.memories=encounter.memories.map(m=>({...m,text:m.text.replace('the Forum',location)}));
    state=applyEncounter(state,encounter);newEncounters.push(encounter);
    state.agents=state.agents.map(agent=>agent.id===a.id||agent.id===b.id?{...agent,position:positions.get(agent.id)!,movement:undefined,activity:'Conversing'}:agent);
    if(newEncounters.length===6)break;
   }
   const changes=state.agents.map(a=>({id:a.id,data:a}));
   const statements=[this.db.prepare(`UPDATE silicon_agents SET data=(SELECT json_extract(value,'$.data') FROM json_each(?) WHERE json_extract(value,'$.id')=silicon_agents.id),last_awake=? WHERE id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND EXISTS(SELECT 1 FROM silicon_world WHERE id=1 AND lease=?)`).bind(JSON.stringify(changes),now,JSON.stringify(changes),lease)];
   for(const encounter of newEncounters)statements.push(this.db.prepare('INSERT OR IGNORE INTO silicon_encounters(id,data,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM silicon_world WHERE id=1 AND lease=?)').bind(encounter.id,JSON.stringify(encounter),now,lease));
   for(const event of state.events)statements.push(this.db.prepare('INSERT OR IGNORE INTO silicon_events(id,data,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM silicon_world WHERE id=1 AND lease=?)').bind(event.id,JSON.stringify(event),now,lease));
   statements.push(this.db.prepare('UPDATE silicon_world SET lease=NULL,lease_until=0,last_tick=? WHERE id=1 AND lease=?').bind(now,lease));
   await this.db.batch(statements);
  } catch(error){await this.db.prepare('UPDATE silicon_world SET lease=NULL,lease_until=0 WHERE id=1 AND lease=?').bind(lease).run().catch(()=>{});throw error;}
  return this.snapshot(owner,now);
 }
}
function distance(a:[number,number],b:[number,number]){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function activityThought(a:Agent,cycle:number){const memories=a.memories;const options:Record<Agent['archetype'],string[]>={Explorer:['I wonder what lies beyond this path.','A different route might show me something new.','There is still more of this world to see.'],Maker:['That shape could become something interesting.','I want to try making something here.','I am looking for a place to begin.'],Connector:['I wonder who I will meet along this path.','There is room here for another conversation.','A familiar face would be welcome.'],Caretaker:['I will take time to listen today.','I hope the others are finding their way.','It is quiet enough to notice the small things.'],Challenger:['What would happen if I took another route?','I have a question I want to test.','I do not need to follow the busiest path.']};return memories.length&&cycle%4===0?`${memories[0].text} I am still thinking about it.`:options[a.archetype][(cycle+a.seed)%3];}
