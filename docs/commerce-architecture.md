# Unmask Commerce Architecture

## Boundary

Unmask Core owns:
- identity
- product intelligence
- community
- experiences
- Ultra Unmask
- canonical products

Unmask Commerce owns:
- sellers
- stores
- store domains
- store subscriptions / activation
- store catalogue entries
- inventory
- future carts, orders, checkout and fulfilment

The systems share identifiers through APIs rather than cross-database foreign keys.

## Identity

A seller signs in with the existing Unmask account. Commerce stores the immutable core_user_id as the bridge.

## Product relationship

store_products.unmask_product_id points to the canonical product ID in Unmask Core.

Commerce answers: who sells it, what is the seller's price, is it in stock, and where is the seller's store?

Unmask Core answers: what is the product, what does the evidence say, what are users experiencing, what claims exist, and what questions remain?

## Store URL

Founding stores use: {slug}.{STORE_BASE_DOMAIN}

A custom domain can later be attached through store_domains.

## Activation flow

1. Authenticated Unmask user opens seller onboarding.
2. Commerce creates seller + pending store + pending subscription.
3. Payment provider creates/receives a checkout reference.
4. Provider webhook calls /api/stores/activate with the server-only webhook secret.
5. Commerce marks the subscription active, activates the store and subdomain, and records an activation event.
6. Seller proceeds to store setup.

## Security

The Commerce database is RLS-enabled with no client policies. The current API is the server-side boundary.

Never expose COMMERCE_SUPABASE_SERVICE_ROLE_KEY to Expo or browser code.

## Planned next layer

- payment adapter (provider-specific)
- store dashboard
- product import / manual product creation
- canonical Unmask product linking
- storefront renderer
- host-based tenant resolution
- cart / order / fulfilment model
- Unmask product page -> partner stores API
- store -> Unmask room/product links
