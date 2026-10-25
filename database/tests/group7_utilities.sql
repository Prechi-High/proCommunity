begin;
select set_config('test.uid',(select id::text from profiles where not is_admin limit 1),true),set_config('test.case',gen_random_uuid()::text,true),set_config('test.bookmark',gen_random_uuid()::text,true),set_config('test.ticket',gen_random_uuid()::text,true);
insert into unmask_investigations(id,user_id,title) values(current_setting('test.case')::uuid,current_setting('test.uid')::uuid,'Utility privacy test investigation');
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into unmask_bookmarks(id,investigation_id) values(current_setting('test.bookmark')::uuid,current_setting('test.case')::uuid);
insert into unmask_support_requests(id,subject,message) values(current_setting('test.ticket')::uuid,'Privacy fixture','Private support test message');
insert into unmask_subscriptions(user_id,target_type,target_id) values(auth.uid(),'investigation',current_setting('test.case'));
do $$ declare n integer;begin
 update unmask_support_requests set status='resolved' where id=current_setting('test.ticket')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Member changed support status';end if;
end $$;
reset role;
update unmask_investigations set status='published' where id=current_setting('test.case')::uuid;
set local role authenticated;
do $$ begin
 if not exists(select 1 from unmask_activity where user_id=auth.uid() and route='/investigation/'||current_setting('test.case') and kind='investigation') then raise exception 'Investigation event missing';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from unmask_bookmarks where id=current_setting('test.bookmark')::uuid) then raise exception 'Bookmark leaked';end if;
 if exists(select 1 from unmask_support_requests where id=current_setting('test.ticket')::uuid) then raise exception 'Support request leaked';end if;
end $$;
select 'PASS: private bookmarks, private support requests, admin-only status, followed-investigation notifications' result;
rollback;
