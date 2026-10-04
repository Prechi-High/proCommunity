-- Claim agreement scores & owner discoveries (text product_id aligns with product_intel.id).

create table if not exists public.product_claims (
  id text primary key default 'pcl_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null,
  variant_id text,
  topic text not null,
  exact_text text not null default '',
  brand_source_id int,
  conditions text not null default '',
  criterion text not null default '',
  partial_criterion text not null default '',
  claim_type text not null default 'general' check (claim_type in ('general', 'health_efficacy')),
  policy_version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_claims_product_idx on public.product_claims (product_id);

create table if not exists public.claim_assessments (
  id text primary key default 'cas_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  claim_id text not null references public.product_claims (id) on delete cascade,
  score numeric,
  finding text not null,
  confidence text not null,
  reasons jsonb not null default '[]'::jsonb,
  support_count int not null default 0,
  partial_count int not null default 0,
  contradict_count int not null default 0,
  excluded_count int not null default 0,
  unavailable_reason text,
  policy_version text not null default '1.0.0',
  computed_at timestamptz not null default now()
);

create table if not exists public.owner_discoveries (
  id text primary key default 'odc_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null,
  variant_id text,
  topic text not null,
  observation_type text not null check (observation_type in ('benefit', 'concern', 'usage')),
  summary text not null,
  source_ids jsonb not null default '[]'::jsonb,
  context text not null default '',
  confidence text not null default 'limited',
  manufacturer_relation text not null default '',
  buying_implication text not null default '',
  corpus_id text,
  created_at timestamptz not null default now()
);

create index if not exists owner_discoveries_product_idx on public.owner_discoveries (product_id);

alter table public.product_claims enable row level security;
alter table public.claim_assessments enable row level security;
alter table public.owner_discoveries enable row level security;

create policy "product_claims_public_read" on public.product_claims for select using (true);
create policy "claim_assessments_public_read" on public.claim_assessments for select using (true);
create policy "owner_discoveries_public_read" on public.owner_discoveries for select using (true);
