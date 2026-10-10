-- Incremental expansion: apply after 001_world.sql. Saved identities, memories and ownership remain intact.
alter table public.silicon_usage add column if not exists location text;
alter table public.silicon_agents add column if not exists last_awake timestamptz;
create index if not exists silicon_agents_rotation on public.silicon_agents(last_awake,last_encounter,created_at);
create or replace function public.silicon_layout() returns jsonb language sql immutable set search_path=public as $$ select '{"nodes":[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3],[-36,-48],[-24,-48],[-12,-48],[0,-48],[12,-48],[24,-48],[36,-48],[-48,-36],[-36,-36],[-24,-36],[-12,-36],[0,-36],[12,-36],[24,-36],[36,-36],[48,-36],[-48,-24],[-36,-24],[-24,-24],[-12,-24],[0,-24],[12,-24],[24,-24],[36,-24],[48,-24],[-48,-12],[-36,-12],[-24,-12],[-12,-12],[0,-12],[12,-12],[24,-12],[36,-12],[48,-12],[-48,0],[-36,0],[-24,0],[-12,0],[12,0],[24,0],[36,0],[48,0],[-48,12],[-36,12],[-24,12],[-12,12],[0,12],[12,12],[24,12],[36,12],[48,12],[-48,24],[-36,24],[-24,24],[-12,24],[0,24],[12,24],[24,24],[36,24],[48,24],[-48,36],[-36,36],[-24,36],[-12,36],[0,36],[12,36],[24,36],[36,36],[48,36],[-36,48],[-24,48],[-12,48],[0,48],[12,48],[24,48],[36,48],[-28,4],[28,8],[0,-28],[-5,30],[30,-28]],"edges":[[1,9,56],[0,2,7],[1,3,6,57],[2,4,58],[3,5,58,49],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10,48],[9,39],[12,19],[11,13,20],[12,14,21],[13,15,22],[14,16,23],[15,17,24],[16,25],[19,27],[11,18,20,28],[12,19,21,29],[13,20,22,30],[14,21,23,31,89],[15,22,24,32],[16,23,25,33],[17,24,26,34],[25,35],[18,28,36],[19,27,29,37],[20,28,30,38],[21,29,31,39],[22,30,32,40,89],[23,31,33,41],[24,32,34,42,91],[25,33,35,43,91],[26,34,44],[27,37,45],[28,36,38,46],[29,37,39,47],[30,38,40,48,10],[31,39,41],[32,40,42,49],[33,41,43,50],[34,42,44,51],[35,43,52],[36,46,53],[37,45,47,54,87],[38,46,48,55,87],[39,47,56,9],[41,50,58,4],[42,49,51,59,88],[43,50,52,60],[44,51,61],[45,54,62],[46,53,55,63],[47,54,56,64],[48,55,57,65,0],[56,58,66,2],[49,57,59,67,3,4],[50,58,60,68,88],[51,59,61,69],[52,60,70],[53,63,71],[54,62,64,72],[55,63,65,73],[56,64,66,74],[57,65,67,75,90],[58,66,68,76],[59,67,69,77],[60,68,70,78],[61,69,79],[62,72],[63,71,73,80],[64,72,74,81],[65,73,75,82],[66,74,76,83,90],[67,75,77,84],[68,76,78,85],[69,77,79,86],[70,78],[72,81],[73,80,82],[74,81,83],[75,82,84],[76,83,85],[77,84,86],[78,85],[47,46],[59,50],[31,22],[66,75],[33,34]],"meetingSites":[{"center":[4,4],"name":"The Forum"},{"center":[-28,4],"name":"West Garden"},{"center":[28,8],"name":"East Forum"},{"center":[-5,30],"name":"Workshop"},{"center":[30,-28],"name":"Ridge Forum"}]}'::jsonb $$;
create or replace function public.silicon_spread(p jsonb,s bigint) returns jsonb language plpgsql immutable set search_path=public as $$
declare angle double precision:=(s%997)*2.39996323; radius double precision:=.35+((s/997)%101)/100.0*1.2; x double precision; z double precision;
begin x:=(p->>0)::double precision+cos(angle)*radius;z:=(p->>1)::double precision+sin(angle)*radius;if x>-2 and x<10 and z>-6 and z<-2 then z:=-.7;end if;return jsonb_build_array(x,z);end $$;
create or replace function public.silicon_route(p_from jsonb,p_to jsonb) returns jsonb language plpgsql immutable set search_path=public as $$
declare nodes jsonb:='[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3],[-36,-48],[-24,-48],[-12,-48],[0,-48],[12,-48],[24,-48],[36,-48],[-48,-36],[-36,-36],[-24,-36],[-12,-36],[0,-36],[12,-36],[24,-36],[36,-36],[48,-36],[-48,-24],[-36,-24],[-24,-24],[-12,-24],[0,-24],[12,-24],[24,-24],[36,-24],[48,-24],[-48,-12],[-36,-12],[-24,-12],[-12,-12],[0,-12],[12,-12],[24,-12],[36,-12],[48,-12],[-48,0],[-36,0],[-24,0],[-12,0],[12,0],[24,0],[36,0],[48,0],[-48,12],[-36,12],[-24,12],[-12,12],[0,12],[12,12],[24,12],[36,12],[48,12],[-48,24],[-36,24],[-24,24],[-12,24],[0,24],[12,24],[24,24],[36,24],[48,24],[-48,36],[-36,36],[-24,36],[-12,36],[0,36],[12,36],[24,36],[36,36],[48,36],[-36,48],[-24,48],[-12,48],[0,48],[12,48],[24,48],[36,48],[-28,4],[28,8],[0,-28],[-5,30],[30,-28]]';edges jsonb:='[[1,9,56],[0,2,7],[1,3,6,57],[2,4,58],[3,5,58,49],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10,48],[9,39],[12,19],[11,13,20],[12,14,21],[13,15,22],[14,16,23],[15,17,24],[16,25],[19,27],[11,18,20,28],[12,19,21,29],[13,20,22,30],[14,21,23,31,89],[15,22,24,32],[16,23,25,33],[17,24,26,34],[25,35],[18,28,36],[19,27,29,37],[20,28,30,38],[21,29,31,39],[22,30,32,40,89],[23,31,33,41],[24,32,34,42,91],[25,33,35,43,91],[26,34,44],[27,37,45],[28,36,38,46],[29,37,39,47],[30,38,40,48,10],[31,39,41],[32,40,42,49],[33,41,43,50],[34,42,44,51],[35,43,52],[36,46,53],[37,45,47,54,87],[38,46,48,55,87],[39,47,56,9],[41,50,58,4],[42,49,51,59,88],[43,50,52,60],[44,51,61],[45,54,62],[46,53,55,63],[47,54,56,64],[48,55,57,65,0],[56,58,66,2],[49,57,59,67,3,4],[50,58,60,68,88],[51,59,61,69],[52,60,70],[53,63,71],[54,62,64,72],[55,63,65,73],[56,64,66,74],[57,65,67,75,90],[58,66,68,76],[59,67,69,77],[60,68,70,78],[61,69,79],[62,72],[63,71,73,80],[64,72,74,81],[65,73,75,82],[66,74,76,83,90],[67,75,77,84],[68,76,78,85],[69,77,79,86],[70,78],[72,81],[73,80,82],[74,81,83],[75,82,84],[76,83,85],[77,84,86],[78,85],[47,46],[59,50],[31,22],[66,75],[33,34]]';n int:=jsonb_array_length(nodes);start_node int;end_node int;distances double precision[];previous int[];visited boolean[];u int;v int;i int;candidate double precision;path int[]:='{}';output jsonb:=jsonb_build_array(p_from);
begin
 select j into start_node from generate_series(0,n-1) j order by power((nodes->j->>0)::double precision-(p_from->>0)::double precision,2)+power((nodes->j->>1)::double precision-(p_from->>1)::double precision,2),j limit 1;
 select j into end_node from generate_series(0,n-1) j order by power((nodes->j->>0)::double precision-(p_to->>0)::double precision,2)+power((nodes->j->>1)::double precision-(p_to->>1)::double precision,2),j limit 1;
 distances:=array_fill('Infinity'::double precision,array[n]);previous:=array_fill(-1,array[n]);visited:=array_fill(false,array[n]);distances[start_node+1]:=0;
 for i in 1..n loop
  select j into u from generate_series(0,n-1) j where not visited[j+1] order by distances[j+1],j desc limit 1;
  exit when u is null or distances[u+1]='Infinity'::double precision;visited[u+1]:=true;exit when u=end_node;
  for v in select value::int from jsonb_array_elements_text(edges->u) loop
   candidate:=distances[u+1]+sqrt(power((nodes->u->>0)::double precision-(nodes->v->>0)::double precision,2)+power((nodes->u->>1)::double precision-(nodes->v->>1)::double precision,2));
   if candidate<distances[v+1] then distances[v+1]:=candidate;previous[v+1]:=u;end if;
  end loop;
 end loop;
 u:=end_node;for i in 1..n loop path:=u||path;exit when previous[u+1]=-1;u:=previous[u+1];end loop;
 foreach u in array path loop if output->-1<>nodes->u then output:=output||jsonb_build_array(nodes->u);end if;end loop;
 if output->-1<>p_to then output:=output||jsonb_build_array(p_to);end if;return output;
