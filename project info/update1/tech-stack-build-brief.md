# Technical Build Brief — V1

This document is written to be handed directly to Cursor (or any developer) as the authoritative build spec. It assumes the product decisions in `product-vision.md`, `v1-product-spec.md`, `ux-flows-v1.md`, `guiding-principles.md`, and `brand-identity.md` are settled.

---

## 1. Project Goal in One Paragraph

Build a mobile-first product called **Sourced** (working name): a "buying confidence" layer for skincare and beauty. Shoppers search a canonical product, read ingredient/literacy info, see a personalized Confidence Score, watch embedded video, and read real experience from verified owners — *before* any merchant or price is shown. Only when the shopper taps "Get This Product" do we reveal the list of stores selling it. The app also tracks their skincare routine, progress photos, and price/refill alerts so they return between purchases. Product catalog is sourced from connected Shopify merchants (and a seeded manual catalog at launch). We never take payment and never hold inventory.

---

## 2. Tech Stack

### Core decision: one codebase, web + native, shared backend

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict mode) | Type safety across shared code between web and native |
| Framework | **React Native + Expo (SDK 54+)**, using **Expo Router** | Expo exports the *same* codebase to iOS, Android, and web — this is the literal answer to "web now, app later, no rebuild" |
| Web target | **Expo Web** (React Native Web under the hood) | Ship the web app first to gather real usage data; compile native later from identical code |
| Styling | **NativeWind v4** (Tailwind for React Native) | Works identically on web and native; design tokens map cleanly to the brand system |
| Animation | **Moti + React Native Reanimated** | Gives a Framer-Motion-like declarative API but actually runs on React Native — Framer Motion itself is DOM-only and won't run in the native app, so using it would split the codebase's animation system across platforms |
| Navigation | **Expo Router** (file-based) | URL-addressable routes on web, native stack/tabs on mobile, one routing definition |
| State (server) | **TanStack Query v5** | Caching, refetch, optimistic updates for all Supabase reads |
| State (client) | **Zustand** | Lightweight; only for genuinely local UI state (filters, quiz progress) |
| Forms | **React Hook Form + Zod** | Zod schemas shared between client validation and server-side edge function validation |
| Backend / DB | **Supabase** (Postgres + Auth + Storage + Row Level Security + Edge Functions) | Portable, free tier, not locked to any builder platform; RLS gives us per-user data isolation without writing an API layer |
| Shopify connector | **Supabase Edge Functions** (Deno/TypeScript) | Handles OAuth callback, Admin API calls, and webhook verification server-side. Never in the client. |
| Background jobs | **Supabase pg_cron + Edge Functions** | Price polling, refill/expiry checks, digest notifications |
| Web hosting | **Vercel** (Expo web export) | Free tier, instant deploys, preview branches |
| Native builds | **EAS Build** (Expo Application Services) | Needed only when we go to app stores — not for V1 web launch |
| Push notifications | **Expo Notifications** | Unified API across iOS/Android; web falls back to in-app + email |
| Analytics | **PostHog** (self-host or cloud free tier) | Event tracking for the V1 success metrics; privacy-respecting, EU hosting option |
| Error tracking | **Sentry** | React Native + web SDK from one config |
| Testing | **Vitest** (unit), **React Native Testing Library** (component), **Playwright** (web E2E) | — |
| Linting | **ESLint + Prettier + TypeScript strict** | — |

