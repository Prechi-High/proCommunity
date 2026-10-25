-- Existing owner-only RLS remains authoritative; no public access is added.
alter table public.clarity_preferences
 add column interests text[] not null default '{}',
 add column sensitive_skin boolean not null default false,
 add column onboarding_completed_at timestamptz;
alter table public.clarity_preferences add constraint clarity_interests_allowed check (
 cardinality(interests)<=6 and interests <@ array['Skincare','Body care','Hair care','Electronics','Home essentials','Food and drinks']::text[]
);
