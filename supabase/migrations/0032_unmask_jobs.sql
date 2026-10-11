-- Durable Unmask investigation job state (hot copy also in Redis).

create table if not exists public.unmask_jobs (
  product_id text primary key,
  state text not null,
  progress jsonb not null default '{}'::jsonb,
  timings jsonb,
  error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists unmask_jobs_state_idx on public.unmask_jobs (state, updated_at desc);

alter table public.unmask_jobs enable row level security;

drop policy if exists "unmask_jobs_public_read" on public.unmask_jobs;
create policy "unmask_jobs_public_read" on public.unmask_jobs for select using (true);