end $$;
create or replace function public.silicon_plan(p_from jsonb,p_to jsonb,p_ms bigint) returns jsonb language plpgsql immutable set search_path=public as $$
declare path jsonb:=silicon_route(p_from,p_to);length double precision:=0;i int;
begin for i in 1..jsonb_array_length(path)-1 loop length:=length+sqrt(power((path->i->>0)::double precision-(path->(i-1)->>0)::double precision,2)+power((path->i->>1)::double precision-(path->(i-1)->>1)::double precision,2));end loop;return jsonb_build_object('from',p_from,'to',p_to,'path',path,'startedAt',p_ms,'duration',greatest(2000,length*1150));end $$;
create or replace function public.silicon_advance_walkers(p_ms bigint) returns void language plpgsql security definer set search_path=public as $$
declare nodes jsonb:='[[-5,4],[-2,4],[1,4],[4,4],[6,1],[3,0],[1,1],[-2,1],[-2,-1],[-7,1],[-6,-3],[-36,-48],[-24,-48],[-12,-48],[0,-48],[12,-48],[24,-48],[36,-48],[-48,-36],[-36,-36],[-24,-36],[-12,-36],[0,-36],[12,-36],[24,-36],[36,-36],[48,-36],[-48,-24],[-36,-24],[-24,-24],[-12,-24],[0,-24],[12,-24],[24,-24],[36,-24],[48,-24],[-48,-12],[-36,-12],[-24,-12],[-12,-12],[0,-12],[12,-12],[24,-12],[36,-12],[48,-12],[-48,0],[-36,0],[-24,0],[-12,0],[12,0],[24,0],[36,0],[48,0],[-48,12],[-36,12],[-24,12],[-12,12],[0,12],[12,12],[24,12],[36,12],[48,12],[-48,24],[-36,24],[-24,24],[-12,24],[0,24],[12,24],[24,24],[36,24],[48,24],[-48,36],[-36,36],[-24,36],[-12,36],[0,36],[12,36],[24,36],[36,36],[48,36],[-36,48],[-24,48],[-12,48],[0,48],[12,48],[24,48],[36,48],[-28,4],[28,8],[0,-28],[-5,30],[30,-28]]';edges jsonb:='[[1,9,56],[0,2,7],[1,3,6,57],[2,4,58],[3,5,58,49],[4,6],[5,2,7],[6,1,8],[7,9],[0,8,10,48],[9,39],[12,19],[11,13,20],[12,14,21],[13,15,22],[14,16,23],[15,17,24],[16,25],[19,27],[11,18,20,28],[12,19,21,29],[13,20,22,30],[14,21,23,31,89],[15,22,24,32],[16,23,25,33],[17,24,26,34],[25,35],[18,28,36],[19,27,29,37],[20,28,30,38],[21,29,31,39],[22,30,32,40,89],[23,31,33,41],[24,32,34,42,91],[25,33,35,43,91],[26,34,44],[27,37,45],[28,36,38,46],[29,37,39,47],[30,38,40,48,10],[31,39,41],[32,40,42,49],[33,41,43,50],[34,42,44,51],[35,43,52],[36,46,53],[37,45,47,54,87],[38,46,48,55,87],[39,47,56,9],[41,50,58,4],[42,49,51,59,88],[43,50,52,60],[44,51,61],[45,54,62],[46,53,55,63],[47,54,56,64],[48,55,57,65,0],[56,58,66,2],[49,57,59,67,3,4],[50,58,60,68,88],[51,59,61,69],[52,60,70],[53,63,71],[54,62,64,72],[55,63,65,73],[56,64,66,74],[57,65,67,75,90],[58,66,68,76],[59,67,69,77],[60,68,70,78],[61,69,79],[62,72],[63,71,73,80],[64,72,74,81],[65,73,75,82],[66,74,76,83,90],[67,75,77,84],[68,76,78,85],[69,77,79,86],[70,78],[72,81],[73,80,82],[74,81,83],[75,82,84],[76,83,85],[77,84,86],[78,85],[47,46],[59,50],[31,22],[66,75],[33,34]]';sites jsonb:='[{"center":[4,4],"name":"The Forum"},{"center":[-28,4],"name":"West Garden"},{"center":[28,8],"name":"East Forum"},{"center":[-5,30],"name":"Workshop"},{"center":[30,-28],"name":"Ridge Forum"}]';r silicon_agents%rowtype;d jsonb;current_pos jsonb;nearest int;target int;phase int;seed bigint;goal jsonb;dest jsonb;distance double precision;
begin
 for r in select * from silicon_agents where data->>'activity'<>'Resting' loop
  d:=r.data;current_pos:=d->'position';seed:=(d->>'seed')::bigint;phase:=((seed+p_ms/20000)%12)::int;
  if d->'movement' is not null then
   if (d->'movement'->>'startedAt')::bigint+(d->'movement'->>'duration')::double precision>p_ms then continue;end if;
   current_pos:=d->'movement'->'to';d:=jsonb_set(d-'movement','{position}',current_pos);
  end if;
  if phase=0 or ((d->'traits'->>'creativity')::int>=75 and phase%5=0) then update silicon_agents set data=jsonb_set(d,'{activity}','"Observing"') where id=r.id;continue;end if;
  select j into nearest from generate_series(0,jsonb_array_length(nodes)-1) j order by power((nodes->j->>0)::double precision-(current_pos->>0)::double precision,2)+power((nodes->j->>1)::double precision-(current_pos->>1)::double precision,2),j limit 1;
  goal:=case when (d->'traits'->>'sociability')::int>=75 then sites->(seed%jsonb_array_length(sites))::int->'center' when (d->'traits'->>'curiosity')::int>=75 then nodes->(11+(seed+p_ms/60000)%(jsonb_array_length(nodes)-11))::int else nodes->((seed/7)%jsonb_array_length(nodes))::int end;
  if phase%3=0 then target:=(edges->nearest->>(phase%jsonb_array_length(edges->nearest)))::int;
  else select value::int into target from jsonb_array_elements_text(edges->nearest) order by power((nodes->(value::int)->>0)::double precision-(goal->>0)::double precision,2)+power((nodes->(value::int)->>1)::double precision-(goal->>1)::double precision,2),value::int limit 1;end if;
  dest:=silicon_spread(nodes->target,seed);distance:=sqrt(power((dest->>0)::double precision-(current_pos->>0)::double precision,2)+power((dest->>1)::double precision-(current_pos->>1)::double precision,2));
  d:=jsonb_set(jsonb_set(d,'{activity}','"Walking"'),'{movement}',jsonb_build_object('from',current_pos,'to',dest,'path',jsonb_build_array(current_pos,nodes->nearest,nodes->target,dest),'startedAt',p_ms,'duration',greatest(3500,distance*1150)));
  update silicon_agents set data=d where id=r.id;
 end loop;
