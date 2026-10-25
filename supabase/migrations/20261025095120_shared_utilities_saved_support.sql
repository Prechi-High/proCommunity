begin;
create table public.unmask_bookmarks(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,investigation_id uuid references public.unmask_investigations on delete cascade,experience_id uuid references public.clarity_experiences on delete cascade,created_at timestamptz not null default now(),check(num_nonnulls(investigation_id,experience_id)=1),unique(user_id,investigation_id),unique(user_id,experience_id));
alter table public.unmask_bookmarks enable row level security;
create policy bookmark_read on public.unmask_bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy bookmark_insert on public.unmask_bookmarks for insert to authenticated with check(user_id=(select auth.uid()) and (experience_id is null or exists(select 1 from public.clarity_experiences e where e.id=experience_id)));
create policy bookmark_delete on public.unmask_bookmarks for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,delete on public.unmask_bookmarks to authenticated;
create table public.unmask_support_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,subject text not null check(length(subject) between 2 and 100),reference text not null default '' check(length(reference)<=100),message text not null check(length(message) between 10 and 500),status text not null default 'open' check(status in('open','resolved')),created_at timestamptz not null default now());
alter table public.unmask_support_requests enable row level security;
create policy support_own_read on public.unmask_support_requests for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
create policy support_own_insert on public.unmask_support_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='open');
create policy support_admin_update on public.unmask_support_requests for update to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
grant select,insert,update on public.unmask_support_requests to authenticated;
-- In-app events only, no external message delivery.
create function public.unmask_utility_events() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='unmask_investigations' then
 if old.status is distinct from new.status then
 insert into unmask_activity(user_id,kind,title,body,route) select distinct s.user_id,'investigation',case when new.status='published' then 'An investigation you follow was published' else 'An investigation you follow has an update' end,new.title,'/investigation/'||new.id from unmask_subscriptions s where s.target_type='investigation' and s.target_id=new.id::text;
 end if;
 elsif tg_table_name='unmask_subscriptions' then
 if new.target_type='person' and new.target_id<>new.user_id::text then
 insert into unmask_activity(user_id,kind,title,route) select p.id,'person','Someone followed you','/member/'||new.user_id from profiles p where p.id::text=new.target_id;
 end if;
 elsif tg_table_name='clarity_experience_replies' then
 insert into unmask_activity(user_id,kind,title,body,route) select e.user_id,'reply','Someone replied to your experience',left(new.body,180),'/contribute?experience='||e.id from clarity_experiences e where e.id=new.experience_id and e.user_id<>new.user_id;
 end if;
 return new;
end;$$;
revoke all on function public.unmask_utility_events() from public,anon,authenticated;
create trigger investigation_activity after update of status on public.unmask_investigations for each row execute function public.unmask_utility_events();
create trigger person_follow_activity after insert on public.unmask_subscriptions for each row execute function public.unmask_utility_events();
create trigger experience_reply_activity after insert on public.clarity_experience_replies for each row execute function public.unmask_utility_events();
commit;
