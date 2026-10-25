# Community clarity implementation

Builds on the community-first implementation on master (c20a321); retains four tabs: Today, Unmask, Product, You.

## Connected flows
- Today: community stories/questions, product search, explicit contribution actions, following by saved product and subscribed product/person.
- Product: basic identity, actual experience/context counts, skin-type filtering, community questions, creator investigations, follow/unfollow and private tracking.
- Story/question: optional attachment of the author's public experience for the same product; links preserve live access checks.
- Investigations: variable support amounts, optional public acknowledgment, transactional idempotent wallet debit, editable editorial targets, live progress updates, creator attribution, company responses and commercial disclosures.
- Profiles: everyone is an Unmasker; approved video investigators are Unmask Creators; existing private creator/editorial tools retained.
- Presentation: white reading surfaces, responsive maximum content width, scrollable constrained sheets, wrapping actions, reduced-motion support for Spark acknowledgment.
- Cost control: product-intelligence rejects start_unmask/investigate with HTTP409 unless ENABLE_AUTOMATED_RESEARCH=true is explicitly configured. Search and existing data remain available.

## Verification
- TypeScript check passed.
- Production web export passed.
- 38 research regressions plus 3 support-progress tests passed.
- Database rollback-only integration tests passed for variable contributions, safe replay without double debit, closed investigation rejection, member target protection, public experience attachment and private attachment rejection.
- Database security advisor ran; legacy warnings remain outside this change. New trigger helpers pin search_path and revoke direct client execution; wallet contribution RPC remains authenticated-only.

## External setup still required
Paid recharge remains deliberately disconnected. No live payment provider credentials, verified-payment webhook or merchant configuration were supplied for this change. The existing UI states this and never mints balances on client success. No real purchase, payout or charge was performed during verification.

Monthly allocations, free-vs-paid credit accounting, expiry/refund policy and the meaning of the additional currency are not specified enough to invent monetary obligations. Existing Thunder Sparks use the existing conversion (100 Spark equivalents); this change does not introduce another exchange rate.

Example feed/profile content remains explicitly labeled as sample content; it is not counted as live contributions or authentic product evidence.
