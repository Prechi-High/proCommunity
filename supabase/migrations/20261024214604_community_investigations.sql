begin;
create table public.unmask_investigations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users,
 product_id text references public.unmask_catalog, question_id uuid references public.unmask_questions,
 experience_id uuid references public.clarity_experiences, title text not null check(length(title) between 10 and 500),
 concern text not null default '', supporting_links text not null default '',
 status text not null default 'requested' check(status in('requested','selected','investigating','published')),
 creator_id uuid references public.unmask_creators, findings text not null default '', company_response text not null default '',
 uncertainty text not null default '', sources text not null default '', video_url text check(video_url is null or video_url ~ '^https://'),
 created_at timestamptz not null default now()
);
alter table public.unmask_investigations enable row level security;
create policy investigations_read on public.unmask_investigations for select to anon,authenticated using(true);
create policy investigations_insert on public.unmask_investigations for insert to authenticated with check(user_id=(select auth.uid()) and status='requested' and creator_id is null and video_url is null and findings='' and company_response='' and uncertainty='' and sources='' and (question_id is null or exists(select 1 from public.unmask_questions q where q.id=question_id and q.product_id=unmask_investigations.product_id)) and (experience_id is null or exists(select 1 from public.clarity_experiences e where e.id=experience_id and e.visibility='public' and e.product_id=unmask_investigations.product_id)));
create policy investigations_admin on public.unmask_investigations for update to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
create table public.unmask_investigation_updates(id uuid primary key default gen_random_uuid(), investigation_id uuid not null references public.unmask_investigations on delete cascade, body text not null, created_at timestamptz not null default now());
alter table public.unmask_investigation_updates enable row level security;
create policy updates_read on public.unmask_investigation_updates for select to anon,authenticated using(true);
create policy updates_admin on public.unmask_investigation_updates for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
create index on public.unmask_investigation_updates(investigation_id,created_at);
create table public.unmask_spark_wallets(user_id uuid primary key references auth.users, sparks bigint not null default 0 check(sparks>=0), thunder bigint not null default 0 check(thunder>=0));
alter table public.unmask_spark_wallets enable row level security;
create policy wallet_own_read on public.unmask_spark_wallets for select to authenticated using(user_id=(select auth.uid()));
create table public.unmask_spark_contributions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users, investigation_id uuid not null references public.unmask_investigations, kind text not null check(kind in('sparks','thunder')), amount integer not null check(amount>0), public_ack boolean not null default false, request_key uuid not null, created_at timestamptz not null default now(), unique(user_id,request_key));
create index on public.unmask_spark_contributions(investigation_id,user_id);
alter table public.unmask_spark_contributions enable row level security;
create policy contributions_own_read on public.unmask_spark_contributions for select to authenticated using(user_id=(select auth.uid()));
grant select on public.unmask_investigations,public.unmask_investigation_updates to anon,authenticated;
grant insert,update on public.unmask_investigations to authenticated;
grant insert,update,delete on public.unmask_investigation_updates to authenticated;
grant select on public.unmask_spark_wallets,public.unmask_spark_contributions to authenticated;
-- No client can mint balances or insert contributions directly.
create function public.investigation_support_summary(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('sparks',coalesce(sum(amount) filter(where kind='sparks'),0),'thunder',coalesce(sum(amount) filter(where kind='thunder'),0),'supporters',count(distinct user_id),'backers',coalesce((select jsonb_agg(jsonb_build_object('name',p.display_name,'user_id',x.user_id,'weight',x.weight)) from (select user_id,sum(amount*case when kind='thunder' then 100::bigint else 1 end) weight from public.unmask_spark_contributions where investigation_id=p_id and public_ack group by user_id order by weight desc,user_id limit 20) x join public.profiles p on p.id=x.user_id),'[]'::jsonb)) from public.unmask_spark_contributions where investigation_id=p_id;
$$;
revoke all on function public.investigation_support_summary(uuid) from public;
grant execute on function public.investigation_support_summary(uuid) to anon,authenticated;
create function public.contribute_investigation(p_id uuid,p_kind text,p_amount integer,p_public boolean,p_key uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); w public.unmask_spark_wallets; c public.unmask_spark_contributions;
begin
 if u is null then raise exception 'Sign in to support an investigation'; end if;
 if p_key is null or p_public is null or p_kind is null or p_kind not in('sparks','thunder') or p_amount is null or p_amount>1000000 or p_amount<(case when p_kind='sparks' then 10 else 1 end) then raise exception 'Choose a valid contribution amount';end if;
 if not exists(select 1 from public.unmask_investigations where id=p_id) then raise exception 'Investigation unavailable';end if;
 insert into public.unmask_spark_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.unmask_spark_wallets where user_id=u for update;
 select * into c from public.unmask_spark_contributions where user_id=u and request_key=p_key;
 if found then
 if c.investigation_id<>p_id or c.kind<>p_kind or c.amount<>p_amount or c.public_ack<>p_public then raise exception 'Contribution reference already used';end if;
 else
 if (p_kind='sparks' and w.sparks<p_amount) or (p_kind='thunder' and w.thunder<p_amount) then raise exception 'Insufficient balance. Recharge is not connected yet.';end if;
 update public.unmask_spark_wallets set sparks=sparks-case when p_kind='sparks' then p_amount else 0 end,thunder=thunder-case when p_kind='thunder' then p_amount else 0 end where user_id=u;
 insert into public.unmask_spark_contributions(user_id,investigation_id,kind,amount,public_ack,request_key) values(u,p_id,p_kind,p_amount,p_public,p_key) returning * into c;
 end if;
 select * into w from public.unmask_spark_wallets where user_id=u;
 return jsonb_build_object('id',c.id,'kind',c.kind,'amount',c.amount,'public_ack',c.public_ack,'sparks',w.sparks,'thunder',w.thunder,'summary',public.investigation_support_summary(p_id));
end; $$;
revoke all on function public.contribute_investigation(uuid,text,integer,boolean,uuid) from public,anon;
grant execute on function public.contribute_investigation(uuid,text,integer,boolean,uuid) to authenticated;
commit;
