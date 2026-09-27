-- Universal product intelligence memory.
-- The edge function `product-intelligence` writes with the service role; clients read only.

create table if not exists public.product_intel (
  id text primary key,
  query text not null,
  name text not null,
  brand text,
  category text,
  hero_image_url text,
  payload jsonb not null,
  confidence numeric,
  verified_at timestamptz not null default now(),
  refresh_after timestamptz not null default now() + interval '7 days'
);

create index if not exists product_intel_name_idx on public.product_intel using gin (to_tsvector('simple', coalesce(brand, '') || ' ' || name));

create table if not exists public.search_intel (
  query_key text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.product_intel enable row level security;
alter table public.search_intel enable row level security;

drop policy if exists "product_intel_public_read" on public.product_intel;
create policy "product_intel_public_read" on public.product_intel for select using (true);

drop policy if exists "search_intel_public_read" on public.search_intel;
create policy "search_intel_public_read" on public.search_intel for select using (true);
