-- Batch result, reusable decisions and verification children in one lease-guarded transaction.
alter table public.research_tasks add column if not exists provider_wait_ms bigint not null default 0;
create index if not exists research_tasks_live_dispatch on public.research_tasks(kind,ready_at,created_at) where state='pending';
create index if not exists research_usage_inflight on public.research_provider_usage(provider,started_at) where finished_at is null;
create or replace function public.research_commit_assessment(p_task uuid,p_lease uuid,p_result jsonb,p_children jsonb,p_cache jsonb,p_complete boolean)
returns boolean language plpgsql set search_path='' as $$
declare t public.research_tasks;
begin
 select * into t from public.research_tasks where id=p_task and lease=p_lease and state='running' for update;
 if not found then return false;end if;
 insert into public.research_decision_cache(input_hash,product_id,decision,policy_version,verified,expires_at,updated_at)
 select c.input_hash,r.product_id,c.decision,c.policy_version,true,clock_timestamp()+interval '30 days',clock_timestamp()
 from jsonb_to_recordset(p_cache) c(input_hash text,decision jsonb,policy_version text)
 join public.research_runs r on r.id=t.run_id
 on conflict(input_hash) do update set decision=excluded.decision,policy_version=excluded.policy_version,verified=true,expires_at=excluded.expires_at,updated_at=excluded.updated_at;
 if p_complete then return public.research_finish(p_task,p_lease,p_result,p_children,null,null);
 else return public.research_checkpoint(p_task,p_lease,p_result,p_children);end if;
end $$;
revoke all on function public.research_commit_assessment(uuid,uuid,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.research_commit_assessment(uuid,uuid,jsonb,jsonb,jsonb,boolean) to service_role;

-- The publisher reads only the columns it needs, not duplicated raw payloads/checkpoint rows.
create or replace function public.research_task_snapshot(p_run uuid) returns setof jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',t.id,'task_key',t.task_key,'kind',t.kind,'batch',t.batch,'state',t.state,
 'created_at',t.created_at,'updated_at',t.updated_at,'first_started_at',t.first_started_at,'last_started_at',t.last_started_at,
 'finished_at',t.finished_at,'total_processing_ms',t.total_processing_ms,'capacity_deferrals',t.capacity_deferrals,'provider_wait_ms',t.provider_wait_ms,'error',t.error,
 'payload',case when t.kind in ('review','verify') then jsonb_build_object('records',coalesce((select jsonb_agg(jsonb_build_object('id',v->>'id')) from jsonb_array_elements(t.payload->'records')v),'[]'::jsonb))
 when t.kind='collect' then jsonb_build_object('video',jsonb_build_object('id',t.payload->'video'->>'id')) else t.payload end,
 'result',case when t.kind='review' and t.result ? 'assessmentState' then jsonb_set(t.result,'{assessmentState}',(t.result->'assessmentState')-'rows') else t.result end)
 from public.research_tasks t where t.run_id=p_run order by t.created_at,t.id;
