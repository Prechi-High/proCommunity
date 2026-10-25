begin;
-- Account owners must never be able to grant themselves team privileges.
create function public.team_protect_admin_flag() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$begin
 if current_user not in('postgres','service_role','supabase_admin') then
 if tg_op='INSERT' then if new.is_admin then raise exception 'Team roles are managed on the server';end if;
 elsif new.is_admin is distinct from old.is_admin then raise exception 'Team roles are managed on the server';end if;
 end if;return new;end;$$;
revoke all on function public.team_protect_admin_flag() from public,anon,authenticated;
create trigger protect_admin_flag before insert or update of is_admin on public.profiles for each row execute function public.team_protect_admin_flag();
create table public.unmask_team_audit(id uuid primary key default gen_random_uuid(),actor_id uuid default auth.uid(),action text not null,entity_id uuid,payload jsonb not null default '{}',created_at timestamptz not null default now());
create table public.unmask_team_research(id uuid primary key default gen_random_uuid(),investigation_id uuid not null references public.unmask_investigations on delete cascade,kind text not null check(kind in('Interview','Source','Outreach','Permission')),label text not null check(length(label) between 2 and 150),notes text not null default '' check(length(notes)<=6000),scheduled_at timestamptz,status text not null default 'Pending',recording_consent boolean not null default false,publication_approved boolean not null default false,created_at timestamptz not null default now());
create table public.unmask_editorial_decisions(id uuid primary key default gen_random_uuid(),submission_id uuid not null references public.unmask_creator_submissions,reviewer_id uuid not null default auth.uid(),decision text not null check(decision in('approved','changes_requested')),checklist jsonb not null,feedback text not null,created_at timestamptz not null default now());
create table public.unmask_publication_plans(submission_id uuid primary key references public.unmask_creator_submissions,scheduled_for timestamptz,payload jsonb not null,published_at timestamptz);
alter table public.unmask_creator_publications add column investigation_id uuid unique references public.unmask_investigations;
alter table public.unmask_creator_earnings add column funding_source text check(funding_source in('Purchased support','Founder subsidy','Funded promotion')),add column funding_reference text;
create unique index creator_payout_reference_unique on public.unmask_creator_payouts(reference);
create table public.unmask_offers(id uuid primary key default gen_random_uuid(),sponsor text not null check(length(sponsor) between 2 and 120),title text not null check(length(title) between 3 and 200),product_id text not null references public.unmask_catalog,kind text not null check(kind in('Store offer','Sponsored investigation','Experience programme')),description text not null default '' check(length(description)<=3000),disclosure text not null check(length(trim(disclosure))>=10),terms text not null default '' check(length(terms)<=6000),store_url text check(store_url is null or store_url ~ '^https://'),status text not null default 'draft' check(status in('draft','active','paused')),starts_at timestamptz,expires_at timestamptz,created_at timestamptz not null default now(),check(expires_at is null or starts_at is null or expires_at>starts_at));
create table public.unmask_offer_internal(offer_id uuid primary key references public.unmask_offers on delete cascade,notes text not null default '',funding_reference text not null default '');
create table public.unmask_content_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null default auth.uid() references auth.users,target_kind text not null check(target_kind in('experience','reply','question')),target_id uuid not null,reason text not null check(length(reason) between 10 and 1000),status text not null default 'open' check(status in('open','in_review','resolved')),decision text,decision_reason text,created_at timestamptz not null default now(),unique(reporter_id,target_kind,target_id));
do $$ declare t text;begin foreach t in array array['unmask_team_audit','unmask_team_research','unmask_editorial_decisions','unmask_publication_plans','unmask_offers','unmask_offer_internal','unmask_content_reports'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy team_all on public.%I for all to authenticated using(public.cw_admin()) with check(public.cw_admin())',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);end loop;end $$;
-- Audit/decisions are append-only through the protected server operations.
revoke insert,update,delete on public.unmask_team_audit,public.unmask_editorial_decisions,public.unmask_publication_plans from authenticated;
create policy active_offers on public.unmask_offers for select to anon,authenticated using(status='active' and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()));
grant select on public.unmask_offers to anon;
create policy reports_own on public.unmask_content_reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy report_public_content on public.unmask_content_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and status='open' and decision is null and decision_reason is null and ((target_kind='experience' and exists(select 1 from public.clarity_experiences e where e.id=target_id and e.visibility='public')) or (target_kind='reply' and exists(select 1 from public.clarity_experience_replies r join public.clarity_experiences e on e.id=r.experience_id where r.id=target_id and e.visibility='public')) or (target_kind='question' and exists(select 1 from public.unmask_questions q where q.id=target_id and q.routine_id is null))));
create policy finance_contributions_read on public.unmask_spark_contributions for select to authenticated using(public.cw_admin());
alter table public.clarity_experiences add column moderation_status text not null default 'visible' check(moderation_status in('visible','removed'));
alter table public.clarity_experience_replies add column moderation_status text not null default 'visible' check(moderation_status in('visible','removed'));
alter table public.unmask_questions add column moderation_status text not null default 'visible' check(moderation_status in('visible','removed'));
create function public.team_protect_moderation() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$begin
 if current_user not in('postgres','service_role','supabase_admin') and not public.cw_admin() then
 if tg_op='INSERT' then if new.moderation_status<>'visible' then raise exception 'Moderation is managed by the team';end if;
 elsif new.moderation_status is distinct from old.moderation_status then raise exception 'Moderation is managed by the team';end if;end if;return new;end;$$;
