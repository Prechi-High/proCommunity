-- Richer display names for Google / OAuth sign-ups.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  founder boolean := lower(coalesce(new.email, '')) = 'highprechi@gmail.com';
  display text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
begin
  insert into public.profiles (id, display_name, is_admin)
  values (new.id, display, founder)
  on conflict (id) do update set
    display_name = coalesce(nullif(trim(public.profiles.display_name), ''), excluded.display_name),
    is_admin = public.profiles.is_admin or excluded.is_admin;
  return new;
end;
$$;
