-- Multi-platform video discovery. Web-search finds are inserted with
-- pending_review = true and stay hidden until a human approves them.
-- YouTube search.list rows are backfilled as already approved.

alter table public.video_cache
  alter column youtube_video_id drop not null;

alter table public.video_cache
  add column if not exists source_platform text,
  add column if not exists source_url text,
  add column if not exists embed_html text,
  add column if not exists channel_or_author text,
  add column if not exists duration_seconds int,
  add column if not exists pending_review boolean not null default true,
  add column if not exists approved_by uuid references public.profiles (id);

-- Existing YouTube cache came from search.list, not general web search.
update public.video_cache
set
  source_platform = coalesce(source_platform, 'youtube'),
  source_url = coalesce(
    source_url,
    case
      when youtube_video_id is not null then 'https://www.youtube.com/watch?v=' || youtube_video_id
      else null
    end
  ),
  channel_or_author = coalesce(channel_or_author, channel_title),
  pending_review = false
where youtube_video_id is not null;

delete from public.video_cache where source_url is null;

alter table public.video_cache
  alter column source_platform set not null,
  alter column source_url set not null;

alter table public.video_cache drop constraint if exists video_cache_source_platform_check;
alter table public.video_cache
  add constraint video_cache_source_platform_check
  check (source_platform in ('youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'));

create unique index if not exists video_cache_source_url
  on public.video_cache (source_url);

drop index if exists video_cache_query_video;
create unique index if not exists video_cache_query_video
  on public.video_cache (search_query, youtube_video_id)
  where search_query is not null and youtube_video_id is not null;

drop policy if exists "public read videos" on public.video_cache;
drop policy if exists "public read approved videos" on public.video_cache;
create policy "public read approved videos"
  on public.video_cache
  for select
  using (pending_review = false);