### Environment variables (never commit these)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # Edge Functions only, never client
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_WEBHOOK_SECRET
YOUTUBE_DATA_API_KEY
EXPO_PUBLIC_POSTHOG_KEY
SENTRY_DSN
```

---

## 3. External Services — What We Call and What We Explicitly Do Not

### ✅ Services we integrate

**Shopify Admin API (GraphQL, 2026-01 or later)**
- Purpose: pull merchant product catalogs after they install our public app
- Auth: **OAuth 2.0** via the Shopify Dev Dashboard (token-exchange flow — the older simple-token method was retired in January 2026)
- Scopes requested: `read_products`, `read_inventory`. **Do not request customer or order scopes** — we have no need for them and asking erodes merchant trust
- Sync: register webhooks for `products/create`, `products/update`, `products/delete`, and `app/uninstalled`. Verify every webhook with HMAC using `SHOPIFY_WEBHOOK_SECRET` before processing. Poll as a nightly fallback only
- Rate limits: GraphQL uses a calculated-cost leaky bucket — implement exponential backoff and respect `throttleStatus` in responses

**YouTube Data API v3 + official YouTube embed player**
- Purpose: find and display educational/review videos per product or per ingredient
- Method: `search.list` to find videos by query (e.g. "niacinamide serum review oily skin"), then render results using the **official YouTube iframe embed** (`react-native-youtube-iframe` on native, standard iframe on web)
- Quota: default 10,000 units/day; a `search.list` call costs 100 units. **Cache search results in Postgres per product for at least 7 days** — do not call the API on every product page view or we will exhaust quota in hours

**Supabase Storage**
- Purpose: verified-owner progress photos and owner-uploaded videos
- Buckets: `progress-photos` (private, RLS-protected, signed URLs only), `owner-videos` (private until the owner explicitly shares)

**Expo Notifications / Resend (email)**
- Purpose: routine reminders, refill/expiry alerts, price drops, "someone answered your question"

**Open Beauty Facts (seeding/testing only)**
- Purpose: a free, open-licensed cosmetics product database (from the Open Food Facts project) with names, brands, and ingredient lists — useful to populate a realistic test catalog before real Shopify merchants connect
- Use: one-time import script into the `products` table with `source = 'seed'`. Verify current API endpoint and licence/attribution requirements before shipping anything public with this data
- This is **test/seed data only** — it is not a live integration and must not be presented to users as verified merchant inventory

### ❌ Services we deliberately do NOT integrate (and why)

These were considered and ruled out earlier. Do not add them "for convenience":

| Service | Why not |
|---|---|
| **TikTok video scraping / download** | Downloading or rehosting TikTok content violates their Terms of Service and is a copyright exposure. TikTok has no general public search API for this purpose. If TikTok content is ever used, it must be via their **official oEmbed embed** of public posts only — never downloaded, never rehosted |
| **Instagram Reels scraping** | Same reasoning. Official oEmbed for public posts only, if ever |
| **Telegram bot video pulling** | The "Telegram bots that fetch YouTube/TikTok videos" approach works by scraping/downloading media files. It violates platform ToS, breaks constantly when platforms patch it, and creates direct copyright liability for us. **Not used under any circumstances** |
| **Any web scraping of Jumia/Konga/competitor catalogs** | ToS violation and legal exposure. Product data comes from Shopify's official API or manual seeding only |
| **Payment processing (Paystack/Flutterwave/Stripe)** | V1 takes no payments. The purchase happens on the merchant's own Shopify store. Do not build checkout |
| **Any third-party ad network** | V1 has no ads. Monetization (Product Drops) is V2 and will be built in-house with explicit labeling |

---

## 4. Database Schema (Supabase / Postgres)

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, and `updated_at timestamptz`. Row Level Security is **enabled on every table** — no exceptions.

### Identity & profile

**`profiles`** (extends `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid PK | FK → `auth.users.id` |
| display_name | text | |
| skin_type | text | enum: `dry`, `oily`, `combination`, `sensitive`, `normal`, `unknown` |
| skin_type_source | text | `self_selected` or `quiz_estimated` — we must never present a quiz result as fact |
| concerns | text[] | e.g. `{acne, aging, hyperpigmentation}` |
| country | text | ISO code |
| notification_prefs | jsonb | granular per-type opt-ins |
| brand_drops_opt_in | boolean default false | **must default false** — separate consent for V2 Product Drops |

**`quiz_responses`** — `id`, `user_id`, `answers jsonb`, `inferred_skin_type`, `created_at`. Keep history so users can retake.

### Catalog (canonical product vs. per-merchant listing — this split is critical)

**`products`** — the canonical product. Community, literacy, and Confidence Score attach **here**, never to a merchant's listing.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| brand | text | |
| description | text | |
| category | text | `cleanser`, `serum`, `moisturizer`, `spf`, etc. |
| ingredients | text[] | normalized, lowercase INCI names |
| attribute_tags | text[] | `{mattifying, fragrance_free, oil_free}` — powers keyword search |
| suits_skin_types | text[] | derived from attributes + community data |
| hero_image_url | text | |
| typical_duration_days | int | for refill estimates; nullable |
| shelf_life_months | int | for expiry alerts; nullable |
| source | text | `seed` or `shopify` |
| barcode | text | UPC/EAN where known — used later for automated dedup |

