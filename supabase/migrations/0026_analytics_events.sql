-- Site-level analytics (visits, searches). Writes via service-role edge function only.

create table if not exists public.analytics_events (
  id bigserial primary key,
  event text not null check (event in ('visit', 'search', 'session_start')),
  user_id uuid references public.profiles (id) on delete set null,
  visitor_key text,
  query text,
  path text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_created_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor_key, created_at desc)
  where visitor_key is not null;
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

alter table public.analytics_events enable row level security;

-- Admin reads via service role in edge functions only.

create or replace function public.admin_member_directory(lim int default 50)
returns table (
  user_id uuid,
  email text,
  display_name text,
  profile_created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    p.id,
    u.email::text,
    p.display_name,
    p.created_at,
    u.last_sign_in_at,
    p.is_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc
  limit greatest(1, least(lim, 200));
$$;

revoke all on function public.admin_member_directory(int) from public;
grant execute on function public.admin_member_directory(int) to service_role;
