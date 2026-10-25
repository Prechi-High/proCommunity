-- Rollback-only integration test. No live balances, posts or roles persist.
begin;
select set_config('test.uid',(select id::text from public.profiles where not is_admin limit 1),true),set_config('test.product',(select id from public.unmask_catalog limit 1),true),set_config('test.case',gen_random_uuid()::text,true),set_config('test.exp',gen_random_uuid()::text,true),set_config('test.question',gen_random_uuid()::text,true),set_config('test.key',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
insert into public.unmask_investigations(id,user_id,product_id,title) values(current_setting('test.case')::uuid,current_setting('test.uid')::uuid,current_setting('test.product'),'Rollback-only investigation fixture');
insert into public.unmask_spark_wallets(user_id,sparks,thunder) values(current_setting('test.uid')::uuid,1000,2) on conflict(user_id) do update set sparks=1000,thunder=2;
insert into public.clarity_experiences(id,user_id,product_id,duration,body,visibility) values(current_setting('test.exp')::uuid,current_setting('test.uid')::uuid,current_setting('test.product'),'1–4 weeks','Rollback-only attached experience','public');
insert into public.unmask_questions(id,user_id,product_id,body) values(current_setting('test.question')::uuid,current_setting('test.uid')::uuid,current_setting('test.product'),'Rollback-only product question');
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=public.contribute_investigation(current_setting('test.case')::uuid,'sparks',75,false,current_setting('test.key')::uuid);
 b:=public.contribute_investigation(current_setting('test.case')::uuid,'sparks',75,false,current_setting('test.key')::uuid);
 if a->>'id'<>b->>'id' or (b->>'sparks')::int<>925 then raise exception 'Duplicate debit or variable amount failed';end if;
 begin update public.unmask_investigations set spark_goal=10 where id=current_setting('test.case')::uuid;exception when others then raise exception 'Unexpected update error: %',sqlerrm;end;
 if exists(select 1 from public.unmask_investigations where id=current_setting('test.case')::uuid and spark_goal<>500) then raise exception 'Member changed target';end if;
 insert into public.unmask_answers(question_id,body,duration,context,acquisition,uncertainty,attached_experience_id) values(current_setting('test.question')::uuid,'A reply with my published experience','1–4 weeks','','purchased','',current_setting('test.exp')::uuid);
end $$;
reset role;
update public.clarity_experiences set visibility='private' where id=current_setting('test.exp')::uuid;
set local role authenticated;
do $$ begin
 begin insert into public.unmask_answers(question_id,body,duration,context,acquisition,uncertainty,attached_experience_id) values(current_setting('test.question')::uuid,'Should not attach private experience','','','purchased','',current_setting('test.exp')::uuid);raise exception 'Private attachment accepted';exception when others then if sqlerrm<>'Attach your own published experience for this product' then raise;end if;end;
end $$;
reset role;
update public.unmask_investigations set status='selected' where id=current_setting('test.case')::uuid;
set local role authenticated;
do $$ begin
 -- Previously acknowledged requests remain safely replayable after closure.
 perform public.contribute_investigation(current_setting('test.case')::uuid,'sparks',75,false,current_setting('test.key')::uuid);
 begin perform public.contribute_investigation(current_setting('test.case')::uuid,'sparks',10,false,gen_random_uuid());raise exception 'Closed case accepted payment';exception when others then if sqlerrm<>'Support is closed for this investigation' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.contribute_investigation(uuid,text,integer,boolean,uuid)','execute') then raise exception 'Anonymous debit access';end if;
 begin if exists(select 1 from public.unmask_spark_wallets) then raise exception 'Wallet leaked';end if;exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'Contribution replay, variable amount, closed-case rejection, target authorization and public attachment checks passed; fixtures rolled back.' result;
