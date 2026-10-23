-- Reserve verification capacity while expanding the measured H100 assessment pipeline.
CREATE OR REPLACE FUNCTION public.research_dispatch()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare r public.research_runs; t public.research_tasks; k text; cap integer; slots integer; sent integer:=0; i integer; review_cap integer;
begin
 if not pg_try_advisory_xact_lock(77190241) then return 0; end if;
 select case when public.research_inference_config()->>'mode'='modal' then greatest(1,concurrency-8) else 8 end into review_cap from public.research_provider_limits where provider='modal';
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
  cap:=case k when 'verify' then case when review_cap>20 then 8 else 4 end when 'collect' then 20 when 'review' then review_cap when 'identity' then 4 when 'publish' then 2 when 'preview' then 1 else 2 end;
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


update public.research_provider_limits set concurrency=48 where provider='modal';
