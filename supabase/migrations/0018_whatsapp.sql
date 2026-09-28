-- WhatsApp integration layer + a generic background job queue + notification deliveries.
-- WhatsApp tables are written only by service-role edge functions. Signed-in users can
-- read (and, for preferences, update) their own connection through RLS.

-- ---------------------------------------------------------------------------
-- Connections

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wa_id text not null,
  phone_e164 text,
  status text not null default 'pending' check (status in ('pending', 'active', 'disconnected', 'blocked')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  notification_preferences jsonb not null default
    '{"price_alerts": true, "research_updates": true, "community_replies": true, "refill_reminders": false, "product_drops": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists whatsapp_connections_wa_id_key on public.whatsapp_connections (wa_id);
-- One active WhatsApp number per Sourced account.
create unique index if not exists whatsapp_connections_one_active_per_user on public.whatsapp_connections (user_id) where status = 'active';

create table if not exists public.whatsapp_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'used', 'expired', 'revoked')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_link_tokens_user on public.whatsapp_link_tokens (user_id, status);

-- ---------------------------------------------------------------------------
-- Webhook events (idempotency), messages (minimal), conversations (active context)

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text,
  provider_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'queued', 'processing', 'processed', 'failed', 'ignored')),
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists whatsapp_webhook_events_event_key on public.whatsapp_webhook_events (provider_event_id) where provider_event_id is not null;

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.whatsapp_connections (id) on delete cascade,
  active_research_card_id uuid references public.research_cards (id) on delete set null,
  active_product_id text,
  state jsonb not null default '{}'::jsonb,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists whatsapp_conversations_connection_key on public.whatsapp_conversations (connection_id);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.whatsapp_connections (id) on delete set null,
  conversation_id uuid references public.whatsapp_conversations (id) on delete set null,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  research_card_id uuid references public.research_cards (id) on delete set null,
  status text not null default 'received',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists whatsapp_messages_provider_key on public.whatsapp_messages (provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- Notification delivery (channel-agnostic; source notifications live in public.notifications)

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'push', 'email', 'in_app')),
  event_type text not null,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists notification_deliveries_provider on public.notification_deliveries (provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- Background jobs (Postgres is the source of truth; Redis is only used for locks/caches)

create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 4,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists integration_jobs_idempotency_key on public.integration_jobs (idempotency_key) where idempotency_key is not null;
create index if not exists integration_jobs_due on public.integration_jobs (status, run_after);

-- Claims due jobs, and reclaims jobs whose worker died mid-run (locked > 5 minutes).
create or replace function public.claim_integration_jobs(worker text, max_jobs integer default 5)
returns setof public.integration_jobs
language sql
security definer
set search_path = public
as $$
  update public.integration_jobs j
     set status = 'processing', locked_at = now(), locked_by = worker, attempts = j.attempts + 1, updated_at = now()
   where j.id in (
     select id from public.integration_jobs
      where (status in ('queued', 'failed') and run_after <= now())
         or (status = 'processing' and locked_at < now() - interval '5 minutes')
      order by run_after
      limit greatest(1, least(max_jobs, 20))
      for update skip locked
   )
  returning j.*;
$$;

revoke all on function public.claim_integration_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_integration_jobs(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- RLS

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_link_tokens enable row level security;
alter table public.whatsapp_webhook_events enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.integration_jobs enable row level security;

drop policy if exists "own connection read" on public.whatsapp_connections;
create policy "own connection read" on public.whatsapp_connections for select using (auth.uid() = user_id);

drop policy if exists "own deliveries read" on public.notification_deliveries;
create policy "own deliveries read" on public.notification_deliveries for select using (auth.uid() = user_id);
-- link tokens, webhook events, conversations, messages and jobs: service role only (no policies).
