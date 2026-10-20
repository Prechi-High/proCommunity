begin;
do $$
declare r uuid;t uuid;c jsonb;ok boolean;
begin
 insert into research_runs(product_id,endpoint,identity,blueprint,profile)
 values('__queue_test__','https://example.invalid','{}','{}','{}') returning id into r;
 insert into research_tasks(run_id,task_key,kind,state) values(r,'test','collect','dispatched') returning id into t;
 c:=research_claim(t,r,(select token from research_runs where id=r));
 if c is null then raise exception 'claim failed';end if;
 if (c->'run') ? 'profile' then raise exception 'collector claim unnecessarily includes full profile';end if;
 if research_claim(t,r,(select token from research_runs where id=r)) is not null then raise exception 'double claim';end if;
 ok:=research_finish(t,(c->'task'->>'lease')::uuid,'{"records":[{"id":"youtube:1","text":"example"}]}',
 '[{"key":"review:1","kind":"review","payload":{"records":[{"id":"youtube:1","text":"example"}]}}]');
 if not ok then raise exception 'finish failed';end if;
 if research_finish(t,(c->'task'->>'lease')::uuid,'{}') then raise exception 'stale lease';end if;
 if (select count(*) from research_comments where run_id=r)<>1 then raise exception 'raw not persisted';end if;
 if (select count(*) from research_tasks where run_id=r)<>2 then raise exception 'child missing';end if;
end $$;
rollback;