end $$;
create or replace function public.silicon_begin_tick(p_owner uuid,p_ai boolean,p_daily_requests int,p_daily_usd numeric,p_estimate numeric,p_interval int,p_pair_cooldown int,p_character_cooldown int) returns jsonb language plpgsql security definer set search_path=public as $$
declare w silicon_world%rowtype; seen silicon_presence%rowtype; a silicon_agents%rowtype; b silicon_agents%rowtype; site jsonb; sites jsonb:='[{"center":[4,4],"name":"The Forum"},{"center":[-28,4],"name":"West Garden"},{"center":[28,8],"name":"East Forum"},{"center":[-5,30],"name":"Workshop"},{"center":[30,-28],"name":"Ridge Forum"}]'; awake_ids text[]; job uuid; will_pay boolean:=false; pair_key text; ms bigint:=floor(extract(epoch from now())*1000);
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
 select array_agg(id) into awake_ids from(select id from silicon_agents order by ((data->'movement'->>'startedAt')::numeric+(data->'movement'->>'duration')::numeric>ms) desc nulls last,last_awake nulls first,last_encounter nulls first,created_at,id limit 500) chosen;
 update silicon_agents set data=jsonb_set(data,'{activity}','"Resting"') where not id=any(awake_ids);
 update silicon_agents set data=case when data->>'activity'='Resting' then jsonb_set(data,'{activity}','"Observing"') else data end,last_awake=now() where id=any(awake_ids);

 update silicon_agents set data=jsonb_set(data-'movement','{position}',data->'movement'->'to') where data->'movement' is not null and (data->'movement'->>'startedAt')::numeric+(data->'movement'->>'duration')::numeric<=ms;
 select * into a from silicon_agents where data->>'activity'<>'Resting' and (data->'movement' is null or (data->'movement'->>'startedAt')::numeric+(data->'movement'->>'duration')::numeric<=ms) and (last_encounter is null or last_encounter<now()-make_interval(secs=>greatest(30,p_character_cooldown))) order by last_encounter nulls first,created_at desc limit 1;
 if a.id is null then perform silicon_advance_walkers(ms);update silicon_world set last_tick=now() where id=1; return null; end if;
 select x.* into b from silicon_agents x where x.id<>a.id and x.data->>'activity'<>'Resting' and (x.data->'movement' is null or (x.data->'movement'->>'startedAt')::numeric+(x.data->'movement'->>'duration')::numeric<=ms) and (x.last_encounter is null or x.last_encounter<now()-make_interval(secs=>greatest(30,p_character_cooldown))) and not exists(select 1 from silicon_relationships r where r.pair=least(a.id,x.id)||':'||greatest(a.id,x.id) and r.last_at>now()-make_interval(secs=>greatest(60,p_pair_cooldown))) order by power((x.data->'position'->>0)::double precision-(a.data->'position'->>0)::double precision,2)+power((x.data->'position'->>1)::double precision-(a.data->'position'->>1)::double precision,2),(x.data->'traits'->>'sociability')::int desc,x.last_encounter nulls first limit 1;
 if b.id is null then perform silicon_advance_walkers(ms);update silicon_world set last_tick=now() where id=1; return null; end if;
 select value into site from jsonb_array_elements(sites) order by power((value->'center'->>0)::double precision-((a.data->'position'->>0)::double precision+(b.data->'position'->>0)::double precision)/2,2)+power((value->'center'->>1)::double precision-((a.data->'position'->>1)::double precision+(b.data->'position'->>1)::double precision)/2,2) limit 1;
 will_pay:=p_ai and p_estimate>0 and p_daily_usd>0 and (w.last_start is null or w.last_start<now()-make_interval(secs=>greatest(30,p_interval))) and (select count(*) from silicon_usage where paid and reserved_at>now()-interval '60 seconds')<2 and (select count(*) from silicon_usage where paid and reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')<least(10000,greatest(0,p_daily_requests)) and (select coalesce(sum(estimated_usd),0) from silicon_usage where paid and reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+p_estimate<=p_daily_usd;
 job:=gen_random_uuid();
 insert into silicon_usage(id,estimated_usd,paid,participants) values(job,case when will_pay then p_estimate else 0 end,will_pay,array[a.id,b.id]);
 update silicon_world set lease=job,lease_until=now()+interval '45 seconds',last_tick=now(),last_start=case when will_pay then now() else last_start end,status=case when p_ai and not will_pay then 'New AI conversations paused by the global allowance; scripted encounters continue.' else null end where id=1;
 perform silicon_advance_walkers(ms);
 -- Forum approach is an authored clear route; interpolation is rendered from server time.
 a.data:=jsonb_set(jsonb_set(a.data,'{activity}','"Approaching"'),'{movement}',silicon_plan(a.data->'position',jsonb_build_array((site->'center'->>0)::numeric-.6,(site->'center'->>1)::numeric+.4),ms));
 b.data:=jsonb_set(jsonb_set(b.data,'{activity}','"Approaching"'),'{movement}',silicon_plan(b.data->'position',jsonb_build_array((site->'center'->>0)::numeric+.6,(site->'center'->>1)::numeric+.4),ms));
 update silicon_agents set data=case when id=a.id then a.data else b.data end where id in(a.id,b.id);
 update silicon_usage set location=site->>'name' where id=job;
 return jsonb_build_object('location',site->>'name','id',job,'agents',jsonb_build_array(a.data,b.data),'ai',will_pay);
end $$;

create or replace function public.silicon_finish_tick(p_job uuid,p_encounter jsonb,p_usage jsonb,p_failure text) returns boolean language plpgsql security definer set search_path=public as $$
declare w silicon_world%rowtype; u silicon_usage%rowtype; participant text; other text; memory jsonb; pair_key text; a jsonb; ms bigint:=floor(extract(epoch from now())*1000); n int:=0;
begin
 select * into w from silicon_world where id=1 for update;
 select * into u from silicon_usage where id=p_job for update;
 if u.id is null or u.status<>'reserved' or w.lease is distinct from p_job or w.lease_until is null or w.lease_until<now() then return false; end if;
 if p_encounter->>'id'<>p_job::text or p_encounter->'participants'<>to_jsonb(u.participants) then raise exception 'Invalid encounter authority'; end if;
 p_encounter:=jsonb_set(p_encounter,'{location}',to_jsonb(coalesce(u.location,'The Forum')));
 p_encounter:=jsonb_set(p_encounter,'{memories}',(select jsonb_agg(jsonb_set(m,'{text}',to_jsonb(replace(m->>'text','the Forum',coalesce(u.location,'The Forum'))))) from jsonb_array_elements(p_encounter->'memories') m));
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
revoke all on function public.silicon_layout(),public.silicon_spread(jsonb,bigint),public.silicon_plan(jsonb,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.silicon_layout(),public.silicon_spread(jsonb,bigint),public.silicon_plan(jsonb,jsonb,bigint) to service_role;


