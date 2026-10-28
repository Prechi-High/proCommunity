# Home and Community direction

Home is the front door. It explains Unmask and offers two clear paths: unmask a product through existing experiences, or take a story further with Ultra Unmask. Product search/photo recognition still uses the existing results → product → experiences → ask-community flow. No external research pipeline is re-enabled.

Community is the social home. The former Today feed moves here, with existing post cards, reactions, creator rings and external seller offers after six visible posts. Filters include experiences, questions, Ultra Unmasks and following. The former Ultra-only feed remains at /ultra-unmask with its existing stage and sort controls. /unmask and /pulse redirect to /community. Main navigation: Home, Community, Create, My Products, You.

Home presents real Spark and Thunder balances. Recharge links to the existing pack screen; checkout is still disconnected. The guide explains that Sparks support a closer look, not a verdict or guaranteed response. Existing creator publications are shown newest first; illustrative demo answers are identified as demos. No video exists for the short explainer yet; its slot is labelled coming soon and a visual written guide works now.

## Identity

Claiming an Unmasker ring is free and persists in unmask_member_identities. It appears on Home, You and the member's public profile. It is an identity marker, not product verification, founder status or a professional credential. Claims belong to the signed-in user; timestamps are server-set and immutable to clients.

## Founding program proposal

The founding program is a preview and private interest list, not a purchasable membership. Interest is saved in unmask_founding_interest and does not award a badge, grant coins or imply a payment. The proposed launch window ends 31 December 2026, subject to confirmation.

Recommended structure for review: free identity for every member; first verified paid Spark recharge during the confirmed window can qualify a founder; permanent founding badge; partner-discount credits for 12 monthly allocations, with each month's credits usable only against actual participating seller offers. Set the number of credits, monetary discount mapping, limits, expiry, seller funding and qualifying pack before opening purchases. Show full terms before payment. Keep Sparks and seller-discount credits in separate ledgers. A preview payment state or wallet adjustment must never qualify as a verified purchase.

Unmask Coins would be noncash seller-discount credits, not cash, investment returns or Spark equivalents. No claim of participating partners, available discounts or monthly issuance is made while these are unimplemented. The free ring and founding badge must stay visually distinct.

## Creator program

The Home creator section links to creator profiles and an information/interest page. Members can privately send an interest message through the existing support system. It does not grant workspace access or promise an assignment or payment. Editorial assignment remains unchanged.

## Validation

Typecheck and web export; rollback SQL allow/deny tests for free claims, immutable timestamps, private founding interest and anonymous access; browser checks of Home search, Community filters, legacy redirects and the visual guide. Production payment and monthly-credit systems are not part of this release.

## Social Home refresh — 28 October 2026

Home now uses a personal greeting, creator update circles, a compact product-search surface, a monthly Spark drop, a shorter Ultra invitation and a prominent animated membership-ring card. Portraits remain stable while a gradient light and particles orbit the ring; reduced-motion preferences disable continuous animation. No synthetic popularity counts or activity are shown.

Every signed-in non-anonymous account can manually claim 50 free Sparks per calendar month in Africa/Lagos. Unclaimed months are not banked; credited Sparks carry over in the existing wallet. The server supplies the claim month, next boundary and fixed amount. A ledger primary key (user_id, month) makes retries and concurrent claims idempotent. The grant and wallet credit happen in one transaction. Client roles cannot insert or alter ledger rows. Claim history is private to its owner. Free grants do not count as purchases or founding qualification. Existing creator support/payout rules are unchanged; free credits are platform-funded rather than payment revenue.

Home and wallet show the same claim component. Celebration occurs only after a confirmed newly awarded grant. Repeated claims return the existing balance and no duplicate award. The monthly guide and FAQ distinguish free claims from recharge packs. Checkout is still not connected, and no simulated payment grants credits.
