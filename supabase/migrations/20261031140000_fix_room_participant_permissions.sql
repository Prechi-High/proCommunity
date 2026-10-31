begin;

grant insert on public.unmask_room_participants to authenticated;

drop policy if exists room_participants_own_insert on public.unmask_room_participants;
create policy room_participants_own_insert
  on public.unmask_room_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.unmask_realtime_sessions s
      where s.id = session_id
        and s.status = 'live'
        and s.mode = 'room'
    )
  );

commit;