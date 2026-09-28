# WhatsApp + Research Card — implementation map

Produced before any existing code was modified (spec §90). It records what exists today, whether it can be reused, and what the WhatsApp / Research Card modules will call.

## Blocking gaps

| Gap | Today | Why it blocks the spec |
| --- | --- | --- |
| No server-verified identity | `profile` is invented on the device (`lib/store.ts` `joinCommunity` / `signIn`). No `supabase.auth` anywhere. The edge function trusts whatever `memberId` the client sends. | §7–§8 require an authenticated user to request a link token; §44/§63/§64 require ownership checks and RLS against a real user id. With client-supplied ids, anyone holding the public anon key could request a link token for another member and read their Research Cards from WhatsApp. |
| Saves are device-only | `favorites` / `ownerships` live in zustand (AsyncStorage). | §47 requires a WhatsApp "Save" to appear immediately in the app. That needs a server-side saved list the app reads. |
| Satchel does not exist in the app | `satchel_items` table exists (0003) but nothing uses it. | §48 is conditional ("if Satchel exists"), so `ADD_TO_SATCHEL` is out of V1. |
| No push notifications | No `expo-notifications`; `community_notifications` is polled. | §51 delivery layer can start with WhatsApp + in-app only. |
| No general job queue | Only the ASR Redis list + a Python worker that is not deployed. | §29 needs a research worker. |
| No Meta credentials | None of the `WHATSAPP_*` / `META_*` secrets exist. | Everything Meta-facing can be built and unit-tested with a mocked Cloud API, but not exercised end to end until the Meta app, WABA, number and Flow are set up. |

## Existing modules

| Existing file / module | What it does | Reuse? | Change needed | Called by (new) |
| --- | --- | --- | --- | --- |
| `supabase/functions/product-intelligence` `search` | Serper product search → candidates | Yes | None | Research service (text research, compare target resolution) |
| `supabase/functions/product-intelligence` `investigate` / `get` | Full product intelligence, cached in `product_intel` (slug id) | Yes — this is the shared brain | None | Research worker (`runResearch`) |
| `supabase/functions/product-intelligence` `ask` | LLM Q&A about a product, optional `compareId` | Yes | None | Research service `askQuestion`, `compare` |
| `supabase/functions/product-vision` (`format: "json"`) | Lens + Gemini exact identification, returns label/brand/model/confidence/alternatives/matches | Yes | Accept already-downloaded bytes (it already takes base64) | WhatsApp image pipeline → `identifyProduct` adapter |
| `product_intel` table (0013) | Canonical product memory keyed by slug | Yes — canonical product lookup (§26) | None | Research service |
| `community_threads` / `community_replies` (0015/0016) | Community evidence per product | Yes | None | Community section of a card |
| `product_events` `track` | View / compare / save events | Yes | None | Research activity side effects |
| `supabase/functions/_shared/redis/*` | Upstash cache-aside, keys, TTLs | Yes | Add WhatsApp/research keys + rate-limit helper | Webhook idempotency, rate limits, conversation cache |
| `lib/observability.tsx`, `lib/analytics.ts` | Client Sentry + PostHog | Yes (client events) | Add WhatsApp settings events | App settings screen |
| Server Sentry / PostHog | Not present in edge functions | New | Minimal `_shared/observability.ts` (Sentry envelope + PostHog capture over HTTP, redacted) | All new functions |
| `app/(tabs)/you.tsx` | Local settings | Yes | Add "Connected services → WhatsApp" row | — |
| `zod` (package.json) | Validation | Yes (Deno via `npm:zod`) | — | Webhook, Flow, actions |
| Tests | Only `tsx --test` for one Redis file | Extend | Add `test:whatsapp` using Node test runner + mocked Meta | — |
| Web hosting | Vercel, `web.output: "single"`, `api/` Vercel functions | Yes | `/r/:token` needs server-rendered Open Graph tags → Vercel function or edge function, SPA rewrite exception | Public share page |

## New modules (planned locations)

The spec's `src/` layout is adapted to this repo: server code runs as Supabase Edge Functions (Deno), so the integration lives under `supabase/functions/`.

```text
supabase/functions/
  _shared/
    research/        cards, questions, comparisons, snapshots, sources, sharing, activity, service.ts
    whatsapp/        client, webhook parsing, messages, media, connections, conversation, flows/encryption,
                     notifications, templates, policy, repository, types
    observability.ts
    ratelimit.ts
  whatsapp-webhook/  GET verify + POST receive (fast ack, dedupe, enqueue)
  whatsapp-worker/   drains research + delivery jobs (retry, backoff, dead-letter)
  whatsapp-flow-data/ encrypted Flow data exchange
  research/          app-facing Research Card API (create, list, get, ask, compare, share, link WhatsApp)
  research-public/   /r/:token safe read + Open Graph HTML
supabase/migrations/0017_research_cards.sql
supabase/migrations/0018_whatsapp.sql
docs/integrations/whatsapp/*.md
```

## Proposed stage order

1. Identity foundation (decision needed): real server-verified user id.
2. Migrations: Research Card domain + WhatsApp domain + server-side saves, with RLS.
3. Research service + app-facing API; Research Cards visible in the app.
4. WhatsApp client, webhook verify/receive, idempotency, account linking, disconnect.
5. Text research → image research → worker → completion message.
6. Conversation context, follow-up questions, comparisons, save.
7. Sharing + public page with Open Graph.
8. Flow JSON, encryption endpoint, Flow screens.
9. Notification delivery, templates, messaging-window policy.
10. Analytics, observability, tests, docs.
