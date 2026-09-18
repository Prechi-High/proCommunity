-- Classified video discovery: taxonomy tags, LLM fields, helpful votes,
-- Wilson ranking, and a DB-side review flag (RLS cannot read Edge env).
-- VIDEO_REVIEW_ENABLED / app_flags.video_review_enabled MUST be true before
-- any real public user sees the app. Revisit daily refresh toward weekly
-- once out of testing.

create table if not exists public.category_tag_taxonomy (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  tag_key text not null,
  tag_label text not null,
  description text not null,
  sort_order int not null default 0,
  unique (category, tag_key)
);

alter table public.category_tag_taxonomy enable row level security;

drop policy if exists "public read taxonomy" on public.category_tag_taxonomy;
create policy "public read taxonomy"
  on public.category_tag_taxonomy
  for select
  using (true);

insert into public.category_tag_taxonomy (category, tag_key, tag_label, description, sort_order)
values
  (
    'skincare',
    'how_it_works',
    'How it works',
    'Explains the mechanism or science of the ingredient or product: what it does on the skin and why, without being mainly an application tutorial.',
    1
  ),
  (
    'skincare',
    'how_to_use',
    'How to use',
    'Shows or explains application method, order in a routine, frequency, amount, or layering with other products.',
    2
  ),
  (
    'skincare',
    'composition',
    'What it''s made of',
    'Ingredient breakdown, formulation, concentration, or what is in the bottle.',
    3
  ),
  (
    'skincare',
    'who_its_for',
    'Who it''s for',
    'Skin type or concern suitability: oily, dry, sensitive, acne-prone, who should or should not use it.',
    4
  ),
  (
    'skincare',
    'results_over_time',
    'Results over time',
    'Before/after, timelines, weeks of use, or visible change discussed as a journey rather than a single application.',
    5
  ),
  (
    'skincare',
    'precautions',
    'Precautions',
    'Side effects, patch-testing, irritation risk, interactions, or who should be careful. Not medical advice.',
    6
  ),
  (
    'skincare',
    'comparisons',
    'Comparisons',
    'Versus similar or alternative products, dupes, or which option to pick.',
    7
  )
on conflict (category, tag_key) do update
set
  tag_label = excluded.tag_label,
  description = excluded.description,
  sort_order = excluded.sort_order;

create table if not exists public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  note text
);

alter table public.app_flags enable row level security;

drop policy if exists "public read app flags" on public.app_flags;
create policy "public read app flags"
  on public.app_flags
  for select
  using (true);

insert into public.app_flags (key, enabled, note)
values (
  'video_review_enabled',
  false,
  'Temporary testing setting. Flip to true before public users. Pending video_cache rows then hide until approved.'
)
on conflict (key) do nothing;

alter table public.video_cache
  add column if not exists content_tags text[] not null default '{}',
  add column if not exists classification_confidence numeric,
  add column if not exists classification_method text,
  add column if not exists classification_justification text,
  add column if not exists helpful_count int not null default 0,
  add column if not exists not_helpful_count int not null default 0;

alter table public.video_cache drop constraint if exists video_cache_classification_method_check;
alter table public.video_cache
  add constraint video_cache_classification_method_check
  check (
    classification_method is null
    or classification_method in ('title_description', 'transcript')
  );

-- Record-keeping: new finds start pending. Visibility is gated by app_flags, not this default.
alter table public.video_cache
  alter column pending_review set default true;

create index if not exists video_cache_content_tags
  on public.video_cache using gin (content_tags);

create index if not exists video_cache_catalog_tags
  on public.video_cache (catalog_product_id)
  where catalog_product_id is not null;

create or replace function public.wilson_score(helpful int, not_helpful int)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(helpful, 0) + coalesce(not_helpful, 0) <= 0 then 0::numeric
    else (
      (
        (helpful::numeric / n)
        + (z * z) / (2 * n)
        - z * sqrt(
          ((helpful::numeric / n) * (1 - helpful::numeric / n) + (z * z) / (4 * n)) / n
        )
      ) / (1 + (z * z) / n)
    )
  end
  from (
    select
      1.96::numeric as z,
      (coalesce(helpful, 0) + coalesce(not_helpful, 0))::numeric as n
  ) params;
$$;

create or replace function public.list_tagged_videos(
  p_catalog text,
  p_tag text,
  p_limit int default 40
)
returns setof public.video_cache
language sql
stable
security invoker
as $$
  select *
  from public.video_cache
  where catalog_product_id = p_catalog
    and content_tags @> array[p_tag]
  order by
    public.wilson_score(helpful_count, not_helpful_count) desc,
    fetched_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 80));
$$;

grant execute on function public.list_tagged_videos(text, text, int) to anon, authenticated;

create table if not exists public.video_feedback (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.video_cache (id) on delete cascade,
  voter_key text not null,
  is_helpful boolean not null,
  created_at timestamptz not null default now(),
  unique (video_id, voter_key)
);

alter table public.video_feedback enable row level security;

drop policy if exists "public read own video feedback" on public.video_feedback;
create policy "public read own video feedback"
  on public.video_feedback
  for select
  using (true);

drop policy if exists "service writes video feedback" on public.video_feedback;
-- Votes go through the Edge Function (service role). No direct client writes.

create or replace function public.touch_video_helpful_counts()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_helpful then
      update public.video_cache set helpful_count = helpful_count + 1 where id = new.video_id;
    else
      update public.video_cache set not_helpful_count = not_helpful_count + 1 where id = new.video_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_helpful is distinct from new.is_helpful then
      if new.is_helpful then
        update public.video_cache
        set helpful_count = helpful_count + 1,
            not_helpful_count = greatest(0, not_helpful_count - 1)
        where id = new.video_id;
      else
        update public.video_cache
        set not_helpful_count = not_helpful_count + 1,
            helpful_count = greatest(0, helpful_count - 1)
        where id = new.video_id;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_helpful then
      update public.video_cache
      set helpful_count = greatest(0, helpful_count - 1)
      where id = old.video_id;
    else
      update public.video_cache
      set not_helpful_count = greatest(0, not_helpful_count - 1)
      where id = old.video_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists video_feedback_counts on public.video_feedback;
create trigger video_feedback_counts
after insert or update or delete on public.video_feedback
for each row execute function public.touch_video_helpful_counts();

drop policy if exists "public read approved videos" on public.video_cache;
create policy "public read approved videos"
  on public.video_cache
  for select
  using (
    pending_review = false
    or not exists (
      select 1 from public.app_flags
      where key = 'video_review_enabled' and enabled
    )
  );
