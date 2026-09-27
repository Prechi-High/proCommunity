-- Shared community layer keyed on Product Intelligence slugs (text ids).
-- Writes go through the product-intelligence edge function (service role); the public can read.

create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_name text not null,
  product_image text,
  category text,
  kind text not null default 'question' check (kind in ('question', 'worry', 'experience', 'compare')),
  title text not null check (char_length(title) between 4 and 280),
  body text check (body is null or char_length(body) <= 2000),
  compare_id text,
  compare_name text,
  compare_image text,
  author_id text not null,
  author_name text not null,
  reply_count int not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists community_threads_product on public.community_threads (product_id, last_activity_at desc);
create index if not exists community_threads_compare on public.community_threads (compare_id) where compare_id is not null;
create index if not exists community_threads_recent on public.community_threads (last_activity_at desc);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  author_id text not null,
  author_name text not null,
  is_owner boolean not null default false,
  body text not null check (char_length(body) between 2 and 2000),
  helpful int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_replies_thread on public.community_replies (thread_id, created_at);

create table if not exists public.community_asks (
  id bigserial primary key,
  product_id text not null,
  product_name text,
  compare_id text,
  question text not null,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists community_asks_recent on public.community_asks (created_at desc);

create table if not exists public.product_events (
  id bigserial primary key,
  product_id text not null,
  name text,
  brand text,
  category text,
  image text,
  event text not null check (event in ('view', 'compare', 'ask', 'thread', 'save')),
  created_at timestamptz not null default now()
);

create index if not exists product_events_recent on public.product_events (created_at desc);
create index if not exists product_events_product on public.product_events (product_id, created_at desc);

alter table public.community_threads enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_asks enable row level security;
alter table public.product_events enable row level security;

drop policy if exists "public read community threads" on public.community_threads;
create policy "public read community threads" on public.community_threads for select using (true);
drop policy if exists "public read community replies" on public.community_replies;
create policy "public read community replies" on public.community_replies for select using (true);

create or replace function public.trending_products(days int default 7, cat text default null, lim int default 20)
returns table (
  product_id text,
  name text,
  brand text,
  category text,
  image text,
  views bigint,
  compares bigint,
  asks bigint,
  threads bigint,
  heat numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select
      e.product_id,
      max(e.name) as name,
      max(e.brand) as brand,
      max(e.category) as category,
      max(e.image) as image,
      count(*) filter (where e.event = 'view') as views,
      count(*) filter (where e.event = 'compare') as compares,
      count(*) filter (where e.event = 'ask') as asks,
      count(*) filter (where e.event = 'thread') as threads,
      sum(
        case e.event when 'view' then 1 when 'compare' then 2 when 'ask' then 3 when 'thread' then 4 else 1 end
        * exp(-extract(epoch from (now() - e.created_at)) / 259200.0)
      ) as heat
    from public.product_events e
    where e.created_at > now() - make_interval(days => days)
    group by e.product_id
  )
  select ev.product_id, ev.name, ev.brand, ev.category, ev.image, ev.views, ev.compares, ev.asks, ev.threads,
         round(ev.heat::numeric, 3) as heat
  from ev
  where cat is null or lower(ev.category) = lower(cat)
  order by ev.heat desc
  limit lim;
$$;

revoke all on function public.trending_products(int, text, int) from public;
grant execute on function public.trending_products(int, text, int) to service_role;
