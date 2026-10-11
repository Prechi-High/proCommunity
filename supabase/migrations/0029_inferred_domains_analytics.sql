-- Inferred domains registry, demand telemetry, voting, and blueprint domain linkage.

-- Fixed UUIDs for official domains (stable references in code/seeds).
-- Tech, Beauty, Home Appliances

create table if not exists public.domain_registry (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  slug text not null unique,
  status text not null check (status in ('official', 'inferred', 'proposed', 'merged', 'deprecated')),
  is_official boolean not null default false,
  template_status text not null default 'missing'
    check (template_status in ('missing', 'generating', 'ready', 'failed', 'stale')),
  merged_into_domain_id uuid references public.domain_registry(id),
  classification_notes text,
  first_seen_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.domain_aliases (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domain_registry(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'system',
  confidence numeric,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (domain_id, normalized_alias)
);

create index if not exists domain_aliases_normalized_idx on public.domain_aliases (normalized_alias);

create table if not exists public.domain_intelligence_templates (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domain_registry(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'active', 'stale', 'archived')),
  common_fact_families jsonb not null default '[]'::jsonb,
  common_buyer_expectations jsonb not null default '[]'::jsonb,
  common_risk_families jsonb not null default '[]'::jsonb,
  common_experience_families jsonb not null default '[]'::jsonb,
  preferred_source_types jsonb not null default '[]'::jsonb,
  research_guidance jsonb not null default '{}'::jsonb,
  generated_by_model text,
  generation_confidence numeric,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (domain_id, version)
);

alter table public.product_blueprints
  add column if not exists domain_id uuid references public.domain_registry(id),
  add column if not exists domain_status text,
  add column if not exists product_family text,
  add column if not exists domain_template_version integer,
  add column if not exists classification_confidence numeric;

create table if not exists public.domain_demand_daily (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domain_registry(id) on delete cascade,
  metric_date date not null,
  search_count integer not null default 0,
  unique_searchers integer not null default 0,
  distinct_products integer not null default 0,
  unmask_count integer not null default 0,
  question_count integer not null default 0,
  community_escalation_count integer not null default 0,
  vote_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (domain_id, metric_date)
);

create table if not exists public.inferred_domain_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_id text,
  domain_id uuid not null references public.domain_registry(id) on delete cascade,
  product_id text,
  source text not null default 'inferred_domain_notice',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists inferred_domain_votes_user_domain
  on public.inferred_domain_votes (user_id, domain_id) where user_id is not null;

create unique index if not exists inferred_domain_votes_anon_domain
  on public.inferred_domain_votes (anonymous_id, domain_id) where anonymous_id is not null and user_id is null;

create table if not exists public.user_domain_notice_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_id text,
  domain_id uuid not null references public.domain_registry(id) on delete cascade,
  first_shown_at timestamptz not null default timezone('utc'::text, now()),
  last_shown_at timestamptz not null default timezone('utc'::text, now()),
  dismissed_at timestamptz,
  voted_at timestamptz,
  show_count integer not null default 1,
  constraint user_domain_notice_actor check (user_id is not null or anonymous_id is not null)
);

create unique index if not exists user_domain_notice_user
  on public.user_domain_notice_state (user_id, domain_id) where user_id is not null;

create unique index if not exists user_domain_notice_anon
  on public.user_domain_notice_state (anonymous_id, domain_id) where anonymous_id is not null and user_id is null;

