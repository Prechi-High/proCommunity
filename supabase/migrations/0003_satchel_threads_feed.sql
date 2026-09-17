-- Named threads, Discovery Feed photos, Satchel, YouTube comment bootstrap.

create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.community_posts
  add column if not exists thread_id uuid references public.discussion_threads (id) on delete set null;

alter table public.community_posts
  add column if not exists photo_path text;

alter table public.community_posts drop constraint if exists community_posts_type_check;
alter table public.community_posts
  add constraint community_posts_type_check
  check (type in ('question', 'answer', 'experience', 'update', 'feed_post'));

create table if not exists public.satchel_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  added_at timestamptz not null default now(),
  purchased boolean not null default false,
  purchased_at timestamptz,
  unique (user_id, product_id)
);

create table if not exists public.youtube_comments (
  id text primary key,
  product_id uuid references public.products (id) on delete cascade,
  youtube_video_id text not null,
  author_display_name text not null,
  body text not null,
  fetched_at timestamptz not null default now()
);

create index if not exists discussion_threads_product_id on public.discussion_threads (product_id);
create index if not exists community_posts_thread_id on public.community_posts (thread_id);
create index if not exists satchel_items_user_id on public.satchel_items (user_id);
create index if not exists youtube_comments_video on public.youtube_comments (youtube_video_id);

alter table public.discussion_threads enable row level security;
alter table public.satchel_items enable row level security;
alter table public.youtube_comments enable row level security;

create policy "public read threads" on public.discussion_threads for select using (true);
create policy "auth insert threads" on public.discussion_threads
  for insert to authenticated with check (auth.uid() = created_by);

create policy "own satchel" on public.satchel_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public read youtube comments" on public.youtube_comments for select using (true);
