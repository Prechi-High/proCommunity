-- Pulse: the social layer for products — posts with photos, votes, follows (bells), notifications.
-- Writes go through the product-intelligence edge function (service role); the public can read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('scans', 'scans', true, 6291456, array['image/jpeg', 'image/png', 'image/webp']),
  ('community', 'community', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

alter table public.community_threads drop constraint if exists community_threads_kind_check;
alter table public.community_threads
  add constraint community_threads_kind_check check (kind in ('question', 'worry', 'experience', 'compare', 'tip', 'review'));

alter table public.community_threads add column if not exists image_url text;
alter table public.community_threads add column if not exists rating smallint check (rating is null or rating between 1 and 5);
alter table public.community_threads add column if not exists votes int not null default 0;
alter table public.community_threads add column if not exists follower_count int not null default 0;
alter table public.community_threads add column if not exists brand text;

create index if not exists community_threads_votes on public.community_threads (votes desc, created_at desc);

create table if not exists public.community_votes (
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  member_id text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, member_id)
);

create table if not exists public.community_follows (
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  member_id text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, member_id)
);

create index if not exists community_follows_member on public.community_follows (member_id, created_at desc);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  actor_name text not null,
  kind text not null default 'reply' check (kind in ('reply', 'owner_reply', 'vote')),
  snippet text,
  thread_title text,
  product_name text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists community_notifications_member on public.community_notifications (member_id, created_at desc);

alter table public.community_votes enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_notifications enable row level security;
