# Meta setup

Everything here is done once, by a person with access to Meta Business Manager. The code is already deployed and waits behind `WHATSAPP_INTEGRATION_ENABLED`. Only the official Cloud API is used — no unofficial libraries, no browser automation.

## 1. Business and app

1. In [Meta Business Manager](https://business.facebook.com/), verify the business (required for higher messaging limits and display-name approval).
2. At [developers.facebook.com](https://developers.facebook.com/apps) create an app of type **Business** and add the **WhatsApp** product.
3. Note **App ID** (`META_APP_ID`) and **App Secret** (`META_APP_SECRET`, App settings → Basic).

## 2. WhatsApp Business Account and number

1. WhatsApp → API Setup: create or attach a WhatsApp Business Account. Note its id (`WHATSAPP_BUSINESS_ACCOUNT_ID`).
2. Add the production phone number, verify it, and set the display name "Sourced".
3. Note the **Phone number ID** (`WHATSAPP_PHONE_NUMBER_ID`) and the number itself in digits, e.g. `2348012345678` (`WHATSAPP_BUSINESS_NUMBER`).

## 3. Permanent access token

1. Business settings → Users → **System users** → add an admin system user.
2. Assign the app and the WABA to it with full control.
3. Generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`, no expiry. This is `WHATSAPP_ACCESS_TOKEN`.

Never use the 24-hour test token in production, and never put the token in the app bundle.

## 4. Webhook

1. Pick a random verify token (e.g. `openssl rand -hex 24`) → `WHATSAPP_VERIFY_TOKEN`.
2. Set the secrets in step 5 **first** — verification reads them.
3. WhatsApp → Configuration → Webhook:
   - Callback URL: `https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: the value above
4. Subscribe to the **messages** field.

## 5. Set Supabase secrets

Run from the repo root with `SUPABASE_ACCESS_TOKEN` in your environment. Do not paste secrets into files that get committed, and do not echo them.

```powershell
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak `
  META_APP_ID=... META_APP_SECRET=... `
  WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... `
  WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_BUSINESS_NUMBER=... `
  WHATSAPP_VERIFY_TOKEN=... WHATSAPP_API_VERSION=v23.0
```

`SOURCED_PUBLIC_URL` is already set to `https://pro-community.vercel.app`.

Then enable the integration (research is on by default once the integration is on):

```powershell
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak WHATSAPP_INTEGRATION_ENABLED=true
```

## 6. Flow (optional, recommended)

See [flows.md](./flows.md): generate keys, upload the public key, create and publish `SOURCED_RESEARCH`, then set `WHATSAPP_FLOW_RESEARCH_ID`, `WHATSAPP_FLOW_PRIVATE_KEY` and `WHATSAPP_FLOWS_ENABLED=true`.

## 7. Message templates

Templates are needed to message a user more than 24 hours after their last message. Submit each one in WhatsApp Manager → Message templates exactly as written in `supabase/functions/_shared/whatsapp/templates.ts`:

| Name | Category | Body | Button |
| --- | --- | --- | --- |
| `sourced_research_completed_v1` | Utility | Research complete ✓ / {{1}} / Research Card {{2}} is ready with product details, owner evidence and sources. | URL `https://pro-community.vercel.app/{{1}}` |
| `sourced_research_updated_v1` | Utility | Research updated / {{1}} / New information is available in Research Card {{2}}. | URL, dynamic suffix |
| `sourced_price_drop_v1` | Utility | Price update for {{1}} / When you researched it: {{2}} / Now: {{3}} | URL, dynamic suffix |
| `sourced_community_reply_v1` | Utility | {{1}} replied in a discussion you follow about {{2}}. | URL, dynamic suffix |
| `sourced_refill_reminder_v1` | Utility | You may be running low on {{1}}. Your Research Card has current prices and stores. | URL, dynamic suffix |
| `sourced_product_drop_v1` | Marketing | New from {{1}}: {{2}}. See what owners say before you buy. | URL, dynamic suffix |

Language: English (`en`). The URL button base is `https://pro-community.vercel.app/` with a dynamic suffix; the code fills the path (e.g. `research/<id>`).

As each template is approved, add its name to the allow-list — unapproved templates are never sent:

```powershell
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak `
  WHATSAPP_APPROVED_TEMPLATES=sourced_research_completed_v1,sourced_community_reply_v1
```

Then turn on notifications:

```powershell
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak WHATSAPP_NOTIFICATIONS_ENABLED=true
```

## 8. Go-live checklist

- [ ] Webhook shows as verified in Meta; a test message produces a `whatsapp_webhook_events` row.
- [ ] Linking from **You → WhatsApp** works end to end.
- [ ] Text research and image research return a card link.
- [ ] Worker cron is scheduled ([operations.md](./operations.md#worker-cron)).
- [ ] Flow validated in Flow Builder and published (if enabled).
- [ ] At least `sourced_research_completed_v1` approved and listed.
- [ ] Sentry DSN and PostHog key set; confirm no message text appears in either.
- [ ] Custom SMTP configured in Supabase Auth so sign-in emails show a 6-digit code (see [security.md](./security.md#sign-in-email)).
