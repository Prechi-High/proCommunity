# Product Spec — V1 (MVP)

**Positioning: "Buying Confidence."** Not a store, not a marketplace, not a trust-badge system. This is the place someone goes *before* buying something unfamiliar — to understand it, see real community proof, and decide with confidence. Price is a filter, not the differentiator.

**Category:** Skincare & beauty (chosen for: high purchase anxiety, strong pre-existing informal community culture, literacy content that's genuinely hard to fake generically, and strong indie-brand presence on Shopify).

**Data/supply strategy:** A Shopify app (public app via Shopify Partner account) that merchants install to automatically list their products in our catalog. This solves cold-start supply without manual vendor onboarding — merchants already have structured product data and an existing trust relationship with Shopify.

**Core differentiator (the actual moat):** Not price comparison (already done well by ShopAIflex, Price.com, Vetted) and not AI-generated literacy alone (replicable by any AI tool). The moat is the **compounding structured community layer**: real verified owners, tagged by relevant traits (e.g., skin type), generating ongoing lived-experience data no AI tool can manufacture.

**What V1 is NOT:** background scanning, voice agent, AI sales rep, payments/checkout, wallet, live/random group calls, scheduled voice rooms, region-based visual search, business registration service, MCP plugin ecosystem, manual Nigeria vendor onboarding. See Section 8 (deferred) and the separate V2 Spec.

---

## 1. Users & Core Jobs

**Shopper** — "Help me decide with confidence whether this product is actually right for me, before I buy it from a Shopify store I've never dealt with."

**Merchant (Shopify store owner)** — "Let people discover my products through a channel that builds real trust, without extra work on my end."

**Verified Owner (a shopper who has purchased)** — "Let me build a reputation for what I actually know, and use this to track my own experience too."

---

## 2. Core Loop

```
Merchant installs Shopify app → catalog auto-syncs into our platform
        ↓
Shopper searches/browses (by category, skin type, concern)
        ↓
Product page shows:
   - Literacy panel (ingredients, who it suits, key facts)
   - Confidence Score (fit match + community sentiment + transparency)
   - Video journey (curated, tagged YouTube content — not a flat list)
   - Discovery Feed (visual, Pinterest-style masonry of real owner posts)
   - Named discussion threads (multiple per product, not one flat Q&A)
   - "Add to Satchel" (collect without committing) or "Get This Product" (reveals stores)
        ↓
Shopper adds product(s) to their Satchel while continuing to browse/search more
        ↓
When ready, opens Satchel → sees full collection → store-coverage view (V2) → 
        proceeds to buy (in-app WebView for connected stores)
        ↓
Shopper returns → marks "I bought this" → becomes eligible to post as a (pending) Verified Owner after a wait period
        ↓
Prompted later (2–4 weeks) to share results → becomes part of the Discovery Feed and discussion threads for future shoppers
```

---

## 3. Feature List — V1 Scope

### A. Merchant Side (Shopify App)
1. **Install via Shopify App Store** (public app, OAuth-based per current Shopify requirements)
2. **Automatic catalog sync** — product name, images, price, description, ingredients (where available in product data), stock status
3. **Merchant dashboard (lightweight)** — see views, click-throughs to their store, opt out of specific products if desired
4. No manual storefront building needed — this is not a storefront-hosting product, it's a discovery/confidence layer sitting in front of Shopify stores

### B. Shopper Side
1. **Account** — sign-up, optional profile traits relevant to skincare (skin type, key concerns) used for personalized fit-matching — clearly explained as improving their own recommendations, not sold to third parties
   - **Skin type quiz** — for users who don't already know their skin type: a short set of questions (e.g., how skin feels by midday, visible shine areas, tightness after washing) infers a likely skin type. Always framed as an estimate based on their answers ("Based on what you told us, you're likely combination — you can always adjust this"), never a diagnosis, with an easy manual override at any time.
2. **Search & browse** — text search, category/concern-based browsing (e.g., "oily skin," "sensitive," "anti-aging")
   - **Keyword-to-attribute search** — literacy content maps skincare-relevant keywords (mattifying, hydrating, fragrance-free, oil-free, dewy, etc.) to product attributes, so a shopper can search or filter by these terms even without knowing exactly which product to look for. Also used to *steer* — e.g., gently flag when a dewy/balmy product is being viewed by someone with oily skin, framed as informational, not restrictive.
3. **Product page:**
   - **Literacy panel** — AI-assisted content on key ingredients, product type, general fit guidance (clearly labeled as general information, not medical advice)
   - **Confidence Score** — composite of (a) fit match to the shopper's stated profile, (b) aggregated community sentiment, (c) ingredient/claim transparency. Never phrased as a safety or efficacy guarantee. Always shown with its explanation — never a bare number.
   - **Video journey** — curated, tagged YouTube content via official embed (organized by "who this is for," "results over time," "how to use," not a flat unsorted list) + optional Verified Owner video uploads. Bootstrapped early with real YouTube comments (via official API, `commentThreads.list`), always clearly labeled "From a YouTube review" and never carrying the Verified Owner badge — this content fades in importance as real on-platform community grows.
   - **Discovery Feed** — a Pinterest-style masonry feed of real owner posts (photo + caption + product tag), browsable and discoverable rather than a flat list to read and judge. This is the primary front door into community content.
   - **Named discussion threads** — multiple separately-titled conversations per product (e.g., "Alternatives for oily skin," "3 weeks in — results"), not one undifferentiated Q&A list. New questions are automatically matched to relevant existing posts (via embedding similarity) and surfaced alongside them, clearly labeled "related" rather than implying a direct reply — this keeps early threads from feeling dead before real community volume exists.
   - **Unfiltered by design** — critical/negative posts are never suppressed or down-weighted relative to positive ones; the platform reflects real community sentiment, not a curated highlight reel. Moderation targets harassment and abuse, never disagreement or criticism of a product.
   - Clear, persistent disclaimer: *"This platform shares community insight and general information, not medical or dermatological advice. Always patch-test new products and consult a professional for skin concerns."*
   - **"Add to Satchel"** — collect a product without committing to buy now, so a shopper can keep browsing/searching before acting on anything (see Section C2)
   - **"Get This Product"** — reveals the store list (price, merchant) only at this step, never earlier on the page
4. **Verified Owner status**
   - Self-attested "I bought this" + time-elapsed gate before posting a full review/update (prevents day-one fake reviews)
   - Category-specific reputation (e.g., recognized specifically for oily-skin/acne-prone insight, not a flat global score)
   - Visible contribution history (badges, streaks, "answered X questions")
5. **Notifications/prompts** — gentle nudges 2–4 weeks after a marked purchase asking for a results update; also notifies relevant Verified Owners when a new question matches their tagged expertise
6. **Favorites/saved items**
7. **Search & profile history** (visible, deletable by user)

### C. The Satchel (collection tray)

Solves a real friction point: evaluating one product at a time and having to complete a purchase before searching for the next. The Satchel lets a shopper collect multiple products they're considering before acting on any of them.

1. **Floating persistent widget** — a mascot (cat with a transparent bag, pending final art direction) visible across the app; tapping a product's "Add to Satchel" triggers a distinct fly-in animation into the widget
2. **Satchel view** — tapping the widget opens the full collection: every product currently gathered, viewable and manageable in one place
3. **In-app WebView carry-through** — when a shopper proceeds to buy from a connected store, it opens in an in-app browser (WebView) we control, not the device's separate browser app. Because we control that view, the Satchel widget remains visible as a floating overlay *within it* — this delivers the "carry my tray with me" experience the founder wants, scoped to what's technically achievable (true cross-app overlay is blocked by iOS platform restrictions and is explicitly out of scope, not deferred)
4. **Persistence across sessions** — if a shopper leaves the app entirely, the Satchel's contents persist; on return, a gentle nudge references what's still in it ("You still have 3 items in your Satchel") rather than a literal floating reminder outside the app
5. **Manual purchase logging** — shopper can check off items in the Satchel as bought (in-app or after returning from an external store), feeding into Verified Ownership eligibility

### D. Retention Layer — "Your Shelf & Routine" (why they come back daily/every 2 days)

This is the structural fix for the biggest weakness of a pure pre-purchase decision tool: without it, the app is only opened at the moment of a buying decision, which may be months apart. Skincare has a natural daily-use behavior (a routine) that most product categories don't — this layer builds the app around that real behavior rather than manufacturing artificial urgency.

1. **Routine tracker (AM/PM)**
   - User builds a simple routine from products they own/marked as purchased (auto-suggested from purchase history, editable)
   - Daily check-off for morning/evening steps, with gentle reminder notifications at user-set times
   - **Routine-adherence streak** — tied strictly to actual routine completion, never to generic "app opens." Framed gently (encouragement, not loss-punishment messaging)
2. **Progress photo journal**
   - Private by default; user can optionally attach photos to a product/date (e.g., "week 4 with [Product]")
   - Can be shared to the product's community thread as Verified Owner evidence, at the user's choice — never automatic
3. **Product monitoring & alerts**
   - **Refill alerts** — estimated based on typical product duration + logged usage frequency ("you're probably running low")
   - **Expiry tracking** — especially important for actives (retinoids, acids) where expired product can irritate skin; this is protective, not just an engagement hook
   - **Price-drop alerts** on favorited/wishlist items
4. **"Your Shelf" home view**
   - A living view of owned/tracked products, surfacing: new community activity on products they own, literacy updates, refill/expiry flags, relevant new questions in their area of contributed expertise
   - This is the main reason to open the app between purchases — a standing reference tied to what they actually use, not a generic feed

**Guardrail (per Guiding Principles #7 and the Tier 3 discussion):** No manufactured urgency (fake scarcity, fake countdowns), no variable/randomized reward mechanics, no streak tied to anything other than genuine routine adherence. Every notification in this layer must be tied to something real and specific to that user — not generic re-engagement pushes.

---

### E. Platform / Admin (you)
1. Merchant app review/monitoring (basic — Shopify's own app store review process handles initial vetting)
2. Content moderation — critical here: enforce no medical/health-outcome claims (e.g., "cures acne") in community posts; redirect serious adverse-reaction reports toward the merchant/manufacturer and general medical guidance, not platform-handled resolution; moderation targets harassment/abuse, never disagreement or product criticism
3. Basic analytics: installs, searches, click-throughs to merchant stores, community activity (questions asked/answered, contribution rate), Satchel usage (items added, conversion to purchase)

---

## 4. Screens

1. Onboarding / shopper profile setup (skin type, concerns — optional but encouraged)
2. **Your Shelf (home screen)** — owned/tracked products, routine status, alerts, relevant community activity
3. Search/browse
4. Search results (grid/list, filterable by concern, price, skin type match)
5. Product detail page (literacy, Confidence Score, video journey, Discovery Feed, threads, click-through)
6. **Discovery Feed** (masonry view, per product and/or global)
7. **Discussion thread list + individual thread view** (per product, multiple named threads)
8. Verified Owner profile (reputation, badges, contribution history, personal usage log)
9. **Routine tracker** (AM/PM check-off, streak, reminder settings)
10. **Progress journal** (photo timeline per product, private/shareable toggle)
11. **The Satchel** (collection view, store-readiness, in-app WebView checkout)
12. Favorites/wishlist page (with price-alert settings)
13. Merchant dashboard (Shopify app side — separate lightweight interface)
14. Admin panel (moderation queue, flagged content, analytics)

---

## 5. Data Model (high level)

- **User** (id, email/phone, skin_type, concerns[], role: shopper (default; verified_owner is a status, not a separate role))
- **Merchant** (id, shopify_store_id, store_name, connected_at)
- **Product** (id, name, brand, ingredients[], category, key_attributes[], created_at) — the canonical product; community, literacy, and Confidence Score all attach here, never to a single merchant's listing
- **Listing** (id, product_id, merchant_id, shopify_product_id, price, images[], stock_status, synced_at) — one product can have many listings across connected merchants; matched manually in V1 (see Section 8/build notes), automated matching (UPC/fuzzy match) is a V2 refinement
- **LiteracyEntry** (id, attribute_tag e.g. "salicylic_acid", content) — attached to products via shared attributes/ingredients, not written per-SKU, so it scales independently of catalog size
- **ConfidenceScore** (product_id, user_id, fit_match_score, sentiment_score, transparency_score) — computed per shopper-product pair, not a single global number
- **CommunityPost** (id, product_id, thread_id, user_id, type: question/answer/update/feed_post, text, photo_url, trait_tags[], is_verified_owner: bool, upvotes, status: visible/flagged/removed, created_at) — attached to the canonical product, shared across all its listings; `thread_id` groups posts into named discussions; feed_post type powers the Discovery Feed
- **DiscussionThread** (id, product_id, title, created_by, created_at) — a single named conversation (e.g., "Alternatives for oily skin"); a product has many threads
- **PostEmbedding** (post_id, embedding vector) — pgvector column powering AI-assisted related-post surfacing on new questions
- **YouTubeComment** (id, product_id or attribute_tag, youtube_video_id, author_display, text, fetched_at) — bootstrap content only; always rendered with "From a YouTube review" labeling, never assigned Verified Owner status
- **SatchelItem** (id, user_id, product_id, added_at, purchased: bool, purchased_at) — the collection tray; a product can be added without committing to "Get This Product"
- **VerifiedOwnership** (user_id, product_id, purchase_marked_at, eligible_to_post_at)
- **Reputation** (user_id, category_tag, score, contribution_count)
- **Favorite** (user_id, product_id, price_alert_enabled: bool, last_known_price) — favorites the canonical product, not a specific store's listing
- **RoutineStep** (id, user_id, product_id, time_of_day: AM/PM, order, active: bool)
- **RoutineLog** (id, user_id, date, completed_steps[], streak_count)
- **ProgressEntry** (id, user_id, product_id, photo_url, note, date, shared_to_community: bool)
- **UsageEstimate** (product_id, user_id, purchase_date, estimated_duration_days, expiry_date)

---

## 6. Explicit Trust & Legal Guardrails (build in from day one)

- No pay-to-rank in search or Confidence Score — merchant relationship (via the Shopify app) is entirely separate from ranking logic
- Confidence Score and literacy panels **never** state safety/efficacy guarantees — always framed as reported experience/general information
- Mandatory, persistent disclaimer on every product and community page (see wording above)
- Patch-test guidance surfaced prominently as standard platform advice, not optional fine print
- Community guidelines explicitly prohibit medical/health-outcome claims; moderation actively enforces this, not just a buried ToS clause
- Adverse-reaction reports are routed toward the merchant/manufacturer and general medical guidance — platform is clear it is not the responsible party for product outcomes
- Get actual Terms of Service and liability language reviewed by a real lawyer before launch — this is not a template situation given health-adjacent community content
- No incentive (points, discounts, features) is ever tied to review sentiment — only to participation/helpfulness, to protect review integrity

---

## 7. Video Content Architecture

- **Curated video journey, not a flat list** — YouTube content via official embed, organized by tags ("who this is for," "results over time," "how to use") per product or per key ingredient/attribute, using YouTube's official embed player (never scraping/downloading)
- **YouTube comments as bootstrap content** — pulled via the official `commentThreads.list` endpoint (legitimate API use, not scraping), used to make early threads feel populated before real community volume exists. Always visually distinct, labeled "From a YouTube review," never carrying the Verified Owner badge or contributing to Reputation — this fades in relative importance as real on-platform content grows
- **Verified Owner video uploads** — optional, encouraged for "results over time" updates; carries the same disclaimer treatment as text reviews (individual experience, not guaranteed results)

---

## 8. Explicitly Deferred (V2+ — see separate V2 Spec)

| Feature | Why deferred |
|---|---|
| Scheduled voice "office hours" rooms | Needs a functioning reputation system and real community activity first; real-time infra is a bigger technical lift |
| Region-based ("select part of image") visual search | Needs third-party API integration + large catalog volume to return good matches |
| Random/live group calls with owners | Superseded by the scheduled, opt-in voice room model — see V2 |
| Payments/checkout in-app | Sale happens on merchant's Shopify store in V1; no need to duplicate checkout |
| Manual Nigeria vendor onboarding / non-Shopify markets | Shopify app is the V1 supply strategy; other markets/mechanisms are a later expansion, not parallel to V1 |
| WooCommerce/WordPress plugin | Logical next integration after Shopify app is proven — sequenced, not simultaneous |
| **Global product reach beyond Shopify** (any product online, unaffiliated store handoff) | Expanding reach before the Shopify-sourced core loop is proven repeats the "too much at once" pattern already corrected elsewhere in this build |
| **Satchel store-coverage matching** (which store(s) cover a full collection) | Depends on multi-listing data from global reach being solid first |
| **Your Trail** (lifetime product history, shareable/comparable) | Needs V1's routine/progress-entry primitives proven first; sequenced early in V2 given retention/shareability value |
| **Cred** (category-wide product dominance score) | Needs real community scale to be meaningful — misleading with a small sample |
| Dedicated community terminology naming session | Naming works better once the product feel from V1.1 UX changes is locked |
| MCP-style plugin ecosystem, AI sales rep, business registration service, stored-value wallet | Unchanged from earlier — still out of scope, no new rationale needed |

---

## 9. Suggested Build Order (Cursor + Expo/React Native + Supabase, web-first)

1. Shopper account + profile (skin type, concerns)
2. Manually seed a starter catalog (a small batch of real skincare products, entered by hand) to avoid an empty-shelf launch while the Shopify app is being built/reviewed
3. Search/browse + product detail page (literacy panel manually written for starter catalog) — **no listings data on this route**
4. Discussion threads (named, multiple per product) — seed initial content yourself for popular products
5. Discovery Feed (masonry) — seed with real early photos/captions where possible
6. AI-assisted related-post surfacing (pgvector embeddings on new posts)
7. Verified Owner marking + basic reputation/badges
8. Confidence Score v1 (can start simple — even a basic weighted formula — refine later; always shown with its explanation)
9. Video journey (YouTube embed + tagged organization first; YouTube comments bootstrap; owner uploads once storage/moderation is ready)
10. The Satchel — collection widget, add animation, in-app WebView carry-through
11. Build and submit the Shopify public app in parallel — once approved, real catalog sync replaces/expands manual seeding
12. Notification prompts (2–4 week check-in for reviews)
13. **Retention layer:** routine tracker + reminders → progress journal → refill/expiry/price alerts → "Your Shelf" home view
14. Get real usage data → this becomes your investor pitch material

---

## 10. Success Metrics for V1

- Product-page engagement: % of views where literacy panel, community thread, or video is opened before click-through
- Community health: questions asked vs. answered ratio, average time-to-answer, Verified Owner participation rate after prompt
- Click-through rate to merchant stores (your core value delivery signal)
- Retention: % of shoppers returning to search/browse within 7 days
- **Routine engagement:** % of users with an active routine who log 4+ times/week, average streak length
- **DAU/every-other-day-AU:** % of users opening the app at least once every 2 days — the direct measure of whether the retention layer is working
- Merchant side: install-to-active-catalog rate (once Shopify app is live)
