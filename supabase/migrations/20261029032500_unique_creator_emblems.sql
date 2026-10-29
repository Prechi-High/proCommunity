begin;

alter table public.unmask_creators
  alter column creator_mark set default ('creator-' || substr(replace(gen_random_uuid()::text,'-',''),1,8));

create unique index if not exists unmask_creators_creator_mark_unique
  on public.unmask_creators(creator_mark);

commit;
