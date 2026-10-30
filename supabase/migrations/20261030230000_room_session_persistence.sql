begin;

create table if not exists public.unmask_room_participants (
  session_id uuid not null references public.unmask_realtime_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.unmask_room_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.unmask_realtime_sessions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  kind text not null check (kind in ('chat','reaction','ultra','spark','pin')),
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create index if not exists unmask_room_events_session_idx on public.unmask_room_events(session_id, created_at);

create table if not exists public.unmask_session_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.unmask_realtime_sessions(id) on delete cascade,
  host_id uuid,
  audio_url text,
  transcript text,
  duration_seconds integer,
  status text not null check (status in ('not_requested','pending','recording','processing','ready','failed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.unmask_room_participants enable row level security;
alter table public.unmask_room_events enable row level security;
alter table public.unmask_session_recordings enable row level security;

revoke all on public.unmask_room_participants from anon, authenticated;
revoke all on public.unmask_room_events from anon, authenticated;
revoke all on public.unmask_session_recordings from anon, authenticated;

grant select on public.unmask_room_events to authenticated;
grant select on public.unmask_session_recordings to authenticated;

drop policy if exists room_events_live_participant_read on public.unmask_room_events;
create policy room_events_live_participant_read on public.unmask_room_events
  for select to authenticated
  using (
    exists (
      select 1 from public.unmask_realtime_sessions s
      where s.id = session_id and s.status = 'live' and s.mode = 'room'
    )
    and exists (
      select 1 from public.unmask_room_participants p
      where p.session_id = unmask_room_events.session_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists session_recordings_read on public.unmask_session_recordings;
create policy session_recordings_read on public.unmask_session_recordings
  for select to authenticated
  using (
    status = 'ready'
    or host_id = (select auth.uid())
  );

create or replace function public.unmask_room_join(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in to join this Room'; end if;
  if not exists (
    select 1 from public.unmask_realtime_sessions
    where id = p_session and status = 'live' and mode = 'room'
  ) then
    raise exception 'This Room is not live';
  end if;
  insert into public.unmask_room_participants(session_id, user_id)
  values (p_session, u)
  on conflict do nothing;
end;
$$;

create or replace function public.unmask_room_post(
  p_session uuid,
  p_kind text,
  p_name text,
  p_payload jsonb,
  p_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  row public.unmask_room_events;
begin
  if u is null then raise exception 'Sign in to post in this Room'; end if;
  if p_kind is null or p_kind not in ('chat','reaction','ultra','spark','pin') then
    raise exception 'That Room note is not supported';
  end if;
  if p_key is null or length(trim(p_key)) < 8 or length(p_key) > 80 then
    raise exception 'A stable id is required';
  end if;
  if p_payload is null or octet_length(p_payload::text) > 16000 then
    raise exception 'That note is too large';
  end if;
  if not exists (
    select 1 from public.unmask_realtime_sessions
    where id = p_session and status = 'live' and mode = 'room'
  ) then
    raise exception 'This Room is not live';
  end if;
  if not exists (
    select 1 from public.unmask_room_participants
    where session_id = p_session and user_id = u
  ) then
    raise exception 'Join the Room before posting';
  end if;
  insert into public.unmask_room_events(session_id, author_id, author_name, kind, payload, idempotency_key)
  values (p_session, u, left(coalesce(nullif(trim(p_name), ''), 'Unmasker'), 80), p_kind, p_payload, trim(p_key))
  on conflict (session_id, idempotency_key) do nothing;
  select * into row from public.unmask_room_events
  where session_id = p_session and idempotency_key = trim(p_key);
  return to_jsonb(row);
end;
$$;

revoke all on function public.unmask_room_join(uuid) from public;
revoke all on function public.unmask_room_post(uuid, text, text, jsonb, text) from public;
grant execute on function public.unmask_room_join(uuid) to authenticated;
grant execute on function public.unmask_room_post(uuid, text, text, jsonb, text) to authenticated;

create or replace function public.unmask_room_dissolve() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  kept text;
begin
  if new.status in ('ended','cancelled') and old.status is distinct from new.status then
    kept := case
      when new.recording_status in ('pending','recording','processing','ready','failed','not_requested') then new.recording_status
      else 'not_requested'
    end;
    insert into public.unmask_session_recordings(session_id, host_id, audio_url, transcript, duration_seconds, status, note)
    values (
      new.id,
      new.host_creator_id,
      nullif(new.recording_url, ''),
      null,
      null,
      kept,
      case
        when kept = 'not_requested' then 'No audio file was captured. LiveKit egress and speech-to-text are not connected, so there is no transcript to keep.'
        when nullif(new.recording_url, '') is null then 'Recording was requested, but no audio file is stored yet.'
        else ''
      end
    )
    on conflict (session_id) do update
      set status = excluded.status,
          audio_url = coalesce(excluded.audio_url, public.unmask_session_recordings.audio_url),
          note = excluded.note;
    delete from public.unmask_room_events where session_id = new.id;
    delete from public.unmask_room_participants where session_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists unmask_room_dissolve_on_end on public.unmask_realtime_sessions;
create trigger unmask_room_dissolve_on_end
  after update of status on public.unmask_realtime_sessions
  for each row execute function public.unmask_room_dissolve();

commit;