$$;
revoke all on function public.research_task_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.research_task_snapshot(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.research_claim(p_task uuid, p_run uuid, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t public.research_tasks; r public.research_runs;
begin
 select * into r from public.research_runs where id=p_run and token=p_token and phase not in ('complete','interrupted');
 if not found then return null; end if;
 update public.research_tasks set state='running',lease=gen_random_uuid(),updated_at=now(),first_started_at=coalesce(first_started_at,clock_timestamp()),last_started_at=clock_timestamp()
 where id=p_task and run_id=p_run and state='dispatched' returning * into t;
 if not found then return null; end if;
 return jsonb_build_object('task',to_jsonb(t),'run',case when t.kind='facts' then to_jsonb(r) else jsonb_build_object('id',r.id,'product_id',r.product_id,'identity',r.identity,'blueprint',r.blueprint,'phase',r.phase,'batch',r.batch,'created_at',r.created_at) end);
end $function$;

CREATE OR REPLACE FUNCTION public.research_provider_acquire(p_run uuid, p_task uuid, p_candidates jsonb, p_tokens integer, p_stage text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.research_provider_limits; candidate jsonb; request_id uuid; active integer; used_requests integer;
 used_tokens bigint; day_requests integer; day_tokens bigint; wait_until timestamptz; earliest timestamptz:='infinity';
 instant timestamptz:=clock_timestamp(); fits boolean:=false;
begin
 if p_tokens<=0 or p_tokens>200000 then raise exception 'invalid token reservation';end if;
 for cfg in select * from public.research_provider_limits
  where provider in(select value->>'provider' from jsonb_array_elements(p_candidates))
  order by last_started_at loop
  perform pg_advisory_xact_lock(hashtextextended('provider:'||cfg.provider,0));
  instant:=clock_timestamp();
  select * into cfg from public.research_provider_limits where provider=cfg.provider for update;
  if p_tokens>cfg.tpm then continue;end if;
  fits:=true;
  select count(*),coalesce(sum(coalesce(actual_tokens,reserved_tokens)),0) into used_requests,used_tokens
   from public.research_provider_usage where provider=cfg.provider and started_at>instant-interval '60 seconds';
  if cfg.rpd is not null or cfg.tpd is not null then
  select count(*),coalesce(sum(coalesce(actual_tokens,reserved_tokens)),0) into day_requests,day_tokens
   from public.research_provider_usage where provider=cfg.provider and started_at>=date_trunc('day',instant at time zone 'UTC') at time zone 'UTC';
  end if;
  select count(*) into active from public.research_provider_usage
   where provider=cfg.provider and finished_at is null and started_at>instant-interval '90 seconds';
  wait_until:=greatest(cfg.cooldown_until,case when cfg.provider='modal' then '-infinity'::timestamptz else cfg.last_started_at+make_interval(secs=>60.0/cfg.rpm) end);
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
  update public.research_tasks set provider_wait_ms=provider_wait_ms+case when capacity_wait_started_at is null then 0 else greatest(0,extract(epoch from instant-capacity_wait_started_at)*1000)::bigint end,capacity_wait_started_at=null where id=p_task;
  return jsonb_build_object('allowed',true,'requestId',request_id,'provider',cfg.provider,'model',candidate->>'model');
 end loop;
 if not fits then return jsonb_build_object('allowed',false,'error','request_exceeds_provider_token_budget');end if;
 return jsonb_build_object('allowed',false,'retryAfterMs',greatest(1000,ceil(extract(epoch from earliest-instant)*1000)));
end $function$;

CREATE OR REPLACE FUNCTION public.research_dispatch()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare r public.research_runs; t public.research_tasks; k text; cap integer; slots integer; sent integer:=0; i integer; review_cap integer;
begin
 if not pg_try_advisory_xact_lock(77190241) then return 0; end if;
 select case when public.research_inference_config()->>'mode'='modal' then greatest(1,concurrency-4) else 8 end into review_cap from public.research_provider_limits where provider='modal';
 review_cap:=coalesce(review_cap,8);
 update public.research_tasks set state=case when attempts>=2 then 'failed' else 'pending' end,lease=null,
 error='worker lease expired',updated_at=now(),ready_at=now()
 where (state='dispatched' and updated_at<now()-interval '45 seconds')
    or (state='running' and updated_at<now()-interval '150 seconds');
 update public.research_tasks set state='failed',lease=null,finished_at=clock_timestamp(),updated_at=now(),error='provider_capacity_unavailable: waited 5 minutes; saved work can be resumed'
 where state in ('pending','dispatched') and capacity_wait_started_at<now()-interval '5 minutes';
 -- Bound each validation wave. Keep its verified matches; finish with honest limited coverage.
 update public.research_tasks t set state='failed',error='video_validation_deadline',lease=null,finished_at=clock_timestamp(),updated_at=now()
 where kind='identity' and state in ('pending','dispatched','running') and greatest(coalesce((payload->>'attemptWindowStartedAt')::timestamptz,t.created_at),coalesce((select max(w.finished_at) from public.research_tasks w where w.run_id=t.run_id and w.kind='warmup' and w.state='done'),t.created_at))<now()-interval '90 seconds' and not exists(select 1 from public.research_tasks w where w.run_id=t.run_id and w.kind='warmup' and w.state not in ('done','failed'));
 update public.research_runs r set phase='validating'  where phase='discovering'
 and exists(select 1 from public.research_tasks t where t.run_id=r.id and t.kind='discover' and t.state='failed');
 for r in select * from public.research_runs where phase not in ('complete','interrupted') loop
  if r.phase='validating' and not exists(select 1 from public.research_tasks where run_id=r.id and kind in ('discover','identity') and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,payload) values(r.id,'coordinate:validated','coordinate','{"stage":"validated"}') on conflict do nothing;
  elsif r.phase in ('batch1','batch2') and not exists(select 1 from public.research_tasks where run_id=r.id and kind<>'coordinate' and batch<=r.batch and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,batch,payload) values(r.id,'coordinate:batch:'||r.batch,'coordinate',r.batch,jsonb_build_object('stage','batch','batch',r.batch)) on conflict do nothing;
  end if;
 end loop;
 update public.research_tasks p set state='done',result='{"skipped":true,"reason":"final_publication_priority"}',finished_at=clock_timestamp(),updated_at=now()
 where p.kind='coordinate' and p.payload->>'stage'='preview' and p.state='pending'
 and exists(select 1 from public.research_tasks f where f.run_id=p.run_id and f.kind='coordinate' and f.payload->>'stage'='batch');
 insert into public.research_tasks(run_id,task_key,kind,batch,payload)
 select r.id,'coordinate:preview:'||floor(extract(epoch from now())/60)::text,'coordinate',r.batch,'{"stage":"preview"}'::jsonb
 from public.research_runs r where r.phase in ('batch1','batch2')
 and exists(select 1 from public.research_tasks v where v.run_id=r.id and v.kind='verify' and v.state='done')
 and exists(select 1 from public.research_tasks w where w.run_id=r.id and w.kind<>'coordinate' and w.state not in ('done','failed'))
 and not exists(select 1 from public.research_tasks p where p.run_id=r.id and p.kind='coordinate' and (p.state in ('pending','dispatched','running') or p.created_at>now()-interval '60 seconds'))
 on conflict do nothing;
 foreach k in array array['verify','collect','review','identity','publish','preview','other'] loop
  cap:=case k when 'verify' then 4 when 'collect' then 20 when 'review' then review_cap when 'identity' then 4 when 'publish' then 2 when 'preview' then 1 else 2 end;
  select greatest(0,cap-count(*)::int) into slots from public.research_tasks
   where state in ('dispatched','running') and (case when kind in ('verify','collect','review','identity') then kind when kind='coordinate' then case when payload->>'stage'='preview' then 'preview' else 'publish' end else 'other' end)=k;
  for i in 1..slots loop
   select q.* into t from public.research_tasks q join public.research_runs r on r.id=q.run_id
    where q.state='pending' and q.ready_at<=now() and r.phase not in ('complete','interrupted')
    and (case when q.kind in ('verify','collect','review','identity') then q.kind when q.kind='coordinate' then case when q.payload->>'stage'='preview' then 'preview' else 'publish' end else 'other' end)=k
    and not(q.kind in ('facts','identity','review','verify') and exists(select 1 from public.research_tasks w where w.run_id=q.run_id and w.kind='warmup' and w.state<>'done'))
    and not(q.kind='coordinate' and exists(select 1 from public.research_tasks active_task
     where active_task.run_id=q.run_id and active_task.kind='coordinate' and active_task.state in ('dispatched','running')))
    order by case when q.kind='coordinate' and q.payload->>'stage'<>'preview' then 0 else 1 end,r.last_dispatched_at,q.created_at limit 1 for update of q skip locked;
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
end $function$;

