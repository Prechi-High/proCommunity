-- Auto-admin for founder account on sign-up; backfill if the user already exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  founder boolean := lower(coalesce(new.email, '')) = 'highprechi@gmail.com';
begin
  insert into public.profiles (id, display_name, is_admin)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    founder
  )
  on conflict (id) do update set
    is_admin = public.profiles.is_admin or excluded.is_admin;
  return new;
end;
$$;

update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'highprechi@gmail.com';
