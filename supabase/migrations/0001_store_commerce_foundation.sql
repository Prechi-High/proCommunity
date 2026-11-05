-- Unmask Commerce / Store database foundation
-- This migration targets the separate "Unmask stores" Supabase project.
-- Core user IDs and Unmask product IDs are intentionally stored as UUID references
-- without cross-project foreign keys.

create extension if not exists pgcrypto;

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  core_user_id uuid not null unique,
  business_name text not null,
  legal_name text,
  contact_email text not null,
  phone text,
  country text not null default 'NG',
  status text not null default 'pending'
    check (status in ('pending','approved','suspended','rejected')),
  onboarding_step text not null default 'business'
    check (onboarding_step in ('business','store','payment','active','review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null,
  slug text not null unique,
  tagline text not null default '',
  description text not null default '',
  logo_url text,
  cover_image_url text,
  currency text not null default 'NGN',
  status text not null default 'pending'
    check (status in ('pending','active','suspended','closed')),
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  hostname text not null unique,
  type text not null default 'subdomain'
    check (type in ('subdomain','custom')),
  status text not null default 'pending'
    check (status in ('pending','active','failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_code text not null default 'founding_store',
  amount numeric(12,2),
  currency text not null default 'NGN',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','paid','active','expired','cancelled','failed')),
  payment_provider text,
  payment_reference text unique,
  checkout_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_activation_events (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.sellers(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  event_type text not null,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  unmask_product_id uuid,
  title text not null,
  description text not null default '',
  sku text,
  price numeric(12,2) not null,
  compare_at_price numeric(12,2),
  currency text not null default 'NGN',
  inventory_quantity integer not null default 0,
  in_stock boolean not null default true,
  product_url_slug text not null,
  hero_image_url text,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, product_url_slug),
  unique(store_id, sku)
);

create index if not exists idx_stores_seller_id on public.stores(seller_id);
create index if not exists idx_store_domains_store_id on public.store_domains(store_id);
create index if not exists idx_store_subscriptions_store_id on public.store_subscriptions(store_id);
create index if not exists idx_store_products_store_id on public.store_products(store_id);
create index if not exists idx_store_products_unmask_product_id on public.store_products(unmask_product_id);
create index if not exists idx_store_activation_events_store_id on public.store_activation_events(store_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sellers_touch_updated_at on public.sellers;
create trigger sellers_touch_updated_at before update on public.sellers for each row execute function public.touch_updated_at();

drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at before update on public.stores for each row execute function public.touch_updated_at();

drop trigger if exists store_subscriptions_touch_updated_at on public.store_subscriptions;
create trigger store_subscriptions_touch_updated_at before update on public.store_subscriptions for each row execute function public.touch_updated_at();

drop trigger if exists store_products_touch_updated_at on public.store_products;
create trigger store_products_touch_updated_at before update on public.store_products for each row execute function public.touch_updated_at();

alter table public.sellers enable row level security;
alter table public.stores enable row level security;
alter table public.store_domains enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.store_activation_events enable row level security;
alter table public.store_products enable row level security;

-- No public/authenticated policies yet. Commerce access is intentionally mediated
-- by the server-side Commerce API until the seller/customer auth boundary is finalized.
