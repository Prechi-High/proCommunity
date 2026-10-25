-- Fixtures, role changes, financial records and publications are all rolled back.
begin;
select set_config('test.uid',(select id::text from public.profiles where not is_admin limit 1),true),set_config('test.product',(select id from public.unmask_catalog limit 1),true),set_config('test.case',gen_random_uuid()::text,true),set_config('test.sub',gen_random_uuid()::text,true),set_config('test.exp',gen_random_uuid()::text,true),set_config('test.report',gen_random_uuid()::text,true),set_config('test.offer',gen_random_uuid()::text,true),set_config('test.earning',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
do $$ begin
 begin update public.profiles set is_admin=true where id=auth.uid();raise exception 'Member elevated role';exception when others then if sqlerrm<>'Team roles are managed on the server' then raise;end if;end;
 begin perform public.team_queue();raise exception 'Member accessed team RPC';exception when others then if sqlerrm<>'Team access required' then raise;end if;end;
end $$;
reset role;
insert into unmask_creators(user_id,display_name,handle) values(current_setting('test.uid')::uuid,'Editorial fixture','ed_'||md5(random()::text)) on conflict(user_id) do nothing;
insert into unmask_investigations(id,user_id,creator_id,product_id,title) values(current_setting('test.case')::uuid,current_setting('test.uid')::uuid,current_setting('test.uid')::uuid,current_setting('test.product'),'Editorial fixture investigation');
insert into unmask_creator_submissions(id,investigation_id,creator_id,request_key,title,summary,narrative,sources,response,disclosure,video_path) values(current_setting('test.sub')::uuid,current_setting('test.case')::uuid,current_setting('test.uid')::uuid,gen_random_uuid(),'Fixture title','Fixture summary','Fixture notes','Fixture sources','','Sponsored','fixture.mp4');
insert into clarity_experiences(id,user_id,product_id,duration,body,visibility) values(current_setting('test.exp')::uuid,current_setting('test.uid')::uuid,current_setting('test.product'),'1–4 weeks','A public moderation fixture','public');
insert into unmask_content_reports(id,reporter_id,target_kind,target_id,reason) values(current_setting('test.report')::uuid,current_setting('test.uid')::uuid,'experience',current_setting('test.exp')::uuid,'Fixture moderation report reason');
insert into unmask_offers(id,sponsor,title,product_id,kind,disclosure,status) values(current_setting('test.offer')::uuid,'Fixture sponsor','Fixture sponsored offer',current_setting('test.product'),'Store offer','Fixture paid placement disclosure','draft');
set local role anon;
do $$ begin if exists(select 1 from unmask_offers where id=current_setting('test.offer')::uuid) then raise exception 'Draft offer leaked';end if;end $$;
reset role;
update profiles set is_admin=true where id=current_setting('test.uid')::uuid;
set local role authenticated;
do $$ begin
 begin perform team_publish(current_setting('test.sub')::uuid,jsonb_build_object('video_url','https://example.com/video.mp4','findings','Fixture findings','uncertainty','Fixture uncertainty','sources','Fixture sources'));raise exception 'Unapproved publication';exception when others then if sqlerrm<>'Approve the submission first' then raise;end if;end;
 begin perform team_review(current_setting('test.sub')::uuid,'approved','Fixture editorial feedback','{}');raise exception 'Missing checklist accepted';exception when others then if sqlerrm<>'Complete all four review checks' then raise;end if;end;
 perform team_review(current_setting('test.sub')::uuid,'approved','Fixture editorial feedback','{"sources":true,"permissions":true,"uncertainty":true,"commercial":true}');
 perform team_publish(current_setting('test.sub')::uuid,jsonb_build_object('video_url','https://example.com/video.mp4','findings','Fixture findings','uncertainty','Fixture uncertainty','sources','Fixture sources'),null,true);
 if not exists(select 1 from unmask_investigations where id=current_setting('test.case')::uuid and status='published' and commercial_disclosure='Sponsored') then raise exception 'Publication or disclosure failed';end if;
 if not exists(select 1 from unmask_creator_publications where investigation_id=current_setting('test.case')::uuid and published_at is not null and commercial_disclosure='Sponsored') then raise exception 'Creator publication missing';end if;
 perform team_moderate(current_setting('test.report')::uuid,'remove','Fixture policy violation reason',true);
end $$;
insert into unmask_creator_earnings(id,creator_id,label,amount_kobo,status,funding_source,funding_reference) values(current_setting('test.earning')::uuid,current_setting('test.uid')::uuid,'Fixture earning',10000,'available','Founder subsidy','Fixture funded reference');
do $$ declare out_id uuid;begin
 out_id:=team_record_payout(current_setting('test.uid')::uuid,array[current_setting('test.earning')::uuid],'TEST-'||current_setting('test.earning'),null);
 if not exists(select 1 from unmask_creator_payouts where id=out_id and amount_kobo=10000) then raise exception 'Payout accounting failed';end if;
 begin perform team_record_payout(current_setting('test.uid')::uuid,array[current_setting('test.earning')::uuid],'SECOND-'||current_setting('test.earning'),null);raise exception 'Duplicate payout accepted';exception when others then if sqlerrm<>'Earnings are unavailable or already paid' then raise;end if;end;
end $$;
update unmask_offers set status='active' where id=current_setting('test.offer')::uuid;
reset role;
update profiles set is_admin=false where id=current_setting('test.uid')::uuid;
set local role authenticated;
do $$ begin
 begin update clarity_experiences set moderation_status='visible' where id=current_setting('test.exp')::uuid;raise exception 'Author reversed moderation';exception when others then if sqlerrm<>'Moderation is managed by the team' then raise;end if;end;
 if exists(select 1 from unmask_team_research) or exists(select 1 from unmask_team_audit) then raise exception 'Private team records leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if exists(select 1 from clarity_experiences where id=current_setting('test.exp')::uuid) then raise exception 'Removed content visible publicly';end if;
 if not exists(select 1 from unmask_offers where id=current_setting('test.offer')::uuid) then raise exception 'Active offer unavailable';end if;
end $$;
select 'PASS: admin-role protection, team RPC access, draft-offer privacy, review gating, publication/disclosure, moderation, payout accounting and duplicate protection' result;
rollback;
