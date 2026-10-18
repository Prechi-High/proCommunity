begin;
insert into auth.users(id,email) values ('3f700000-0000-4000-8000-000000000001','rls-fixture-a@example.invalid'),('3f700000-0000-4000-8000-000000000002','rls-fixture-b@example.invalid');
insert into profiles(id,display_name) values ('3f700000-0000-4000-8000-000000000001','Rollback fixture A'),('3f700000-0000-4000-8000-000000000002','Rollback fixture B') on conflict do nothing;
select set_config('request.jwt.claim.sub','3f700000-0000-4000-8000-000000000001',true);
set local role authenticated;
select unmask_register_product('rollback-security-test','Rollback security test','', 'skincare',null);
insert into unmask_journeys(id,product_id,acquisition,visibility,created_at) values ('3f710000-0000-4000-8000-000000000001','rollback-security-test','purchased','private','2020-01-01');
insert into unmask_experience_updates(journey_id,changed,visibility) values ('3f710000-0000-4000-8000-000000000001','An explicitly temporary transaction-only observation','public');
do $$ begin
if (select created_at::date<current_date from unmask_journeys where id='3f710000-0000-4000-8000-000000000001') then raise exception 'Client backdated observed history'; end if;
if (select count(*) from unmask_experience_feed where product_id='rollback-security-test')<>1 then raise exception 'Owner cannot read own history'; end if;
end $$;
select set_config('request.jwt.claim.sub','3f700000-0000-4000-8000-000000000002',true);
do $$ begin
if exists(select 1 from unmask_experience_feed where product_id='rollback-security-test') then raise exception 'PRIVATE JOURNEY LEAK'; end if;
end $$;
select set_config('request.jwt.claim.sub','3f700000-0000-4000-8000-000000000001',true);
update unmask_journeys set visibility='followers' where product_id='rollback-security-test';
select set_config('request.jwt.claim.sub','3f700000-0000-4000-8000-000000000002',true);
insert into unmask_subscriptions(user_id,target_type,target_id) values ('3f700000-0000-4000-8000-000000000002','person','3f700000-0000-4000-8000-000000000001');
do $$ begin
if (select count(*) from unmask_experience_feed where product_id='rollback-security-test')<>1 then raise exception 'Follower read failed'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
if exists(select 1 from unmask_experience_feed where product_id='rollback-security-test') then raise exception 'FOLLOWER DATA LEAK'; end if;
end $$;
reset role;
rollback;
select 'PASS: owner, follower and anonymous privacy; server-stamped documented history; fixtures rolled back' as result;
