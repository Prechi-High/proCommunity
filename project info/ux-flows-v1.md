# UX Flows — V1

Purpose: define how each part of the product works and connects *before* visual design. Each section describes the flow, the decisions a user makes at each step, and what the system shows/does in response. Once these are agreed, they translate directly into wireframes.

---

## 1. Onboarding & Profile Setup

**Goal:** Get a shopper to a useful first experience fast, while capturing just enough profile data to power personalization — without demanding it.

```
Open app (first time)
  → Brief value explanation (1-2 screens max: "Buying confidence, before you buy")
  → Sign up (email/phone)
  → Optional profile prompt: "Help us tailor this to you"
      - Skin type (dry/oily/combination/sensitive/normal) — single select
          OR "Not sure? Take a quick quiz" → 4-5 short questions (midday shine,
          tightness after washing, visible pores, etc.) → suggests a likely skin
          type, framed as an estimate ("Based on your answers, you're likely
          combination — you can change this anytime"), never a diagnosis
      - Key concerns (acne, aging, sensitivity, hyperpigmentation, etc.) — multi-select
      - Skip option available — profile can be completed later from settings
  → Land on "Your Shelf" (home) — empty state explains what it will fill up with
```

**Decision points for us:** How much friction is acceptable before first value? Recommendation: allow full skip of profile setup — a shopper can search and browse immediately; personalization (Confidence Score fit-match, routine suggestions) simply improves once profile is filled in, prompted contextually later ("Want a better match? Tell us your skin type") rather than gating entry.

---

## 2. Search & Browse

**Goal:** Get to a relevant product fast, whether the shopper knows exactly what they want or is exploring.

```
Shopper taps Search
  → Text input (autocomplete suggests categories/products/concerns as they type)
  → OR taps a browse category/concern tile (e.g., "Oily Skin", "Anti-Aging")
  → Results list:
      - Product thumbnail, name, price, Confidence Score badge (visible at a glance)
      - Filters available: price range, concern, skin type match, condition/category
      - Default sort: relevance/fit — never pay-to-rank
  → Tap a product → Product Detail Page
```

**Decision points for us:** Confidence Score should be visible in the results list, not just the product page — it's the differentiator, so it needs to be scannable before a click, not buried. Recommend a simple visual indicator (not just a number) — e.g., a short label like "Strong match" / "Mixed feedback" alongside a score, so it's meaningful at a glance without requiring interpretation.

---

## 3. Product Detail Page (the core screen — most design attention goes here)

**Goal:** Give the shopper everything they need to decide with confidence — discussion and literacy first, purchase routing only once they're convinced. This is a canonical product page (e.g., "CeraVe Foaming Cleanser"), not a single merchant's listing — the same product may be sold by multiple connected stores.

```
Product Detail Page loads, top to bottom:

1. Product photo(s), name — NO merchant name or price shown yet at this stage
2. Confidence Score (prominent) — tap to expand into its 3 components:
     - Fit match (based on shopper's profile)
     - Community sentiment
     - Ingredient/claim transparency
3. Literacy panel — plain-language ingredient/material breakdown, "who this suits"
     - Persistent disclaimer directly beneath: not medical advice, patch-test guidance
4. Video panel — horizontal scroll: YouTube embeds + Verified Owner uploads
     - Tap a video → plays inline (in-app browser/embed), never leaves the app
5. Community thread preview — top 2-3 Q&A/experience posts, trait-tagged (e.g., "oily skin, 3 months in")
     - "View all / Ask a question" → full Community Thread view
6. Reviews summary (aggregated, tied into Confidence Score's sentiment component)
7. Sticky bottom bar: "Get This Product" button + Favorite/heart icon (favorites the product itself)

--- Shopper taps "Get This Product" ---

8. Store list reveals (this is where merchants/price first appear):
     - All connected stores selling this exact product (matched via manual tagging in V1, see Data Model)
     - Sortable/filterable: price low-to-high, high-to-low, (later: shipping speed, store rating once store pages exist)
     - Tap a store → routes out to that merchant's Shopify store to complete purchase
```

**Decision points for us:** Should "Get This Product" collapse the page into the store list, or expand below the existing content? Recommendation: expand/reveal below — so the shopper doesn't lose the context they just built confidence from; the store list feels like the natural next step of the same page, not a separate destination.

