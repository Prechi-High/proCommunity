-- Independent published experiences must not expose the user's private shelf.
create table if not exists public.clarity_experiences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 product_id text not null references public.unmask_catalog(id), author_name text not null default 'Member',
 duration text not null check(duration in ('Less than a week','1–4 weeks','1–3 months','3+ months')),
 body text not null check(length(trim(body)) between 10 and 4000), uncertainty text not null default '',
 skin_type text check(skin_type in ('Dry','Oily','Combination','Normal','Sensitive')),
 context text not null default '', acquisition text not null default 'Bought personally',
 usage_status text not null default 'Still using', would_rebuy text not null default 'Not sure yet',
 visibility text not null default 'private' check(visibility in ('private','public')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.clarity_experiences enable row level security;
create policy clarity_experience_read on public.clarity_experiences for select to anon,authenticated using (visibility='public' or user_id=(select auth.uid()));
create policy clarity_experience_insert on public.clarity_experiences for insert to authenticated with check(user_id=(select auth.uid()));
create policy clarity_experience_update on public.clarity_experiences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy clarity_experience_delete on public.clarity_experiences for delete to authenticated using(user_id=(select auth.uid()));
grant select on public.clarity_experiences to anon,authenticated;
grant insert,update,delete on public.clarity_experiences to authenticated;
create index clarity_experiences_public on public.clarity_experiences(product_id,created_at desc) where visibility='public';
create index clarity_experiences_owner on public.clarity_experiences(user_id);
create table public.clarity_event_preferences (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 joined boolean not null default false, participation text not null default 'Share one experience',
 category text not null default 'Skincare', reminder text not null default 'None', updated_at timestamptz not null default now()
);
alter table public.clarity_event_preferences enable row level security;
create policy clarity_event_own on public.clarity_event_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.clarity_event_preferences to authenticated;
create table public.clarity_events (
 id uuid primary key default gen_random_uuid(), title text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 category text not null default 'Skincare', published boolean not null default false, check(ends_at>starts_at)
);
alter table public.clarity_events enable row level security;
create policy clarity_event_public on public.clarity_events for select to anon,authenticated using(published);
grant select on public.clarity_events to anon,authenticated;
-- No event or attendance is seeded. Scheduling is an explicit administrative act.
create table public.clarity_preferences (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 skin_type text, skin_public boolean not null default false, save_investigations boolean not null default true
);
alter table public.clarity_preferences enable row level security;
create policy clarity_preferences_own on public.clarity_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.clarity_preferences to authenticated;
create table public.clarity_product_completions (
 product_id text primary key, name text not null, brand text, category text, image_url text, first_completed_at timestamptz
);
alter table public.clarity_product_completions enable row level security;
create policy clarity_completions_public on public.clarity_product_completions for select to anon,authenticated using(true);
grant select on public.clarity_product_completions to anon,authenticated;
-- Privileged trigger is not a public RPC. Only trusted pipeline writes can mark completion.
create or replace function public.clarity_record_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='ready' then
 insert into public.clarity_product_completions(product_id,name,brand,category,image_url,first_completed_at)
 select p.id,p.name,p.brand,p.category,p.hero_image_url,now() from public.product_intel p
 where p.id=new.product_id and p.name<>'' and (jsonb_array_length(coalesce(p.payload->'sources','[]'::jsonb))>0)
 on conflict(product_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.clarity_record_completion() from public,anon,authenticated;
create trigger clarity_completion after insert or update of state on public.unmask_jobs for each row execute function public.clarity_record_completion();
-- Existing completed products have no trustworthy first-completion timestamp; do not invent one.
insert into public.clarity_product_completions(product_id,name,brand,category,image_url)
select p.id,p.name,p.brand,p.category,p.hero_image_url from public.product_intel p join public.unmask_jobs j on j.product_id=p.id
where j.state='ready' and p.name<>'' and jsonb_array_length(coalesce(p.payload->'sources','[]'::jsonb))>0 on conflict do nothing;
create view public.clarity_activity_summary with(security_invoker=true) as select count(*)::int unique_products,count(*) filter(where first_completed_at >= date_trunc('week',now()))::int new_this_week from public.clarity_product_completions;
grant select on public.clarity_activity_summary to anon,authenticated;
