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

**Goal:** Give the shopper an experience, not a document to read and judge — discussion and literacy first, purchase routing only once they're convinced. This is a canonical product page (e.g., "CeraVe Foaming Cleanser"), not a single merchant's listing — the same product may be sold by multiple connected stores.

```
Product Detail Page loads, top to bottom:

1. Product photo(s), name — NO merchant name or price shown yet at this stage
2. Confidence Score (prominent) — tap to expand into its 3 components:
     - Fit match (based on shopper's profile)
     - Community sentiment
     - Ingredient/claim transparency
   Always shown WITH this explanation — never a bare number.
3. Literacy panel — plain-language ingredient/material breakdown, "who this suits"
     - Persistent disclaimer directly beneath: not medical advice, patch-test guidance
4. Video journey — horizontal scroll, tagged by what each video shows ("who this is for,"
   "results over time," "how to use"), not a flat unsorted list
     - Tap a video → plays inline via official embed, never leaves the app
     - Early on, includes real YouTube comments as bootstrap content, always labeled
       "From a YouTube review" — never styled like a Verified Owner post
5. Discovery Feed preview — a small masonry grid (2-3 tiles) of real owner posts: photo,
   short caption, product tag. This is the primary front door into community content —
   browsable and visual, not a list to read and evaluate
     - Tap any tile → opens full Discovery Feed for this product
6. Discussion threads — list of named, topic-specific threads (e.g., "Alternatives for
   oily skin," "3 weeks in — results," "Does this work under makeup?"), not one flat
   Q&A. Each shows a preview of its most recent/relevant post
     - "Start a new thread" available
     - New questions are auto-matched to relevant existing posts (via embedding
       similarity) and shown alongside, clearly labeled "Related" — never implying a
       direct reply from someone who didn't actually see the question
7. Sticky bottom bar: "Add to Satchel" (secondary) + "Get This Product" (primary) +
   Favorite/heart icon

--- Shopper taps "Get This Product" ---

8. Store list reveals (this is where merchants/price first appear):
     - All connected stores selling this exact product (matched via manual tagging in V1, see Data Model)
     - Sortable/filterable: price low-to-high, high-to-low, (later: shipping speed, store rating once store pages exist)
     - Tap a store → opens in an in-app WebView (not the device's separate browser) so the
       Satchel widget can remain visible as a floating overlay while completing purchase
```

**Decision points for us:** Should "Get This Product" collapse the page into the store list, or expand below the existing content? Recommendation: expand/reveal below — so the shopper doesn't lose the context they just built confidence from; the store list feels like the natural next step of the same page, not a separate destination.

**Unfiltered by design:** critical and negative posts in the Discovery Feed and threads are never suppressed or down-weighted relative to positive ones — the page reflects real community sentiment, not a curated highlight reel. Moderation targets harassment/abuse only, never disagreement or product criticism.

**Note on store favoriting:** In V1, there is nothing to favorite at the store level — stores have no in-app presence beyond being a listing source and a destination link. Store-level favorite/follow is a V2 feature, introduced alongside in-app store pages (see V2 Spec) — this also becomes a natural incentive for merchants to want a deeper presence with us, not just basic catalog sync.

---

## 4. Discovery Feed & Discussion Threads (per product)

**Goal:** Let real experience surface in a way that invites browsing and discovery — not a list to read and judge.

```
DISCOVERY FEED (tapped from product page preview)
  → Full masonry/staggered grid: each tile = photo + short caption + poster (Verified
    Owner badge if applicable) + trait tags
  → Scrollable, visually led — tapping a tile opens its full detail (larger photo,
    full caption, replies, link back to the product)
  → A tile from an unrelated but visually/thematically adjacent post can surface here
    too (same "tangential discovery" behavior as browsing Pinterest) — this is
    intentional, not a bug in the feed logic
  → Shopper can post their own: photo + caption + product tag, optionally marked
    Verified Owner if eligible

DISCUSSION THREADS (tapped from product page thread list, or "Start a new thread")
  → Thread view: chronological, with the option to sort by most helpful
      - Each post shows: author (Verified Owner badge if applicable), trait tags,
        text/photo, upvotes, timestamp
      - Question posts are visually distinct from experience/update posts
  → Shopper can:
      - Ask a new question within a thread, or start a new named thread
      - Upvote a helpful post
      - Reply (if they are a Verified Owner or simply replying with their own experience)
  → New questions trigger automatic surfacing of related existing posts (embedding-based
    similarity), labeled "Related," shown before any human has replied — reduces the
    "dead thread" feeling in a young community
  → Verified Owners see a subtle indicator when a new question matches their tagged expertise
```

**Decision points for us:** How do we prevent an empty feed/thread from looking dead on launch? Recommendation: seed the first 20-30 products' feeds and threads manually (as outlined in the V1 build order) with real, useful starter content before opening to the public — an empty community reads as "nobody uses this," which undermines trust immediately. YouTube comment bootstrap content (Segment 6) also helps here, provided the labeling guardrail is respected.

---

## 4b. The Satchel (collection tray)

**Goal:** Remove the friction of having to fully complete one purchase before researching the next — let a shopper collect multiple products they're considering, evaluate them together, and act when ready.

```
Any product page: shopper taps "Add to Satchel"
  → Distinct fly-in animation: the product visibly moves into the floating Satchel
    widget (mascot — cat with a transparent bag, pending final art)
  → Widget persists, floating, across the app as the shopper continues browsing/searching
  → Tapping the widget opens the full Satchel view: every collected product, with
    quick actions (remove, go to product page, mark as purchased)
  → When ready to buy: shopper proceeds via "Get This Product" on any item as usual
  → Store opens in an in-app WebView (not the device's separate browser) — because we
    control this view, the Satchel widget remains visible as a floating overlay WITHIN
    it, so the shopper can reference their full collection while completing purchase
  → If the shopper leaves the app entirely (closes it, opens a different app), the
    Satchel's contents persist silently — no floating overlay follows them outside our
    app (this is a real platform restriction, not a missing feature). On return, a
    gentle nudge references what's still there: "You still have 3 items in your Satchel"
  → Shopper can manually check off items as purchased at any time, in-app or after
    returning from an external store
```

**Decision points for us:** confirmed not building true cross-app floating overlay — iOS does not permit third-party apps to draw over other apps or the system browser, and Android's equivalent permission is increasingly restricted and would read as suspicious rather than delightful to request. The in-app WebView approach delivers the intended feeling without asking for something the platforms won't reliably allow.

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
6. **The community stays unfiltered by design, but moderated for conduct, not opinion** — critical and negative posts are never suppressed or down-weighted relative to positive ones. Moderation removes harassment and abuse; it never removes honest criticism of a product.
7. **External or borrowed content is always visually distinct from platform-native trust signals** — YouTube comments, unaffiliated store links, anything not generated by our own Verified Owner system carries its own clear labeling and never borrows the Verified Owner badge or Confidence Score styling.
8. **Cross-app promises are scoped to what the platforms actually allow** — the Satchel's "carry it with me" experience is real within our own in-app WebView, and honestly limited (with a graceful fallback, not a broken promise) once a shopper leaves the app entirely.

---

## Next Step
Once these flows are agreed/adjusted, they translate directly into wireframes (low-fidelity, screen-by-screen) before any visual UI styling begins — keeping the flow logic separate from and prior to visual design decisions.
