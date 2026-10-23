-- Keep queueing, inference reservations, network time and storage time distinct.
create or replace function public.research_usage_summary(p_run uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('assessmentCalls',count(*) filter(where stage in ('review','verify')),
 'totalCalls',count(*),'failedCalls',count(*) filter(where status is not null and status<>200),
 'tokens',coalesce(sum(actual_tokens),0),'reservedTokens',coalesce(sum(reserved_tokens),0),
 'providers',coalesce((select jsonb_agg(x) from(select provider,count(*) calls,
 count(*) filter(where status=429) throttled,count(*) filter(where stage='verify') verification_calls,
 coalesce(sum(actual_tokens),0) tokens from public.research_provider_usage where run_id=p_run group by provider)x),'[]'),
 'requestTimings',coalesce((select jsonb_agg(x) from(select stage,count(*) calls,
 round(avg((usage->'timing'->>'httpMs')::numeric),1) http_mean_ms,
 percentile_cont(.95) within group(order by (usage->'timing'->>'httpMs')::numeric) http_p95_ms,
 round(avg((usage->'timing'->>'acquireMs')::numeric),1) reservation_mean_ms
 from public.research_provider_usage where run_id=p_run group by stage)x),'[]'),
 'activity',jsonb_build_object(
 'queuedTasks',(select count(*) from public.research_tasks where run_id=p_run and state in ('pending','dispatched')),
 'capacityDeferredTasks',(select count(*) from public.research_tasks where run_id=p_run and state in ('pending','dispatched') and capacity_wait_started_at is not null),
 'runningWorkers',(select count(*) from public.research_tasks where run_id=p_run and state='running'),
 'inferenceReservationsInFlight',count(*) filter(where finished_at is null and started_at>clock_timestamp()-interval '90 seconds')))
 from public.research_provider_usage where run_id=p_run;
$$;
revoke all on function public.research_usage_summary(uuid) from public,anon,authenticated;
grant execute on function public.research_usage_summary(uuid) to service_role;