**`merchants`** — `id`, `shopify_shop_domain` (unique), `shop_name`, `access_token_encrypted`, `installed_at`, `uninstalled_at`, `is_active`.
> Store the Shopify access token **encrypted**, accessible only to Edge Functions via the service role key. Never expose to the client.

**`listings`** — one product can have many listings across merchants.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | **manually matched in V1** |
| merchant_id | uuid FK → merchants | |
| shopify_product_id | text | |
| shopify_variant_id | text | |
| price | numeric(10,2) | |
| currency | text | |
| in_stock | boolean | |
| product_url | text | the outbound link to the merchant's store |
| opted_out | boolean default false | merchant can hide a specific product |
| last_synced_at | timestamptz | |

**`price_history`** — `id`, `listing_id`, `price`, `recorded_at`. Powers price-drop alerts. Insert only on change, not every poll.

### Literacy & scoring

**`literacy_entries`** — `id`, `attribute_tag` (unique, e.g. `niacinamide`), `title`, `body`, `source_note`.
> Attached to products by matching `attribute_tag` against `products.ingredients` / `products.attribute_tags`. **Write once per ingredient, applies to every product containing it** — this is why the literacy layer scales independently of catalog size.

**`confidence_scores`** — computed per shopper × product, cached.
| column | type | notes |
|---|---|---|
| user_id | uuid | |
| product_id | uuid | |
| fit_match_score | int | 0–100, from profile vs. `suits_skin_types` |
| sentiment_score | int | 0–100, from community posts |
| transparency_score | int | 0–100, from ingredient-labeling completeness |
| composite_score | int | weighted; recomputed on community change |
| computed_at | timestamptz | |

> **Never render a composite score without the plain-language explanation of its three components.** A bare number is an unexplained verdict and conflicts with the product's positioning.

### Community & reputation

**`ownerships`** — `id`, `user_id`, `product_id`, `marked_purchased_at`, `eligible_to_post_at` (= marked + 14 days), `is_verified` (boolean, true once eligible).

**`discussion_threads`** — `id`, `product_id`, `title`, `created_by`, `created_at`. A product has many named threads (e.g., "Alternatives for oily skin"), not one flat Q&A list.

**`community_posts`** — `id`, `product_id`, `thread_id` (nullable — null for Discovery Feed posts), `user_id`, `parent_post_id` (nullable, for replies), `type` (`question` | `answer` | `experience` | `update` | `feed_post`), `body`, `photo_path` (nullable, used by `feed_post`), `trait_tags text[]`, `is_verified_owner`, `helpful_count`, `status` (`visible` | `flagged` | `removed`).

**`post_embeddings`** — `post_id`, `embedding vector(1536)` (pgvector). Generated on post creation; queried for nearest-neighbor similarity when a new question is posted, to surface related existing content automatically.

**`youtube_comments`** — `id`, `product_id` (nullable), `attribute_tag` (nullable), `youtube_video_id`, `author_display_name`, `body`, `fetched_at`. Bootstrap content only. **Never** joined or displayed with `is_verified_owner = true` styling — always rendered with a distinct "From a YouTube review" label.

**`satchel_items`** — `id`, `user_id`, `product_id`, `added_at`, `purchased boolean default false`, `purchased_at`. The collection tray; adding an item here is distinct from and does not require visiting the store list.

**`post_votes`** — `post_id`, `user_id`, unique composite. Helpful-marks only; no downvotes in V1.

**`reputation`** — `user_id`, `category_tag`, `score`, `contribution_count`, unique on (`user_id`, `category_tag`).
> Reputation is **per category** (e.g. "oily skin"), never a single global number, and **never rendered as a leaderboard or user-vs-user ranking**.

**`moderation_reports`** — `id`, `post_id`, `reporter_id`, `reason`, `status`, `resolved_by`, `resolved_at`.

