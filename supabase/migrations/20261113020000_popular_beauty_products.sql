-- Aggregated beauty picks for ask-before-you-buy. Search counts come from analytics_events (not client-readable).
create or replace function public.unmask_popular_beauty_products(p_limit int default 12)
returns table (
  id text,
  name text,
  brand text,
  category text,
  image_url text,
  search_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with beauty as (
    select c.*
    from public.unmask_catalog c
    where lower(coalesce(c.category, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(c.brand, '')) ~
      '(beauty|skin|cosmetic|cream|serum|lotion|oil|soap|shampoo|conditioner|makeup|fragrance|perfume|sunscreen|cleanser|toner|moistur|hair|body care|personal care|caro|carotone)'
      and lower(coalesce(c.category, '')) !~ '(electronics|laptop|smartphone|appliances|grocery|dairy|alcoholic|pantry|kitchen|computer|tv|phone)'
      and c.id !~ '^(minute-|modal-|atomic-|nano-|siliconflow-|__)'
  ),
  searches as (
    select lower(trim(query)) as q, count(*)::bigint as n
    from public.analytics_events
    where event = 'search' and query is not null and length(trim(query)) >= 2
    group by 1
  ),
  scored as (
    select
      b.id,
      b.name,
      b.brand,
      b.category,
      b.image_url,
      coalesce(
        (
          select max(s.n)
          from searches s
          where position(s.q in lower(b.name || ' ' || coalesce(b.brand, ''))) > 0
             or position(s.q in lower(coalesce(b.brand, '') || ' ' || b.name)) > 0
             or (length(s.q) >= 4 and position(s.q in lower(b.name)) > 0)
        ),
        0::bigint
      ) as search_count
    from beauty b
  )
  select id, name, brand, category, image_url, search_count
  from scored
  order by search_count desc, lower(name)
  limit greatest(1, least(coalesce(p_limit, 12), 24));
$$;

revoke all on function public.unmask_popular_beauty_products(int) from public;
grant execute on function public.unmask_popular_beauty_products(int) to anon, authenticated;
