# Research Cards

A Research Card is the durable result of one research request. It is owned by one Sourced account and is the same object in the app, in WhatsApp chat, in the Flow and on the share page.

## Lifecycle

| Status | Meaning |
| --- | --- |
| `created` | Card exists, research job queued |
| `identifying` | Resolving which exact product this is |
| `researching` | Worker is gathering intelligence |
| `complete` | Sections written |
| `partial` | Some sections had no evidence; the rest is usable |
| `failed` | Research could not complete (retries exhausted) |
| `archived` | Hidden from lists, still owned |

When a WhatsApp query matches several products, no card is created yet: the user gets a pick list (stored in the conversation state) and the card is created from their choice.

Created by:
- **App** — "Save as Research Card" on a product page, or `research` action `create`.
- **WhatsApp text** — `research_text` job (search → candidates → pick if ambiguous → run).
- **WhatsApp image** — `research_image` job. The image is downloaded from Meta, passed to `product-vision` as base64, and **not persisted**.
- **Flow** — `START_RESEARCH` screen enqueues `research_text`.

## Sections

Built by `_shared/research/sections.ts` from the existing product-intelligence profile. Nothing is invented: a section with no evidence is `unavailable` and hidden everywhere.

`identity`, `summary`, `confidence`, `key_facts`, `fit`, `ingredients_or_specs` (labelled Ingredients / Materials & fit / Specs by category), `community`, `pros_cons`, `pricing`, `stores`, `alternatives`, `sources`.

A card's `focus` (everything, fit, ingredients, community, price, stores, alternatives) selects which sections are emphasised in WhatsApp replies.

`fit` is never computed from faces or skin in images. Personal fit uses only what the user has explicitly told the app.

## Follow-ups

| Action | App | WhatsApp |
| --- | --- | --- |
| Ask a question | Card → Ask | Any question while a card is active ("is it good for oily skin?") |
| Compare | Card → Compare | "compare with …" or the Compare button |
| Save | Heart on product | "save" / Save button → `saved_products` (shows in the app immediately) |
| Share | Card → Share | "share" / Share button |
| Refresh | Card → Refresh | "research again" button |
| Archive | Card → Archive | — |

Questions use product-intelligence `ask`; comparisons resolve the other product via `search` and store a comparison snapshot. Satchel is not part of V1 (`ADD_TO_SATCHEL` replies that it's coming).

## Active context in WhatsApp

`whatsapp_conversations.active_research_card_id` is the card the user is talking about. It is set when research finishes or a card is opened, and it is what "save", "share", "compare" and questions apply to. Without an active card those intents ask which product the user means. Every action re-checks that the card belongs to the linked user.

## Sharing

- A share creates a 16-character random token; only its SHA-256 hash is stored in `research_shares`.
- Link: `https://pro-community.vercel.app/r/<token>`.
- `/r/:token` is served by `api/r/[token].ts` (Vercel): it calls `research-public`, renders HTML with Open Graph / Twitter tags, `noindex`, and escapes every value.
- Public view shows product, sections and sources only — never the owner, their questions, preferences, or the WhatsApp number. `research_card_by_share` enforces this in SQL; `toPublicCard` whitelists fields again in code.
- "Stop sharing" revokes all tokens for the card; old links return 404.

## App API (`research` function)

POST with the user's JWT and `{ action, ... }`:

`list`, `get`, `create`, `ask`, `compare`, `share`, `revoke_shares`, `refresh`, `archive`, `saves`, `save`, `unsave`, `import_saves`, `whatsapp_status`, `whatsapp_link`, `whatsapp_disconnect`, `whatsapp_preferences`.

Inputs are validated with a zod discriminated union; identity is always taken from the JWT.
