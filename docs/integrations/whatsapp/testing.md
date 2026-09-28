# Testing

## Unit and integration tests

```powershell
npm run test:whatsapp
```

Runs the Node test runner (`tsx --test`) over:

| File | Covers |
| --- | --- |
| `_shared/research/__tests__/research.test.ts` | Card creation, sections, questions, compare, sharing projection, ownership |
| `_shared/whatsapp/__tests__/linking.test.ts` | Token hashing, expiry, single use, relinking, disconnect |
| `_shared/whatsapp/__tests__/webhook.test.ts` | Signature verification, payload parsing, dedupe |
| `_shared/whatsapp/__tests__/intent.test.ts` | Deterministic routing, classifier fallback limits |
| `_shared/whatsapp/__tests__/orchestrator.test.ts` | Unlinked users, research, questions, save, share, IDOR attempts |
| `_shared/whatsapp/__tests__/worker.test.ts` | Retry, backoff, dead-letter, force refresh |
| `_shared/whatsapp/__tests__/flows.test.ts` | Real RSA/AES round trip, 421 cases, session binding, foreign card → ERROR |
| `_shared/whatsapp/__tests__/notifications.test.ts` | Preferences, Product Drops opt-in, 24-hour window vs template |
| `_shared/whatsapp/__tests__/client.test.ts` | Cloud API request shapes against a mocked `fetch` |

No test calls Meta. `_shared/__tests__/fakes.ts` provides in-memory repositories, a fake intelligence layer and a recording WhatsApp client.

## Deployed smoke checks

Checks the security boundaries of the live functions with only the public anon key:

| Check | Expected |
| --- | --- |
| `research` without a user token | 401 |
| `research-public` with an unknown token | 404 |
| webhook GET with the wrong verify token | 403 |
| unsigned webhook POST | 401 |
| worker without the service key | 403 |
| unsigned Flow request | 432 |
| community post as anon | 401 |
| community feed / search as anon | 200 |

## Manual test plan (once Meta is configured)

1. **Link**: You → WhatsApp → Connect. Send the prefilled message. The app shows "Connected" within a few seconds. Send the same code again → "already used".
2. **Text research**: "research cerave foaming cleanser" → "Researching…" then a card summary with buttons. The card appears in My Research.
3. **Ambiguous**: "research iphone" → candidate list → pick one.
4. **Image**: send a product photo → card. Confirm no image is stored in Storage.
5. **Follow-ups**: ask a question, "compare with la roche posay", "save" (check the heart in the app), "share" (open the link logged out).
6. **Isolation**: from a second linked number, tap a forwarded button from the first user's card → "not found".
7. **Flow**: open Sourced from chat → My Research → a card → a section.
8. **Notifications**: reply in a discussion the linked user follows → WhatsApp message (inside 24 h) or template (outside, if approved).
9. **Disconnect**: "disconnect" in chat → the app shows disconnected; further messages get linking instructions.
10. **Observability**: check Sentry and PostHog contain no phone numbers or message text.
