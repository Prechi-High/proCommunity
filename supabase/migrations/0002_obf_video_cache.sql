-- Allow Open Beauty Facts as a catalog source and cache YouTube by search query.

alter table public.products drop constraint if exists products_source_check;
alter table public.products
  add constraint products_source_check
  check (source in ('seed', 'shopify', 'open_beauty_facts'));

alter table public.video_cache
  add column if not exists search_query text;

create unique index if not exists video_cache_query_video
  on public.video_cache (search_query, youtube_video_id)
  where search_query is not null;
