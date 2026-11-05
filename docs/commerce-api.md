# Commerce API v0

## Authenticated

### POST /api/stores/register
Creates a seller, pending store, subdomain record and pending founding-store subscription.

Requires Authorization: Bearer <Unmask access token>

Body:
- businessName
- legalName?
- contactEmail
- phone?
- country?
- storeName
- slug?
- tagline?
- description?

Returns sellerId, store, domain, subscription and nextStep.

### GET /api/stores/me
Returns the authenticated seller's store, domain and subscriptions.

### POST /api/stores/activate
Server-to-server payment activation endpoint.

Requires x-store-webhook-secret.

Body:
- subscriptionId
- paymentReference?
- paymentProvider?
- startsAt?
- endsAt?

### GET /api/stores/public?slug=<slug>
Returns a public active store and its active products.

## Environment

- CORE_SUPABASE_URL
- CORE_SUPABASE_ANON_KEY
- COMMERCE_SUPABASE_URL
- COMMERCE_SUPABASE_SERVICE_ROLE_KEY
- STORE_BASE_DOMAIN
- STORE_PAYMENT_WEBHOOK_SECRET

Payment-provider credentials are deliberately not hardcoded into the first API layer. The provider adapter will be added once the payment provider is selected.
