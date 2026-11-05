import { createHmac, timingSafeEqual } from 'node:crypto';
import { commerceSupabase, json, normalizeSlug, requireUser, storeHostname, webhookSecret } from './_lib';

export const config = { api: { bodyParser: false } };

type Req = {
  method?: string;
  url?: string;
  body?: any;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, cb: (...args: any[]) => void) => void;
};
type Res = {
  status: (code: number) => {
    json: (body: unknown) => void;
    send: (body: string) => void;
    redirect?: (code: number, url: string) => void;
  };
};

const env = (name: string, fallback = '') =>
  (process.env[name]?.trim() ?? '').replace(/^[\"']|[\"']$/g, '') || fallback;

const header = (req: Req, name: string) => {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const queryValue = (req: Req, key: string) => {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
};

const pathParts = (req: Req) => {
  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') return raw.split('/').filter(Boolean);
  const pathname = req.url?.split('?')[0] ?? '';
  const marker = pathname.indexOf('/api/stores/');
  return marker >= 0 ? pathname.slice(marker + '/api/stores/'.length).split('/').filter(Boolean) : [];
};

const readRawBody = (req: Req) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    if (!req.on) return resolve(Buffer.alloc(0));
    req.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const parseBody = async (req: Req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { return {}; }
};

const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

const verifyLegacyPaystack = (raw: Buffer, signature: string, secret: string) => {
  if (!/^[0-9a-f]{128}$/.test(signature)) return false;
  return safeEqual(createHmac('sha512', secret).update(raw).digest(), Buffer.from(signature, 'hex'));
};

const verifySignedPaystack = (raw: Buffer, signature: string, secret: string) => {
  const parts = signature.split(',').map((x) => x.trim());
  const timestamp = parts.find((x) => x.startsWith('t='))?.slice(2);
  if (!timestamp || !/^[0-9]+$/.test(timestamp)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) return false;
  const expected = createHmac('sha512', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return parts.filter((x) => x.startsWith('v1=')).map((x) => x.slice(3)).some((value) => {
    const sig = value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
    return /^[0-9a-f]{128}$/.test(sig) && safeEqual(Buffer.from(expected), Buffer.from(sig));
  });
};

const activateSubscription = async (reference: string, data: any) => {
  const db = commerceSupabase();
  const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata || '{}') : (data.metadata || {});
  const id = metadata.subscription_id;
  if (!id) return;
  const sub = await db.from('store_subscriptions')
    .select('id,seller_id,store_id,amount,currency,status')
    .eq('id', id).maybeSingle();
  if (sub.error || !sub.data || sub.data.status === 'active') return;
  if (data.status !== 'success' ||
      Number(data.amount) !== Math.round(Number(sub.data.amount ?? 0) * 100) ||
      data.currency !== sub.data.currency) return;
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  await Promise.all([
    db.from('store_subscriptions').update({
      status: 'active', payment_provider: 'paystack', payment_reference: reference,
      provider_transaction_id: String(data.id), payment_status: 'success',
      paid_at: now.toISOString(), starts_at: now.toISOString(), ends_at: end.toISOString(),
      payment_metadata: data,
    }).eq('id', id),
    db.from('sellers').update({ status: 'approved', onboarding_step: 'active' }).eq('id', sub.data.seller_id),
    db.from('stores').update({ status: 'active', activated_at: now.toISOString(), expires_at: end.toISOString() }).eq('id', sub.data.store_id),
    db.from('store_domains').update({ status: 'active', verified_at: now.toISOString() }).eq('store_id', sub.data.store_id),
    db.from('store_activation_events').insert({
      seller_id: sub.data.seller_id, store_id: sub.data.store_id, event_type: 'store_activated',
      payload: { provider: 'paystack', reference, transactionId: data.id, source: 'webhook' },
    }),
  ]);
};

const paystackVerify = async (reference: string) => {
  const secret = env('PAYSTACK_SECRET_KEY');
  if (!secret) throw new Error('paystack_not_configured');
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload?.status) throw new Error(payload?.message || 'paystack_verify_failed');
  return payload.data;
};

export default async function handler(req: Req, res: Res) {
  const method = (req.method ?? 'GET').toUpperCase();
  const parts = pathParts(req);
  const route = parts.join('/');

  try {
    // Paystack webhook: raw body + signature verification.
    if (route === 'paystack/webhook') {
      if (method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
      const raw = await readRawBody(req);
      const legacySecret = env('PAYSTACK_SECRET_KEY');
      const webhookSecretValue = env('PAYSTACK_WEBHOOK_SECRET');
      const legacySignature = header(req, 'x-paystack-signature');
      const modernSignature = header(req, 'paystack-signature');
      if (!legacySignature && !modernSignature) { res.status(401).send('Missing signature'); return; }
      if ((legacySignature && (!legacySecret || !verifyLegacyPaystack(raw, legacySignature, legacySecret))) ||
          (modernSignature && (!webhookSecretValue || !verifySignedPaystack(raw, modernSignature, webhookSecretValue)))) {
        res.status(401).send('Invalid signature'); return;
      }
      let event: any;
      try { event = JSON.parse(raw.toString('utf8')); } catch { res.status(400).send('Invalid JSON'); return; }
      if (event.event === 'charge.success') await activateSubscription(event.data?.reference, event.data);
      res.status(200).send('OK'); return;
    }

    if (route === 'paystack/callback') {
      if (method !== 'GET') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const reference = queryValue(req, 'reference');
      if (!reference) { json(res, 400, { error: 'missing_reference' }); return; }
      const data = await paystackVerify(reference);
      const db = commerceSupabase();
      const sub = await db.from('store_subscriptions')
        .select('id,seller_id,store_id,amount,currency,status')
        .eq('payment_reference', reference).maybeSingle();
      if (!sub.data) { json(res, 404, { error: 'subscription_not_found' }); return; }
      const valid = data.status === 'success' &&
        Number(data.amount) === Math.round(Number(sub.data.amount ?? 0) * 100) &&
        data.currency === sub.data.currency;
      if (valid && sub.data.status !== 'active') {
        const now = new Date();
        const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        await Promise.all([
          db.from('store_subscriptions').update({
            status: 'active', payment_provider: 'paystack', provider_transaction_id: String(data.id),
            payment_status: 'success', paid_at: now.toISOString(), starts_at: now.toISOString(), ends_at: end.toISOString(),
          }).eq('id', sub.data.id),
          db.from('sellers').update({ status: 'approved', onboarding_step: 'active' }).eq('id', sub.data.seller_id),
          db.from('stores').update({ status: 'active', activated_at: now.toISOString(), expires_at: end.toISOString() }).eq('id', sub.data.store_id),
          db.from('store_domains').update({ status: 'active', verified_at: now.toISOString() }).eq('store_id', sub.data.store_id),
          db.from('store_activation_events').insert({
            seller_id: sub.data.seller_id, store_id: sub.data.store_id, event_type: 'store_activated',
            payload: { provider: 'paystack', reference, transactionId: data.id, source: 'callback' },
          }),
        ]);
      }
      const base = env('STORE_PUBLIC_URL') ||
        `https://${(Array.isArray(req.headers?.host) ? req.headers?.host[0] : req.headers?.host) || 'dunmasker.vercel.app'}`;
      const redirect = res.status(302);
      if (redirect.redirect) redirect.redirect(302, `${base.replace(/\/$/, '')}/seller/onboarding?payment=${valid ? 'success' : 'failed'}&reference=${encodeURIComponent(reference)}`);
      else redirect.send('');
      return;
    }

    if (route === 'paystack/initialize') {
      if (method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const user = await requireUser(req);
      if (!user) { json(res, 401, { error: 'unauthorized' }); return; }
      const body = await parseBody(req);
      const db = commerceSupabase();
      const seller = await db.from('sellers').select('id').eq('core_user_id', user.id).maybeSingle();
      if (seller.error || !seller.data) { json(res, 404, { error: 'seller_not_found' }); return; }
      const subscription = await db.from('store_subscriptions')
        .select('id,seller_id,store_id,plan_code,status,amount,currency')
        .eq('id', body.subscriptionId ?? '').eq('seller_id', seller.data.id).single();
      if (subscription.error || !subscription.data) { json(res, 404, { error: 'subscription_not_found' }); return; }
      const amountNgn = Number(env('STORE_FOUNDING_PRICE_NGN'));
      if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
        json(res, 503, { error: 'store_price_not_configured', message: 'STORE_FOUNDING_PRICE_NGN must be configured before checkout.' }); return;
      }
      const reference = `unmask-store-${subscription.data.id}-${Date.now()}`;
      const configured = env('STORE_PUBLIC_URL');
      const host = Array.isArray(req.headers?.host) ? req.headers?.host[0] : req.headers?.host;
      const base = (configured || (host ? `https://${host}` : '')).replace(/\/$/, '');
      const payload = {
        email: user.email, amount: String(Math.round(amountNgn * 100)),
        currency: subscription.data.currency || 'NGN', reference,
        callback_url: `${base}/api/stores/paystack/callback`,
        metadata: JSON.stringify({
          type: 'unmask_store_activation', subscription_id: subscription.data.id,
          seller_id: seller.data.id, store_id: subscription.data.store_id,
        }),
      };
      const secret = env('PAYSTACK_SECRET_KEY');
      if (!secret) { json(res, 503, { error: 'paystack_not_configured' }); return; }
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.status || !result?.data?.authorization_url) {
        json(res, 502, { error: 'paystack_initialize_failed', message: result?.message || 'Paystack could not initialize checkout.' }); return;
      }
      const updated = await db.from('store_subscriptions').update({
        amount: amountNgn, payment_provider: 'paystack', payment_reference: reference,
        checkout_reference: result.data.access_code ?? null, payment_status: 'initialized',
      }).eq('id', subscription.data.id)
        .select('id,amount,currency,status,payment_provider,payment_reference,checkout_reference').single();
      if (updated.error) { json(res, 500, { error: 'subscription_update_failed' }); return; }
      await db.from('store_activation_events').insert({
        seller_id: seller.data.id, store_id: subscription.data.store_id, event_type: 'payment_initialized',
        actor_user_id: user.id, payload: { provider: 'paystack', reference, amount: amountNgn },
      });
      json(res, 200, {
        ok: true, authorizationUrl: result.data.authorization_url, accessCode: result.data.access_code,
        reference, amount: amountNgn, currency: subscription.data.currency || 'NGN',
      }); return;
    }

    if (route === 'me') {
      if (method !== 'GET') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const user = await requireUser(req);
      if (!user) { json(res, 401, { error: 'unauthorized' }); return; }
      const db = commerceSupabase();
      const seller = await db.from('sellers').select('*').eq('core_user_id', user.id).maybeSingle();
      if (seller.error) { json(res, 500, { error: 'seller_lookup_failed' }); return; }
      if (!seller.data) { json(res, 404, { error: 'seller_not_found' }); return; }
      const [store, subscriptions] = await Promise.all([
        db.from('stores').select('*').eq('seller_id', seller.data.id).maybeSingle(),
        db.from('store_subscriptions').select('*').eq('seller_id', seller.data.id).order('created_at', { ascending: false }),
      ]);
      if (store.error || subscriptions.error) { json(res, 500, { error: 'store_lookup_failed' }); return; }
      let domain = null;
      if (store.data) {
        const d = await db.from('store_domains').select('*').eq('store_id', store.data.id).maybeSingle();
        domain = d.data ?? null;
      }
      json(res, 200, { seller: seller.data, store: store.data ?? null, domain, subscriptions: subscriptions.data ?? [] }); return;
    }

    if (route === 'register') {
      if (method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const user = await requireUser(req);
      if (!user) { json(res, 401, { error: 'unauthorized' }); return; }
      const body = await parseBody(req);
      const businessName = body.businessName?.trim();
      const contactEmail = body.contactEmail?.trim() || user.email?.trim();
      const storeName = body.storeName?.trim();
      const slug = normalizeSlug(body.slug || storeName || '');
      if (!businessName || !contactEmail || !storeName || !slug) {
        json(res, 400, { error: 'validation_error', message: 'businessName, contactEmail and storeName are required' }); return;
      }
      const db = commerceSupabase();
      const existing = await db.from('sellers').select('id').eq('core_user_id', user.id).maybeSingle();
      if (existing.error) { json(res, 500, { error: 'seller_lookup_failed' }); return; }
      if (existing.data) { json(res, 409, { error: 'seller_exists', sellerId: existing.data.id }); return; }
      const sellerInsert = await db.from('sellers').insert({
        core_user_id: user.id, business_name: businessName, legal_name: body.legalName?.trim() || null,
        contact_email: contactEmail, phone: body.phone?.trim() || null, country: body.country?.trim() || 'NG',
        onboarding_step: 'store',
      }).select('id').single();
      if (sellerInsert.error || !sellerInsert.data) {
        json(res, 400, { error: 'seller_create_failed', detail: sellerInsert.error?.message }); return;
      }
      const sellerId = sellerInsert.data.id;
      const storeInsert = await db.from('stores').insert({
        seller_id: sellerId, name: storeName, slug, tagline: body.tagline?.trim() || '',
        description: body.description?.trim() || '', currency: 'NGN', status: 'pending',
      }).select('id,name,slug,status').single();
      if (storeInsert.error || !storeInsert.data) {
        await db.from('sellers').delete().eq('id', sellerId);
        json(res, 400, { error: 'store_create_failed', detail: storeInsert.error?.message }); return;
      }
      const store = storeInsert.data;
      await db.from('store_domains').insert({ store_id: store.id, hostname: storeHostname(slug), type: 'subdomain', status: 'pending' });
      const subscription = await db.from('store_subscriptions').insert({
        seller_id: sellerId, store_id: store.id, plan_code: 'founding_store', status: 'pending',
      }).select('id,plan_code,status,amount,currency').single();
      if (subscription.error || !subscription.data) {
        await db.from('stores').delete().eq('id', store.id);
        await db.from('sellers').delete().eq('id', sellerId);
        json(res, 400, { error: 'subscription_create_failed', detail: subscription.error?.message }); return;
      }
      await db.from('store_activation_events').insert({
        seller_id: sellerId, store_id: store.id, event_type: 'seller_registered',
        actor_user_id: user.id, payload: { onboardingStep: 'payment' },
      });
      await db.from('sellers').update({ onboarding_step: 'payment' }).eq('id', sellerId);
      json(res, 201, { sellerId, store, domain: storeHostname(slug), subscription: subscription.data, nextStep: 'payment' }); return;
    }

    if (route === 'products') {
      if (method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const user = await requireUser(req);
      if (!user) { json(res, 401, { error: 'unauthorized' }); return; }
      const body = await parseBody(req);
      const title = body.title?.trim();
      const price = Number(body.price);
      const productUrlSlug = body.productUrlSlug?.trim().toLowerCase();
      if (!title || !productUrlSlug || !Number.isFinite(price) || price < 0) {
        json(res, 400, { error: 'validation_error', message: 'title, productUrlSlug and a valid price are required' }); return;
      }
      const db = commerceSupabase();
      const seller = await db.from('sellers').select('id').eq('core_user_id', user.id).eq('status', 'approved').maybeSingle();
      if (seller.error || !seller.data) { json(res, 403, { error: 'seller_not_active' }); return; }
      const store = await db.from('stores').select('id,status').eq('seller_id', seller.data.id).maybeSingle();
      if (store.error || !store.data || store.data.status !== 'active') { json(res, 403, { error: 'store_not_active' }); return; }
      const inventoryQuantity = Math.max(0, Math.floor(Number(body.inventoryQuantity ?? 0)));
      const result = await db.from('store_products').insert({
        store_id: store.data.id, unmask_product_id: body.unmaskProductId?.trim() || null,
        title, description: body.description?.trim() || '', sku: body.sku?.trim() || null, price,
        compare_at_price: body.compareAtPrice ?? null, currency: body.currency?.trim() || 'NGN',
        inventory_quantity: inventoryQuantity, in_stock: inventoryQuantity > 0,
        product_url_slug: productUrlSlug, hero_image_url: body.heroImageUrl?.trim() || null, status: 'draft',
      }).select('*').single();
      if (result.error || !result.data) { json(res, 400, { error: 'product_create_failed', detail: result.error?.message }); return; }
      json(res, 201, { product: result.data }); return;
    }

    if (route === 'products/activate') {
      if (method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const user = await requireUser(req);
      if (!user) { json(res, 401, { error: 'unauthorized' }); return; }
      const body = await parseBody(req);
      const productId = body.productId?.trim();
      if (!productId) { json(res, 400, { error: 'productId_required' }); return; }
      const db = commerceSupabase();
      const seller = await db.from('sellers').select('id').eq('core_user_id', user.id).maybeSingle();
      if (seller.error || !seller.data) { json(res, 404, { error: 'seller_not_found' }); return; }
      const product = await db.from('store_products')
        .select('id,store_id,title,status,stores!inner(id,seller_id,status)')
        .eq('id', productId).eq('stores.seller_id', seller.data.id).maybeSingle();
      if (product.error || !product.data) { json(res, 404, { error: 'product_not_found' }); return; }
      const stores = product.data.stores as { status?: string } | { status?: string }[] | null;
      const storeStatus = Array.isArray(stores) ? stores[0]?.status : stores?.status;
      if (storeStatus !== 'active') { json(res, 409, { error: 'store_not_active' }); return; }
      const next = body.active === false ? 'draft' : 'active';
      const updated = await db.from('store_products').update({ status: next }).eq('id', productId)
        .select('id,title,status').single();
      if (updated.error) { json(res, 400, { error: 'product_update_failed', detail: updated.error.message }); return; }
      json(res, 200, { ok: true, product: updated.data }); return;
    }

    if (route === 'activate') {
      if (method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }
      if (!webhookSecret(req)) { json(res, 401, { error: 'unauthorized' }); return; }
      const body = await parseBody(req);
      const subscriptionId = body.subscriptionId?.trim();
      if (!subscriptionId) { json(res, 400, { error: 'subscriptionId_required' }); return; }
      const db = commerceSupabase();
      const subscription = await db.from('store_subscriptions').select('id,seller_id,store_id').eq('id', subscriptionId).single();
      if (subscription.error || !subscription.data) { json(res, 404, { error: 'subscription_not_found' }); return; }
      const now = new Date();
      const startsAt = body.startsAt || now.toISOString();
      const endsAt = body.endsAt || new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const updated = await db.from('store_subscriptions').update({
        status: 'active', payment_provider: body.paymentProvider?.trim() || null,
        payment_reference: body.paymentReference?.trim() || null, paid_at: now.toISOString(),
        starts_at: startsAt, ends_at: endsAt,
      }).eq('id', subscriptionId)
        .select('id,status,payment_provider,payment_reference,starts_at,ends_at').single();
      if (updated.error || !updated.data) {
        json(res, 400, { error: 'subscription_activation_failed', detail: updated.error?.message }); return;
      }
      await Promise.all([
        db.from('sellers').update({ status: 'approved', onboarding_step: 'active' }).eq('id', subscription.data.seller_id),
        db.from('stores').update({ status: 'active', activated_at: startsAt, expires_at: endsAt }).eq('id', subscription.data.store_id),
        db.from('store_domains').update({ status: 'active', verified_at: now.toISOString() }).eq('store_id', subscription.data.store_id),
        db.from('store_activation_events').insert({
          seller_id: subscription.data.seller_id, store_id: subscription.data.store_id, event_type: 'store_activated',
          payload: { subscriptionId, paymentReference: body.paymentReference ?? null },
        }),
      ]);
      json(res, 200, { ok: true, subscription: updated.data, storeStatus: 'active', nextStep: 'store_setup' }); return;
    }

    if (route === 'for-product') {
      if (method !== 'GET') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const productId = queryValue(req, 'productId')?.trim();
      if (!productId) { json(res, 400, { error: 'productId_required' }); return; }
      const db = commerceSupabase();
      const result = await db.from('store_products')
        .select('id,store_id,unmask_product_id,title,price,compare_at_price,currency,inventory_quantity,in_stock,product_url_slug,hero_image_url,stores!inner(id,name,slug,tagline,logo_url,status)')
        .eq('unmask_product_id', productId).eq('status', 'active').eq('stores.status', 'active')
        .order('price', { ascending: true });
      if (result.error) { json(res, 500, { error: 'partner_store_lookup_failed' }); return; }
      json(res, 200, { productId, stores: result.data ?? [] }); return;
    }

    if (route === 'public') {
      if (method !== 'GET') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const slug = queryValue(req, 'slug')?.trim().toLowerCase();
      if (!slug) { json(res, 400, { error: 'slug_required' }); return; }
      const db = commerceSupabase();
      const store = await db.from('stores')
        .select('id,name,slug,tagline,description,logo_url,cover_image_url,currency,status,activated_at,expires_at')
        .eq('slug', slug).eq('status', 'active').maybeSingle();
      if (store.error) { json(res, 500, { error: 'store_lookup_failed' }); return; }
      if (!store.data) { json(res, 404, { error: 'store_not_found' }); return; }
      const products = await db.from('store_products')
        .select('id,unmask_product_id,title,description,sku,price,compare_at_price,currency,inventory_quantity,in_stock,product_url_slug,hero_image_url')
        .eq('store_id', store.data.id).eq('status', 'active').order('created_at', { ascending: false });
      if (products.error) { json(res, 500, { error: 'products_lookup_failed' }); return; }
      json(res, 200, { store: store.data, products: products.data ?? [] }); return;
    }

    if (route === 'public-by-host') {
      if (method !== 'GET') { json(res, 405, { error: 'method_not_allowed' }); return; }
      const hostname = (queryValue(req, 'host') || '').trim().toLowerCase();
      if (!hostname || hostname.length > 253) { json(res, 400, { error: 'host_required' }); return; }
      const db = commerceSupabase();
      const domain = await db.from('store_domains').select('store_id,hostname')
        .eq('hostname', hostname).eq('status', 'active').maybeSingle();
      if (domain.error || !domain.data) { json(res, 404, { error: 'store_not_found' }); return; }
      const store = await db.from('stores')
        .select('id,name,slug,tagline,description,logo_url,cover_image_url,currency,status,activated_at,expires_at')
        .eq('id', domain.data.store_id).eq('status', 'active').maybeSingle();
      if (store.error || !store.data) { json(res, 404, { error: 'store_not_found' }); return; }
      const products = await db.from('store_products')
        .select('id,unmask_product_id,title,description,sku,price,compare_at_price,currency,inventory_quantity,in_stock,product_url_slug,hero_image_url')
        .eq('store_id', store.data.id).eq('status', 'active').order('created_at', { ascending: false });
      if (products.error) { json(res, 500, { error: 'products_lookup_failed' }); return; }
      json(res, 200, { store: store.data, products: products.data ?? [] }); return;
    }

    json(res, 404, { error: 'store_route_not_found', route });
  } catch (error) {
    json(res, 500, { error: 'store_request_failed', message: error instanceof Error ? error.message : 'Unexpected store request failure' });
  }
}
