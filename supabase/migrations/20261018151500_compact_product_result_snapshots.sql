alter table public.product_intel
  add column if not exists presentation_snapshot jsonb,
  add column if not exists ui_contract_snapshot jsonb;

comment on column public.product_intel.presentation_snapshot is
  'Compact computed result, stored separately from the full evidence corpus to avoid rewriting large payloads.';
