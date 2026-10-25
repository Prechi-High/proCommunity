-- Run with a database owner connection; every fixture is rolled back.
begin;
select set_config('test.uid',(select id::text from public.profiles limit 1),true),set_config('test.case',gen_random_uuid()::text,true);
insert into public.unmask_public_profiles(user_id,display_name,handle) values(current_setting('test.uid')::uuid,'Privacy fixture','test_'||substr(md5(random()::text),1,16)) on conflict(user_id) do update set show_counts=false,show_support=false;
insert into public.unmask_investigations(id,user_id,title) values(current_setting('test.case')::uuid,current_setting('test.uid')::uuid,'Profile privacy test investigation');
insert into public.unmask_spark_contributions(user_id,investigation_id,kind,amount,public_ack,request_key) values(current_setting('test.uid')::uuid,current_setting('test.case')::uuid,'sparks',10,true,gen_random_uuid()),(current_setting('test.uid')::uuid,current_setting('test.case')::uuid,'sparks',20,false,gen_random_uuid());
set local role anon;
do $$ begin
 if public.unmask_profile_counts(current_setting('test.uid')::uuid)<>'{}'::jsonb then raise exception 'Hidden counts exposed';end if;
 if exists(select 1 from public.unmask_profile_support(current_setting('test.uid')::uuid)) then raise exception 'Hidden support exposed';end if;
 if has_function_privilege('anon','public.unmask_my_people(boolean)','execute') then raise exception 'Anonymous relationship access';end if;
end $$;
reset role;
update public.unmask_public_profiles set show_support=true where user_id=current_setting('test.uid')::uuid;
set local role anon;
do $$ begin
 if (select count(*) from public.unmask_profile_support(current_setting('test.uid')::uuid) where id=current_setting('test.case')::uuid)<>1 then raise exception 'Opt-in recognition failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ declare n integer;begin
 update public.unmask_public_profiles set bio='Unauthorized change' where user_id=current_setting('test.uid')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Another member edited profile';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
do $$ declare n integer;begin
 update public.unmask_public_profiles set bio='Owner edit' where user_id=current_setting('test.uid')::uuid;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Owner cannot edit';end if;
 if not(public.unmask_profile_counts(current_setting('test.uid')::uuid)?'followers') then raise exception 'Own counts unavailable';end if;
end $$;
select 'PASS: private counts, opt-in recognition, private relationship API, own-only edits' as result;
rollback;
