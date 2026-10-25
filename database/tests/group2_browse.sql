begin;
select set_config('test.uid',(select id::text from profiles limit 1),true),set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.prefix','browse_'||md5(random()::text),true);
insert into unmask_investigations(id,user_id,title) values(current_setting('test.a')::uuid,current_setting('test.uid')::uuid,current_setting('test.prefix')||' first'),(current_setting('test.b')::uuid,current_setting('test.uid')::uuid,current_setting('test.prefix')||' second');
insert into unmask_spark_contributions(user_id,investigation_id,kind,amount,public_ack,request_key) values(current_setting('test.uid')::uuid,current_setting('test.a')::uuid,'sparks',10,false,gen_random_uuid()),(current_setting('test.uid')::uuid,current_setting('test.a')::uuid,'thunder',1,false,gen_random_uuid()),(current_setting('test.uid')::uuid,current_setting('test.b')::uuid,'sparks',100,false,gen_random_uuid());
set local role anon;
do $$ declare results jsonb;begin
 results:=unmask_browse_investigations(current_setting('test.prefix'),'All','Most sparked',0);
 if jsonb_array_length(results)<>2 or results->0->>'id'<>current_setting('test.a') or (results->0->>'supporters')::int<>1 or (results->0->>'sparks')::int<>10 or (results->0->>'thunder')::int<>1 then raise exception 'Ranking or distinct supporter counting failed';end if;
 if results::text like '%request_key%' or results::text like '%public_ack%' then raise exception 'Contribution detail leaked';end if;
 if jsonb_array_length(unmask_browse_investigations(current_setting('test.prefix'),'All','Following',0))<>0 then raise exception 'Anonymous following result';end if;
 if jsonb_array_length(unmask_browse_investigations(current_setting('test.prefix'),'All','Recent',1))<>1 then raise exception 'Paging failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into unmask_subscriptions(user_id,target_type,target_id) values(auth.uid(),'investigation',current_setting('test.b'));
do $$ begin
 if not exists(select 1 from jsonb_array_elements(unmask_browse_investigations(current_setting('test.prefix'),'All','Following',0)) x where x->>'id'=current_setting('test.b')) then raise exception 'Followed investigation missing';end if;
end $$;
select 'PASS: combined Spark ranking, distinct supporters, safe anonymous totals, paging, investigation following' as result;
rollback;
