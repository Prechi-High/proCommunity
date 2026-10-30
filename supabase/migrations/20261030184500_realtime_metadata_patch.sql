-- Merge presence and mic fields without replacing the rest of the session metadata.
create or replace function public.unmask_patch_realtime_metadata(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_meta jsonb;
begin
  update public.unmask_realtime_sessions
  set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
  where id = p_id
  returning metadata into next_meta;
  return next_meta;
end;
$$;

revoke all on function public.unmask_patch_realtime_metadata(uuid, jsonb) from public;
grant execute on function public.unmask_patch_realtime_metadata(uuid, jsonb) to service_role;
