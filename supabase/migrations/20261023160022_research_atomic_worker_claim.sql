CREATE OR REPLACE FUNCTION public.research_claim(p_task uuid, p_run uuid, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t public.research_tasks; r public.research_runs;
begin
 select * into r from public.research_runs where id=p_run and token=p_token and phase not in ('complete','interrupted');
 if not found then return null; end if;
 update public.research_tasks set state='running',lease=gen_random_uuid(),updated_at=now(),first_started_at=coalesce(first_started_at,clock_timestamp()),last_started_at=clock_timestamp()
 where id=p_task and run_id=p_run and state='dispatched' returning * into t;
 if not found then return null; end if;
 return jsonb_build_object('inferenceConfig',public.research_inference_config(),'task',to_jsonb(t),'run',case when t.kind='facts' then to_jsonb(r) else jsonb_build_object('id',r.id,'product_id',r.product_id,'identity',r.identity,'blueprint',r.blueprint,'phase',r.phase,'batch',r.batch,'created_at',r.created_at) end);
end $function$;


revoke all on function public.research_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.research_claim(uuid,uuid,uuid) to service_role;
