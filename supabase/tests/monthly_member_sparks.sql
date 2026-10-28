-- These checks leave no wallet changes or claim records behind.
begin;
select set_config('test.member',(select u.id::text from auth.users u where not exists(select 1 from public.unmask_monthly_spark_claims c where c.user_id=u.id and c.month=date_trunc('month',now() at time zone 'Africa/Lagos')::date) order by u.created_at limit 1),true);
select set_config('test.other',(select id::text from auth.users order by created_at offset 1 limit 1),true);
select set_config('test.before',coalesce((select sparks::text from public.unmask_spark_wallets where user_id=current_setting('test.member')::uuid),'0'),true);
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.member'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; s jsonb; blocked boolean:=false; begin
 s:=public.unmask_monthly_sparks(false);
 if (s->>'claimed')::boolean then raise exception 'Read status granted Sparks'; end if;
 a:=public.unmask_monthly_sparks(true);
 b:=public.unmask_monthly_sparks(true);
 if not (a->>'awarded')::boolean or (b->>'awarded')::boolean then raise exception 'Claim idempotency failed';end if;
 if (a->>'sparks')::bigint <> current_setting('test.before')::bigint+50 or a->>'sparks'<>b->>'sparks' then raise exception 'Incorrect wallet credit';end if;
 if (a->>'month')::date <> date_trunc('month',now() at time zone 'Africa/Lagos')::date then raise exception 'Wrong claim month';end if;
 if (a->>'next_claim_at')::timestamptz <> ((date_trunc('month',now() at time zone 'Africa/Lagos')+interval '1 month') at time zone 'Africa/Lagos') then raise exception 'Wrong next claim date';end if;
 begin insert into public.unmask_monthly_spark_claims(user_id,month) values(auth.uid(),'2000-01-01');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client could invent claims';end if;
 blocked:=false;
 begin update public.unmask_monthly_spark_claims set amount=100 where user_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client could modify grants';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.unmask_monthly_spark_claims where user_id=current_setting('test.member')::uuid) then raise exception 'Another member claim leaked';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.other'),'role','authenticated','is_anonymous',true)::text,true);
do $$ declare blocked boolean:=false; begin
 begin perform public.unmask_monthly_sparks(true);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous auth account could claim';end if;
end $$;
set local role anon;
do $$ declare blocked boolean:=false; begin
 begin perform public.unmask_monthly_sparks(true);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Signed-out visitor could claim';end if;
end $$;
rollback;
