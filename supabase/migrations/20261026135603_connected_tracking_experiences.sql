-- Restrictive policy preserves existing moderation and ownership rules.
create policy clarity_attachment_privacy on public.clarity_experiences as restrictive for select to anon,authenticated using(user_id=(select auth.uid()) or (visibility='public' and moderation_status='visible'));
alter table public.unmask_journeys add column usage_duration text,add column skin_type text,add column ownership_verified boolean not null default false;
alter table public.unmask_experience_updates add column usage_duration text,add column skin_type text,add column status_snapshot text;
revoke insert,update on public.unmask_journeys from authenticated;
grant insert(id,user_id,product_id,status,acquisition,started_on,stopped_on,frequency,goal,context,stop_reason,replacement_id,visibility,created_at,updated_at,usage_duration,skin_type),update(product_id,status,acquisition,started_on,stopped_on,frequency,goal,context,stop_reason,replacement_id,visibility,updated_at,usage_duration,skin_type) on public.unmask_journeys to authenticated;
create table public.unmask_ownership_proofs(id uuid primary key default gen_random_uuid(),journey_id uuid not null unique references public.unmask_journeys(id) on delete cascade,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,photo_path text not null,status text not null default 'pending' check(status in('pending','verified','rejected')),created_at timestamptz not null default now());
alter table public.unmask_ownership_proofs enable row level security;
revoke all on public.unmask_ownership_proofs from anon,authenticated;
grant select,insert(id,journey_id,user_id,photo_path),delete on public.unmask_ownership_proofs to authenticated;
grant update(status) on public.unmask_ownership_proofs to authenticated;
create policy ownership_read on public.unmask_ownership_proofs for select to authenticated using(user_id=(select auth.uid()) or public.cw_admin());
create policy ownership_insert on public.unmask_ownership_proofs for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and photo_path like auth.uid()::text||'/%' and exists(select 1 from public.unmask_journeys j where j.id=journey_id and j.user_id=auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='ownership-proofs' and o.name=photo_path));
create policy ownership_review on public.unmask_ownership_proofs for update to authenticated using(public.cw_admin()) with check(public.cw_admin());
create policy ownership_remove on public.unmask_ownership_proofs for delete to authenticated using(user_id=(select auth.uid()));
create index ownership_user on public.unmask_ownership_proofs(user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ownership-proofs','ownership-proofs',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy ownership_photo_insert on storage.objects for insert to authenticated with check(bucket_id='ownership-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy ownership_photo_read on storage.objects for select to authenticated using(bucket_id='ownership-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.cw_admin()));
create schema if not exists unmask_private;
revoke all on schema unmask_private from public,anon,authenticated;
create function unmask_private.sync_ownership() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.unmask_journeys set ownership_verified=case when TG_OP='DELETE' then false else new.status='verified' end where id=case when TG_OP='DELETE' then old.journey_id else new.journey_id end;
 return null;end$$;
revoke all on function unmask_private.sync_ownership() from public;
create trigger sync_ownership after insert or update or delete on public.unmask_ownership_proofs for each row execute function unmask_private.sync_ownership();
-- An update saves the current context and the observation in one transaction.
create function public.unmask_log_usage(p_journey uuid,p_id uuid,p_data jsonb) returns uuid language plpgsql security invoker set search_path='' as $$declare j public.unmask_journeys;begin
 select * into j from public.unmask_journeys where id=p_journey and user_id=auth.uid() for update;
 if j.id is null then raise exception 'Timeline unavailable';end if;
 if nullif(p_data->>'photo_path','') is not null and p_data->>'photo_path' not like auth.uid()::text||'/%' then raise exception 'Use your own photo';end if;
 if exists(select 1 from public.unmask_experience_updates where id=p_id and user_id=auth.uid()) then return p_id;end if;
 update public.unmask_journeys set status=coalesce(p_data->>'status',status),usage_duration=coalesce(p_data->>'duration',usage_duration),frequency=coalesce(p_data->>'frequency',frequency),skin_type=coalesce(p_data->>'skin_type',skin_type),stop_reason=nullif(p_data->>'reason',''),visibility=coalesce(p_data->>'visibility',visibility),updated_at=now() where id=p_journey;
 insert into public.unmask_experience_updates(id,journey_id,changed,unchanged,reaction,uncertainty,would_rebuy,photo_path,visibility,usage_duration,skin_type,status_snapshot) values(p_id,p_journey,p_data->>'body','','','',null,nullif(p_data->>'photo_path',''),coalesce(p_data->>'visibility',j.visibility),p_data->>'duration',coalesce(p_data->>'skin_type',j.skin_type),coalesce(p_data->>'status',j.status));
 return p_id;end$$;
revoke all on function public.unmask_log_usage(uuid,uuid,jsonb) from public;
grant execute on function public.unmask_log_usage(uuid,uuid,jsonb) to authenticated;
-- Attachments reference the live source; revoking its visibility revokes access.
alter table public.clarity_experiences add column attached_journey_id uuid references public.unmask_journeys(id) on delete set null,add column attached_experience_id uuid references public.clarity_experiences(id) on delete set null;
alter table public.clarity_experience_replies add column attached_journey_id uuid references public.unmask_journeys(id) on delete set null;
alter table public.unmask_answers add column attached_journey_id uuid references public.unmask_journeys(id) on delete set null;
alter table public.unmask_story_comments add column attached_journey_id uuid references public.unmask_journeys(id) on delete set null,add column attached_experience_id uuid references public.clarity_experiences(id) on delete set null;
grant insert(attached_journey_id,attached_experience_id) on public.unmask_story_comments to authenticated;
create function public.unmask_validate_attachment() returns trigger language plpgsql security invoker set search_path='' as $$declare is_public boolean;begin
 is_public:=true; if TG_TABLE_NAME='clarity_experiences' then is_public:=new.visibility='public';end if;
 if new.attached_journey_id is not null and not exists(select 1 from public.unmask_journeys j where j.id=new.attached_journey_id and ((j.user_id=auth.uid() and not is_public) or j.visibility='public')) then raise exception 'Make the timeline public before attaching it to a public conversation';end if;
 if new.attached_experience_id is not null and not exists(select 1 from public.clarity_experiences e where e.id=new.attached_experience_id and ((e.user_id=auth.uid() and not is_public) or (e.visibility='public' and e.moderation_status='visible'))) then raise exception 'Attach a public experience or keep your post private';end if;
 if TG_TABLE_NAME='clarity_experiences' and new.attached_experience_id=new.id then raise exception 'An experience cannot attach itself';end if;
 return new;end$$;
revoke all on function public.unmask_validate_attachment() from public;
grant execute on function public.unmask_validate_attachment() to authenticated;
create trigger validate_post_attachment before insert or update on public.clarity_experiences for each row execute function public.unmask_validate_attachment();
create trigger validate_reply_attachment before insert or update on public.clarity_experience_replies for each row execute function public.unmask_validate_attachment();
create trigger validate_answer_attachment before insert or update on public.unmask_answers for each row execute function public.unmask_validate_attachment();
create trigger validate_unmask_comment_attachment before insert or update on public.unmask_story_comments for each row execute function public.unmask_validate_attachment();
create index post_attached_journey on public.clarity_experiences(attached_journey_id);
create index post_attached_experience on public.clarity_experiences(attached_experience_id);
create index reply_attached_journey on public.clarity_experience_replies(attached_journey_id);
create index answer_attached_journey on public.unmask_answers(attached_journey_id);
create index comment_attached_journey on public.unmask_story_comments(attached_journey_id);
create index comment_attached_experience on public.unmask_story_comments(attached_experience_id);
create table public.unmask_tracking_reminders(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,journey_id uuid not null references public.unmask_journeys(id) on delete cascade,kind text not null check(kind in('log','routine')),cadence text not null check(cadence in('daily','weekly')),time_label text not null,time_zone text not null default 'UTC',next_at timestamptz not null,enabled boolean not null default true,unique(user_id,journey_id,kind));
alter table public.unmask_tracking_reminders enable row level security;
revoke all on public.unmask_tracking_reminders from anon,authenticated;
grant select,insert,update,delete on public.unmask_tracking_reminders to authenticated;
create policy own_tracking_reminders on public.unmask_tracking_reminders for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.unmask_journeys j where j.id=journey_id and j.user_id=auth.uid()));
create index reminder_due on public.unmask_tracking_reminders(next_at) where enabled;
create index reminder_journey on public.unmask_tracking_reminders(journey_id);
create function public.unmask_validate_reminder() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.time_label !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then raise exception 'Choose a valid local reminder time';end if;return new;end$$;
revoke all on function public.unmask_validate_reminder() from public;
grant execute on function public.unmask_validate_reminder() to authenticated;
create trigger validate_reminder before insert or update on public.unmask_tracking_reminders for each row execute function public.unmask_validate_reminder();
create function unmask_private.deliver_tracking_reminders() returns void language plpgsql security definer set search_path='' as $$declare r record;d date;begin
 for r in select m.*,j.status,c.name from public.unmask_tracking_reminders m join public.unmask_journeys j on j.id=m.journey_id join public.unmask_catalog c on c.id=j.product_id where m.enabled and m.next_at<=now() for update of m skip locked loop
 if r.status in('active','repurchased') then insert into public.unmask_activity(user_id,kind,title,body,route) values(r.user_id,'routine',case when r.kind='log' then 'A moment for your product update?' else 'Your routine, at your pace' end,r.name||case when r.kind='log' then ': add a note when you have something to share.' else ': continue when it suits you. Skipping a day is okay.' end,'/journey/'||r.journey_id::text);end if;
 d:=(now() at time zone r.time_zone)::date+case when r.cadence='weekly' then 7 else 1 end;
 update public.unmask_tracking_reminders set next_at=(d+r.time_label::time) at time zone r.time_zone where id=r.id;
 end loop;end$$;
revoke all on function unmask_private.deliver_tracking_reminders() from public,anon,authenticated;
select cron.schedule('unmask-tracking-reminders','*/5 * * * *','select unmask_private.deliver_tracking_reminders()');

create or replace function public.unmask_guard_experience_attachment() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.attached_experience_id is null then return new;end if;
 if not exists(select 1 from public.clarity_experiences e where e.id=new.attached_experience_id and e.visibility='public' and e.moderation_status='visible' and (e.user_id=auth.uid() or exists(select 1 from public.unmask_bookmarks b where b.user_id=auth.uid() and b.experience_id=e.id))) then raise exception 'Choose your public experience or a saved public experience';end if;
 return new;end$$;

-- Experiences may describe their actual duration (for example Week 2).
alter table public.clarity_experiences drop constraint clarity_experiences_duration_check;
alter table public.clarity_experiences add constraint clarity_experiences_duration_check check (length(trim(duration)) <= 100);