create table if not exists public.intelligence_job_telemetry (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  product_id text,
  domain_id uuid references public.domain_registry(id),
  domain_status text,
  cache_source text check (cache_source in ('redis', 'supabase', 'fresh')),
  llm_calls integer not null default 0,
  llm_input_tokens integer not null default 0,
  llm_output_tokens integer not null default 0,
  search_provider_calls integer not null default 0,
  youtube_api_calls integer not null default 0,
  evidence_count integer not null default 0,
  latency_ms integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists touch_domain_registry_updated_at on public.domain_registry;
create trigger touch_domain_registry_updated_at
  before update on public.domain_registry for each row execute function public.touch_updated_at();

drop trigger if exists touch_domain_intelligence_templates_updated_at on public.domain_intelligence_templates;
create trigger touch_domain_intelligence_templates_updated_at
  before update on public.domain_intelligence_templates for each row execute function public.touch_updated_at();

alter table public.domain_registry enable row level security;
alter table public.domain_aliases enable row level security;
alter table public.domain_intelligence_templates enable row level security;
alter table public.domain_demand_daily enable row level security;
alter table public.inferred_domain_votes enable row level security;
alter table public.user_domain_notice_state enable row level security;
alter table public.intelligence_job_telemetry enable row level security;

create policy domain_registry_public_read on public.domain_registry for select using (true);
create policy domain_registry_service_write on public.domain_registry for all using (auth.role() = 'service_role');

create policy domain_aliases_public_read on public.domain_aliases for select using (true);
create policy domain_aliases_service_write on public.domain_aliases for all using (auth.role() = 'service_role');

create policy domain_templates_public_read on public.domain_intelligence_templates for select using (true);
create policy domain_templates_service_write on public.domain_intelligence_templates for all using (auth.role() = 'service_role');

create policy domain_demand_public_read on public.domain_demand_daily for select using (true);
create policy domain_demand_service_write on public.domain_demand_daily for all using (auth.role() = 'service_role');

create policy inferred_votes_service_write on public.inferred_domain_votes for all using (auth.role() = 'service_role');
create policy inferred_votes_user_read on public.inferred_domain_votes for select using (auth.uid() = user_id);

create policy notice_state_service_write on public.user_domain_notice_state for all using (auth.role() = 'service_role');
create policy notice_state_user_read on public.user_domain_notice_state for select using (auth.uid() = user_id);

create policy intel_telemetry_service_write on public.intelligence_job_telemetry for all using (auth.role() = 'service_role');
create policy intel_telemetry_admin_read on public.intelligence_job_telemetry for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- Official domains
insert into public.domain_registry (id, canonical_name, slug, status, is_official, template_status)
values
  ('a1000001-0000-4000-8000-000000000001', 'Tech', 'tech', 'official', true, 'ready'),
  ('a1000001-0000-4000-8000-000000000002', 'Beauty', 'beauty', 'official', true, 'ready'),
  ('a1000001-0000-4000-8000-000000000003', 'Home Appliances', 'home-appliances', 'official', true, 'ready')
on conflict (slug) do update set
  status = excluded.status,
  is_official = excluded.is_official,
  template_status = excluded.template_status,
  updated_at = timezone('utc'::text, now());

insert into public.domain_aliases (domain_id, alias, normalized_alias, source, confidence)
select d.id, v.alias, v.norm, 'seed', 0.95
from public.domain_registry d
cross join (values
  ('tech', 'electronics', 'electronics'),
  ('tech', 'gadgets', 'gadgets'),
  ('tech', 'mobile', 'mobile'),
  ('beauty', 'cosmetics', 'cosmetics'),
  ('beauty', 'skincare', 'skincare'),
  ('beauty', 'makeup', 'makeup'),
  ('beauty', 'personal beauty', 'personal beauty'),
  ('home-appliances', 'kitchen appliances', 'kitchen appliances'),
  ('home-appliances', 'home appliances', 'home appliances')
) as v(slug, alias, norm)
where d.slug = v.slug
on conflict (domain_id, normalized_alias) do nothing;

insert into public.domain_intelligence_templates (
  domain_id, version, status, common_fact_families, common_buyer_expectations,
  common_risk_families, common_experience_families, preferred_source_types, research_guidance,
  generated_by_model, generation_confidence
)
select
  d.id, 1, 'active',
  case d.slug
    when 'tech' then '["Specs","Connectivity","Compatibility","Power","Build"]'::jsonb
    when 'beauty' then '["Ingredients","Product Details","Who It''s For","How to Use"]'::jsonb
    else '["Specs","Capacity","Power","Safety","Maintenance"]'::jsonb
  end,
  '["Matches advertised claims","Reliable day-to-day use"]'::jsonb,
  '["Unmet expectations","Hidden long-term issues"]'::jsonb,
  case d.slug
    when 'tech' then '["Performance","Reliability","Usability","Durability","Compatibility"]'::jsonb
    when 'beauty' then '["Results","Comfort","Wear","Application","Tolerance"]'::jsonb
    else '["Effectiveness","Noise","Cleaning","Efficiency","Reliability"]'::jsonb
  end,
  '["reviews","retail","community","video"]'::jsonb,
  '{"what_to_prioritize":["owner experiences","verified specs"],"common_evidence_patterns":["split reviews"],"common_failure_modes":["marketing hype"]}'::jsonb,
  'seed-v1',
  0.9
from public.domain_registry d
where d.is_official = true
on conflict (domain_id, version) do nothing;
