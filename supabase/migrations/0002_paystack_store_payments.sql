-- Paystack fields for seller store activation.
alter table public.store_subscriptions
  add column if not exists provider_transaction_id text,
  add column if not exists payment_status text,
  add column if not exists payment_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_store_subscriptions_provider_transaction_id
  on public.store_subscriptions(provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists idx_store_subscriptions_payment_status
  on public.store_subscriptions(payment_status);
