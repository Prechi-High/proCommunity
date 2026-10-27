-- Free community identity is separate from paid/future founding membership.
create table public.unmask_member_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.unmask_member_identities enable row level security;
revoke all on public.unmask_member_identities from anon, authenticated;
grant select on public.unmask_member_identities to anon, authenticated;
grant insert(user_id) on public.unmask_member_identities to authenticated;
create policy "Public Unmasker identity" on public.unmask_member_identities for select to anon, authenticated using (true);
create policy "Claim own Unmasker identity" on public.unmask_member_identities for insert to authenticated with check ((select auth.uid()) = user_id);

-- Private expression of interest; never implies payment, entitlement or award.
create table public.unmask_founding_interest (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.unmask_founding_interest enable row level security;
revoke all on public.unmask_founding_interest from anon, authenticated;
grant select on public.unmask_founding_interest to authenticated;
grant insert(user_id) on public.unmask_founding_interest to authenticated;
create policy "Read own founding interest" on public.unmask_founding_interest for select to authenticated using ((select auth.uid()) = user_id);
create policy "Express own founding interest" on public.unmask_founding_interest for insert to authenticated with check ((select auth.uid()) = user_id);
