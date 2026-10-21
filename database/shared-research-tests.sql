begin;
do $$
declare opened jsonb; again jsonb; r uuid; t uuid; claim jsonb; first_slot jsonb; second_slot jsonb; third_slot jsonb;
begin
 opened:=public.research_open('__shared_queue_test__','{}','{}','{}','https://example.invalid',false,
  '[{"key":"review","kind":"review","payload":{"records":[]}}]');
 r:=(opened->'run'->>'id')::uuid;
 again:=public.research_open('__shared_queue_test__','{}','{}','{}','https://example.invalid');
 if (again->>'created')::boolean or (again->'run'->>'id')::uuid<>r then raise exception 'duplicate research job';end if;
 if (select count(*) from research_tasks where run_id=r)<>1 then raise exception 'non atomic bootstrap';end if;
 select id into t from research_tasks where run_id=r;
 update research_tasks set state='dispatched',attempts=1 where id=t;
 claim:=research_claim(t,r,(select token from research_runs where id=r));
 if not research_checkpoint(t,(claim->'task'->>'lease')::uuid,'{"saved":true}',
  '[{"key":"verify","kind":"verify","payload":{}}]') then raise exception 'checkpoint failed';end if;
 perform research_retry(t,(claim->'task'->>'lease')::uuid,'provider_wait:5000');
 if (select attempts from research_tasks where id=t)<>0 then raise exception 'queue wait consumed retry';end if;
 if (select result->>'saved' from research_tasks where id=t)<>'true' then raise exception 'checkpoint lost';end if;
 update research_tasks set state='dispatched',attempts=2 where id=t;
 claim:=research_claim(t,r,(select token from research_runs where id=r));
 perform research_retry(t,(claim->'task'->>'lease')::uuid,'http_429');
 if (select state from research_tasks where id=t)<>'failed' then raise exception 'retry cap failed';end if;
 if research_checkpoint(t,(claim->'task'->>'lease')::uuid,'{}') then raise exception 'stale checkpoint write';end if;
 update research_provider_limits set rpm=1,tpm=1000,rpd=null,tpd=null,last_started_at='-infinity',cooldown_until='-infinity' where provider in ('groq','cloudflare');
 first_slot:=research_provider_acquire(r,t,'[{"provider":"groq","model":"test"},{"provider":"cloudflare","model":"test"}]',100,'review');
 second_slot:=research_provider_acquire(r,t,'[{"provider":"groq","model":"test"},{"provider":"cloudflare","model":"test"}]',100,'review');
 third_slot:=research_provider_acquire(r,t,'[{"provider":"groq","model":"test"},{"provider":"cloudflare","model":"test"}]',100,'review');
 if not(first_slot->>'allowed')::boolean or not(second_slot->>'allowed')::boolean then raise exception 'two provider pools not used';end if;
 if first_slot->>'provider'=second_slot->>'provider' then raise exception 'provider pacing bypassed';end if;
 if (third_slot->>'allowed')::boolean then raise exception 'shared rate budget bypassed';end if;
 perform research_provider_finish((first_slot->>'requestId')::uuid,429,null,'http_429',75);
 if (select cooldown_until from research_provider_limits where provider=first_slot->>'provider')<now()+interval '70 seconds' then raise exception 'cooldown ignored';end if;
 if has_table_privilege('anon','public.research_provider_usage','SELECT') then raise exception 'provider usage exposed';end if;
 if has_function_privilege('anon','public.research_provider_acquire(uuid,uuid,jsonb,integer,text)','EXECUTE') then raise exception 'provider governor exposed';end if;
end $$;
rollback;
