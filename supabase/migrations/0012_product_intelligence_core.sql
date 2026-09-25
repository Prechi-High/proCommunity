-- Product Intelligence Organisation - Core Database Schema
-- Implements the Product Knowledge Base as described in the Implementation Blueprint

-- 1. refresh_policies - Controls how often different facts should be rechecked
create table if not exists public.refresh_policies (
  id text primary key,
  name text not null,
  description text,
  ttl_seconds integer not null,
  is_default boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. categories - Controlled category hierarchy with template assignments (no FK to templates initially)
create table if not exists public.categories (
  id text primary key,
  parent_id text references public.categories(id),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active' check (status in ('active', 'draft', 'deprecated')),
  intelligence_template_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. intelligence_templates - Universal and category-specific templates
create table if not exists public.intelligence_templates (
  id text primary key,
  category_id text references public.categories(id),
  name text not null,
  version integer not null default 1,
  description text,
  status text not null default 'active' check (status in ('active', 'draft', 'deprecated')),
  is_universal boolean not null default false,
  parent_template_id text references public.intelligence_templates(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add FK after both tables exist
alter table public.categories add constraint categories_template_id_fkey 
  foreign key (intelligence_template_id) references public.intelligence_templates(id);

-- 4. intelligence_fields - Individual facts/attributes required by a template
create table if not exists public.intelligence_fields (
  id text primary key,
  template_id text not null references public.intelligence_templates(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  data_type text not null default 'text' check (data_type in ('text', 'number', 'boolean', 'array', 'object', 'date', 'url', 'image')),
  unit text,
  required boolean not null default false,
  importance text not null default 'core' check (importance in ('core', 'important', 'optional')),
  extraction_instruction text,
  search_instructions text,
  preferred_sources text[], -- domain names preferred for this field
  verification_rule text,
  confidence_threshold numeric not null default 0.7,
  refresh_policy_id text references public.refresh_policies(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. intelligence_claims - Actual structured facts known about a product
create table if not exists public.intelligence_claims (
  id text primary key default 'clm_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null references public.products(id) on delete cascade,
  field_id text not null references public.intelligence_fields(id) on delete cascade,
  value text,
  normalized_value text,
  confidence numeric not null default 0,
  status text not null default 'pending' check (status in ('candidates', 'supported', 'verified', 'conflicted', 'stale', 'rejected')),
  first_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_verified_at timestamp with time zone,
  next_refresh_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. evidence - Source material supporting claims
create table if not exists public.evidence (
  id text primary key default 'ev_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text references public.products(id) on delete set null,
  source_id text,
  source_url text,
  source_title text,
  content text,
  content_summary text,
  evidence_type text not null default 'text' check (evidence_type in ('text', 'structured_data', 'html', 'json', 'image', 'video', 'social_media', 'document')),
  retrieved_at timestamp with time zone,
  source_reliability numeric default 0.5, -- 0-1, higher is more reliable
  content_hash text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. claim_evidence - Connects claims to one or more evidence items
create table if not exists public.claim_evidence (
  claim_id text not null references public.intelligence_claims(id) on delete cascade,
  evidence_id text not null references public.evidence(id) on delete cascade,
  support_level text not null default 'full' check (support_level in ('full', 'partial', 'contradicts')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (claim_id, evidence_id)
);

-- 7. product_images - Primary and gallery images plus provenance
create table if not exists public.product_images (
  id text primary key default 'img_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null references public.products(id) on delete cascade,
  image_url text not null,
  source_url text,
  source_id text,
  image_type text not null default 'primary' check (image_type in ('primary', 'gallery', 'packaging', 'specification', 'detail', 'lifestyle', 'variant')),
  width integer,
  height integer,
  is_primary boolean not null default false,
  is_gallery boolean not null default false,
  confidence numeric not null default 0.5,
  first_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. product_prices - Observed prices with source and timestamp
create table if not exists public.product_prices (
  id text primary key default 'prc_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null references public.products(id) on delete cascade,
  variant_id text,
  seller text,
  source_id text,
  currency text not null default 'NGN',
  amount numeric not null,
  original_amount numeric,
  availability text,
  source_url text,
  observed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. intelligence_jobs - Tracks research/refresh work
create table if not exists public.intelligence_jobs (
  id text primary key default 'job_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  product_id text not null references public.products(id) on delete cascade,
  template_id text references public.intelligence_templates(id),
  job_type text not null check (job_type in ('initial_research', 'refresh', 'image_refresh', 'price_refresh', 'category_review', 'identity_verification')),
  status text not null default 'pending' check (status in ('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled')),
  fields_requested text[],
  fields_completed text[],
  priority integer not null default 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. refresh_policies - Controls how often different facts should be rechecked
create table if not exists public.refresh_policies (
  id text primary key,
  name text not null,
  description text,
  ttl_seconds integer not null,
  is_default boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. category_proposals - New category suggestions awaiting governance
create table if not exists public.category_proposals (
  id text primary key default 'prop_' || lower(substring(gen_random_uuid()::text, 1, 22)),
  proposed_name text not null,
  parent_category_id text references public.categories(id),
  reason text not null,
  products_affected text[],
  similar_existing_categories text[],
  confidence numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for frequently queried columns
create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_template_id on public.categories(intelligence_template_id);
create index if not exists idx_intelligence_claims_product_id on public.intelligence_claims(product_id);
create index if not exists idx_intelligence_claims_field_id on public.intelligence_claims(field_id);
create index if not exists idx_intelligence_claims_status on public.intelligence_claims(status);
create index if not exists idx_intelligence_claims_next_refresh on public.intelligence_claims(next_refresh_at) where next_refresh_at is not null;
create index if not exists idx_evidence_product_id on public.evidence(product_id);
create index if not exists idx_evidence_content_hash on public.evidence(content_hash) where content_hash is not null;
create index if not exists idx_claim_evidence_claim_id on public.claim_evidence(claim_id);
create index if not exists idx_claim_evidence_evidence_id on public.claim_evidence(evidence_id);
create index if not exists idx_product_images_product_id on public.product_images(product_id);
create index if not exists idx_product_images_is_primary on public.product_images(product_id, is_primary);
create index if not exists idx_product_images_image_type on public.product_images(image_type);
create index if not exists idx_product_prices_product_id on public.product_prices(product_id);
create index if not exists idx_product_prices_observed_at on public.product_prices(product_id, observed_at desc);
create index if not exists idx_intelligence_jobs_product_id on public.intelligence_jobs(product_id);
create index if not exists idx_intelligence_jobs_status on public.intelligence_jobs(status);
create index if not exists idx_refresh_policies_is_default on public.refresh_policies(is_default);

-- RLS Policies
alter table public.categories enable row level security;
alter table public.intelligence_templates enable row level security;
alter table public.intelligence_fields enable row level security;
alter table public.intelligence_claims enable row level security;
alter table public.evidence enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.product_images enable row level security;
alter table public.product_prices enable row level security;
alter table public.intelligence_jobs enable row level security;
alter table public.refresh_policies enable row level security;
alter table public.category_proposals enable row level security;

-- 12.触碰更新时间戳函数
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists touch_categories_updated_at on public.categories;
create trigger touch_categories_updated_at
  before update on public.categories
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_intelligence_templates_updated_at on public.intelligence_templates;
create trigger touch_intelligence_templates_updated_at
  before update on public.intelligence_templates
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_intelligence_fields_updated_at on public.intelligence_fields;
create trigger touch_intelligence_fields_updated_at
  before update on public.intelligence_fields
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_intelligence_claims_updated_at on public.intelligence_claims;
create trigger touch_intelligence_claims_updated_at
  before update on public.intelligence_claims
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_product_images_updated_at on public.product_images;
create trigger touch_product_images_updated_at
  before update on public.product_images
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_product_prices_updated_at on public.product_prices;
create trigger touch_product_prices_updated_at
  before update on public.product_prices
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_intelligence_jobs_updated_at on public.intelligence_jobs;
create trigger touch_intelligence_jobs_updated_at
  before update on public.intelligence_jobs
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_category_proposals_updated_at on public.category_proposals;
create trigger touch_category_proposals_updated_at
  before update on public.category_proposals
  for each row execute function public.touch_updated_at();

-- Default refresh policies
insert into public.refresh_policies (id, name, description, ttl_seconds, is_default)
values
  ('long_lived', 'Long-lived', 'Product identity rarely changes', 2592000, false),
  ('periodic', 'Periodic', 'Specifications checked periodically', 2592000, false),
  ('frequent', 'Frequent', 'Price and availability change frequently', 86400, false),
  ('very_frequent', 'Very frequent', 'Stock updates frequently', 3600, false)
on conflict (id) do nothing;

-- Default universal template for products without a specialized category
insert into public.intelligence_templates (id, category_id, name, version, description, status, is_universal, created_at)
values (
  'universal_default',
  null,
  'Universal Default Template',
  1,
  'Baseline product intelligence for products without a specialized template',
  'active',
  true,
  timezone('utc'::text, now())
)
on conflict (id) do update
set updated_at = timezone('utc'::text, now());

-- Default universal intelligence fields
insert into public.intelligence_fields (id, template_id, key, label, description, data_type, required, importance, extraction_instruction, search_instructions, preferred_sources, refresh_policy_id)
values
  ('fld_product_name_universal', 'universal_default', 'product_name', 'Product Name', 'Canonical product name', 'text', true, 'core', 'Extract the full product name as it appears on packaging', 'search: "product_name brand official product page"', '{official,manufacturer}', 'long_lived'),
  ('fld_brand_universal', 'universal_default', 'brand', 'Brand', 'Product brand/manufacturer', 'text', true, 'core', 'Extract the brand name', 'search: "brand official website"', '{official,manufacturer}', 'long_lived'),
  ('fld_category_universal', 'universal_default', 'category', 'Category', 'Product category', 'text', true, 'core', 'Classify into existing categories', 'search: "product category classification"', '{classification}', 'long_lived'),
  ('fld_model_universal', 'universal_default', 'model', 'Model Number', 'Product model identifier', 'text', false, 'core', 'Extract model number, SKU, or product code', 'search: "model number specification"', '{official,retailer}', 'long_lived'),
  ('fld_description_universal', 'universal_default', 'description', 'Description', 'Product description', 'text', false, 'core', 'Extract product description', 'search: "product description"', '{official,retailer}', 'periodic'),
  ('fld_primary_image_universal', 'universal_default', 'primary_image', 'Primary Image', 'Primary product image', 'image', true, 'core', 'Extract primary product image URL', 'search: "product image"', '{official,retailer}', 'periodic'),
  ('fld_gallery_images_universal', 'universal_default', 'gallery_images', 'Gallery Images', 'Additional product images', 'array', false, 'important', 'Extract additional product images', 'search: "product gallery images"', '{official,retailer}', 'periodic'),
  ('fld_price_universal', 'universal_default', 'price', 'Price', 'Current product price', 'number', false, 'important', 'Extract current price and currency', 'search: "product price Nigeria"', '{retailer,marketplace}', 'frequent'),
  ('fld_availability_universal', 'universal_default', 'availability', 'Availability', 'Product availability status', 'text', false, 'important', 'Check if product is in stock', 'search: "product availability"', '{retailer,marketplace}', 'very_frequent'),
  ('fld_common_praise_universal', 'universal_default', 'common_praise', 'Common Praise', 'Common positive user feedback', 'array', false, 'important', 'Extract common positive comments', 'search: "product review praise"', '{review,forum,reddit}', 'periodic'),
  ('fld_common_complaints_universal', 'universal_default', 'common_complaints', 'Common Complaints', 'Common negative user feedback', 'array', false, 'important', 'Extract common complaints', 'search: "product review complaints"', '{review,forum,reddit}', 'periodic'),
  ('fld_sources_universal', 'universal_default', 'sources', 'Sources', 'List of information sources', 'array', false, 'optional', 'Compile all source URLs', 'search: product information sources', '{}', 'long_lived')
on conflict (id) do update
set updated_at = timezone('utc'::text, now());

-- RLS Policies for categories
create policy "Categories are readable by all"
  on public.categories for select
  using (status = 'active');

create policy "Categories are writable by service role"
  on public.categories for all
  using (auth.role() = 'service_role');

-- RLS Policies for intelligence_templates
create policy "Templates are readable by all"
  on public.intelligence_templates for select
  using (status = 'active');

create policy "Templates are writable by service role"
  on public.intelligence_templates for all
  using (auth.role() = 'service_role');

-- RLS Policies for intelligence_fields
create policy "Fields are readable by all"
  on public.intelligence_fields for select
  using (exists (
    select 1 from public.intelligence_templates t
    where t.id = public.intelligence_fields.template_id
    and t.status = 'active'
  ));

create policy "Fields are writable by service role"
  on public.intelligence_fields for all
  using (auth.role() = 'service_role');

-- RLS Policies for intelligence_claims
create policy "Claims are readable by all"
  on public.intelligence_claims for select
  using (status in ('supported', 'verified'));

create policy "Claims are writable by service role"
  on public.intelligence_claims for all
  using (auth.role() = 'service_role');

-- RLS Policies for evidence
create policy "Evidence is readable by all"
  on public.evidence for select
  using (true);

create policy "Evidence is writable by service role"
  on public.evidence for all
  using (auth.role() = 'service_role');

-- RLS Policies for claim_evidence
create policy "Claim evidence is readable by all"
  on public.claim_evidence for select
  using (true);

create policy "Claim evidence is writable by service role"
  on public.claim_evidence for all
  using (auth.role() = 'service_role');

-- RLS Policies for product_images
create policy "Product images are readable by all"
  on public.product_images for select
  using (true);

create policy "Product images are writable by service role"
  on public.product_images for all
  using (auth.role() = 'service_role');

-- RLS Policies for product_prices
create policy "Product prices are readable by all"
  on public.product_prices for select
  using (true);

create policy "Product prices are writable by service role"
  on public.product_prices for all
  using (auth.role() = 'service_role');

-- RLS Policies for intelligence_jobs
create policy "Jobs are readable by all"
  on public.intelligence_jobs for select
  using (true);

create policy "Jobs are writable by service role"
  on public.intelligence_jobs for all
  using (auth.role() = 'service_role');

-- RLS Policies for refresh_policies
create policy "Refresh policies are readable by all"
  on public.refresh_policies for select
  using (true);

create policy "Refresh policies are writable by service role"
  on public.refresh_policies for all
  using (auth.role() = 'service_role');

-- RLS Policies for category_proposals
create policy "Category proposals are readable by all"
  on public.category_proposals for select
  using (true);

create policy "Category proposals are writable by service role"
  on public.category_proposals for all
  using (auth.role() = 'service_role');
