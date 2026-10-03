-- Server-side OTP *request* throttling only (not OTP storage). Service role only.

create table if not exists public.auth_email_rate_limits (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_email_rate_limits_email_created_idx
  on public.auth_email_rate_limits (email_hash, created_at desc);

create index if not exists auth_email_rate_limits_ip_created_idx
  on public.auth_email_rate_limits (ip_hash, created_at desc);

alter table public.auth_email_rate_limits enable row level security;

-- No policies: anon/authenticated cannot read or write.
