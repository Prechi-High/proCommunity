create table public.research_filter_audits (
 task_id uuid primary key references public.research_tasks(id) on delete cascade,
 run_id uuid not null references public.research_runs(id) on delete cascade,
 result jsonb not null,created_at timestamptz not null default now()
);
alter table public.research_filter_audits enable row level security;
revoke all on public.research_filter_audits from public,anon,authenticated;
grant all on public.research_filter_audits to service_role;
