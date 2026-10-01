-- Lets the client choose password vs email code for returning accounts (no PII beyond registration status).

create or replace function public.account_sign_in_hint(target_email text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(trim(target_email));
  uid uuid;
  has_pw boolean := false;
begin
  if normalized is null or normalized !~ '^[^@]+@[^@]+\.[^@]+$' then
    return json_build_object('registered', false, 'password_sign_in', false);
  end if;

  select u.id,
         coalesce(u.encrypted_password is not null and u.encrypted_password <> '', false)
    into uid, has_pw
    from auth.users u
   where lower(u.email) = normalized
   limit 1;

  if uid is null then
    return json_build_object('registered', false, 'password_sign_in', false);
  end if;

  return json_build_object('registered', true, 'password_sign_in', has_pw);
end;
$$;

revoke all on function public.account_sign_in_hint(text) from public;
grant execute on function public.account_sign_in_hint(text) to anon, authenticated;