**Note on store favoriting:** In V1, there is nothing to favorite at the store level — stores have no in-app presence beyond being a listing source and a destination link. Store-level favorite/follow is a V2 feature, introduced alongside in-app store pages (see V2 Spec) — this also becomes a natural incentive for merchants to want a deeper presence with us, not just basic catalog sync.

---

## 4. Community Thread (per product)

**Goal:** Let real experience surface, be askable, and be trustworthy without needing to be flashy.

```
Shopper taps "View all" from product page or "Ask a question"
  → Thread view: chronological or top-voted toggle
      - Each post shows: author (Verified Owner badge if applicable), trait tags, text/photo/video, upvotes, timestamp
      - Question posts are visually distinct from experience/update posts
  → Shopper can:
      - Ask a new question (routed as a notification to Verified Owners with matching trait tags)
      - Upvote a helpful post
      - Reply (if they are a Verified Owner or simply replying with their own experience)
  → Verified Owners see a subtle indicator when a new question matches their tagged expertise
```

**Decision points for us:** How do we prevent an empty thread from looking dead on launch? Recommendation: seed the first 20-30 products' threads manually (as outlined in the V1 build order) with real, useful starter Q&A before opening to the public — an empty community reads as "nobody uses this," which undermines trust immediately.

---

## 5. Verified Owner Status & Reputation

**Goal:** Make contribution feel meaningful and status-worthy, without turning into a vanity-metrics popularity contest.

```
Shopper marks "I bought this" on a product (self-attested)
  → Status: Pending Verified Owner (visible only to them)
  → After a set wait period (e.g., 2 weeks) → eligible to post as Verified Owner
  → Prompted (gentle notification): "How's [Product] working out?"
  → First post as Verified Owner → badge appears next to their name on that product's community
  → Reputation accrues per category tag (e.g., "oily skin" reputation), not as one global score
  → Owner Profile page: shows badges, category-specific reputation, contribution history, and links to their own routine/progress journal (if shared)
```

**Decision points for us:** Reputation should never be a leaderboard/ranking against other users — that invites gaming and status-chasing disconnected from actual helpfulness. Recommendation: show individual reputation and contribution history, not a competitive ranked list.

---

## 6. "Your Shelf" (Home Screen / Retention Layer)

**Goal:** Give a returning shopper an immediate, personal reason to be here — even when they're not actively shopping.

```
Shopper opens app (returning visit)
  → Lands on "Your Shelf" (not search) if they have any tracked/owned products
  → Shelf shows, prioritized by relevance:
      1. Today's routine status (AM/PM steps, checkmarks, streak indicator)
      2. Any alerts: refill needed, expiry approaching, price drop on a favorite
      3. New community activity on products they own or have contributed to
      4. Suggested next step (e.g., "Add a progress photo for Product X — it's been 4 weeks")
  → Search/browse remains one tap away (persistent nav), but is not the default landing view once a shelf exists
```

**New-user state (zero tracked products) — must NOT be a blank page.**
A blank Shelf reads as "empty tool, no one's here," which directly undermines the community-driven trust the whole product is built on. But it also must never fabricate scale ("millions of users") we don't actually have — that would violate Guiding Principle 4 outright, and it's a weaker signal anyway once someone senses it's not real. Instead, show real presence that exists independent of this user's own activity:

```
New user lands on Shelf (no tracked products yet)
  → "Trending in [their stated skin type/concern]" — real products from the
    seeded starter catalog, with real Confidence Scores if available
  → "Being discussed right now" — real snippets pulled from seeded/early
    community threads (actual Q&A, not placeholder text)
  → Honest, specific numbers as the platform grows — e.g., "127 people are
    tracking this" — never vague/inflated claims; small real numbers are
    more trustworthy than big fake ones, and the copy pattern scales
    naturally as the user base actually grows
  → Light prompt: "Search or scan a product to start your own Shelf"
```

If the user skipped profile setup (no skin type/concerns on file), default to overall trending/most-discussed products platform-wide rather than a generic empty message.

---

## 7. Routine Tracker

**Goal:** Make daily logging fast enough to be frictionless — this only works if it takes seconds, not minutes.

