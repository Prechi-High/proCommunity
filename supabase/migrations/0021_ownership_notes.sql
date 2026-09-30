-- Ownership Notes: structured, long-term product experiences from verified owners.
-- Writes go through product-intelligence; public reads are exposed through edge functions.

create table if not exists public.ownership_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  author_name text not null,
  product_id text not null,
  product_name text not null,
  product_image text,
  brand text,
  category text,
  verification_id uuid references public.owner_verifications (id) on delete set null,
  milestone text not null default 'first_note' check (milestone in ('first_note', 'one_week', 'one_month', 'three_months', 'six_months', 'one_year', 'after_problem', 'update')),
  title text not null check (char_length(title) between 4 and 160),
  body text not null check (char_length(body) between 8 and 2400),
  used_for text,
  used_duration text,
  times_bought int check (times_bought is null or times_bought between 0 and 999),
  rating smallint check (rating is null or rating between 1 and 5),
  would_rebuy boolean,
  time_to_problem text,
  time_to_results text,
  positive_tags text[] not null default '{}',
  issue_tags text[] not null default '{}',
  context_tags text[] not null default '{}',
  helpful int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ownership_notes_product_recent on public.ownership_notes (product_id, created_at desc);
create index if not exists ownership_notes_user_recent on public.ownership_notes (user_id, created_at desc);
create index if not exists ownership_notes_verified_product on public.ownership_notes (product_id, verification_id) where verification_id is not null;

create table if not exists public.ownership_note_helpful (
  note_id uuid not null references public.ownership_notes (id) on delete cascade,
  member_id text not null,
  created_at timestamptz not null default now(),
  primary key (note_id, member_id)
);

alter table public.ownership_notes enable row level security;
alter table public.ownership_note_helpful enable row level security;

drop policy if exists "public read ownership notes" on public.ownership_notes;
create policy "public read ownership notes" on public.ownership_notes for select using (true);

drop policy if exists "members read own ownership helpful marks" on public.ownership_note_helpful;
create policy "members read own ownership helpful marks" on public.ownership_note_helpful
  for select using (auth.uid()::text = member_id);
