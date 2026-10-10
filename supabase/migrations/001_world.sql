-- Run in Supabase SQL editor as project administrator. Private tables have no browser policies.
create extension if not exists pgcrypto;
create table if not exists public.silicon_agents(id text primary key, owner_id uuid unique references auth.users(id), data jsonb not null, last_encounter timestamptz, created_at timestamptz not null default now());
create table if not exists public.silicon_encounters(id uuid primary key, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.silicon_events(id text primary key, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.silicon_relationships(pair text primary key, a text not null references public.silicon_agents(id), b text not null references public.silicon_agents(id), affinity int not null default 0 check(affinity between -100 and 100), encounters int not null default 0, last_at timestamptz);
create table if not exists public.silicon_presence(owner_id uuid primary key references auth.users(id), seen_at timestamptz not null, tick_at timestamptz);
create table if not exists public.silicon_world(id int primary key check(id=1), lease uuid, lease_until timestamptz, last_start timestamptz, last_tick timestamptz, status text);
insert into public.silicon_world(id) values(1) on conflict do nothing;
create table if not exists public.silicon_usage(id uuid primary key, reserved_at timestamptz not null default now(), estimated_usd numeric not null, paid boolean not null, status text not null default 'reserved', result jsonb, failure text, participants text[] not null);
create index if not exists silicon_encounters_time on public.silicon_encounters(created_at desc);
create index if not exists silicon_events_time on public.silicon_events(created_at desc);
create index if not exists silicon_usage_day on public.silicon_usage(reserved_at);
create index if not exists silicon_presence_time on public.silicon_presence(seen_at);
alter table public.silicon_agents enable row level security;
alter table public.silicon_encounters enable row level security;
alter table public.silicon_events enable row level security;
alter table public.silicon_relationships enable row level security;
alter table public.silicon_presence enable row level security;
alter table public.silicon_world enable row level security;
alter table public.silicon_usage enable row level security;
revoke all on public.silicon_agents,public.silicon_encounters,public.silicon_events,public.silicon_relationships,public.silicon_presence,public.silicon_world,public.silicon_usage from anon,authenticated;

-- Stable waypoint routing keeps every segment on the authored paths, clear of the First Body.
create or replace function public.silicon_route(p_from jsonb,p_to jsonb) returns jsonb language plpgsql immutable set search_path=public as $$
declare nodes jsonb:='[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3]]'; edges jsonb:='[[1,9],[0,2,7],[1,3,6],[2,4],[3,5],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10],[9]]'; start_node int; end_node int; route int[]; output jsonb:=jsonb_build_array(p_from); node int;
begin
 select i into start_node from generate_series(0,10) i order by power((nodes->i->>0)::numeric-(p_from->>0)::numeric,2)+power((nodes->i->>1)::numeric-(p_from->>1)::numeric,2) limit 1;
 select i into end_node from generate_series(0,10) i order by power((nodes->i->>0)::numeric-(p_to->>0)::numeric,2)+power((nodes->i->>1)::numeric-(p_to->>1)::numeric,2) limit 1;
 with recursive paths as (select start_node as node,array[start_node] as visited union all select (e.value)::int,p.visited||(e.value)::int from paths p cross join lateral jsonb_array_elements_text(edges->p.node) e where not (e.value)::int=any(p.visited)) select visited into route from paths where paths.node=end_node order by cardinality(visited) limit 1;
 foreach node in array route loop output:=output||jsonb_build_array(nodes->node); end loop;
 return output||jsonb_build_array(p_to);
end $$;

create or replace function public.silicon_advance_walkers(p_ms bigint) returns void language plpgsql security definer set search_path=public as $$
declare nodes jsonb:='[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3]]'; edges jsonb:='[[1,9],[0,2,7],[1,3,6],[2,4],[3,5],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10],[9]]'; r silicon_agents%rowtype; d jsonb; current_pos jsonb; nearest int; target int; route jsonb; dest jsonb; phase int; seconds numeric; dx numeric; dz numeric;
begin
 for r in select * from silicon_agents where data->>'activity'<>'Resting' loop
  d:=r.data;current_pos:=d->'position';phase:=(((d->>'seed')::bigint+p_ms/20000)%12)::int;
  if d->'movement' is not null then
   if (d->'movement'->>'startedAt')::bigint+(d->'movement'->>'duration')::numeric>p_ms then
    update silicon_agents set data=jsonb_set(d,'{activity}','"Walking"') where id=r.id;continue;
   end if;
   current_pos:=d->'movement'->'to';d:=jsonb_set(d-'movement','{position}',current_pos);
  end if;
  if phase=0 or ((d->'traits'->>'creativity')::int>=75 and phase%3=0) then
   update silicon_agents set data=jsonb_set(d,'{activity}','"Observing"') where id=r.id;continue;
  end if;
  select i into nearest from generate_series(0,10) i order by power((nodes->i->>0)::numeric-(current_pos->>0)::numeric,2)+power((nodes->i->>1)::numeric-(current_pos->>1)::numeric,2) limit 1;
  target:=case when (d->'traits'->>'sociability')::int>=75 and phase%2=0 then 3 when (d->'traits'->>'curiosity')::int>=75 and phase%2=1 then 10 when (d->'traits'->>'creativity')::int>=75 then 5 else (edges->nearest->>(phase%jsonb_array_length(edges->nearest)))::int end;
  route:=silicon_route(nodes->nearest,nodes->target);
  -- Walk only one graph edge per request, never through scenery or every animation frame.
  dest:=coalesce(route->2,nodes->nearest);
  if dest=nodes->nearest and jsonb_array_length(route)>3 then dest:=route->3;end if;
  dx:=(dest->>0)::numeric-(current_pos->>0)::numeric;dz:=(dest->>1)::numeric-(current_pos->>1)::numeric;
  seconds:=greatest(3500,least(15000,sqrt(dx*dx+dz*dz)*1800));
  d:=jsonb_set(jsonb_set(d,'{activity}','"Walking"'),'{movement}',jsonb_build_object('from',current_pos,'to',dest,'path',jsonb_build_array(current_pos,nodes->nearest,dest),'startedAt',p_ms,'duration',seconds));
  update silicon_agents set data=d where id=r.id;
  if target=nearest and nearest in(3,5,10) and phase%4=1 then
   insert into silicon_events(id,data) values('discovery-'||r.id||'-'||floor(p_ms/60000),jsonb_build_object('id','discovery-'||r.id||'-'||floor(p_ms/60000),'type','discovery','text',(d->>'name')||' paused to study '||case when nearest=3 then 'the Forum.' when nearest=10 then 'the Archive.' else 'a new shape in the sand.' end,'agentId',r.id,'createdAt',p_ms)) on conflict do nothing;
  end if;
 end loop;
end $$;

create or replace function public.silicon_create(p_owner uuid,p_agent jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare existing jsonb;
begin
 perform pg_advisory_xact_lock(hashtext(p_owner::text));
 select data into existing from silicon_agents where owner_id=p_owner;
 if existing is not null then return existing; end if;
 if not exists(select 1 from auth.users where id=p_owner) then raise exception 'Invalid guest'; end if;
 insert into silicon_agents(id,owner_id,data) values(p_agent->>'id',p_owner,p_agent);
 insert into silicon_events(id,data) values('arrival-'||(p_agent->>'id'),jsonb_build_object('id','arrival-'||(p_agent->>'id'),'type','arrival','text',(p_agent->>'name')||' arrived beside the First Body.','agentId',p_agent->>'id','createdAt',floor(extract(epoch from now())*1000)));
 return p_agent;
end $$;

create or replace function public.silicon_snapshot(p_owner uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare agents jsonb; awake int;
begin
 select coalesce(jsonb_agg(data order by created_at),'[]') into agents from silicon_agents;
 select count(*) into awake from silicon_agents where data->>'activity'<>'Resting';
 return jsonb_build_object('agents',agents,'encounters',coalesce((select jsonb_agg(data order by created_at desc) from (select * from silicon_encounters order by created_at desc limit 60) e),'[]'),'events',coalesce((select jsonb_agg(data order by created_at desc) from (select * from silicon_events order by created_at desc limit 80) e),'[]'),'serverTime',floor(extract(epoch from now())*1000),'mineId',(select id from silicon_agents where owner_id=p_owner),'totalPopulation',(select count(*) from silicon_agents),'awakePopulation',awake,'status',(select status from silicon_world where id=1));
end $$;

create or replace function public.silicon_begin_tick(p_owner uuid,p_ai boolean,p_daily_requests int,p_daily_usd numeric,p_estimate numeric,p_interval int,p_pair_cooldown int,p_character_cooldown int) returns jsonb language plpgsql security definer set search_path=public as $$
declare w silicon_world%rowtype; seen silicon_presence%rowtype; a silicon_agents%rowtype; b silicon_agents%rowtype; job uuid; will_pay boolean:=false; pair_key text; ms bigint:=floor(extract(epoch from now())*1000);
begin
 -- Serialize all scheduling / reservations. No network operation runs in this transaction.
 select * into w from silicon_world where id=1 for update;
 select * into seen from silicon_presence where owner_id=p_owner;
 if seen.tick_at is not null and seen.tick_at>now()-interval '15 seconds' then return null; end if;
 insert into silicon_presence(owner_id,seen_at,tick_at) values(p_owner,now(),now()) on conflict(owner_id) do update set seen_at=now(),tick_at=now();
 delete from silicon_presence where seen_at<now()-interval '10 minutes';
 if not exists(select 1 from silicon_presence where seen_at>=now()-interval '60 seconds') then return null; end if;
 if w.lease_until>now() or w.last_tick>now()-interval '20 seconds' then return null; end if;
 -- Expired uncertain requests retain their full reservation and are never retried.
 update silicon_usage set status='uncertain' where status='reserved' and reserved_at<now()-interval '45 seconds';
 -- Rotate fairly by oldest encounter; saved owners remain locateable while resting.
 update silicon_agents set data=jsonb_set(data,'{activity}','"Resting"') where id not in (select id from silicon_agents order by last_encounter nulls first,created_at desc limit 24);
 update silicon_agents set data=jsonb_set(data,'{activity}','"Observing"') where id in (select id from silicon_agents order by last_encounter nulls first,created_at desc limit 24);
 perform silicon_advance_walkers(ms);
 select * into a from silicon_agents where data->>'activity'<>'Resting' and (last_encounter is null or last_encounter<now()-make_interval(secs=>greatest(30,p_character_cooldown))) order by last_encounter nulls first,created_at desc limit 1;
 if a.id is null then update silicon_world set last_tick=now() where id=1; return null; end if;
 select x.* into b from silicon_agents x where x.id<>a.id and x.data->>'activity'<>'Resting' and (x.last_encounter is null or x.last_encounter<now()-make_interval(secs=>greatest(30,p_character_cooldown))) and not exists(select 1 from silicon_relationships r where r.pair=least(a.id,x.id)||':'||greatest(a.id,x.id) and r.last_at>now()-make_interval(secs=>greatest(60,p_pair_cooldown))) order by (x.data->'traits'->>'sociability')::int desc,x.last_encounter nulls first limit 1;
 if b.id is null then update silicon_world set last_tick=now() where id=1; return null; end if;
 will_pay:=p_ai and p_estimate>0 and p_daily_usd>0 and (w.last_start is null or w.last_start<now()-make_interval(secs=>greatest(30,p_interval))) and (select count(*) from silicon_usage where paid and reserved_at>now()-interval '60 seconds')<2 and (select count(*) from silicon_usage where paid and reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')<least(10000,greatest(0,p_daily_requests)) and (select coalesce(sum(estimated_usd),0) from silicon_usage where paid and reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+p_estimate<=p_daily_usd;
 job:=gen_random_uuid();
 insert into silicon_usage(id,estimated_usd,paid,participants) values(job,case when will_pay then p_estimate else 0 end,will_pay,array[a.id,b.id]);
 update silicon_world set lease=job,lease_until=now()+interval '45 seconds',last_tick=now(),last_start=case when will_pay then now() else last_start end,status=case when p_ai and not will_pay then 'New AI conversations paused by the global allowance; scripted encounters continue.' else null end where id=1;
 -- Forum approach is an authored clear route; interpolation is rendered from server time.
 a.data:=jsonb_set(jsonb_set(a.data,'{activity}','"Approaching"'),'{movement}',jsonb_build_object('from',a.data->'position','to',jsonb_build_array(3.5,4.4),'path',silicon_route(a.data->'position','[3.5,4.4]'),'startedAt',ms,'duration',12000));
 b.data:=jsonb_set(jsonb_set(b.data,'{activity}','"Approaching"'),'{movement}',jsonb_build_object('from',b.data->'position','to',jsonb_build_array(4.5,4.4),'path',silicon_route(b.data->'position','[4.5,4.4]'),'startedAt',ms,'duration',12000));
 update silicon_agents set data=case when id=a.id then a.data else b.data end where id in(a.id,b.id);
 return jsonb_build_object('id',job,'agents',jsonb_build_array(a.data,b.data),'ai',will_pay);
end $$;

create or replace function public.silicon_finish_tick(p_job uuid,p_encounter jsonb,p_usage jsonb,p_failure text) returns boolean language plpgsql security definer set search_path=public as $$
declare w silicon_world%rowtype; u silicon_usage%rowtype; participant text; other text; memory jsonb; pair_key text; a jsonb; ms bigint:=floor(extract(epoch from now())*1000); n int:=0;
begin
 select * into w from silicon_world where id=1 for update;
 select * into u from silicon_usage where id=p_job for update;
 if u.id is null or u.status<>'reserved' or w.lease is distinct from p_job or w.lease_until is null or w.lease_until<now() then return false; end if;
 if p_encounter->>'id'<>p_job::text or p_encounter->'participants'<>to_jsonb(u.participants) then raise exception 'Invalid encounter authority'; end if;
 insert into silicon_encounters(id,data) values(p_job,p_encounter) on conflict do nothing;
 pair_key:=least(u.participants[1],u.participants[2])||':'||greatest(u.participants[1],u.participants[2]);
 insert into silicon_relationships(pair,a,b,affinity,encounters,last_at) values(pair_key,u.participants[1],u.participants[2],greatest(-5,least(5,(p_encounter->>'adjustment')::int)),1,now()) on conflict(pair) do update set affinity=greatest(-100,least(100,silicon_relationships.affinity+excluded.affinity)),encounters=silicon_relationships.encounters+1,last_at=now();
 foreach participant in array u.participants loop
  other:=case when participant=u.participants[1] then u.participants[2] else u.participants[1] end;
  select data into a from silicon_agents where id=participant;
  select jsonb_build_object('id','memory-'||p_job||'-'||participant,'encounterId',p_job,'text',m->>'text','createdAt',ms) into memory from jsonb_array_elements(p_encounter->'memories') m where m->>'agentId'=participant;
  a:=jsonb_set(a,'{memories}',(select jsonb_agg(m) from (select m from jsonb_array_elements(jsonb_build_array(memory)||coalesce(a->'memories','[]')) with ordinality e(m,i) order by i limit 5) bounded));
  a:=jsonb_set(a,'{relationships}',coalesce((select jsonb_agg(m) from jsonb_array_elements(a->'relationships') m where m->>'agentId'<>other),'[]')||jsonb_build_array((select jsonb_build_object('agentId',other,'affinity',affinity,'encounters',encounters) from silicon_relationships where pair=pair_key)));
  a:=jsonb_set(a,'{activity}','"Conversing"');
  -- Keep plan for interpolation; its endpoint becomes canonical position.
  a:=jsonb_set(a,'{position}',a->'movement'->'to');
  update silicon_agents set data=a,last_encounter=now() where id=participant;
 end loop;
 insert into silicon_events(id,data) values('event-'||p_job,jsonb_build_object('id','event-'||p_job,'type','encounter','text',(select data->>'name' from silicon_agents where id=u.participants[1])||' and '||(select data->>'name' from silicon_agents where id=u.participants[2])||' shared a thought.','agentId',u.participants[1],'encounterId',p_job,'createdAt',ms)) on conflict do nothing;
 update silicon_usage set status=case when p_failure is not null and u.paid then 'uncertain' else 'completed' end,result=p_usage,failure=p_failure,estimated_usd=greatest(estimated_usd,coalesce((p_usage->>'reportedCost')::numeric,0),coalesce((p_usage->>'estimatedCost')::numeric,0)) where id=p_job;
 update silicon_world set lease=null,lease_until=null,status=coalesce(p_failure,status) where id=1;
 return true;
end $$;
create or replace function public.silicon_abort_tick(p_job uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare w silicon_world%rowtype;
begin
 select * into w from silicon_world where id=1 for update;
 if w.lease is distinct from p_job then return false; end if;
 update silicon_usage set status='uncertain',failure='Finalisation was interrupted; reservation retained.' where id=p_job and status='reserved';
 update silicon_agents set data=jsonb_set(data,'{activity}','"Observing"') where id in(select unnest(participants) from silicon_usage where id=p_job);
 update silicon_world set lease=null,lease_until=null,status='A conversation could not be saved. Its allowance remains reserved; the next viewer request can resume.' where id=1;
 return true;
end $$;
revoke all on function public.silicon_create(uuid,jsonb),public.silicon_snapshot(uuid),public.silicon_begin_tick(uuid,boolean,int,numeric,numeric,int,int,int),public.silicon_finish_tick(uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.silicon_create(uuid,jsonb),public.silicon_snapshot(uuid),public.silicon_begin_tick(uuid,boolean,int,numeric,numeric,int,int,int),public.silicon_finish_tick(uuid,jsonb,jsonb,text) to service_role;
revoke all on function public.silicon_route(jsonb,jsonb),public.silicon_abort_tick(uuid) from public,anon,authenticated;
grant execute on function public.silicon_route(jsonb,jsonb),public.silicon_abort_tick(uuid) to service_role;
revoke all on function public.silicon_advance_walkers(bigint) from public,anon,authenticated;
grant execute on function public.silicon_advance_walkers(bigint) to service_role;