revoke all on function public.team_protect_moderation() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['clarity_experiences','clarity_experience_replies','unmask_questions'] loop
 execute format('create policy moderation_anon on public.%I as restrictive for select to anon using(moderation_status=''visible'')',t);
 execute format('create policy moderation_member on public.%I as restrictive for select to authenticated using(moderation_status=''visible'' or user_id=auth.uid() or public.cw_admin())',t);
 execute format('create trigger protect_moderation before insert or update of moderation_status on public.%I for each row execute function public.team_protect_moderation()',t);
end loop;end $$;
create function public.team_queue(p_status text default 'requested',p_sort text default 'Most sparked',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select i.*,p.name product_name,p.image_url product_image,coalesce(t.sparks,0) sparks,coalesce(t.thunder,0) thunder,coalesce(t.supporters,0) supporters,coalesce(d.accepted,false) accepted from unmask_investigations i left join unmask_catalog p on p.id=i.product_id left join unmask_creator_drafts d on d.investigation_id=i.id and d.creator_id=i.creator_id left join (select investigation_id,sum(amount) filter(where kind='sparks') sparks,sum(amount) filter(where kind='thunder') thunder,count(distinct user_id) supporters from unmask_spark_contributions group by investigation_id)t on t.investigation_id=i.id where i.status=p_status order by case when p_sort='Most sparked' then coalesce(t.sparks,0)+100*coalesce(t.thunder,0) end desc nulls last,i.created_at desc,i.id limit 30 offset greatest(0,coalesce(p_offset,0)))x);
end;$$;
create function public.team_review(p_id uuid,p_decision text,p_feedback text,p_checks jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare s unmask_creator_submissions;latest_id uuid;begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 if p_decision not in('approved','changes_requested') or length(trim(p_feedback))<10 or length(p_feedback)>500 then raise exception 'Choose a decision and give feedback (10–500 characters)';end if;
 select * into s from unmask_creator_submissions where id=p_id for update;if not found then raise exception 'Submission unavailable';end if;
 perform 1 from unmask_investigations where id=s.investigation_id and creator_id=s.creator_id and status<>'published' for update;if not found then raise exception 'Assignment changed or is already published';end if;
 select id into latest_id from unmask_creator_submissions where investigation_id=s.investigation_id and creator_id=s.creator_id order by created_at desc,id desc limit 1;if latest_id<>p_id then raise exception 'Review the latest submission';end if;
 if p_decision='approved' and not(coalesce(p_checks->>'sources','false')='true' and coalesce(p_checks->>'permissions','false')='true' and coalesce(p_checks->>'uncertainty','false')='true' and coalesce(p_checks->>'commercial','false')='true') then raise exception 'Complete all four review checks';end if;
 update unmask_creator_submissions set status=p_decision,feedback=p_feedback where id=p_id;
 insert into unmask_editorial_decisions(submission_id,reviewer_id,decision,checklist,feedback) values(p_id,auth.uid(),p_decision,coalesce(p_checks,'{}'),p_feedback);
 insert into unmask_team_audit(actor_id,action,entity_id) values(auth.uid(),'Review: '||p_decision,p_id);
 insert into unmask_activity(user_id,kind,title,body,route) values(s.creator_id,'investigation','Editorial reviewed your submission',p_feedback,'/creator/submit?id='||s.investigation_id);
end;$$;
create function public.team_publish(p_id uuid,p_data jsonb,p_when timestamptz default null,p_publish boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare s unmask_creator_submissions;v text:=p_data->>'video_url';begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 select * into s from unmask_creator_submissions where id=p_id and status='approved' for update;if not found then raise exception 'Approve the submission first';end if;
 perform 1 from unmask_investigations where id=s.investigation_id and creator_id=s.creator_id for update;if not found then raise exception 'Creator assignment changed';end if;
 if v is null or v !~ '^https://' or v like '%/object/sign/creator-videos%' or length(coalesce(p_data->>'findings',''))<10 or length(coalesce(p_data->>'sources',''))<5 or length(coalesce(p_data->>'uncertainty',''))<5 then raise exception 'Provide a permanent public video URL, findings, sources and uncertainty';end if;
 if p_publish and p_when>now() then raise exception 'Scheduled time has not arrived';end if;
 insert into unmask_publication_plans(submission_id,scheduled_for,payload,published_at) values(p_id,p_when,p_data,case when p_publish then now() end) on conflict(submission_id) do update set scheduled_for=excluded.scheduled_for,payload=excluded.payload,published_at=coalesce(excluded.published_at,unmask_publication_plans.published_at);
 if p_publish then
 update unmask_investigations set status='published',findings=p_data->>'findings',company_response=coalesce(p_data->>'company_response',''),uncertainty=p_data->>'uncertainty',sources=p_data->>'sources',video_url=v where id=s.investigation_id;
 insert into unmask_creator_publications(creator_id,title,product_id,video_url,thumbnail_url,published,investigation_id) select s.creator_id,s.title,product_id,v,nullif(p_data->>'thumbnail_url',''),true,id from unmask_investigations where id=s.investigation_id on conflict(investigation_id) do update set title=excluded.title,video_url=excluded.video_url,thumbnail_url=excluded.thumbnail_url,published=true;
 end if;
 insert into unmask_team_audit(actor_id,action,entity_id) values(auth.uid(),case when p_publish then 'Published investigation' else 'Saved publication plan' end,s.investigation_id);
end;$$;
create function public.team_moderate(p_id uuid,p_decision text,p_reason text,p_notify boolean default true) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare r unmask_content_reports;owner_id uuid;begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 if p_decision not in('keep','clarify','remove') or length(trim(p_reason))<10 then raise exception 'Choose an action and explain the reason';end if;
 select * into r from unmask_content_reports where id=p_id for update;if not found then raise exception 'Report unavailable';end if;
 if r.target_kind='experience' then select user_id into owner_id from clarity_experiences where id=r.target_id;if p_decision='remove' then update clarity_experiences set moderation_status='removed' where id=r.target_id;end if;
 elsif r.target_kind='reply' then select user_id into owner_id from clarity_experience_replies where id=r.target_id;if p_decision='remove' then update clarity_experience_replies set moderation_status='removed' where id=r.target_id;end if;
 else select user_id into owner_id from unmask_questions where id=r.target_id;if p_decision='remove' then update unmask_questions set moderation_status='removed' where id=r.target_id;end if;end if;
 update unmask_content_reports set status=case when p_decision='clarify' then 'in_review' else 'resolved' end,decision=p_decision,decision_reason=p_reason where id=p_id;
 if p_notify and owner_id is not null then insert into unmask_activity(user_id,kind,title,body,route) values(owner_id,'moderation','An update about reported content',p_reason,'/notifications');end if;
 insert into unmask_team_audit(actor_id,action,entity_id,payload) values(auth.uid(),'Moderation: '||p_decision,p_id,jsonb_build_object('reason',p_reason));
end;$$;
create function public.team_record_payout(p_creator uuid,p_earnings uuid[],p_reference text,p_receipt text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare total bigint;n integer;out_id uuid;begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 if length(trim(p_reference))<5 or p_earnings is null or cardinality(p_earnings)=0 then raise exception 'Select available earnings and provide an external payout reference';end if;
 perform 1 from unmask_creator_earnings where id=any(p_earnings) for update;
 select sum(amount_kobo),count(*) into total,n from unmask_creator_earnings where id=any(p_earnings) and creator_id=p_creator and status='available';
 if n<>(select count(distinct x) from unnest(p_earnings)x) or coalesce(total,0)<=0 then raise exception 'Earnings are unavailable or already paid';end if;
 insert into unmask_creator_payouts(creator_id,amount_kobo,paid_at,reference,receipt_url) values(p_creator,total,now(),trim(p_reference),nullif(p_receipt,'')) returning id into out_id;
 update unmask_creator_earnings set status='paid' where id=any(p_earnings);
 insert into unmask_team_audit(actor_id,action,entity_id,payload) values(auth.uid(),'Recorded external payout',out_id,jsonb_build_object('amount_kobo',total,'reference',p_reference));return out_id;
end;$$;
revoke all on function public.team_queue(text,text,integer),public.team_review(uuid,text,text,jsonb),public.team_publish(uuid,jsonb,timestamptz,boolean),public.team_moderate(uuid,text,text,boolean),public.team_record_payout(uuid,uuid[],text,text) from public,anon;
grant execute on function public.team_queue(text,text,integer),public.team_review(uuid,text,text,jsonb),public.team_publish(uuid,jsonb,timestamptz,boolean),public.team_moderate(uuid,text,text,boolean),public.team_record_payout(uuid,uuid[],text,text) to authenticated;
commit;
