begin;
alter table public.unmask_investigations add column commercial_disclosure text not null default '';
alter table public.unmask_creator_publications add column commercial_disclosure text not null default '';
alter table public.unmask_subscriptions drop constraint unmask_subscriptions_target_type_check;
alter table public.unmask_subscriptions add constraint unmask_subscriptions_target_type_check check(target_type in('product','person','routine','company','investigation','question'));
create or replace function public.team_publish(p_id uuid,p_data jsonb,p_when timestamptz default null,p_publish boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare s unmask_creator_submissions;v text:=p_data->>'video_url';begin
 if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'Team access required';end if;
 select * into s from unmask_creator_submissions where id=p_id and status='approved' for update;if not found then raise exception 'Approve the submission first';end if;
 perform 1 from unmask_investigations where id=s.investigation_id and creator_id=s.creator_id for update;if not found then raise exception 'Creator assignment changed';end if;
 if v is null or v !~ '^https://' or v like '%/object/sign/creator-videos%' or length(coalesce(p_data->>'findings',''))<10 or length(coalesce(p_data->>'sources',''))<5 or length(coalesce(p_data->>'uncertainty',''))<5 then raise exception 'Provide a permanent public video URL, findings, sources and uncertainty';end if;
 if p_publish and p_when>now() then raise exception 'Scheduled time has not arrived';end if;
 insert into unmask_publication_plans(submission_id,scheduled_for,payload,published_at) values(p_id,p_when,p_data,case when p_publish then now() end) on conflict(submission_id) do update set scheduled_for=excluded.scheduled_for,payload=excluded.payload,published_at=coalesce(excluded.published_at,unmask_publication_plans.published_at);
 if p_publish then
 update unmask_investigations set status='published',findings=p_data->>'findings',company_response=coalesce(p_data->>'company_response',''),uncertainty=p_data->>'uncertainty',sources=p_data->>'sources',video_url=v,commercial_disclosure=s.disclosure where id=s.investigation_id;
 insert into unmask_creator_publications(creator_id,title,product_id,video_url,thumbnail_url,published,investigation_id,commercial_disclosure) select s.creator_id,s.title,product_id,v,nullif(p_data->>'thumbnail_url',''),true,id,s.disclosure from unmask_investigations where id=s.investigation_id on conflict(investigation_id) do update set title=excluded.title,video_url=excluded.video_url,thumbnail_url=excluded.thumbnail_url,published=true,commercial_disclosure=excluded.commercial_disclosure;
 end if;
 insert into unmask_team_audit(actor_id,action,entity_id) values(auth.uid(),case when p_publish then 'Published investigation' else 'Saved publication plan' end,s.investigation_id);
end;$$;
commit;
