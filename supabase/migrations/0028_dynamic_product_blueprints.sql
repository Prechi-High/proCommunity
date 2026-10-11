-- Dynamic Product Intelligence: blueprints, factual sections, evaluation dimensions (additive).

-- MODIFY existing structures
alter table public.categories
  add column if not exists category_level text not null default 'domain',
  add column if not exists is_user_selectable boolean not null default true;

alter table public.intelligence_templates
  add column if not exists template_kind text not null default 'domain_base';

alter table public.intelligence_fields
  add column if not exists product_type_hints text[] not null default '{}',
  add column if not exists applicability_rule jsonb not null default '{}'::jsonb;

alter table public.product_intel
  add column if not exists category_id text,
  add column if not exists product_type text,
  add column if not exists product_subtype text,
  add column if not exists classification_confidence numeric,
  add column if not exists blueprint_version integer;

-- product_blueprints
create table if not exists public.product_blueprints (
  id text primary key,
  product_id text not null,
  category_id text not null references public.categories(id),
  template_id text references public.intelligence_templates(id),
  product_type text not null,
  product_subtype text,
  primary_uses jsonb not null default '[]'::jsonb,
  buyer_expectations jsonb not null default '[]'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,
  classification_confidence numeric not null default 0,
  blueprint_confidence numeric not null default 0,
  version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'superseded', 'draft')),
  generated_by_model text,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  refresh_after timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (product_id, version)
);

create index if not exists idx_product_blueprints_product_active
  on public.product_blueprints (product_id, status, version desc);

-- blueprint_sections (presentation contract sections)
create table if not exists public.blueprint_sections (
  id text primary key,
  blueprint_id text not null references public.product_blueprints(id) on delete cascade,
  section_key text not null,
  label text not null,
  section_type text not null,
  renderer_type text not null,
  display_order integer not null default 0,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  unique (blueprint_id, section_key)
);

create table if not exists public.product_fact_sections (
  id text primary key,
  blueprint_id text not null references public.product_blueprints(id) on delete cascade,
  section_key text not null,
  title text not null,
  description text,
  renderer_type text not null,
  icon_key text,
  display_order integer not null default 0,
  status text not null default 'active',
  unique (blueprint_id, section_key)
);

create table if not exists public.product_fact_fields (
  id text primary key,
  fact_section_id text not null references public.product_fact_sections(id) on delete cascade,
  field_key text not null,
  label text not null,
  value jsonb,
  unit text,
  source_claim_id text references public.intelligence_claims(id),
  confidence numeric not null default 0,
  display_order integer not null default 0,
  unique (fact_section_id, field_key)
);

