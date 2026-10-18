# Living product phases 1 to 3

The main app retains the existing identification, product research, YouTube acquisition,
claims, comparisons and dynamic product UI. It adds five tabs: Today, Unmask,
My Products, Community and You. The old Pulse discussion interface remains at
`/discussions`; saved/recent products remain at `/saved`.

## Phase 1

- Product investigation links to the living product record and company profile.
- Company identities are backfilled only from recorded brand names and remain unverified.
  No websites, certifications, ownership claims or partnerships are invented.
- Product follows, request tracking and relevant-question matching use persistent records.
- Ownership starts a private journey with acquisition disclosure, start date,
  frequency, context and explicit sharing controls. Existing possession verification remains.
- Product watch pages expose early, established and long-term native observations alongside
  a link to the existing external-evidence investigation.

## Phase 2

- Product states preserve paused, stopped, finished, replaced and repurchased history.
- Each experience is a separate observation; new opinions never replace prior text.
- Context and acquisition are server-stamped snapshots at publication time.
- Documented maturity is measured at the update date from server-recorded journey creation,
  independently from a user-reported start date. Existing observations do not mature merely
  because time passes without a follow-up.
- Existing routines are extended with goals, contexts, visibility and text product references.
  Existing UUID catalogue relationships are retained. Routine item changes generate history.
- Photos use a private bucket with RLS and short-lived signed URLs.

## Phase 3

- People, routines, companies and products can be followed; product notification preferences
  support new experiences or long-term updates.
- Structured answers capture duration, context and acquisition. They are visibly self-reported.
- Similar-context filtering, public routine cards, an evening surface and relevant questions
  are available without fake community posts or counters.
- Meaningful events produce in-app activity, not unsolicited external messages.
- Personal checkpoint prompts appear on Today for active product journeys.

## Trust and cache boundaries

Native observations are fetched only for the final product-intelligence response,
after existing external profile/database/cache writes. Private/follower-only, demo,
removed and held contributions cannot enter that public overlay. Author deduplication
prevents repeated updates from becoming multiple independent sources. The initial
policy conservatively restricts scoring to specific, purchased, possession-verified
observations with established documented history and multiple updates, and discounts
identical-language clusters. This is a conservative initial policy, not a calibrated
fraud detector or proof that other opinions are false. No coin code is added.

The response overlay uses existing dimension sufficiency gates. Existing external
research caching remains intact, and native visibility/deletion is rechecked on each
response. Main-product SQL names use `unmask_` and do not repurpose launch tables.

## Validation

- `npm run typecheck`
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform web`
- `node --import tsx --test lib/product-result/__tests__/dynamic-ui.test.ts supabase/functions/_shared/blueprint/__tests__/*.test.ts supabase/functions/_shared/evidence/__tests__/*.test.ts supabase/functions/_shared/domain/__tests__/*.test.ts`
- `node --import tsx --test lib/server/redis/__tests__/redis.service.test.ts lib/claims/__tests__/scoring.test.ts`
- `supabase/tests/living_privacy.sql` exercises RLS with transaction-only fixtures and rolls back.

Company administration, official investigation assignments, sponsorship operations and
business reporting belong to phases 4–5. Reward systems are deliberately excluded.
