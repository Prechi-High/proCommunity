-- Conversation evidence provider provenance (additive).

alter table public.evidence
  add column if not exists provider text,
  add column if not exists source_id text,
  add column if not exists conversation_id text,
  add column if not exists parent_id text,
  add column if not exists experience_quality jsonb,
  add column if not exists provider_metadata jsonb;

create index if not exists idx_evidence_provider_source
  on public.evidence (provider, source_id)
  where provider is not null and source_id is not null;