create table if not exists public.evaluation_dimensions (
  id text primary key,
  blueprint_id text not null references public.product_blueprints(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  dimension_group text,
  importance numeric not null default 0.5,
  display_order integer not null default 0,
  scoreable boolean not null default true,
  why_it_matters text,
  origin text not null default 'blueprint',
  status text not null default 'active',
  unique (blueprint_id, key)
);

create table if not exists public.dimension_assessments (
  id text primary key,
  dimension_id text not null references public.evaluation_dimensions(id) on delete cascade,
  score numeric,
  confidence_score numeric not null default 0,
  finding text,
  positive_count integer not null default 0,
  mixed_count integer not null default 0,
  negative_count integer not null default 0,
  excluded_count integer not null default 0,
  evidence_count integer not null default 0,
  algorithm_version text not null,
  computed_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_dimension_assessments_dimension
  on public.dimension_assessments (dimension_id, computed_at desc);

create table if not exists public.dimension_evidence (
  dimension_id text not null references public.evaluation_dimensions(id) on delete cascade,
  evidence_id text not null references public.evidence(id) on delete cascade,
  stance text not null check (stance in ('positive', 'mixed', 'negative', 'neutral')),
  strength numeric not null default 0.5,
  context text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (dimension_id, evidence_id)
);

-- triggers
drop trigger if exists touch_product_blueprints_updated_at on public.product_blueprints;
create trigger touch_product_blueprints_updated_at
  before update on public.product_blueprints
  for each row execute function public.touch_updated_at();

-- RLS: public read, service write (matches product_intel pattern)
alter table public.product_blueprints enable row level security;
alter table public.blueprint_sections enable row level security;
alter table public.product_fact_sections enable row level security;
alter table public.product_fact_fields enable row level security;
alter table public.evaluation_dimensions enable row level security;
alter table public.dimension_assessments enable row level security;
alter table public.dimension_evidence enable row level security;

drop policy if exists product_blueprints_public_read on public.product_blueprints;
create policy product_blueprints_public_read on public.product_blueprints for select using (true);
drop policy if exists product_blueprints_service_write on public.product_blueprints;
create policy product_blueprints_service_write on public.product_blueprints for all using (auth.role() = 'service_role');

drop policy if exists blueprint_sections_public_read on public.blueprint_sections;
create policy blueprint_sections_public_read on public.blueprint_sections for select using (true);
drop policy if exists blueprint_sections_service_write on public.blueprint_sections;
create policy blueprint_sections_service_write on public.blueprint_sections for all using (auth.role() = 'service_role');

drop policy if exists product_fact_sections_public_read on public.product_fact_sections;
create policy product_fact_sections_public_read on public.product_fact_sections for select using (true);
drop policy if exists product_fact_sections_service_write on public.product_fact_sections;
create policy product_fact_sections_service_write on public.product_fact_sections for all using (auth.role() = 'service_role');

drop policy if exists product_fact_fields_public_read on public.product_fact_fields;
create policy product_fact_fields_public_read on public.product_fact_fields for select using (true);
drop policy if exists product_fact_fields_service_write on public.product_fact_fields;
create policy product_fact_fields_service_write on public.product_fact_fields for all using (auth.role() = 'service_role');

drop policy if exists evaluation_dimensions_public_read on public.evaluation_dimensions;
create policy evaluation_dimensions_public_read on public.evaluation_dimensions for select using (true);
drop policy if exists evaluation_dimensions_service_write on public.evaluation_dimensions;
create policy evaluation_dimensions_service_write on public.evaluation_dimensions for all using (auth.role() = 'service_role');

drop policy if exists dimension_assessments_public_read on public.dimension_assessments;
create policy dimension_assessments_public_read on public.dimension_assessments for select using (true);
drop policy if exists dimension_assessments_service_write on public.dimension_assessments;
create policy dimension_assessments_service_write on public.dimension_assessments for all using (auth.role() = 'service_role');

drop policy if exists dimension_evidence_public_read on public.dimension_evidence;
create policy dimension_evidence_public_read on public.dimension_evidence for select using (true);
drop policy if exists dimension_evidence_service_write on public.dimension_evidence;
create policy dimension_evidence_service_write on public.dimension_evidence for all using (auth.role() = 'service_role');

-- Seed three user-facing domains
insert into public.categories (id, parent_id, name, slug, description, status, category_level, is_user_selectable, created_at, updated_at)
values
  ('domain_tech', null, 'Tech', 'tech', 'Electronics, gadgets, and connected devices', 'active', 'domain', true, timezone('utc'::text, now()), timezone('utc'::text, now())),
  ('domain_beauty', null, 'Beauty', 'beauty', 'Beauty, skincare, and personal care', 'active', 'domain', true, timezone('utc'::text, now()), timezone('utc'::text, now())),
  ('domain_home_appliances', null, 'Home Appliances', 'home-appliances', 'Kitchen and home appliances', 'active', 'domain', true, timezone('utc'::text, now()), timezone('utc'::text, now()))
on conflict (id) do update set
  category_level = excluded.category_level,
  is_user_selectable = excluded.is_user_selectable,
  updated_at = timezone('utc'::text, now());

insert into public.intelligence_templates (id, category_id, name, version, description, status, is_universal, template_kind, created_at, updated_at)
values
  ('tpl_domain_tech', 'domain_tech', 'Tech domain base', 1, 'Baseline factual and experience families for tech products', 'active', false, 'domain_base', timezone('utc'::text, now()), timezone('utc'::text, now())),
  ('tpl_domain_beauty', 'domain_beauty', 'Beauty domain base', 1, 'Baseline factual and experience families for beauty products', 'active', false, 'domain_base', timezone('utc'::text, now()), timezone('utc'::text, now())),
  ('tpl_domain_home', 'domain_home_appliances', 'Home appliances domain base', 1, 'Baseline factual and experience families for home appliances', 'active', false, 'domain_base', timezone('utc'::text, now()), timezone('utc'::text, now()))
on conflict (id) do update set template_kind = excluded.template_kind, updated_at = timezone('utc'::text, now());
