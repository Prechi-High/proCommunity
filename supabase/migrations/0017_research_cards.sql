-- Real accounts, server-side saves and the Research Card domain.
--
-- Product ids are the canonical text slugs used by product_intel / community
-- tables (not the legacy uuid `products` table), so every product_id here is text.
-- All Research Card writes go through service-role edge functions; signed-in
-- users can only read their own rows.

-- ---------------------------------------------------------------------------
-- Accounts: a profile row for every auth user

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Saved products (shared by the app and WhatsApp)

create table if not exists public.saved_products (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  name text,
  brand text,
  category text,
  image text,
  source_channel text not null default 'app' check (source_channel in ('app', 'whatsapp', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.saved_products enable row level security;
drop policy if exists "own saves" on public.saved_products;
create policy "own saves" on public.saved_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Research Cards

create or replace function public.gen_research_reference()
returns text
language plpgsql
as $$
declare
  ref text;
begin
  loop
    ref := 'SR-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.research_cards where public_reference = ref);
  end loop;
  return ref;
end;
$$;

create table if not exists public.research_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  public_reference text,
  title text,
  primary_product_id text,
  research_type text not null default 'product' check (research_type in ('product', 'comparison', 'category')),
  status text not null default 'created'
    check (status in ('created', 'identifying', 'researching', 'partial', 'complete', 'failed', 'archived')),
  focus text not null default 'everything'
    check (focus in ('everything', 'fit', 'ingredients', 'community', 'price', 'stores', 'alternatives', 'comparison')),
  source_channel text not null default 'app' check (source_channel in ('app', 'whatsapp', 'web')),
  image_url text,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_refreshed_at timestamptz,
  is_shared boolean not null default false
);

alter table public.research_cards alter column public_reference set default public.gen_research_reference();
update public.research_cards set public_reference = public.gen_research_reference() where public_reference is null;
alter table public.research_cards alter column public_reference set not null;
create unique index if not exists research_cards_reference_key on public.research_cards (public_reference);
create index if not exists research_cards_user_recent on public.research_cards (user_id, updated_at desc);
create index if not exists research_cards_user_product on public.research_cards (user_id, primary_product_id, created_at desc);
create index if not exists research_cards_search on public.research_cards using gin (search_text gin_trgm_ops);

create table if not exists public.research_products (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  product_id text not null,
  name text,
  brand text,
  category text,
  image text,
  role text not null default 'primary' check (role in ('primary', 'comparison', 'alternative', 'related')),
  added_at timestamptz not null default now(),
  unique (research_card_id, product_id, role)
);

create table if not exists public.research_sections (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  section_key text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'partial', 'unavailable')),
  display_order integer not null default 0,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (research_card_id, section_key)
);

create table if not exists public.research_snapshots (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('product', 'community', 'confidence', 'price', 'availability', 'fit')),
  data jsonb not null,
  source_version text,
  created_at timestamptz not null default now()
);
create index if not exists research_snapshots_card on public.research_snapshots (research_card_id, snapshot_type, created_at desc);

create table if not exists public.research_questions (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 2 and 500),
  answer jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'answered', 'failed')),
  source_channel text not null default 'app' check (source_channel in ('app', 'whatsapp', 'web')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists research_questions_card on public.research_questions (research_card_id, created_at desc);

create table if not exists public.research_comparisons (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  product_a_id text not null,
  product_b_id text not null,
  comparison_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (research_card_id, product_a_id, product_b_id)
);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  section_key text,
  source_type text,
  source_name text,
  source_url text,
  source_reference text,
  retrieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists research_sources_card on public.research_sources (research_card_id);

create table if not exists public.research_activity (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'system')),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists research_activity_card on public.research_activity (research_card_id, created_at desc);

create table if not exists public.research_shares (
  id uuid primary key default gen_random_uuid(),
  research_card_id uuid not null references public.research_cards (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  share_token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists research_shares_card on public.research_shares (research_card_id, status);

-- ---------------------------------------------------------------------------
-- RLS: owners read their own research; writes are service-role only.

alter table public.research_cards enable row level security;
alter table public.research_products enable row level security;
alter table public.research_sections enable row level security;
alter table public.research_snapshots enable row level security;
alter table public.research_questions enable row level security;
alter table public.research_comparisons enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_activity enable row level security;
alter table public.research_shares enable row level security;

drop policy if exists "own cards read" on public.research_cards;
create policy "own cards read" on public.research_cards for select using (auth.uid() = user_id);

create or replace function public.owns_research_card(card uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.research_cards c where c.id = card and c.user_id = auth.uid());
$$;

do $$
declare
  t text;
begin
  foreach t in array array['research_products', 'research_sections', 'research_snapshots', 'research_questions',
                           'research_comparisons', 'research_sources', 'research_activity', 'research_shares']
  loop
    execute format('drop policy if exists "own card rows read" on public.%I', t);
    execute format('create policy "own card rows read" on public.%I for select using (public.owns_research_card(research_card_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public share read: only share-safe fields, looked up by token hash.

create or replace function public.research_card_by_share(token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reference', c.public_reference,
    'title', c.title,
    'status', c.status,
    'researchType', c.research_type,
    'imageUrl', c.image_url,
    'createdAt', c.created_at,
    'completedAt', c.completed_at,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('productId', p.product_id, 'name', p.name, 'brand', p.brand, 'category', p.category, 'image', p.image, 'role', p.role) order by p.added_at)
      from public.research_products p where p.research_card_id = c.id
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('key', s.section_key, 'title', s.title, 'content', s.content, 'status', s.status) order by s.display_order)
      from public.research_sections s
      where s.research_card_id = c.id and s.status <> 'unavailable' and s.section_key <> 'fit'
    ), '[]'::jsonb),
    'comparisons', coalesce((
      select jsonb_agg(jsonb_build_object('productA', m.product_a_id, 'productB', m.product_b_id, 'snapshot', m.comparison_snapshot) order by m.created_at)
      from public.research_comparisons m where m.research_card_id = c.id
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('type', r.source_type, 'name', r.source_name, 'url', r.source_url, 'section', r.section_key))
      from public.research_sources r where r.research_card_id = c.id
    ), '[]'::jsonb)
  )
  from public.research_shares sh
  join public.research_cards c on c.id = sh.research_card_id
  where sh.share_token_hash = token_hash
    and sh.status = 'active'
    and (sh.expires_at is null or sh.expires_at > now())
    and c.status <> 'archived'
  limit 1;
$$;

revoke all on function public.research_card_by_share(text) from public;
grant execute on function public.research_card_by_share(text) to anon, authenticated, service_role;
