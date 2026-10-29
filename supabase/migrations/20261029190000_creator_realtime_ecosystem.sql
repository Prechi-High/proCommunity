begin;

alter table public.unmask_creators
  add column if not exists status text not null default 'trial' check (status in ('trial','active','expert','verified_professional','suspended','removed')),
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists verification_level text not null default 'creator' check (verification_level in ('creator','expert','verified_professional')),
  add column if not exists credential_summary text not null default '',
  add column if not exists credential_status text not null default 'unverified' check (credential_status in ('unverified','submitted','verified','rejected')),
  add column if not exists creator_mark text not null default 'creator',
  add column if not exists availability jsonb not null default '[]'::jsonb,
  add column if not exists languages text[] not null default '{}',
  add column if not exists reliability_score numeric(5,2) not null default 0,
  add column if not exists helpfulness_score numeric(5,2) not null default 0,
  add column if not exists safety_score numeric(5,2) not null default 0,
  add column if not exists sessions_completed integer not null default 0,
  add column if not exists trial_score numeric(5,2) not null default 0,
  add column if not exists promotions_eligible boolean not null default false;

alter table public.unmask_investigations
  add column if not exists ultra_visibility text not null default 'public' check (ultra_visibility in ('public')),
  add column if not exists requester_context_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists eligible_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists resolution text not null default '',
  add column if not exists resolution_status text not null default 'open' check (resolution_status in ('open','resolved','uncertain','cancelled')),
  add column if not exists recording_url text,
  add column if not exists transcript_url text;

create table if not exists public.unmask_realtime_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('live','room','ultra')),
  host_creator_id uuid references public.unmask_creators(user_id) on delete set null,
  investigation_id uuid references public.unmask_investigations(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  room_name text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  recording_url text,
  recording_status text not null default 'pending' check (recording_status in ('pending','recording','processing','ready','failed','not_requested')),
  transcript_status text not null default 'pending' check (transcript_status in ('pending','processing','ready','failed','not_requested')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists unmask_realtime_sessions_mode_status_idx on public.unmask_realtime_sessions(mode,status,scheduled_at);
create index if not exists unmask_realtime_sessions_host_idx on public.unmask_realtime_sessions(host_creator_id,created_at desc);
create index if not exists unmask_realtime_sessions_investigation_idx on public.unmask_realtime_sessions(investigation_id);

create table if not exists public.unmask_creator_trials (
  creator_id uuid primary key references public.unmask_creators(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '30 days'),
  reliability_score numeric(5,2) not null default 0,
  helpfulness_score numeric(5,2) not null default 0,
  accuracy_score numeric(5,2) not null default 0,
  communication_score numeric(5,2) not null default 0,
  safety_score numeric(5,2) not null default 0,
  community_score numeric(5,2) not null default 0,
  ultra_score numeric(5,2) not null default 0,
  professionalism_score numeric(5,2) not null default 0,
  decision text not null default 'pending' check (decision in ('pending','continue','promote','extend','remove')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_notes text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unmask_creator_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text,
  status text not null default 'open' check (status in ('draft','open','closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.unmask_creator_opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.unmask_creator_opportunities(id) on delete cascade,
  creator_id uuid not null references public.unmask_creators(user_id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','selected','rejected','withdrawn')),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique(opportunity_id,creator_id)
);

create table if not exists public.unmask_creator_gifts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.unmask_realtime_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.unmask_creators(user_id) on delete cascade,
  gift_code text not null,
  spark_amount integer not null check (spark_amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists unmask_creator_gifts_session_idx on public.unmask_creator_gifts(session_id,created_at desc);

alter table public.unmask_realtime_sessions enable row level security;
alter table public.unmask_creator_trials enable row level security;
alter table public.unmask_creator_opportunities enable row level security;
alter table public.unmask_creator_opportunity_applications enable row level security;
alter table public.unmask_creator_gifts enable row level security;

drop policy if exists realtime_sessions_public_read on public.unmask_realtime_sessions;
create policy realtime_sessions_public_read on public.unmask_realtime_sessions for select to authenticated using (status in ('scheduled','live','ended') or host_creator_id=(select auth.uid()));

drop policy if exists realtime_sessions_host_write on public.unmask_realtime_sessions;
create policy realtime_sessions_host_write on public.unmask_realtime_sessions for update to authenticated using (host_creator_id=(select auth.uid())) with check (host_creator_id=(select auth.uid()));

drop policy if exists creator_trials_own_read on public.unmask_creator_trials;
create policy creator_trials_own_read on public.unmask_creator_trials for select to authenticated using (creator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin));

drop policy if exists creator_opportunities_public_read on public.unmask_creator_opportunities;
create policy creator_opportunities_public_read on public.unmask_creator_opportunities for select to authenticated using (status='open' or created_by=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin));

drop policy if exists creator_opportunity_apply_own on public.unmask_creator_opportunity_applications;
create policy creator_opportunity_apply_own on public.unmask_creator_opportunity_applications for insert to authenticated with check (creator_id=(select auth.uid()) and exists(select 1 from public.unmask_creator_opportunities o where o.id=opportunity_id and o.status='open'));

drop policy if exists creator_opportunity_read_own on public.unmask_creator_opportunity_applications;
create policy creator_opportunity_read_own on public.unmask_creator_opportunity_applications for select to authenticated using (creator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin));

drop policy if exists gifts_sender_insert on public.unmask_creator_gifts;
create policy gifts_sender_insert on public.unmask_creator_gifts for insert to authenticated with check (sender_id=(select auth.uid()));

drop policy if exists gifts_participant_read on public.unmask_creator_gifts;
create policy gifts_participant_read on public.unmask_creator_gifts for select to authenticated using (sender_id=(select auth.uid()) or creator_id=(select auth.uid()));

commit;


create or replace function public.unmask_start_creator_trial() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$ begin if new.status='trial' then update public.unmask_creators set trial_started_at=coalesce(trial_started_at,now()), trial_ends_at=coalesce(trial_ends_at,now()+interval '30 days') where user_id=new.user_id; insert into public.unmask_creator_trials(creator_id,started_at,ends_at) values(new.user_id,coalesce(new.trial_started_at,now()),coalesce(new.trial_ends_at,now()+interval '30 days')) on conflict(creator_id) do nothing; end if; return new; end; $$;
drop trigger if exists trg_unmask_start_creator_trial on public.unmask_creators;
create trigger trg_unmask_start_creator_trial after insert on public.unmask_creators for each row execute function public.unmask_start_creator_trial();
