-- Verified owners: a member proves they own a specific product with a live in-app photo.
-- Ownership is per product, never a general badge. Writes go through edge functions (service role);
-- the proof photo lives in a private bucket and is never exposed publicly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verifications', 'verifications', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table if not exists public.owner_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  product_id text not null,
  product_name text not null,
  brand text,
  category text,
  product_image text,
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  confidence real,
  reason text,
  attempts int not null default 1,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (user_id, product_id)
);

create index if not exists owner_verifications_user on public.owner_verifications (user_id, status);
create index if not exists owner_verifications_recent on public.owner_verifications (user_id, last_attempt_at desc);
create index if not exists owner_verifications_product on public.owner_verifications (product_id) where status = 'verified';

alter table public.owner_verifications enable row level security;

drop policy if exists "members read own verifications" on public.owner_verifications;
create policy "members read own verifications" on public.owner_verifications
  for select using (auth.uid()::text = user_id);

alter table public.community_replies add column if not exists owner_product_id text;
alter table public.community_replies add column if not exists owner_product_name text;
alter table public.community_replies add column if not exists owner_product_image text;

alter table public.community_threads add column if not exists owner_product_id text;
alter table public.community_threads add column if not exists owner_product_name text;
alter table public.community_threads add column if not exists owner_product_image text;
alter table public.community_threads add column if not exists is_owner boolean not null default false;

create index if not exists community_replies_author on public.community_replies (author_id, created_at desc);
create index if not exists community_threads_author on public.community_threads (author_id, created_at desc);
