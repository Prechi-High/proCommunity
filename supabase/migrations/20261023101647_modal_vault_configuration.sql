create or replace function public.research_inference_config() returns jsonb language sql security definer set search_path='' as $$ select decrypted_secret::jsonb from vault.decrypted_secrets where name='unmask_modal_inference' limit 1 $$;
revoke all on function public.research_inference_config() from public,anon,authenticated;
grant execute on function public.research_inference_config() to service_role;
