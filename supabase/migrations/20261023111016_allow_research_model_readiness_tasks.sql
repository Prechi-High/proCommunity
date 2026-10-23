alter table public.research_tasks drop constraint research_tasks_kind_check;
alter table public.research_tasks add constraint research_tasks_kind_check check(kind in ('discover','identity','collect','review','verify','facts','coordinate','warmup'));
