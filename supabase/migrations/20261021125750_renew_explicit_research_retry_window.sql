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