# Unmask Commerce launch setup

Commerce is a separate bounded system from Unmask product intelligence. Seller identity is bridged through `core_user_id`; product intelligence is referenced by `unmask_product_id`.

## Paystack seller-store checkout

Paystack is used only for the seller's store activation fee in this first Commerce release. Seller payouts are intentionally not included.

The backend:
1. Creates the seller/store/subscription record.
2. Initializes a Paystack transaction server-side.
3. Sends the seller to Paystack Checkout.
4. Verifies the transaction on callback.
5. Accepts the Paystack webhook as the event-driven confirmation path.
6. Checks status, currency and exact amount before activating the store.
7. Activates the store for 60 days.

Paystack's secret key never reaches the client.

## Required Vercel environment variables

Set these on the `pro-community` Vercel project:

- `CORE_SUPABASE_URL`
- `CORE_SUPABASE_ANON_KEY`
- `COMMERCE_SUPABASE_URL`
- `COMMERCE_SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `STORE_FOUNDING_PRICE_NGN`
- `STORE_PUBLIC_URL`
- `EXPO_PUBLIC_STORE_BASE_DOMAIN`

Recommended:
- `STORE_PAYMENT_WEBHOOK_SECRET` is retained for the provider-neutral activation endpoint.

Do not put `COMMERCE_SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` in Expo public variables.

## Paystack webhook

Configure the Paystack webhook URL as:

`https://<store-public-domain>/api/stores/paystack/webhook`

The handler validates the signed raw request body. It supports Paystack's timestamped `Paystack-Signature` format and the legacy `x-paystack-signature` HMAC format.

## Store domain

The intended production shape is:

`<seller-slug>.<main-unmask-domain>`

The app uses one storefront engine and resolves the tenant from the hostname. Custom seller domains can be added later through `store_domains` without creating another storefront codebase.

The current Vercel project does not yet have the final Unmask custom domain attached. Add the real domain and wildcard DNS before expecting seller subdomains to resolve.

## UI direction

The storefront uses the existing React/Expo web stack rather than introducing a second frontend framework. The visual system is intentionally editorial and Figma-inspired:

- large typographic hero
- image-led product grid
- wide/compact card rhythm
- scroll-friendly composition
- subtle hover/press states
- responsive layout
- reduced dependency footprint
- intelligence-first messaging

The storefront is a multi-tenant renderer, not one codebase per seller.
