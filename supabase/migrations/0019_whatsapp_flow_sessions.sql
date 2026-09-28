-- Opaque flow_token → linked connection. Flow requests are authorised through this mapping,
-- never through ids supplied by the Flow client.

create table if not exists public.whatsapp_flow_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  connection_id uuid not null references public.whatsapp_connections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_mode text not null default 'HOME'
    check (entry_mode in ('HOME', 'START_RESEARCH', 'OPEN_RESEARCH', 'MY_RESEARCH', 'COMPARE', 'SHARE')),
  research_card_id uuid references public.research_cards (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_flow_sessions_expiry on public.whatsapp_flow_sessions (expires_at);

alter table public.whatsapp_flow_sessions enable row level security;
-- service role only