### Retention layer

**`routines`** — `id`, `user_id`, `time_of_day` (`am` | `pm`), `reminder_time`, `is_active`.
**`routine_steps`** — `id`, `routine_id`, `product_id`, `step_order`.
**`routine_logs`** — `id`, `user_id`, `routine_id`, `log_date` (date), `completed_step_ids uuid[]`, unique on (`user_id`, `routine_id`, `log_date`).
**`streaks`** — `user_id`, `current_streak`, `longest_streak`, `last_logged_date`.
**`progress_entries`** — `id`, `user_id`, `product_id`, `photo_path`, `note`, `entry_date`, `is_shared boolean default false`.
> `is_shared` **must default to false**, and sharing is per-entry only. No bulk-share action exists.

**`favorites`** — `user_id`, `product_id`, `price_alert_enabled boolean default true`, `last_notified_price`.
**`usage_estimates`** — `user_id`, `product_id`, `started_at`, `estimated_empty_date`, `expiry_date`.
**`notifications`** — `id`, `user_id`, `type`, `payload jsonb`, `read_at`, `sent_at`.

**`video_cache`** — `id`, `product_id` (nullable), `attribute_tag` (nullable), `youtube_video_id`, `title`, `channel_title`, `thumbnail_url`, `fetched_at`.
> Cache YouTube search results here for ≥7 days. Never call the Data API on page render.

### Row Level Security policy summary
- `profiles`, `routines`, `routine_logs`, `progress_entries`, `favorites`, `notifications`, `usage_estimates`, `quiz_responses` → user can read/write **only their own rows**
- `progress_entries` → readable by others **only** when `is_shared = true`
- `products`, `listings`, `literacy_entries`, `video_cache`, `youtube_comments` → public read, **write restricted to service role** (Edge Functions only)
- `community_posts`, `discussion_threads` → public read where `status = 'visible'`; insert requires authenticated user; update/delete only own post
- `satchel_items` → user can read/write only their own rows
- `merchants` → no client access at all; service role only

---

## 5. Application Routes (Expo Router)

```
app/
  (auth)/sign-in.tsx
  (auth)/sign-up.tsx
  (onboarding)/profile.tsx
  (onboarding)/quiz.tsx
  (tabs)/index.tsx              → Your Shelf (home)
  (tabs)/search.tsx             → Search & browse
  (tabs)/saved.tsx              → Saved + price alerts
  (tabs)/you.tsx                → Profile / settings
  product/[id].tsx              → Product detail (clarity-first)
  product/[id]/stores.tsx       → Store list — revealed only after "Get This Product"
  product/[id]/community.tsx    → Community thread
  product/[id]/progress.tsx     → Progress journal for that product
  routine/index.tsx             → Routine tracker
  user/[id].tsx                 → Verified owner public profile
  admin/                        → Moderation queue, seeding tools (role-gated)
```

**Critical routing rule:** `product/[id]` must not fetch or render any `listings` data. Price and merchant information load only on `product/[id]/stores`. This is a product principle expressed in code — keep the data boundary real, not cosmetic.

---

## 6. Edge Functions (Supabase, Deno)

| Function | Trigger | Job |
|---|---|---|
| `shopify-oauth-callback` | HTTP (merchant install) | Exchange code for token, encrypt, insert `merchants`, register webhooks |
| `shopify-webhook` | HTTP (Shopify) | **Verify HMAC first**, then upsert/delete `listings` |
| `shopify-sync-catalog` | Cron nightly | Fallback full sync; reconcile drift |
| `youtube-fetch` | On demand + cached | Search YouTube, write to `video_cache` |
| `compute-confidence` | On community write | Recompute `confidence_scores` for affected product |
| `check-price-drops` | Cron (6h) | Compare `listings.price` vs `price_history`, notify favorites |
| `check-refill-expiry` | Cron daily | Evaluate `usage_estimates`, queue notifications |
| `routine-reminders` | Cron (15 min) | Send due routine reminders per user timezone |
| `seed-import` | Manual/admin | Import Open Beauty Facts test catalog |

---

## 7. Design System — Tokens for NativeWind

