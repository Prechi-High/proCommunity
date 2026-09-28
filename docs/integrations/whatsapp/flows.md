# WhatsApp Flow: `SOURCED_RESEARCH`

The Flow gives a structured, app-like view of Research Cards inside WhatsApp. It is optional — chat works without it — and is off until `WHATSAPP_FLOWS_ENABLED=true` and `WHATSAPP_FLOW_RESEARCH_ID` are set.

## Files

| File | Purpose |
| --- | --- |
| `supabase/functions/_shared/whatsapp/flows/research-flow.json` | Flow JSON (v7.0, `data_api_version` 3.0) to paste into Flow Builder |
| `supabase/functions/_shared/whatsapp/flows/crypto.ts` | Request decryption / response encryption |
| `supabase/functions/_shared/whatsapp/flows/handler.ts` | Screen data, navigation, session and ownership checks |
| `supabase/functions/whatsapp-flow-data/index.ts` | HTTPS data endpoint |
| `scripts/whatsapp-flow-keys.mjs` | Key-pair generator |

## Screens

| Screen | Shows | Next |
| --- | --- | --- |
| `HOME` | Start research / My Research | `START_RESEARCH`, `MY_RESEARCH` |
| `START_RESEARCH` | Product name input + focus picker | `DONE` (research is queued; the result arrives in chat) |
| `MY_RESEARCH` | Up to 10 recent cards | `OVERVIEW` |
| `OVERVIEW` | Title, reference, verdict, section list | `SECTION` |
| `SECTION` | One section as markdown (terminal) | — |
| `DONE` | Confirmation (terminal via complete) | — |
| `ERROR` | Friendly error, e.g. card not found (terminal) | — |

Routing is acyclic as Flow Builder requires; users go back with WhatsApp's native back button.

## Endpoint contract

`POST https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/whatsapp-flow-data`

1. `X-Hub-Signature-256` is verified with `META_APP_SECRET` → **432** on failure.
2. The body `{encrypted_aes_key, encrypted_flow_data, initial_vector}` is decrypted: the AES key with RSA-OAEP (SHA-256) using `WHATSAPP_FLOW_PRIVATE_KEY`, then the payload with AES-128-GCM (16-byte tag appended) → **421** on failure, which tells WhatsApp to re-fetch the public key.
3. `action: "ping"` returns `{data: {status: "active"}}`. Error notifications are acknowledged.
4. The `flow_token` is hashed and looked up in `whatsapp_flow_sessions` (60-minute TTL). The session must belong to an **active** connection. The user id comes only from that session — never from the Flow payload.
5. Any card id in the payload is re-checked for ownership. A card that does not exist or belongs to someone else returns the `ERROR` screen (no difference between the two, so ids can't be probed).
6. The response is encrypted with the same AES key and the **bit-flipped IV**, and returned as base64 `text/plain`.

## Keys

The private key must be an **unencrypted PKCS#8** PEM (`-----BEGIN PRIVATE KEY-----`). PKCS#1 (`BEGIN RSA PRIVATE KEY`) and encrypted keys are rejected at import.

```powershell
npm run whatsapp:keys
# writes .secrets/whatsapp-flow/private.pem and public.pem (gitignored)
```

Upload the public key to the phone number (Graph API, system-user token):

```powershell
curl -X POST "https://graph.facebook.com/v23.0/$env:WHATSAPP_PHONE_NUMBER_ID/whatsapp_business_encryption" `
  -H "Authorization: Bearer $env:WHATSAPP_ACCESS_TOKEN" `
  --data-urlencode "business_public_key=$(Get-Content -Raw .secrets/whatsapp-flow/public.pem)"
```

Store the private key as a secret (it is multi-line; pass it from the file, don't paste it into a terminal log):

```powershell
$pem = Get-Content -Raw .secrets/whatsapp-flow/private.pem
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak "WHATSAPP_FLOW_PRIVATE_KEY=$pem"
```

**Never commit the private key.** `.secrets/` is in `.gitignore`.

### Rotation

1. Generate a new pair.
2. Set the new private key secret, then immediately upload the new public key.
3. In-flight Flows get a 421, WhatsApp fetches the new public key and retries.
4. Delete the old files.

## Create and publish in Flow Builder

1. WhatsApp Manager → Flows → **Create Flow** → name `SOURCED_RESEARCH`, category "Other", template "Without endpoint" (the endpoint is set next).
2. Paste `research-flow.json` into the JSON editor. Fix anything the validator flags — the JSON has not yet been validated against Meta's live validator.
3. Settings → Endpoint: the URL above; run **Health check** (ping). It must return healthy.
4. Preview with "Request data on first screen" enabled and walk every screen.
5. **Publish**. Published Flows cannot be edited — changes need a new Flow (e.g. `SOURCED_RESEARCH_V2`).
6. Set secrets:

```powershell
npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak `
  WHATSAPP_FLOW_RESEARCH_ID=<flow id> WHATSAPP_FLOW_RESEARCH_NAME=SOURCED_RESEARCH WHATSAPP_FLOWS_ENABLED=true
```

## How the Flow is launched

`launchResearchFlow` creates a session with a random `ft_…` token (only its SHA-256 hash is stored), then sends an interactive Flow message ("Open Sourced") with that token. Today it is sent when a linked user types `menu`; the chat replies work the same with or without it.
