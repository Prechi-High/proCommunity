-- Run on a database with at least one existing auth user. All fixture writes roll back.
begin;
select set_config('test.social_user',(select id::text from auth.users limit 1),true),set_config('test.social_story',gen_random_uuid()::text,true);
insert into public.unmask_investigations(id,user_id,title,concern) values(current_setting('test.social_story')::uuid,current_setting('test.social_user')::uuid,'Rollback-only social test','Temporary database verification');
select set_config('request.jwt.claim.sub',current_setting('test.social_user'),true);
set local role authenticated;
insert into public.unmask_story_likes(target_kind,target_id,user_id) values('unmask',current_setting('test.social_story')::uuid,current_setting('test.social_user')::uuid);
insert into public.unmask_story_comments(investigation_id,user_id,body) values(current_setting('test.social_story')::uuid,current_setting('test.social_user')::uuid,'Temporary comment');
do $$begin
 if public.unmask_post_stats('unmask',current_setting('test.social_story')::uuid) <> '{"likes":1,"liked":true,"comments":1}'::jsonb then raise exception 'Counts mismatch';end if;
 begin
 insert into public.unmask_story_likes(target_kind,target_id,user_id) values('unmask',current_setting('test.social_story')::uuid,gen_random_uuid());
 raise exception 'Spoofed like allowed';exception when insufficient_privilege then null;end;
end$$;
delete from public.unmask_story_likes where target_id=current_setting('test.social_story')::uuid;
do $$begin if (public.unmask_post_stats('unmask',current_setting('test.social_story')::uuid)->>'likes')::int<>0 then raise exception 'Unlike failed';end if;end$$;
set local role anon;
do $$begin begin
 insert into public.unmask_story_comments(investigation_id,user_id,body) values(current_setting('test.social_story')::uuid,current_setting('test.social_user')::uuid,'Forbidden');
 raise exception 'Anonymous comment allowed';exception when insufficient_privilege then null;end;end$$;
select true as social_checks_passed;
rollback;
