begin;
alter table public.clarity_experiences add column if not exists goal text not null default '', add column if not exists frequency text not null default '', add column if not exists outcome text not null default 'Not stated' check (outcome in ('Not stated','Positive','Mixed','Negative'));
create table if not exists public.clarity_experience_followups (
 id uuid primary key default gen_random_uuid(), experience_id uuid not null references public.clarity_experiences on delete cascade,
 user_id uuid not null references auth.users on delete cascade, duration text not null, usage_status text not null,
 body text not null check(length(body) between 10 and 4000), created_at timestamptz not null default now()
);
create index if not exists clarity_experience_followups_parent_created on public.clarity_experience_followups(experience_id,created_at);
alter table public.clarity_experience_followups enable row level security;
drop policy if exists followups_read on public.clarity_experience_followups;
create policy followups_read on public.clarity_experience_followups for select to anon,authenticated using(exists(select 1 from public.clarity_experiences e where e.id=experience_id and (e.visibility='public' or e.user_id=(select auth.uid()))));
drop policy if exists followups_insert on public.clarity_experience_followups;
create policy followups_insert on public.clarity_experience_followups for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.clarity_experiences e where e.id=experience_id and e.user_id=(select auth.uid())));
drop policy if exists followups_delete on public.clarity_experience_followups;
create policy followups_delete on public.clarity_experience_followups for delete to authenticated using(user_id=(select auth.uid()));
create table if not exists public.clarity_experience_replies (
 id uuid primary key default gen_random_uuid(), experience_id uuid not null references public.clarity_experiences on delete cascade,
 user_id uuid not null references auth.users on delete cascade, author_name text not null, body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now()
);
create index if not exists clarity_experience_replies_parent_created on public.clarity_experience_replies(experience_id,created_at);
alter table public.clarity_experience_replies enable row level security;
drop policy if exists replies_read on public.clarity_experience_replies;
create policy replies_read on public.clarity_experience_replies for select to anon,authenticated using(exists(select 1 from public.clarity_experiences e where e.id=experience_id and (e.visibility='public' or e.user_id=(select auth.uid()))));
drop policy if exists replies_insert on public.clarity_experience_replies;
create policy replies_insert on public.clarity_experience_replies for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.clarity_experiences e where e.id=experience_id and (e.visibility='public' or e.user_id=(select auth.uid()))) and author_name=(select display_name from public.profiles where id=(select auth.uid())));
drop policy if exists replies_delete on public.clarity_experience_replies;
create policy replies_delete on public.clarity_experience_replies for delete to authenticated using(user_id=(select auth.uid()));
create table if not exists public.unmask_creators (
 user_id uuid primary key references public.profiles on delete cascade, display_name text not null, handle text unique not null,
 bio text not null default '', specialties text[] not null default '{}', avatar_url text, published boolean not null default false
);
alter table public.unmask_creators enable row level security;
drop policy if exists creators_read on public.unmask_creators;
create policy creators_read on public.unmask_creators for select to anon,authenticated using(published);
drop policy if exists creators_admin on public.unmask_creators;
create policy creators_admin on public.unmask_creators for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
create table if not exists public.unmask_creator_publications (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.unmask_creators on delete cascade,
 title text not null, product_id text, video_url text not null check(video_url ~ '^https://'), thumbnail_url text,
 published boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists unmask_creator_publications_parent_created on public.unmask_creator_publications(creator_id,created_at);
alter table public.unmask_creator_publications enable row level security;
drop policy if exists publications_read on public.unmask_creator_publications;
create policy publications_read on public.unmask_creator_publications for select to anon,authenticated using(published and exists(select 1 from public.unmask_creators c where c.user_id=creator_id and c.published));
drop policy if exists publications_admin on public.unmask_creator_publications;
create policy publications_admin on public.unmask_creator_publications for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
grant select on public.clarity_experience_followups,public.clarity_experience_replies,public.unmask_creators,public.unmask_creator_publications to anon,authenticated;
grant insert,delete on public.clarity_experience_followups,public.clarity_experience_replies to authenticated;
grant insert,update,delete on public.unmask_creators,public.unmask_creator_publications to authenticated;
alter table public.clarity_experiences add column if not exists photo_path text;
alter table public.clarity_experience_followups add column if not exists photo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-experiences','community-experiences',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists community_photo_upload on storage.objects;
create policy community_photo_upload on storage.objects for insert to authenticated with check(bucket_id='community-experiences' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists community_photo_read on storage.objects;
create policy community_photo_read on storage.objects for select to anon,authenticated using(bucket_id='community-experiences' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.clarity_experiences e where e.photo_path=name and e.visibility='public') or exists(select 1 from public.clarity_experience_followups f join public.clarity_experiences e on e.id=f.experience_id where f.photo_path=name and e.visibility='public')));
commit;
