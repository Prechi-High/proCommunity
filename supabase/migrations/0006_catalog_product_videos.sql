-- Bind discovered social clips to the catalog product that requested them.
-- Seed IDs are slugs (not uuids), so product_id uuid was always null.

alter table public.video_cache
  add column if not exists catalog_product_id text;

create index if not exists video_cache_catalog_product
  on public.video_cache (catalog_product_id)
  where catalog_product_id is not null;

-- Same public URL may be relevant to more than one product.
drop index if exists video_cache_source_url;

create unique index if not exists video_cache_catalog_source
  on public.video_cache (catalog_product_id, source_url)
  where catalog_product_id is not null;

create unique index if not exists video_cache_unscoped_source
  on public.video_cache (source_url)
  where catalog_product_id is null;

-- Existing Serper finds were for The Ordinary Niacinamide 10% + Zinc 1%.
update public.video_cache
set catalog_product_id = 'niacinamide-10-zinc'
where catalog_product_id is null
  and source_platform <> 'youtube'
  and (
    search_query ilike '%Niacinamide 10% + Zinc 1%'
    or search_query ilike '%niacinamide%'
  );
