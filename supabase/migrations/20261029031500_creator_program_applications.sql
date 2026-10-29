begin;

create table if not exists public.unmask_creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  handle text not null check (handle ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 280),
  specialties text[] not null default '{}',
  reason text not null default '' check (char_length(reason) <= 1200),
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists unmask_creator_applications_pending_user_idx
  on public.unmask_creator_applications(user_id) where status='pending';
create index if not exists unmask_creator_applications_status_idx
  on public.unmask_creator_applications(status, created_at desc);

alter table public.unmask_creator_applications enable row level security;

drop policy if exists creator_applications_insert_own on public.unmask_creator_applications;
create policy creator_applications_insert_own on public.unmask_creator_applications
  for insert to authenticated with check (user_id=(select auth.uid()));

drop policy if exists creator_applications_read_own on public.unmask_creator_applications;
create policy creator_applications_read_own on public.unmask_creator_applications
  for select to authenticated using (
    user_id=(select auth.uid())
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin)
  );

drop policy if exists creator_applications_admin_update on public.unmask_creator_applications;
create policy creator_applications_admin_update on public.unmask_creator_applications
  for update to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin))
  with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin));

grant select, insert, update on public.unmask_creator_applications to authenticated;

commit;
