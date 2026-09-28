# WhatsApp Business Platform + Research Cards

WhatsApp is another way into Sourced, not a second product. Every piece of research — started in the app or in WhatsApp — becomes a **Research Card** owned by a signed-in Sourced account. The app, WhatsApp chat, the WhatsApp Flow and the public share page all read the same card.

| Document | What it covers |
| --- | --- |
| [architecture.md](./architecture.md) | Components, request paths, queue, data model |
| [meta-setup.md](./meta-setup.md) | Meta app, WABA, number, webhook, secrets, templates — step by step |
| [flows.md](./flows.md) | The `SOURCED_RESEARCH` Flow, encryption endpoint, key rotation |
| [research-card.md](./research-card.md) | Card lifecycle, sections, questions, comparisons, sharing |
| [security.md](./security.md) | Identity, linking, signatures, RLS, privacy rules |
| [testing.md](./testing.md) | Unit tests with a mocked Cloud API, smoke checks, manual test plan |
| [operations.md](./operations.md) | Feature flags, worker cron, retries, dead letters, monitoring, runbooks |
| [implementation-map.md](./implementation-map.md) | What existed before this work and what was reused |

## Status

| Area | State |
| --- | --- |
| Research Cards in the app (create, list, questions, compare, share, refresh, archive) | Live |
| Email sign-in (Supabase one-time code / link), server-side saves | Live |
| Public share page `/r/:token` with Open Graph tags | Live |
| WhatsApp webhook, worker, Flow data endpoint | Deployed, **disabled** until Meta is configured (`WHATSAPP_INTEGRATION_ENABLED` unset) |
| Meta app, number, Flow publication, template approval | **Not done** — see [meta-setup.md](./meta-setup.md) |

## Quick start (after Meta setup)

1. Set the secrets listed in [meta-setup.md](./meta-setup.md#5-set-supabase-secrets).
2. Point the Meta webhook at `https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/whatsapp-webhook`.
3. Set `WHATSAPP_INTEGRATION_ENABLED=true`.
4. In the app: **You → WhatsApp → Connect**, send the `LINK wa_link_…` message, then text a product name.

## Environment variables

All server values are **Supabase Edge Function secrets** — never `EXPO_PUBLIC_*`, never committed.

| Name | Required | Purpose |
| --- | --- | --- |
| `META_APP_ID` | yes | Meta app id (reference only) |
| `META_APP_SECRET` | yes | Verifies `X-Hub-Signature-256` on webhook and Flow requests |
| `WHATSAPP_ACCESS_TOKEN` | yes | System-user token for the Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | Sending number; inbound events for other numbers are ignored |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | yes | WABA id (templates, Flows) |
| `WHATSAPP_VERIFY_TOKEN` | yes | Webhook verification handshake |
| `WHATSAPP_API_VERSION` | no | Graph API version, default `v23.0` |
| `WHATSAPP_BUSINESS_NUMBER` | yes | E.164 digits used to build `wa.me` links in the app |
| `WHATSAPP_FLOW_RESEARCH_ID` | for Flows | Published Flow id |
| `WHATSAPP_FLOW_RESEARCH_NAME` | no | Flow name, `SOURCED_RESEARCH` |
| `WHATSAPP_FLOW_PRIVATE_KEY` | for Flows | Unencrypted PKCS#8 PEM for the Flow endpoint |
| `WHATSAPP_FLOW_PUBLIC_KEY` | no | Reference copy of the uploaded public key |
| `WHATSAPP_APPROVED_TEMPLATES` | for notifications | Comma-separated template names Meta has approved |
| `SOURCED_PUBLIC_URL` | yes | Base for share links (set to `https://pro-community.vercel.app`) |
| `SOURCED_APP_DEEP_LINK` | no | Base for "open in app" links, defaults to `SOURCED_PUBLIC_URL` |
| `SENTRY_DSN`, `POSTHOG_KEY` | no | Server error reporting and analytics (no message contents) |
| `WHATSAPP_INTEGRATION_ENABLED` / `_RESEARCH_` / `_FLOWS_` / `_NOTIFICATIONS_ENABLED` | — | Feature flags, see [operations.md](./operations.md#feature-flags) |
