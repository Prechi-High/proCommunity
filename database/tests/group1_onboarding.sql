-- No users, preferences or messages persist after this check.
begin;
select set_config('test.uid',(select id::text from profiles limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into clarity_preferences(user_id,interests,sensitive_skin,onboarding_completed_at)
values(auth.uid(),array['Skincare','Electronics'],true,now())
on conflict(user_id) do update set interests=excluded.interests,sensitive_skin=true,onboarding_completed_at=now();
do $$ begin
 if not exists(select 1 from clarity_preferences where user_id=auth.uid() and sensitive_skin and cardinality(interests)=2 and onboarding_completed_at is not null) then raise exception 'Own setup not saved';end if;
 begin update clarity_preferences set interests=array['Unknown category'] where user_id=auth.uid();raise exception 'Invalid interests accepted';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 if exists(select 1 from clarity_preferences where user_id=current_setting('test.uid')::uuid) then raise exception 'Another account read private context';end if;
 update clarity_preferences set sensitive_skin=false where user_id=current_setting('test.uid')::uuid;
 if found then raise exception 'Another account changed context';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
 if exists(select 1 from clarity_preferences where user_id=current_setting('test.uid')::uuid) then raise exception 'Anonymous context leak';end if;
 exception when insufficient_privilege then null;end;
end $$;
rollback;
