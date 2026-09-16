-- Sourced V1 schema. RLS on every table. Apply with supabase db push or the SQL editor.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  skin_type text not null default 'unknown'
    check (skin_type in ('dry', 'oily', 'combination', 'sensitive', 'normal', 'unknown')),
  skin_type_source text check (skin_type_source in ('self_selected', 'quiz_estimated')),
  concerns text[] not null default '{}',
  country text,
  notification_prefs jsonb not null default '{}'::jsonb,
  brand_drops_opt_in boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null,
  inferred_skin_type text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  description text not null default '',
  category text not null,
  ingredients text[] not null default '{}',
  attribute_tags text[] not null default '{}',
  suits_skin_types text[] not null default '{}',
  hero_image_url text,
  typical_duration_days int,
  shelf_life_months int,
  source text not null check (source in ('seed', 'shopify')),
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  shopify_shop_domain text unique not null,
  shop_name text not null,
  access_token_encrypted text not null,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  shopify_product_id text,
  shopify_variant_id text,
  price numeric(10, 2) not null,
  currency text not null default 'NGN',
  in_stock boolean not null default true,
  product_url text not null,
  opted_out boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  price numeric(10, 2) not null,
  recorded_at timestamptz not null default now()
);

create table public.literacy_entries (
  id uuid primary key default gen_random_uuid(),
  attribute_tag text unique not null,
  title text not null,
  body text not null,
  source_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.confidence_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  fit_match_score int not null,
  sentiment_score int,
  transparency_score int not null,
  composite_score int,
  computed_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.ownerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  marked_purchased_at timestamptz not null default now(),
  eligible_to_post_at timestamptz not null,
  is_verified boolean not null default false,
  unique (user_id, product_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_post_id uuid references public.community_posts (id) on delete set null,
  type text not null check (type in ('question', 'answer', 'experience', 'update')),
  body text not null,
  trait_tags text[] not null default '{}',
  is_verified_owner boolean not null default false,
  helpful_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'flagged', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_votes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.reputation (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_tag text not null,
  score int not null default 0,
  contribution_count int not null default 0,
  primary key (user_id, category_tag)
);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  time_of_day text not null check (time_of_day in ('am', 'pm')),
  reminder_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  product_id uuid not null references public.products (id),
  step_order int not null
);

create table public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  log_date date not null,
  completed_step_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, routine_id, log_date)
);

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_logged_date date
);

create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  photo_path text,
  note text,
  entry_date date not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  price_alert_enabled boolean not null default true,
  last_notified_price numeric(10, 2),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.usage_estimates (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  started_at timestamptz not null,
  estimated_empty_date date,
  expiry_date date,
  primary key (user_id, product_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.video_cache (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  attribute_tag text,
  youtube_video_id text not null,
  title text,
  channel_title text,
  thumbnail_url text,
  fetched_at timestamptz not null default now()
);

create index products_name_trgm on public.products using gin (name gin_trgm_ops);
create index listings_product_id on public.listings (product_id);
create index community_posts_product_id on public.community_posts (product_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'products', 'listings', 'literacy_entries', 'community_posts',
    'routines', 'progress_entries', 'favorites'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.quiz_responses enable row level security;
alter table public.products enable row level security;
alter table public.merchants enable row level security;
alter table public.listings enable row level security;
alter table public.price_history enable row level security;
alter table public.literacy_entries enable row level security;
alter table public.confidence_scores enable row level security;
alter table public.ownerships enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_votes enable row level security;
alter table public.reputation enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;
alter table public.routine_logs enable row level security;
alter table public.streaks enable row level security;
alter table public.progress_entries enable row level security;
alter table public.favorites enable row level security;
alter table public.usage_estimates enable row level security;
alter table public.notifications enable row level security;
alter table public.video_cache enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own quiz" on public.quiz_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public read products" on public.products for select using (true);
create policy "public read listings" on public.listings for select using (opted_out = false);
create policy "public read literacy" on public.literacy_entries for select using (true);
create policy "public read videos" on public.video_cache for select using (true);
create policy "public read visible posts" on public.community_posts
  for select using (status = 'visible' or user_id = auth.uid());
create policy "auth insert posts" on public.community_posts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own update posts" on public.community_posts
  for update using (auth.uid() = user_id);

create policy "own routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine logs" on public.routine_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own favorites" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own usage" on public.usage_estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own progress" on public.progress_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "shared progress read" on public.progress_entries
  for select using (is_shared = true);

create policy "own ownerships" on public.ownerships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scores" on public.confidence_scores
  for select using (auth.uid() = user_id);
create policy "own votes" on public.post_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public reputation" on public.reputation for select using (true);
create policy "own reports" on public.moderation_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

-- merchants: no client policies. service role only.
