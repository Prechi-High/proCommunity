begin;
do $$
declare rid uuid; tid uuid; lease_id uuid:=gen_random_uuid(); vids jsonb; i integer; n integer;
begin
 insert into public.research_runs(product_id,identity,blueprint,profile,endpoint,phase) values('__stream_sql_test__','{}','{}','{}','https://example.invalid','validating') returning id into rid;
 insert into public.research_tasks(run_id,task_key,kind,state,lease,batch) values(rid,'identity:test','identity','running',lease_id,1) returning id into tid;
 select jsonb_agg(jsonb_build_object('id','video'||g,'title','Exact test cream')) into vids from generate_series(1,25) g;
 perform public.research_admit_videos(tid,lease_id,jsonb_build_object('videos',vids));
 select count(*) into n from public.research_tasks where run_id=rid and kind='collect';
 if n<>20 then raise exception 'first batch must admit exactly twenty, got %',n;end if;
 if (select phase from public.research_runs where id=rid)<>'batch1' then raise exception 'must start collecting before all validation ends';end if;
 perform public.research_admit_videos(tid,lease_id,jsonb_build_object('videos',vids));
 if (select count(*) from public.research_tasks where run_id=rid and kind='collect')<>20 then raise exception 'admission must be idempotent';end if;
 if public.research_admit_videos(tid,gen_random_uuid(),jsonb_build_object('videos',vids)) then raise exception 'stale lease admitted';end if;
 update public.research_tasks set batch=2 where id=tid;
 select jsonb_agg(jsonb_build_object('id','video'||g,'title','Exact test cream')) into vids from generate_series(21,50) g;
 perform public.research_admit_videos(tid,lease_id,jsonb_build_object('videos',vids));
 if (select count(*) from public.research_tasks where run_id=rid and kind='collect')<>40 then raise exception 'two batches must admit at most forty unique videos';end if;
end $$;
rollback;
