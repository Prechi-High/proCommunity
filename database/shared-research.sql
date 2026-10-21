-- Shared provider scheduling. Research data and secrets remain service-role only.
alter table public.research_tasks drop constraint research_tasks_kind_check;
alter table public.research_tasks add constraint research_tasks_kind_check
 check(kind in ('discover','identity','collect','review','verify','facts','coordinate'));

create table public.research_provider_limits (
 provider text primary key check(provider in ('nvidia','groq','cloudflare')),
 rpm integer not null check(rpm>0), tpm integer not null check(tpm>0),
 rpd integer, tpd integer, concurrency integer not null default 4 check(concurrency>1),
 cooldown_until timestamptz not null default '-infinity', last_started_at timestamptz not null default '-infinity'
);
-- Conservative starting budgets, not claims about account entitlements. Adjust to confirmed limits.
insert into public.research_provider_limits(provider,rpm,tpm,rpd,tpd)
 values('nvidia',30,32000,null,null),('groq',25,8000,1000,200000),('cloudflare',30,32000,null,null);
create table public.research_provider_usage (
 id uuid primary key default gen_random_uuid(),
 run_id uuid references public.research_runs(id) on delete set null,
 task_id uuid references public.research_tasks(id) on delete set null,
 provider text not null references public.research_provider_limits(provider),
 model text not null, stage text not null,
 started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
 reserved_tokens integer not null, actual_tokens integer, status integer, error text, usage jsonb
);
create index research_provider_usage_window on public.research_provider_usage(provider,started_at);
create index research_provider_usage_run on public.research_provider_usage(run_id,stage);
create table public.research_decision_cache (
 input_hash text primary key, product_id text not null, decision jsonb not null,
 policy_version text not null, verified boolean not null,
 expires_at timestamptz not null default now()+interval '30 days', updated_at timestamptz not null default now()
);
alter table public.research_provider_limits enable row level security;
alter table public.research_provider_usage enable row level security;
alter table public.research_decision_cache enable row level security;
revoke all on public.research_provider_limits,public.research_provider_usage,public.research_decision_cache from public,anon,authenticated;
grant all on public.research_provider_limits,public.research_provider_usage,public.research_decision_cache to service_role;

