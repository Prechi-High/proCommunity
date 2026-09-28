# Architecture

## Components

```text
                ┌──────────── Sourced app (Expo, web + native) ────────────┐
                │ sign-in · My Research · card detail · WhatsApp settings  │
                └──────────────┬───────────────────────────────────────────┘
                               │ user JWT
                               ▼
 Meta Cloud API ──► whatsapp-webhook ──► integration_jobs ◄── research (app API)
      ▲    │  signed POST   │ dedupe, route,         │ claim (SKIP LOCKED)
      │    │                │ fast reply             ▼
      │    └──► whatsapp-flow-data             whatsapp-worker
      │         (encrypted Flow exchange)            │ research_run / research_text /
      │                                              │ research_image / notify
      └──────────────── sends ◄──────────────────────┘
                                                     │
                                  product-intelligence / product-vision (existing brain)
                                                     │
                                  research_cards + sections + sources (Postgres, RLS)
                                                     │
                            research-public ──► /r/:token (Vercel api/r/[token].ts, OG tags)
```

Nothing duplicates intelligence: the worker calls the existing `product-intelligence` (`search`, `investigate`, `ask`) and `product-vision` functions through `_shared/core/intelligence.ts`, then maps the profile into card sections (`_shared/research/sections.ts`).

## Edge functions

| Function | Auth | Job |
| --- | --- | --- |
| `research` | User JWT (`userFromRequest`) | App API: cards, questions, compare, share, saves, WhatsApp link/status/preferences/disconnect |
| `research-public` | Anon, IP rate-limited | Returns the share-safe projection of a card for a share token |
| `whatsapp-webhook` | Meta signature | GET verification; POST receive → dedupe → route → reply / enqueue |
| `whatsapp-worker` | Service role only | Drains `integration_jobs` with retry, backoff and dead-letter |
| `whatsapp-flow-data` | Meta signature + RSA/AES | Encrypted Flow data exchange |
| `product-intelligence` | Anon or user JWT | Existing; community writes now require a signed-in user and take identity from the JWT |

All five new functions run with `verify_jwt = false` in `supabase/config.toml` and check auth in code, because Meta and the public page cannot send a Supabase JWT.

## Shared modules (`supabase/functions/_shared/`)

| Path | Responsibility |
| --- | --- |
| `core/env.ts` | Runtime-agnostic env + feature flags |
| `core/auth.ts` | `userFromRequest`, `isServiceCall` |
| `core/crypto.ts` | SHA-256, HMAC, timing-safe compare, random tokens |
| `core/ratelimit.ts` | Redis fixed-window limits (in-memory fallback), `acquireLock` |
| `core/observability.ts` | Redacted logs, Sentry envelopes, PostHog capture |
| `research/*` | Card repository, service, sections, share projection |
| `whatsapp/client.ts` | Cloud API client (text, buttons, lists, templates, Flows, media) |
| `whatsapp/webhook.ts` | Signature check, payload parsing (zod) |
| `whatsapp/intent.ts` | Deterministic intent router, optional classifier fallback |
| `whatsapp/orchestrator.ts` | Handles one inbound message end to end |
| `whatsapp/connections.ts` | Link tokens, linking, disconnect |
| `whatsapp/policy.ts` | 24-hour window vs template rule |
| `whatsapp/templates.ts` | Template registry |
| `whatsapp/notifications.ts` | Preference check → permitted send → delivery record |
| `whatsapp/worker.ts` | Job processing, backoff |
| `whatsapp/flows/*` | Flow crypto, handler, Flow JSON |

## Inbound message path

1. Meta POSTs to `whatsapp-webhook`. Body > 256 KB is rejected; `X-Hub-Signature-256` is verified with `META_APP_SECRET` (401 on failure).
2. If `WHATSAPP_INTEGRATION_ENABLED` is off, the request is acknowledged and dropped.
3. Events for a different `phone_number_id` are ignored.
4. Each message id is recorded in `whatsapp_webhook_events` (unique). A duplicate delivery is acknowledged without reprocessing.
5. The sender's `wa_id` is looked up in `whatsapp_connections`. Unlinked senders only get the linking instructions (or can link with `LINK wa_link_…`).
6. `routeIntent` decides what the message means (buttons/list ids first, then text rules, then — only for leftover free text — an optional classifier limited to safe intents).
7. Cheap intents reply immediately. Research is queued as a job; the user gets "Researching…" straight away.
8. The worker is kicked with `EdgeRuntime.waitUntil`; a cron also drains the queue (see [operations.md](./operations.md#worker-cron)).

## Queue

`integration_jobs` (Postgres) is the queue. `claim_integration_jobs(worker, max_jobs)` locks rows with `FOR UPDATE SKIP LOCKED`, so several workers never take the same job. Each job has `idempotency_key` (unique), `attempts`, `max_attempts`, `run_after`, `last_error` and status `queued | processing | failed | done | dead` (`failed` means "waiting to retry"). Jobs locked for more than 5 minutes by a worker that died are reclaimed.

Retryable errors back off exponentially (30 s, 60 s, 120 s … capped at 15 min). When `attempts` reaches `max_attempts`, or an error is not retryable, the job becomes `dead` and is reported to Sentry. Redis is used only for rate limits and short locks — never as the queue or source of truth.

## Data model

Migrations `0017_research_cards.sql`, `0018_whatsapp.sql`, `0019_whatsapp_flow_sessions.sql`.

| Table | Purpose |
| --- | --- |
| `research_cards` | One card per research request; `reference` like `SR-7F3K2`, `status`, `active_product_id`, `focus` |
| `research_products` | Products on a card (`primary`, `comparison`) |
| `research_sections` | Section content (identity, summary, fit, specs, community, pricing, …) |
| `research_snapshots` | Point-in-time copies used by refresh and comparisons |
| `research_questions` | Follow-up Q&A with sources |
| `research_comparisons` | Comparison snapshots |
| `research_sources` | Cited sources |
| `research_activity` | Audit trail (created, asked, shared, viewed via share) |
| `research_shares` | Share tokens (**hash only**), revocation |
| `saved_products` | Server-side saves shared by app and WhatsApp |
| `whatsapp_connections` | `user_id` ↔ `wa_id`, status, `last_inbound_at`, preferences |
| `whatsapp_link_tokens` | Hashed single-use link tokens with expiry |
| `whatsapp_webhook_events` | Idempotency ledger |
| `whatsapp_conversations` | Active card, awaiting state, pending candidates |
| `whatsapp_messages` | Message metadata only (no bodies) |
| `whatsapp_flow_sessions` | Hashed Flow tokens bound to a connection |
| `notification_deliveries` | Every notification attempt and its outcome |
| `integration_jobs` | Work queue |

Every table has RLS enabled. Users can read their own cards, saves and connection; everything WhatsApp-side is written only by the service role.
