begin;
alter table public.unmask_creator_publications add column published_at timestamptz;
create function public.cw_publication_timestamp() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$begin
 if new.published and (tg_op='INSERT' or not old.published) then new.published_at=now();end if;
 return new;
end;$$;
revoke all on function public.cw_publication_timestamp() from public,anon,authenticated;
create trigger creator_publication_timestamp before insert or update of published on public.unmask_creator_publications for each row execute function public.cw_publication_timestamp();
commit;
