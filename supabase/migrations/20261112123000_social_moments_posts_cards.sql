-- Social foundation: temporary stories, photo-first posts, and the shareable My Unmask card.
-- Additive only. Existing experiences, timelines, profiles, and storage buckets stay as they are.
-- Stories expire 24 hours after they are created. Posts stay. The card is what a person chooses to show.

begin;

create table public.unmask_cards (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  skin text check (skin is null or length(skin) between 1 and 40),
  hair text check (hair is null or length(hair) between 1 and 40),
  routine text check (routine is null or length(routine) between 1 and 280),
  goals text check (goals is null or length(goals) between 1 and 160),
  concerns text[] not null default '{}' check (cardinality(concerns) <= 8),
  updated_at timestamptz not null default now()
);

create table public.unmask_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null check (
    media_path !~* '^https?://'
    and media_path !~ '\.\.'
    and length(media_path) between 3 and 240
  ),
  media_kind text not null check (media_kind in ('photo', 'video')),
  caption text not null default '' check (length(caption) <= 180),
  attach_kind text check (attach_kind in ('card', 'product', 'timeline')),
  attach_id text,
  attach_label text check (attach_label is null or length(attach_label) <= 80),
  poll_prompt text,
  poll_a text,
  poll_b text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (
    (attach_kind is null and attach_id is null)
    or (attach_kind is not null and attach_id is not null and length(attach_id) between 1 and 80)
  ),
  check (
    (poll_prompt is null and poll_a is null and poll_b is null)
    or (
      poll_prompt is not null and poll_a is not null and poll_b is not null
      and length(poll_prompt) between 1 and 80
      and length(poll_a) between 1 and 40
      and length(poll_b) between 1 and 40
    )
  ),
  check (expires_at > created_at and expires_at <= created_at + interval '26 hours')
);

create table public.unmask_expressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null check (
    media_path !~* '^https?://'
    and media_path !~ '\.\.'
    and length(media_path) between 3 and 240
  ),
  media_kind text not null check (media_kind in ('photo', 'video')),
  caption text not null default '' check (length(caption) <= 500),
  product_id text references public.unmask_catalog (id) on delete set null,
  journey_id uuid references public.unmask_journeys (id) on delete set null,
  attach_card boolean not null default false,
  attach_label text check (attach_label is null or length(attach_label) <= 80),
  created_at timestamptz not null default now()
);

create table public.unmask_moment_votes (
  moment_id uuid not null references public.unmask_moments (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (moment_id, voter_id)
);

create index unmask_moments_user_idx on public.unmask_moments (user_id, created_at desc);
create index unmask_moments_expires_idx on public.unmask_moments (expires_at desc);
create index unmask_expressions_user_idx on public.unmask_expressions (user_id, created_at desc);
create index unmask_expressions_journey_idx on public.unmask_expressions (journey_id);
create index unmask_moment_votes_voter_idx on public.unmask_moment_votes (voter_id);

alter table public.unmask_cards enable row level security;
alter table public.unmask_moments enable row level security;
alter table public.unmask_expressions enable row level security;
alter table public.unmask_moment_votes enable row level security;

revoke all on public.unmask_cards from public, anon, authenticated;
revoke all on public.unmask_moments from public, anon, authenticated;
revoke all on public.unmask_expressions from public, anon, authenticated;
revoke all on public.unmask_moment_votes from public, anon, authenticated;

grant select on public.unmask_cards to anon, authenticated;
grant insert, update on public.unmask_cards to authenticated;
grant select on public.unmask_moments to anon, authenticated;
grant insert, delete on public.unmask_moments to authenticated;
grant select on public.unmask_expressions to anon, authenticated;
grant insert, delete on public.unmask_expressions to authenticated;
grant select, insert on public.unmask_moment_votes to authenticated;

create policy unmask_cards_read on public.unmask_cards
  for select to anon, authenticated
  using (true);
create policy unmask_cards_insert on public.unmask_cards
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy unmask_cards_update on public.unmask_cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy unmask_moments_read on public.unmask_moments
  for select to anon, authenticated
  using (expires_at > now());
create policy unmask_moments_insert on public.unmask_moments
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy unmask_moments_delete on public.unmask_moments
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy unmask_expressions_read on public.unmask_expressions
  for select to anon, authenticated
  using (true);
create policy unmask_expressions_insert on public.unmask_expressions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy unmask_expressions_delete on public.unmask_expressions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy unmask_moment_votes_read on public.unmask_moment_votes
  for select to authenticated
  using (voter_id = (select auth.uid()));
create policy unmask_moment_votes_insert on public.unmask_moment_votes
  for insert to authenticated
  with check (voter_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'unmask-social',
  'unmask-social',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

create policy unmask_social_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'unmask-social');
create policy unmask_social_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'unmask-social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy unmask_social_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'unmask-social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy unmask_social_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'unmask-social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
