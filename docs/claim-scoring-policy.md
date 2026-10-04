# Claim agreement scoring policy (v1.0.0)

Server-side rules in `lib/claims/scoring.ts` and `supabase/functions/_shared/claims/scoring.ts`.

## Formula

`claim agreement = 10 × (support + 0.5 × partial) / eligible`

where `eligible = support + partial + contradict`.

## Gates (no numeric score unless all pass)

- Exact product identity
- Operational criterion defined
- General claim type (not health/efficacy)
- ≥ 5 distinct eligible owner units
- ≥ 2 independent publication origins

## Finding labels (from raw score)

- ≥ 8: Supported by collected reports
- 3–7.9: Mixed
- &lt; 3: Contradicted by collected reports

## User-facing limit

Collected reports are not a representative survey of all owners.
