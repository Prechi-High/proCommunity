
-- Durable two-batch research. All queue state is service-role only.
create table public.research_runs (
 id uuid primary key default gen_random_uuid(),
 product_id text not null unique,
 token uuid not null default gen_random_uuid(),
 endpoint text not null,
 phase text not null default 'discovering' check (phase in ('discovering','validating','batch1','batch2','complete','interrupted')),
 identity jsonb not null, blueprint jsonb not null, profile jsonb not null,
 batch integer not null default 1 check(batch in (1,2)),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.research_tasks (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.research_runs(id) on delete cascade,
 task_key text not null, kind text not null check(kind in ('discover','identity','collect','review','facts','coordinate')),
 batch integer not null default 1 check(batch in (1,2)),
 payload jsonb not null default '{}', result jsonb,
 state text not null default 'pending' check(state in ('pending','dispatched','running','done','failed')),
 attempts integer not null default 0, lease uuid,
 ready_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(), error text,
 unique(run_id,task_key)
);
create index research_tasks_dispatch_idx on public.research_tasks(kind,state,ready_at);
create index research_tasks_run_idx on public.research_tasks(run_id,batch,state);
create table public.research_comments (
 run_id uuid not null references public.research_runs(id) on delete cascade,
 id text not null, raw jsonb not null, created_at timestamptz not null default now(),
 primary key(run_id,id)
);
alter table public.research_comments enable row level security;
revoke all on public.research_comments from public,anon,authenticated;
grant all on public.research_comments to service_role;

alter table public.research_runs enable row level security;
alter table public.research_tasks enable row level security;
revoke all on public.research_runs,public.research_tasks from public,anon,authenticated;
grant all on public.research_runs,public.research_tasks to service_role;

create or replace function public.research_claim(p_task uuid,p_run uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.research_tasks; r public.research_runs;
begin
 select * into r from public.research_runs where id=p_run and token=p_token and phase not in ('complete','interrupted');
 if not found then return null; end if;
 update public.research_tasks set state='running',lease=gen_random_uuid(),updated_at=now()
 where id=p_task and run_id=p_run and state='dispatched' returning * into t;
 if not found then return null; end if;
 return jsonb_build_object('task',to_jsonb(t),'run',to_jsonb(r));
end $$;

-- Child tasks and raw-page result commit in the same transaction. Lease guards prevent stale writes.
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
 update public.research_tasks set state='done',result=p_result,error=null,updated_at=now() where id=t.id;
 update public.research_runs set phase=coalesce(p_phase,phase),profile=coalesce(p_profile,profile),updated_at=now(),
 batch=case when p_phase='batch2' then 2 else batch end where id=t.run_id;
 return true;
end $$;

create or replace function public.research_retry(p_task uuid,p_lease uuid,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.research_tasks set state=case when attempts>=3 then 'failed' else 'pending' end,
 error=left(p_error,500),lease=null,ready_at=now()+make_interval(secs=>least(30,attempts*5)),updated_at=now()
 where id=p_task and lease=p_lease and state='running';
end $$;

-- Global capacity limits: 20 collectors, 8 review calls, 4 identity calls, 2 other calls.
-- Invoked after completions and by cron, so continuation does not depend on the browser.
create or replace function public.research_dispatch()
returns integer language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare r public.research_runs; t public.research_tasks; k text; cap integer; slots integer; sent integer:=0;
begin
 if not pg_try_advisory_xact_lock(77190241) then return 0; end if;
 update public.research_tasks set state=case when attempts>=3 then 'failed' else 'pending' end,lease=null,
 error='worker lease expired',updated_at=now(),ready_at=now()
 where state in ('dispatched','running') and updated_at<now()-interval '150 seconds';
 update public.research_runs r set phase='validating' where phase='discovering'
 and exists(select 1 from public.research_tasks t where t.run_id=r.id and t.kind='discover' and t.state='failed');
 for r in select * from public.research_runs where phase not in ('complete','interrupted') loop
  if r.phase='validating' and not exists(select 1 from public.research_tasks where run_id=r.id and kind in ('discover','identity') and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,payload) values(r.id,'coordinate:validated','coordinate','{"stage":"validated"}') on conflict do nothing;
  elsif r.phase in ('batch1','batch2') and not exists(select 1 from public.research_tasks where run_id=r.id and kind<>'coordinate' and batch<=r.batch and state not in ('done','failed')) then
   insert into public.research_tasks(run_id,task_key,kind,batch,payload) values(r.id,'coordinate:batch:'||r.batch,'coordinate',r.batch,jsonb_build_object('stage','batch','batch',r.batch)) on conflict do nothing;
  end if;
 end loop;
 foreach k in array array['collect','review','identity','other'] loop
  cap:=case k when 'collect' then 20 when 'review' then 8 when 'identity' then 4 else 2 end;
  select greatest(0,cap-count(*)::int) into slots from public.research_tasks
   where state in ('dispatched','running') and (case when kind in ('collect','review','identity') then kind else 'other' end)=k;
  for t in select q.* from public.research_tasks q join public.research_runs r on r.id=q.run_id
   where q.state='pending' and q.ready_at<=now() and r.phase not in ('complete','interrupted')
   and (case when q.kind in ('collect','review','identity') then q.kind else 'other' end)=k
   order by q.created_at limit slots for update of q skip locked loop
    -- Never publish a preview and a final snapshot for the same run concurrently.
    if t.kind='coordinate' and exists(select 1 from public.research_tasks active_task
      where active_task.run_id=t.run_id and active_task.kind='coordinate' and active_task.state in ('dispatched','running')) then
      continue;
    end if;
    select * into r from public.research_runs where id=t.run_id;
    update public.research_tasks set state='dispatched',attempts=attempts+1,updated_at=now() where id=t.id;
    perform net.http_post(url:=r.endpoint,body:=jsonb_build_object('runId',r.id,'taskId',t.id,'token',r.token),
     headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=2000);
    sent:=sent+1;
  end loop;
 end loop;
 return sent;
end $$;
revoke all on function public.research_claim(uuid,uuid,uuid),public.research_finish(uuid,uuid,jsonb,jsonb,text,jsonb),public.research_retry(uuid,uuid,text),public.research_dispatch() from public,anon,authenticated;
grant execute on function public.research_claim(uuid,uuid,uuid),public.research_finish(uuid,uuid,jsonb,jsonb,text,jsonb),public.research_retry(uuid,uuid,text),public.research_dispatch() to service_role;

create extension if not exists pg_cron;
select cron.schedule('parallel-research-recovery','* * * * *','select public.research_dispatch();');
