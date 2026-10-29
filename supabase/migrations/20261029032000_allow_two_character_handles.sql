begin;

alter table public.unmask_public_profiles drop constraint if exists unmask_public_profiles_handle_check;
alter table public.unmask_public_profiles add constraint unmask_public_profiles_handle_check check(handle ~ '^[a-z0-9_]{2,24}$');

commit;