create or replace function public.research_provider_acquire(p_run uuid,p_task uuid,p_candidates jsonb,p_tokens integer,p_stage text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.research_provider_limits; candidate jsonb; request_id uuid; active integer; used_requests integer;
 used_tokens bigint; day_requests integer; day_tokens bigint; wait_until timestamptz; earliest timestamptz:='infinity';
 instant timestamptz:=clock_timestamp(); fits boolean:=false;
begin
 if p_tokens<=0 or p_tokens>200000 then raise exception 'invalid token reservation';end if;
 for cfg in select * from public.research_provider_limits
  where provider in(select value->>'provider' from jsonb_array_elements(p_candidates))
  order by last_started_at for update loop
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

create or replace function public.research_provider_finish(p_request uuid,p_status integer,p_usage jsonb default null,p_error text default null,p_retry_after integer default null)
returns void language plpgsql security invoker set search_path='' as $$
declare provider_name text; tokens integer;
begin
 tokens:=nullif(coalesce((p_usage->>'total_tokens')::int,(p_usage->>'totalTokenCount')::int,0),0);
 update public.research_provider_usage set finished_at=clock_timestamp(),status=p_status,usage=p_usage,
  actual_tokens=tokens,error=left(p_error,300) where id=p_request and finished_at is null returning provider into provider_name;
 if provider_name is null then return;end if;
 if p_status in (401,402,403,429,500,502,503,504) then
  update public.research_provider_limits set cooldown_until=greatest(cooldown_until,clock_timestamp()+
   make_interval(secs=>case when p_status in (401,402,403) then 3600 else greatest(15,least(86400,coalesce(p_retry_after,60))) end))
  where provider=provider_name;
 end if;
end $$;

-- Persist stage progress and its children atomically; stale worker leases cannot write.
create or replace function public.research_checkpoint(p_task uuid,p_lease uuid,p_result jsonb,p_children jsonb default '[]')
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.research_tasks; c jsonb;
begin
 select * into t from public.research_tasks where id=p_task and lease=p_lease and state='running' for update;
 if not found then return false;end if;
 update public.research_tasks set result=p_result,updated_at=now() where id=t.id;
 for c in select value from jsonb_array_elements(p_children) loop
  insert into public.research_tasks(run_id,task_key,kind,batch,payload)
   values(t.run_id,c->>'key',c->>'kind',coalesce((c->>'batch')::int,t.batch),coalesce(c->'payload','{}'))
   on conflict(run_id,task_key) do nothing;
 end loop;
 return true;
end $$;

create or replace function public.research_retry(p_task uuid,p_lease uuid,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
declare delay_ms integer;
begin
 if p_error ~ 'provider_wait:[0-9]+' then
  delay_ms:=least(86400000,coalesce(substring(p_error from 'provider_wait:([0-9]+)')::bigint,5000))::integer;
  update public.research_tasks set state=case when coalesce((payload->>'attemptWindowStartedAt')::timestamptz,created_at)<now()-interval '30 minutes' then 'failed' else 'pending' end,
   attempts=greatest(0,attempts-1),error=case when coalesce((payload->>'attemptWindowStartedAt')::timestamptz,created_at)<now()-interval '30 minutes' then 'provider_capacity_unavailable' else left(p_error,500) end,
   lease=null,ready_at=now()+make_interval(secs=>delay_ms/1000.0+random()),updated_at=now()
   where id=p_task and lease=p_lease and state='running';
 else
  update public.research_tasks set state=case when attempts>=2 then 'failed' else 'pending' end,
   error=left(p_error,500),lease=null,ready_at=now()+make_interval(secs=>30+random()*5),updated_at=now()
   where id=p_task and lease=p_lease and state='running';
 end if;
end $$;

-- Atomic ownership also protects concurrent first selections. Existing jobs attach; force retries are explicit.
create or replace function public.research_open(p_product text,p_identity jsonb,p_blueprint jsonb,p_profile jsonb,p_endpoint text,p_force boolean default false,p_tasks jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.research_runs; c jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('research:'||p_product,0));
 select * into r from public.research_runs where product_id=p_product for update;
 if found then
  if r.phase not in ('complete','interrupted') or not p_force then
   return jsonb_build_object('created',false,'run',to_jsonb(r));
  end if;
  if r.phase='complete' then
   update public.research_tasks set state='pending',attempts=0,lease=null,ready_at=now(),error=null,
    payload=jsonb_set(payload,'{attemptWindowStartedAt}',to_jsonb(now()))
    where run_id=r.id and kind in ('collect','facts');
  end if;
  -- Resume interrupted evidence; explicit retry starts a new attempt allowance, not a new archive.
  update public.research_tasks set state='pending',attempts=0,lease=null,ready_at=now(),error=null,
    payload=jsonb_set(payload,'{attemptWindowStartedAt}',to_jsonb(now()))
   where run_id=r.id and state='failed';
  update public.research_runs set phase=case when exists(select 1 from public.research_tasks where run_id=r.id and kind='collect')
   then case when r.batch=2 then 'batch2' else 'batch1' end else 'validating' end,updated_at=now() where id=r.id returning * into r;
  delete from public.research_tasks where run_id=r.id and kind='coordinate' and payload->>'stage' in ('batch','validated');
  return jsonb_build_object('created',false,'resumed',true,'run',to_jsonb(r));
 end if;
 insert into public.research_runs(product_id,identity,blueprint,profile,endpoint)
  values(p_product,p_identity,p_blueprint,p_profile,p_endpoint) returning * into r;
 for c in select value from jsonb_array_elements(p_tasks) loop
  insert into public.research_tasks(run_id,task_key,kind,payload) values(r.id,c->>'key',c->>'kind',coalesce(c->'payload','{}'));
 end loop;
 return jsonb_build_object('created',true,'run',to_jsonb(r));
end $$;

revoke all on function public.research_provider_acquire(uuid,uuid,jsonb,integer,text),public.research_provider_finish(uuid,integer,jsonb,text,integer),
 public.research_checkpoint(uuid,uuid,jsonb,jsonb),public.research_open(text,jsonb,jsonb,jsonb,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.research_provider_acquire(uuid,uuid,jsonb,integer,text),public.research_provider_finish(uuid,integer,jsonb,text,integer),
 public.research_checkpoint(uuid,uuid,jsonb,jsonb),public.research_open(text,jsonb,jsonb,jsonb,text,boolean,jsonb) to service_role;

create or replace function public.research_usage_summary(p_run uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('assessmentCalls',count(*) filter(where stage in ('review','verify')),
  'totalCalls',count(*),'failedCalls',count(*) filter(where status is not null and status<>200),
  'tokens',coalesce(sum(actual_tokens),0),'reservedTokens',coalesce(sum(reserved_tokens),0),
  'providers',coalesce((select jsonb_agg(x) from(select provider,count(*) calls,
    count(*) filter(where status=429) throttled,count(*) filter(where stage='verify') verification_calls,
    coalesce(sum(actual_tokens),0) tokens from public.research_provider_usage where run_id=p_run group by provider)x),'[]'))
 from public.research_provider_usage where run_id=p_run;
$$;
revoke all on function public.research_usage_summary(uuid) from public,anon,authenticated;
grant execute on function public.research_usage_summary(uuid) to service_role;

alter table public.research_runs add column last_dispatched_at timestamptz not null default '-infinity';
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
 update public.research_runs r set phase='validating' where phase='discovering'
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

-- Short waits are also nudged by worker completions; this recovers durable deferred work.
select cron.schedule('parallel-research-recovery','10 seconds','select public.research_dispatch();');
