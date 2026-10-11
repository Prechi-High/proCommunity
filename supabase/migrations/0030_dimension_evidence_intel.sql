-- Intel-aligned evidence rows (text product_id) + richer dimension_evidence links.

alter table public.evidence
  add column if not exists intel_product_id text,
  add column if not exists platform text,
  add column if not exists author text,
  add column if not exists product_match_level text,
  add column if not exists product_match_confidence numeric,
  add column if not exists extracted_statement text;

create index if not exists idx_evidence_intel_product
  on public.evidence (intel_product_id)
  where intel_product_id is not null;

alter table public.dimension_evidence
  add column if not exists relevance_confidence numeric not null default 0.5,
  add column if not exists product_match_confidence numeric not null default 0.5,
  add column if not exists extracted_statement text,
  add column if not exists affects_score boolean not null default true;
