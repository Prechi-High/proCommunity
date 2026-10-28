-- A claim is an auditable platform grant, never a purchase or founding qualification.
create table public.unmask_monthly_spark_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  amount integer not null default 50 check (amount = 50),
  claimed_at timestamptz not null default now(),
  primary key(user_id, month)
);
alter table public.unmask_monthly_spark_claims enable row level security;
revoke all on public.unmask_monthly_spark_claims from anon, authenticated;
grant select on public.unmask_monthly_spark_claims to authenticated;
create policy "Read own monthly Spark grants" on public.unmask_monthly_spark_claims
  for select to authenticated using ((select auth.uid()) = user_id);

create schema if not exists unmask_rewards_private;
revoke all on schema unmask_rewards_private from public;
grant usage on schema unmask_rewards_private to authenticated;
-- Privilege is required solely for the atomic ledger + wallet credit. No caller-supplied user, date or amount.
create function unmask_rewards_private.monthly_sparks(p_claim boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  m date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  awarded boolean := false;
  claimed boolean;
  balance bigint;
begin
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Sign in to claim your monthly Sparks' using errcode='42501';
  end if;
  if p_claim is true then
    insert into public.unmask_spark_wallets(user_id) values(u) on conflict do nothing;
    insert into public.unmask_monthly_spark_claims(user_id,month) values(u,m)
      on conflict do nothing returning true into awarded;
    if coalesce(awarded,false) then
      update public.unmask_spark_wallets set sparks=sparks+50 where user_id=u;
    end if;
  end if;
  select exists(select 1 from public.unmask_monthly_spark_claims where user_id=u and month=m) into claimed;
  select sparks into balance from public.unmask_spark_wallets where user_id=u;
  return jsonb_build_object('month',m,'next_claim_at',((m+interval '1 month')::timestamp at time zone 'Africa/Lagos'),
    'claimed',claimed,'awarded',coalesce(awarded,false),'amount',50,'sparks',coalesce(balance,0));
end $$;
revoke all on function unmask_rewards_private.monthly_sparks(boolean) from public, anon;
grant execute on function unmask_rewards_private.monthly_sparks(boolean) to authenticated;
create function public.unmask_monthly_sparks(p_claim boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select unmask_rewards_private.monthly_sparks(p_claim);
$$;
revoke all on function public.unmask_monthly_sparks(boolean) from public, anon;
grant execute on function public.unmask_monthly_sparks(boolean) to authenticated;
