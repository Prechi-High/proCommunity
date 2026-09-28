# Security and privacy

## Identity

- Sourced accounts are Supabase Auth users (email one-time code or link). No passwords anywhere, and WhatsApp never asks for one.
- Server functions derive the user from the JWT (`userFromRequest`). A `user_id`, `memberId` or `author` in a request body is ignored — including in `product-intelligence` community actions, which now overwrite them from the JWT and reject anonymous writes with `sign_in_required`.
- In WhatsApp, identity comes from the `wa_id` → active `whatsapp_connections` row. In Flows, from the hashed `flow_token` → session → active connection. Payload user ids are never trusted.

### Sign-in email

The Supabase project uses the default email sender, which does not allow template changes on the free tier. Until custom SMTP is configured, the email contains a **sign-in link** rather than the 6-digit code; on web the link returns to `/sign-in` and completes sign-in (allowed redirect URLs: production and `localhost:8099` / `8081`). After SMTP is set up, change the Magic Link and Confirm signup templates to include `{{ .Token }}` — the OTP length is already 6 and expiry 10 minutes.

## Account linking

1. Signed-in user taps **Connect** → `research` `whatsapp_link` (rate-limited: 6 per 15 min).
2. Server creates `wa_link_` + random token, stores **only its SHA-256 hash** with a 12-minute expiry, returns the raw token once.
3. User sends `LINK wa_link_…` to the Sourced number (the `wa.me` link pre-fills it).
4. Webhook hashes the token, checks unexpired and unused, marks it used atomically, and binds `wa_id` to the user. One active number per account and one account per number; re-linking replaces the old binding.
5. Disconnect works from either side ("disconnect" in chat or the app) and stops all messaging immediately.

## Request authenticity

| Entry point | Check |
| --- | --- |
| Webhook GET | `hub.verify_token` timing-safe compare → 403 |
| Webhook POST | HMAC-SHA256 of the raw body with `META_APP_SECRET` vs `X-Hub-Signature-256` → 401; 256 KB cap; `phone_number_id` must match |
| Flow endpoint | Same signature → 432; RSA/AES decryption → 421 |
| Worker | Service-role bearer only → 403 |
| `research` | Valid user JWT → 401 |
| `research-public` | Token format `^[A-Za-z0-9]{8,64}$`, 60 req/min per IP, 404 for unknown/revoked |

## Idempotency

- Every inbound message id is inserted into `whatsapp_webhook_events` (unique). Duplicates are acknowledged and skipped.
- Jobs carry a unique `idempotency_key` (e.g. `reply:<reply id>:<member>`), so retries never send twice.
- Status callbacks update `whatsapp_messages` by Meta message id.

## Authorisation

- RLS is enabled on every new table; nothing disables it. Users read only their own cards, saves, connection and deliveries. WhatsApp tables are written only by the service role.
- `owns_research_card(card)` is used by policies; the service layer re-checks ownership on every action with a card id (buttons, list rows, Flow payloads), so guessed ids return "not found".

## Rate limits (Redis, per user or IP)

| Rule | Limit |
| --- | --- |
| research | 12 / hour |
| image | 20 / hour |
| question | 40 / hour |
| share | 20 / hour |
| flow | 120 / 10 min |
| inbound | 60 / min |
| link | 6 / 15 min |

If Redis is unreachable, a per-isolate in-memory window still applies.

## Privacy rules

- Message bodies are not stored and not logged. `whatsapp_messages` holds metadata (direction, type, status, ids).
- WhatsApp images are processed in memory and never persisted.
- No face or skin analysis from images.
- Product Drops (marketing) require an explicit, separate opt-in; they are never enabled by linking or by other preferences.
- Logs, Sentry extras and PostHog properties go through `redact()`, which drops any field whose name looks like a token, secret, key, signature, phone, body, text or caption. PostHog receives a hashed user reference, never a phone number or content.
- Secrets live only in Supabase Edge secrets. Nothing Meta-related is in `EXPO_PUBLIC_*`, the repo or the app bundle. The Flow private key lives in `.secrets/` (gitignored) and the secret store only.
- Migrations are additive; no destructive changes.
