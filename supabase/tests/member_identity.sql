-- Rollback-only checks: public free identity; private founding interest; owner-only claims.
begin;
select set_config('test.member', (select id::text from auth.users order by created_at limit 1), true);
select set_config('test.other', (select id::text from auth.users order by created_at offset 1 limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('test.member'), true);
set local role authenticated;
insert into public.unmask_member_identities(user_id) values(auth.uid()) on conflict do nothing;
insert into public.unmask_founding_interest(user_id) values(auth.uid()) on conflict do nothing;
do $$ declare blocked boolean:=false; begin
  begin insert into public.unmask_member_identities(user_id) values(current_setting('test.other')::uuid); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Claimed another member identity'; end if;
  blocked:=false;
  begin update public.unmask_member_identities set claimed_at='2000-01-01' where user_id=auth.uid(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Claim timestamp was mutable'; end if;
  if not exists(select 1 from public.unmask_founding_interest where user_id=auth.uid()) then raise exception 'Own interest not readable'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin
  if exists(select 1 from public.unmask_founding_interest where user_id=current_setting('test.member')::uuid) then raise exception 'Another member interest leaked'; end if;
  if not exists(select 1 from public.unmask_member_identities where user_id=current_setting('test.member')::uuid) then raise exception 'Public ring not readable'; end if;
end $$;
set local role anon;
do $$ declare blocked boolean:=false; begin
  perform user_id from public.unmask_member_identities limit 1;
  begin perform user_id from public.unmask_founding_interest limit 1; exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Anonymous interest access allowed'; end if;
  blocked:=false;
  begin insert into public.unmask_member_identities(user_id) values(current_setting('test.other')::uuid); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Anonymous claim allowed'; end if;
end $$;
rollback;
