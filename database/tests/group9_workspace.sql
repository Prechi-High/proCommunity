begin;
select set_config('test.uid',(select id::text from profiles where not is_admin limit 1),true),set_config('test.case',gen_random_uuid()::text,true),set_config('test.key',gen_random_uuid()::text,true);
insert into unmask_creators(user_id,display_name,handle) values(current_setting('test.uid')::uuid,'Workspace fixture','cw_'||md5(random()::text)) on conflict(user_id) do nothing;
insert into unmask_investigations(id,user_id,creator_id,title) values(current_setting('test.case')::uuid,current_setting('test.uid')::uuid,current_setting('test.uid')::uuid,'Private workspace fixture');
insert into unmask_creator_briefs(investigation_id,scope) values(current_setting('test.case')::uuid,'Private scope');
insert into unmask_creator_materials(investigation_id,label,kind,approved) values(current_setting('test.case')::uuid,'Approved fixture','Community account',true),(current_setting('test.case')::uuid,'Unapproved fixture','Community account',false);
insert into unmask_creator_earnings(creator_id,label,amount_kobo,status) values(current_setting('test.uid')::uuid,'Private earning fixture',10000,'pending');
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into unmask_creator_drafts(investigation_id,accepted,title,summary,sources,permissions_checked,commercial_checked,video_path) values(current_setting('test.case')::uuid,true,'A complete title','A complete summary for review','Fixture source',true,true,current_setting('test.uid')||'/'||current_setting('test.case')||'/fixture.mp4');
do $$ begin
 if (select count(*) from unmask_creator_materials where investigation_id=current_setting('test.case')::uuid)<>1 then raise exception 'Unapproved material exposed';end if;
 begin
 insert into unmask_creator_earnings(creator_id,label,amount_kobo,status) values(auth.uid(),'Forged earning',999999,'available');
 raise exception 'Creator minted earnings';exception when insufficient_privilege then null;end;
 begin
 perform unmask_submit_creator_video(current_setting('test.case')::uuid,current_setting('test.key')::uuid);
 raise exception 'Missing video accepted';exception when others then if sqlerrm<>'Upload a video for this assignment first' then raise;end if;end;
end $$;
reset role;
-- Metadata fixture only; no file is uploaded, and every row is rolled back.
insert into storage.objects(bucket_id,name) values('creator-videos',current_setting('test.uid')||'/'||current_setting('test.case')||'/fixture.mp4');
set local role authenticated;
do $$ declare a uuid;b uuid;n integer;begin
 a:=unmask_submit_creator_video(current_setting('test.case')::uuid,current_setting('test.key')::uuid);
 b:=unmask_submit_creator_video(current_setting('test.case')::uuid,current_setting('test.key')::uuid);
 if a<>b then raise exception 'Submission retry duplicated';end if;
 update unmask_creator_submissions set status='approved' where id=a;get diagnostics n=row_count;
 if n<>0 then raise exception 'Creator approved own submission';end if;
 begin
 perform unmask_submit_creator_video(current_setting('test.case')::uuid,gen_random_uuid());raise exception 'Duplicate pending submission accepted';
 exception when others then if sqlerrm<>'Your latest submission is already with Editorial' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from unmask_creator_drafts where investigation_id=current_setting('test.case')::uuid) or exists(select 1 from unmask_creator_briefs where investigation_id=current_setting('test.case')::uuid) or exists(select 1 from unmask_creator_earnings where creator_id=current_setting('test.uid')::uuid) then raise exception 'Private workspace leaked';end if;
 begin perform unmask_submit_creator_video(current_setting('test.case')::uuid,gen_random_uuid());raise exception 'Unassigned creator submitted';exception when others then if sqlerrm<>'This assignment is unavailable for submission' then raise;end if;end;
end $$;
select 'PASS: assignment isolation, approved-material filtering, earnings protection, submission validation and idempotency, editorial-only approval' result;
rollback;
