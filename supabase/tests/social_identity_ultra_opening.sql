-- Transactional assertions: no posts, wallet changes, profiles or notifications persist.
begin;
select set_config('test.member',(select id::text from auth.users where email_confirmed_at is not null order by created_at limit 1),true);
select set_config('test.other',(select id::text from auth.users where id<>current_setting('test.member')::uuid order by created_at limit 1),true);
insert into public.unmask_spark_wallets(user_id,sparks,thunder) values(current_setting('test.member')::uuid,20,1) on conflict(user_id) do update set sparks=20,thunder=1;
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.member'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; n integer; blocked boolean:=false; k uuid:=gen_random_uuid(); story jsonb:='{"title":"Test: why did this product work?","concern":"Rollback-only integration check"}'; begin
 a:=public.unmask_start_ultra(story,'sparks',10,k);
 b:=public.unmask_start_ultra(story,'sparks',10,k);
 if a->>'id'<>b->>'id' then raise exception 'Retry created duplicate request';end if;
 select sparks into n from public.unmask_spark_wallets where user_id=auth.uid();
 if n<>10 then raise exception 'Opening support did not deduct exactly once';end if;
 if not exists(select 1 from public.unmask_spark_contributions where investigation_id=(a->>'id')::uuid and amount=10 and user_id=auth.uid()) then raise exception 'Missing opening ledger';end if;
 begin perform public.unmask_start_ultra(story,'sparks',20,gen_random_uuid());exception when others then if sqlerrm not like 'Not enough Sparks%' then raise;end if;blocked:=true;end;
 if not blocked then raise exception 'Insufficient balance accepted';end if;
 blocked:=false;begin perform public.unmask_start_ultra(story,'sparks',0,gen_random_uuid());exception when others then if sqlerrm not like 'Start with at least%' then raise;end if;blocked:=true;end;
 if not blocked then raise exception 'Zero Sparks accepted';end if;
 blocked:=false;begin insert into public.unmask_investigations(title,concern) values('Bypass opening Sparks','Test');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client bypassed opening support';end if;
 blocked:=false;begin insert into public.unmask_founding_members(user_id) values(auth.uid());exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Self-awarded founding membership';end if;
 a:=public.unmask_public_identity(auth.uid());
 if a ? 'email' or a ? 'skin_type' or a ? 'country' or a ? 'region' then raise exception 'Private profile context exposed';end if;
end $$;
reset role;
-- Public-post alerts honor product/person follows, deduplicate recipients and skip private stories.
select set_config('test.product',(select id from public.unmask_catalog order by id limit 1),true);
insert into public.unmask_subscriptions(user_id,target_type,target_id,preferences)
values(current_setting('test.other')::uuid,'person',current_setting('test.member'),array['experiences','questions']),
(current_setting('test.other')::uuid,'product',current_setting('test.product'),array['experiences','questions'])
on conflict(user_id,target_type,target_id) do update set preferences=excluded.preferences;
select set_config('test.alerts',(select count(*)::text from public.unmask_activity where user_id=current_setting('test.other')::uuid),true);
set local role authenticated;
do $$ declare a jsonb; n bigint; begin
 a:=public.unmask_start_ultra(jsonb_build_object('title','Follower alert integration check','product_id',current_setting('test.product')),'thunder',1,gen_random_uuid());
 if not exists(select 1 from public.unmask_spark_wallets where user_id=auth.uid() and thunder=0) then raise exception 'Thunder support not debited';end if;
 perform public.unmask_complete_profile('Integration Tester','test_'||replace(auth.uid()::text,'-','')::varchar(12),'Nigeria','Edo');
 a:=public.unmask_public_identity(auth.uid());
 if a->>'display_name'<>'Integration Tester' then raise exception 'Real name not saved';end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.unmask_activity where user_id=current_setting('test.other')::uuid)<>current_setting('test.alerts')::bigint+1 then raise exception 'Follower notification missing or duplicated';end if;
end $$;
-- Force an empty wallet and ensure rejected requests leave no orphan row.
update public.unmask_spark_wallets set sparks=0,thunder=0 where user_id=current_setting('test.member')::uuid;
set local role authenticated;
do $$ declare blocked boolean:=false; n bigint;begin
 select count(*) into n from public.unmask_investigations where user_id=auth.uid();
 begin perform public.unmask_start_ultra('{"title":"No balance test story"}', 'sparks',10,gen_random_uuid());exception when others then if sqlerrm not like 'Not enough Sparks%' then raise;end if;blocked:=true;end;
 if not blocked or n<>(select count(*) from public.unmask_investigations where user_id=auth.uid()) then raise exception 'Empty wallet left an orphan request';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.member'),'role','authenticated','is_anonymous',true)::text,true);
do $$ declare blocked boolean:=false;begin
 begin perform public.unmask_start_ultra('{"title":"Anonymous account test"}','sparks',10,gen_random_uuid());exception when others then if sqlerrm not like 'Sign in to start%' then raise;end if;blocked:=true;end;
 if not blocked then raise exception 'Anonymous user started Ultra';end if;
end $$;
set local role anon;
do $$ declare blocked boolean:=false;begin
 begin perform public.unmask_start_ultra('{"title":"Signed out account test"}','sparks',10,gen_random_uuid());exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Signed-out user started Ultra';end if;
end $$;
rollback;
