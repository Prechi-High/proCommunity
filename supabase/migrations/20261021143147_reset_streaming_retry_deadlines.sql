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
   update public.research_tasks set state='pending',attempts=0,lease=null,ready_at=now(),error=null,capacity_wait_started_at=null,finished_at=null,
    payload=jsonb_set(payload,'{attemptWindowStartedAt}',to_jsonb(now()))
    where run_id=r.id and kind in ('collect','facts');
  end if;
  -- Resume interrupted evidence; explicit retry starts a new attempt allowance, not a new archive.
  update public.research_tasks set state='pending',attempts=0,lease=null,ready_at=now(),error=null,capacity_wait_started_at=null,finished_at=null,
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
 update public.research_tasks set state='failed',lease=null,finished_at=clock_timestamp(),updated_at=now(),error='provider_capacity_unavailable: waited 90 seconds; saved work can be resumed'
 where state in ('pending','dispatched') and capacity_wait_started_at<now()-interval '90 seconds';
 -- Bound each validation wave. Keep its verified matches; finish with honest limited coverage.
 update public.research_tasks t set state='failed',error='video_validation_deadline',lease=null,finished_at=clock_timestamp(),updated_at=now()
 where kind='identity' and state in ('pending','dispatched','running') and coalesce((payload->>'attemptWindowStartedAt')::timestamptz,created_at)<now()-interval '90 seconds';
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
