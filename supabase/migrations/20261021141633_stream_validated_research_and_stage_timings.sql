-- Stream exact-product video admission; task timing is service-role-only metadata.
alter table public.research_tasks add column first_started_at timestamptz,
 add column last_started_at timestamptz,add column finished_at timestamptz,
 add column total_processing_ms bigint not null default 0,add column capacity_deferrals integer not null default 0;
create index research_tasks_active_run on public.research_tasks(run_id,kind,batch,state);
create index research_usage_provider_day on public.research_provider_usage(provider,started_at) include(actual_tokens,reserved_tokens,finished_at);
create or replace function public.research_claim(p_task uuid,p_run uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.research_tasks; r public.research_runs;
begin
 select * into r from public.research_runs where id=p_run and token=p_token and phase not in ('complete','interrupted');
 if not found then return null; end if;
 update public.research_tasks set state='running',lease=gen_random_uuid(),updated_at=now(),first_started_at=coalesce(first_started_at,clock_timestamp()),last_started_at=clock_timestamp()
 where id=p_task and run_id=p_run and state='dispatched' returning * into t;
 if not found then return null; end if;
 return jsonb_build_object('task',to_jsonb(t),'run',case when t.kind='facts' then to_jsonb(r) else to_jsonb(r)-'profile' end);
end $$;
create or replace function public.research_finish(p_task uuid,p_lease uuid,p_result jsonb,p_children jsonb default '[]',p_phase text default null,p_profile jsonb default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.research_tasks; c jsonb; r jsonb; fresh jsonb:='[]'; chosen jsonb;
begin
 select * into t from public.research_tasks where id=p_task and lease=p_lease and state='running' for update;
 if not found then return false; end if;
 if t.kind='collect' then
  for r in select value from jsonb_array_elements(coalesce(p_result->'records','[]')) loop
   insert into public.research_comments(run_id,id,raw) values(t.run_id,r->>'id',r) on conflict do nothing;
   if found then fresh:=fresh||jsonb_build_array(r->>'id'); end if;
  end loop;
 end if;
 for c in select value from jsonb_array_elements(p_children) loop
  if t.kind='collect' and c->>'kind'='review' then
   select coalesce(jsonb_agg(v),'[]') into chosen from jsonb_array_elements(c->'payload'->'records') v where fresh ? (v->>'id');
   if jsonb_array_length(chosen)=0 then continue;end if;
   c:=jsonb_set(c,'{payload,records}',chosen);
  end if;
  insert into public.research_tasks(run_id,task_key,kind,batch,payload)
  values(t.run_id,c->>'key',c->>'kind',coalesce((c->>'batch')::int,t.batch),coalesce(c->'payload','{}'))
  on conflict(run_id,task_key) do nothing;
 end loop;
 update public.research_tasks set state='done',result=p_result,error=null,updated_at=now(),finished_at=clock_timestamp(),total_processing_ms=total_processing_ms+greatest(0,extract(epoch from clock_timestamp()-last_started_at)*1000)::bigint where id=t.id;
 update public.research_runs set phase=coalesce(p_phase,phase),profile=coalesce(p_profile,profile),updated_at=now(),
 batch=case when p_phase='batch2' then 2 else batch end where id=t.run_id and (p_phase is not null or p_profile is not null);
 return true;
end $$;

create or replace function public.research_admit_videos(p_task uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.research_tasks; v jsonb; used integer; admitted integer:=0;
begin
 select * into t from public.research_tasks where id=p_task and lease=p_lease and state='running';
 if not found then return false;end if;
 -- Serialize only admission within one run, never slow upstream requests.
 perform pg_advisory_xact_lock(hashtextextended('admit:'||t.run_id::text,0));
 perform 1 from public.research_tasks where id=p_task and lease=p_lease and state='running' for update;
 if not found then return false;end if;
 update public.research_tasks set result=p_result,updated_at=now() where id=t.id;
 select count(distinct payload->'video'->>'id') into used from public.research_tasks
  where run_id=t.run_id and kind='collect' and batch=t.batch;
 for v in select value from jsonb_array_elements(coalesce(p_result->'videos','[]')) loop
  if used>=20 then exit;end if;
  if exists(select 1 from public.research_tasks where run_id=t.run_id and kind='collect' and payload->'video'->>'id'=v->>'id') then continue;end if;
  insert into public.research_tasks(run_id,task_key,kind,batch,payload)
   values(t.run_id,'collect:'||(v->>'id')||':first','collect',t.batch,jsonb_build_object('video',v,'pageToken','','page',0,'stream','threads'))
   on conflict do nothing;
  if found then used:=used+1;admitted:=admitted+1;end if;
 end loop;
 if admitted>0 then update public.research_runs set phase=case when t.batch=2 then 'batch2' else 'batch1' end,updated_at=now() where id=t.run_id;end if;
 return true;
end $$;
revoke all on function public.research_admit_videos(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.research_admit_videos(uuid,uuid,jsonb) to service_role;
create or replace function public.research_retry(p_task uuid,p_lease uuid,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
declare delay_ms integer;
begin
 if p_error ~ 'provider_wait:[0-9]+' then
  delay_ms:=least(86400000,coalesce(substring(p_error from 'provider_wait:([0-9]+)')::bigint,5000))::integer;
  update public.research_tasks set state=case when coalesce((payload->>'attemptWindowStartedAt')::timestamptz,created_at)<now()-interval '30 minutes' then 'failed' else 'pending' end,
   capacity_deferrals=capacity_deferrals+1,attempts=greatest(0,attempts-1),error=case when coalesce((payload->>'attemptWindowStartedAt')::timestamptz,created_at)<now()-interval '30 minutes' then 'provider_capacity_unavailable' else left(p_error,500) end,
   lease=null,ready_at=now()+make_interval(secs=>delay_ms/1000.0+random()),updated_at=now()
   where id=p_task and lease=p_lease and state='running';
 else
  update public.research_tasks set total_processing_ms=total_processing_ms+coalesce(greatest(0,extract(epoch from clock_timestamp()-last_started_at)*1000)::bigint,0),state=case when attempts>=2 then 'failed' else 'pending' end,
   error=left(p_error,500),lease=null,ready_at=now()+make_interval(secs=>2+random()*2),updated_at=now()
   where id=p_task and lease=p_lease and state='running';
 end if;
end $$;
create or replace function public.research_dispatch()
returns integer language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare r public.research_runs; t public.research_tasks; k text; cap integer; slots integer; sent integer:=0; i integer;
begin
 if not pg_try_advisory_xact_lock(77190241) then return 0; end if;
 update public.research_tasks set state=case when attempts>=2 then 'failed' else 'pending' end,lease=null,
 error='worker lease expired',updated_at=now(),ready_at=now()
 where (state='dispatched' and updated_at<now()-interval '45 seconds')
    or (state='running' and updated_at<now()-interval '150 seconds');
 -- Bound each validation wave. Keep its verified matches; finish with honest limited coverage.
 update public.research_tasks t set state='failed',error='video_validation_deadline',lease=null,finished_at=clock_timestamp(),updated_at=now()
 where kind='identity' and state in ('pending','dispatched','running') and created_at<now()-interval '90 seconds';
 update public.research_runs r set phase='validating'  where phase='discovering'
 and exists(select 1 from public.research_tasks t where t.run_id=r.id and t.kind='discover' and t.state='failed');
 for r in select * from public.research_runs where phase not in ('complete','interrupted') loop
  if r.phase='validating' and not exists(select 1 from public.research_tasks where run_id=r.id and kind in ('discover','identity') and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,payload) values(r.id,'coordinate:validated','coordinate','{"stage":"validated"}') on conflict do nothing;
  elsif r.phase in ('batch1','batch2') and not exists(select 1 from public.research_tasks where run_id=r.id and kind<>'coordinate' and batch<=r.batch and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,batch,payload) values(r.id,'coordinate:batch:'||r.batch,'coordinate',r.batch,jsonb_build_object('stage','batch','batch',r.batch)) on conflict do nothing;
  end if;
 end loop;
 foreach k in array array['verify','collect','review','identity','other'] loop
  cap:=case k when 'verify' then 4 when 'collect' then 20 when 'review' then 8 when 'identity' then 4 else 2 end;
  select greatest(0,cap-count(*)::int) into slots from public.research_tasks
   where state in ('dispatched','running') and (case when kind in ('verify','collect','review','identity') then kind else 'other' end)=k;
  for i in 1..slots loop
   select q.* into t from public.research_tasks q join public.research_runs r on r.id=q.run_id
    where q.state='pending' and q.ready_at<=now() and r.phase not in ('complete','interrupted')
    and (case when q.kind in ('verify','collect','review','identity') then q.kind else 'other' end)=k
    and not(q.kind='coordinate' and exists(select 1 from public.research_tasks active_task
     where active_task.run_id=q.run_id and active_task.kind='coordinate' and active_task.state in ('dispatched','running')))
    order by r.last_dispatched_at,q.created_at limit 1 for update of q skip locked;
   if not found then exit;end if;
   update public.research_runs set last_dispatched_at=clock_timestamp() where id=t.run_id;
    select * into r from public.research_runs where id=t.run_id;
    update public.research_tasks set state='dispatched',attempts=attempts+1,updated_at=now() where id=t.id;
    perform net.http_post(url:=r.endpoint,body:=jsonb_build_object('runId',r.id,'taskId',t.id,'token',r.token),
     headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=20000);
    sent:=sent+1;
  end loop;
 end loop;
 return sent;
end $$;
create or replace function public.research_provider_acquire(p_run uuid,p_task uuid,p_candidates jsonb,p_tokens integer,p_stage text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.research_provider_limits; candidate jsonb; request_id uuid; active integer; used_requests integer;
 used_tokens bigint; day_requests integer; day_tokens bigint; wait_until timestamptz; earliest timestamptz:='infinity';
 instant timestamptz:=clock_timestamp(); fits boolean:=false;
begin
 if p_tokens<=0 or p_tokens>200000 then raise exception 'invalid token reservation';end if;
 for cfg in select * from public.research_provider_limits
  where provider in(select value->>'provider' from jsonb_array_elements(p_candidates))
  order by last_started_at loop
  if not pg_try_advisory_xact_lock(hashtextextended('provider:'||cfg.provider,0)) then earliest:=least(earliest,instant+interval '1 second');fits:=true;continue;end if;
  select * into cfg from public.research_provider_limits where provider=cfg.provider for update;
  if p_tokens>cfg.tpm then continue;end if;
  fits:=true;
  select count(*),coalesce(sum(coalesce(actual_tokens,reserved_tokens)),0) into used_requests,used_tokens
   from public.research_provider_usage where provider=cfg.provider and started_at>instant-interval '60 seconds';
  select count(*),coalesce(sum(coalesce(actual_tokens,reserved_tokens)),0) into day_requests,day_tokens
   from public.research_provider_usage where provider=cfg.provider and started_at>=date_trunc('day',instant at time zone 'UTC') at time zone 'UTC';
  select count(*) into active from public.research_provider_usage
   where provider=cfg.provider and finished_at is null and started_at>instant-interval '90 seconds';
  wait_until:=greatest(cfg.cooldown_until,cfg.last_started_at+make_interval(secs=>60.0/cfg.rpm));
  if used_requests>=cfg.rpm or used_tokens+p_tokens>cfg.tpm or active>=cfg.concurrency
    or (p_stage='review' and active>=cfg.concurrency-1) then
   wait_until:=greatest(wait_until,instant+interval '5 seconds');
  end if;
  if (cfg.rpd is not null and day_requests>=cfg.rpd) or (cfg.tpd is not null and day_tokens+p_tokens>cfg.tpd) then
   wait_until:=greatest(wait_until,(date_trunc('day',instant at time zone 'UTC')+interval '1 day') at time zone 'UTC');
  end if;
  if wait_until>instant then earliest:=least(earliest,wait_until);continue;end if;
  select value into candidate from jsonb_array_elements(p_candidates) where value->>'provider'=cfg.provider limit 1;
  insert into public.research_provider_usage(run_id,task_id,provider,model,stage,reserved_tokens)
   values(p_run,p_task,cfg.provider,candidate->>'model',p_stage,p_tokens) returning id into request_id;
  update public.research_provider_limits set last_started_at=instant where provider=cfg.provider;
  return jsonb_build_object('allowed',true,'requestId',request_id,'provider',cfg.provider,'model',candidate->>'model');
 end loop;
 if not fits then return jsonb_build_object('allowed',false,'error','request_exceeds_provider_token_budget');end if;
 return jsonb_build_object('allowed',false,'retryAfterMs',greatest(1000,ceil(extract(epoch from earliest-instant)*1000)));
end $$;
