-- Supabase default privileges grant EXECUTE directly to API roles as well as PUBLIC.
revoke all on function public.unmask_stamp_contribution() from public,anon,authenticated;
revoke all on function public.unmask_sync_catalog() from public,anon,authenticated;
revoke all on function public.unmask_notify_event() from public,anon,authenticated;
revoke all on function public.unmask_notify_request() from public,anon,authenticated;
revoke all on function public.unmask_notify_routine_event() from public,anon,authenticated;
revoke all on function public.unmask_record_routine_change() from public,anon,authenticated;
revoke all on function public.unmask_touch_routine() from public,anon,authenticated;
revoke all on function public.unmask_register_product(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.unmask_register_product(text,text,text,text,text) to authenticated;
revoke all on function public.unmask_can_view(uuid,text) from public,anon,authenticated;
grant execute on function public.unmask_can_view(uuid,text) to anon,authenticated;
