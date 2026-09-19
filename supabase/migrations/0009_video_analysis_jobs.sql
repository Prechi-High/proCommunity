-- Background analysis jobs for captions-first classification with ASR fallback.
-- Extends video_cache; does not duplicate it as a second videos table.
-- Catalog products remain slug ids on catalog_product_id (no new products table).

alter table public.video_cache
  add column if not exists description text,
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists transcript_available boolean not null default false,
  add column if not exists transcript_source text,
  add column if not exists last_analyzed_at timestamptz,
  add column if not exists analysis_metrics jsonb not null default '{}'::jsonb;

alter table public.video_cache drop constraint if exists video_cache_analysis_status_check;
alter table public.video_cache
  add constraint video_cache_analysis_status_check
  check (
    analysis_status in (
      'pending', 'queued', 'processing', 'complete', 'failed', 'skipped'
    )
  );

alter table public.video_cache drop constraint if exists video_cache_transcript_source_check;
alter table public.video_cache
  add constraint video_cache_transcript_source_check
  check (
    transcript_source is null
    or transcript_source in ('captions', 'comments_metadata', 'asr', 'none')
  );

create table if not exists public.video_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.video_cache (id) on delete cascade,
  job_type text not null default 'TRANSCRIBE_VIDEO',
  status text not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 3,
  error_message text,
  job_payload jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, job_type)
);

alter table public.video_analysis_jobs
  drop constraint if exists video_analysis_jobs_status_check;
alter table public.video_analysis_jobs
  add constraint video_analysis_jobs_status_check
  check (status in ('queued', 'processing', 'complete', 'failed', 'dead'));

create index if not exists video_analysis_jobs_status
  on public.video_analysis_jobs (status, created_at);

alter table public.video_analysis_jobs enable row level security;

drop policy if exists "service reads analysis jobs" on public.video_analysis_jobs;
-- Writes stay on the service role. Public clients do not enqueue.

drop policy if exists "public read analysis job status" on public.video_analysis_jobs;
create policy "public read analysis job status"
  on public.video_analysis_jobs
  for select
  using (true);

create or replace function public.touch_video_analysis_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_analysis_jobs_updated_at on public.video_analysis_jobs;
create trigger video_analysis_jobs_updated_at
before update on public.video_analysis_jobs
for each row execute function public.touch_video_analysis_jobs_updated_at();