```js
// tailwind.config.js → theme.extend.colors
shell:    '#FBF5F1',   // background
ink:      '#2A211D',   // primary text
inkSoft:  '#6B5F57',   // secondary text
rosewood: '#8C3547',   // primary / CTA / active
honey:    '#D9A441',   // accent, badges, caution
sage:     '#6E8F73',   // positive: strong match, streaks, completed
mist:     '#E7DED7',   // borders, dividers, card fills
white:    '#FFFFFF'
```
- **Font:** General Sans (Fontshare) — single family, weights 400/500/600/700. Load via `expo-font`
- **Icons:** Phosphor Icons — outline for inactive, filled + rosewood for active
- **Radii:** cards 14px, buttons 12px, chips 999px
- Reference implementation of every screen: `ui-screens-v1.html`

---

## 8. Build Order

1. Expo + TypeScript + NativeWind + Expo Router scaffold; brand tokens and fonts wired
2. Supabase project, full schema migration, RLS policies on every table
3. Auth (sign up / sign in / session persistence across web + native)
4. Onboarding: profile setup + skin-type quiz (result stored as `quiz_estimated`)
5. `seed-import` Edge Function → populate test catalog from Open Beauty Facts
6. Search + browse (text, attribute chips, filters) against seeded catalog
7. Product detail page — **no listings data on this route**
8. Store list route (`/stores`) with sort/filter and the "no store can pay to rank higher" notice
9. Community threads, posting, verified-owner gating, helpful-marks, per-category reputation
10. Confidence Score computation + the mandatory three-part explanation UI
11. YouTube integration with `video_cache` (7-day TTL)
12. Routine tracker, streaks, reminders
13. Progress journal (private default, per-entry share)
14. Favorites, price alerts, refill/expiry jobs
15. Admin/moderation panel
16. Shopify app: OAuth, webhooks, catalog sync, minimal merchant dashboard
17. Deploy web to Vercel → onboard first real merchants → gather usage data
18. EAS native builds only once web usage validates the loop

---

## 9. Non-Negotiable Engineering Rules

These encode the Guiding Principles at the code level. Treat a violation as a bug, not a preference.

1. **No merchant or price data on the product detail route.** The reveal is a real data boundary.
2. **No pay-to-rank.** There is no `promoted`, `boosted`, or `sponsored_rank` column in V1. Store list sorts only by the user's chosen filter.
3. **Confidence Score never ships without its explanation.** No bare number anywhere in the UI. This applies to Cred (V2) as well, once built.
4. **No efficacy or safety claims in generated/rendered copy.** Literacy text describes; it never promises. The patch-test + not-medical-advice notice renders on every product and community surface.
5. **`is_shared` and `brand_drops_opt_in` default to `false`.** Consent is opt-in, per item, never bulk.
6. **`youtube_comments` content never renders with Verified Owner styling or contributes to `reputation`.** It's bootstrap filler, always labeled "From a YouTube review," visually and functionally distinct from platform-native posts.
7. **Notifications must reference real user-specific data.** No generic "come back!" pushes. If the underlying data (e.g. `typical_duration_days`) is null, send nothing rather than guess.
8. **Streaks attach to routine completion only**, never to app opens, and copy never uses loss/guilt framing.
9. **No variable-reward, infinite-scroll, fake-scarcity, or countdown mechanics.** Anywhere.
10. **Never render numbers we can't substantiate.** "127 people tracking this" must be a real count query. No inflated or placeholder social proof.
11. **Moderation removes harassment and abuse; it never removes honest criticism.** The Discovery Feed and discussion threads are unfiltered by sentiment, moderated by conduct.
12. **Secrets never reach the client.** Shopify tokens and the service role key live in Edge Functions only.

---

## 10. V1 Definition of Done

- A shopper can sign up, get a skin-type estimate, search, read clarity + community, reveal stores, and click out to buy
- A shopper can build a routine, log it daily, add private progress entries, and receive real refill/price alerts
- A verified owner can post after the eligibility window and accrue per-category reputation
- A Shopify merchant can install the app and see their catalog appear automatically within minutes
- All V1 success metrics in `v1-product-spec.md` §10 are instrumented in PostHog
- Web app is live on a custom domain; native builds are possible from the same codebase without a rewrite
