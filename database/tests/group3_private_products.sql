begin;
select set_config('test.uid',(select id::text from public.profiles where not is_admin limit 1),true),set_config('test.product',(select id from public.unmask_catalog limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into public.unmask_journeys(user_id,product_id,status,acquisition,visibility) values(auth.uid(),current_setting('test.product'),'active','purchased','private') on conflict(user_id,product_id) do update set visibility='private';
do $$ begin
 if not exists(select 1 from public.unmask_journeys where user_id=auth.uid() and product_id=current_setting('test.product')) then raise exception 'Own private record unavailable';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.unmask_journeys where user_id=current_setting('test.uid')::uuid and product_id=current_setting('test.product')) then raise exception 'Private product record leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if exists(select 1 from public.unmask_journeys where user_id=current_setting('test.uid')::uuid and product_id=current_setting('test.product')) then raise exception 'Anonymous private product access';end if;
end $$;
select 'PASS: own private product access, other-member isolation, anonymous isolation' result;
rollback;