```
Shopper builds a routine (from Shelf or Product page: "Add to my routine")
  → Assign to AM, PM, or both; set order (optional, drag to reorder)
  → Daily reminder notification at user-set time
  → Tap notification or open Shelf → checklist view → tap each step to check off
  → All steps checked → streak increments, small positive confirmation (not celebratory/gamified overload — a quiet acknowledgment, not a dopamine spike)
  → Missed day → streak resets quietly, no shaming language, no guilt-based copy
```

**Decision points for us:** Notification copy and in-app messaging around streaks must avoid loss-aversion/guilt framing (per Guiding Principles — no manufactured urgency or manipulative reward mechanics). Recommend: "Pick up where you left off" rather than "You lost your streak!"

---

## 8. Progress Journal

**Goal:** Let shoppers document their own experience for themselves first, community second.

```
From Product page or Shelf: "Add a progress entry"
  → Attach photo (optional), short note, auto-dated
  → Default: private, visible only to the user
  → Toggle: "Share to community" (off by default) — if enabled, appears in that product's Community Thread as Verified Owner evidence
  → Timeline view per product: chronological photo/note history
```

**Decision points for us:** Sharing must always be an explicit, per-entry opt-in — never a default or bulk action, per Guiding Principle 5 (consent/transparency over convenience).

---

## 9. Alerts (Refill / Expiry / Price)

**Goal:** Surface timely, useful nudges without becoming spammy or manipulative.

```
System calculates (in background):
  - Refill estimate: purchase date + typical product duration + logged usage frequency
  - Expiry: purchase date + product shelf-life data (where known)
  - Price: periodic check against merchant's listed price for favorited items
Triggers a notification/Shelf badge when:
  - Refill estimate reached → "You may be running low on [Product]"
  - Expiry approaching → "[Product] may be expiring soon — worth checking"
  - Price drops on a favorite → "[Product] price dropped to [X]"
Shopper taps → goes to product page or directly to merchant link
```

**Decision points for us:** All alerts must reflect real, calculated data — never simulated urgency. If we don't have reliable duration/expiry data for a product yet, don't show a fake estimate; omit the alert rather than guess convincingly.

---

## 10. Merchant Side (Shopify App)

**Goal:** Zero-effort installation and ongoing value visibility for the merchant — this is not their primary workspace, just a connected utility.

```
Merchant finds app in Shopify App Store (or via direct install link)
  → Install → OAuth permission screen (clear about what data is accessed: product listings, images, pricing — not customer data)
  → Approve → catalog begins syncing automatically (webhook-driven, ongoing)
  → Merchant dashboard (lightweight, separate from shopper app):
      - View count per product
      - Click-throughs to their store
      - Option to opt a specific product out of listing
  → No further action required from merchant unless they want to review stats
```

**Decision points for us:** Keep this dashboard minimal for V1 — merchants shouldn't need to "manage" anything actively; the value proposition is passive discovery, not another dashboard to maintain.

---

## Cross-Cutting UX Principles (apply to every flow above)

1. **Disclaimers are persistent, not buried** — every screen involving product claims or health-adjacent content carries the standard disclaimer, visible without needing to seek it out.
2. **No dark patterns anywhere** — no fake urgency, no guilt-based copy, no default-on sharing, no pay-to-rank visual tricks.
3. **Every notification must be specific and real** — tied to actual user data (their routine, their favorites, their contributed expertise) — never a generic "come back!" push.
4. **Purchase routing is a deliberate second step, not the first thing shown** — the shopper sees discussion and literacy before any merchant or price appears; "Get This Product" is always accessible (sticky bar) but reveals store options only when tapped, reinforcing "confidence layer," not "sales funnel."
5. **Empty states must show real community presence, never fabricated scale** — a new user's Shelf, an unseeded community thread — each needs to surface genuine activity (trending products, real discussion snippets) so absence of *personal* history never reads as absence of *community*. Never invent numbers or activity that isn't real (Principle 4) — small honest signals build more trust than big vague ones.

---

## Next Step
Once these flows are agreed/adjusted, they translate directly into wireframes (low-fidelity, screen-by-screen) before any visual UI styling begins — keeping the flow logic separate from and prior to visual design decisions.
