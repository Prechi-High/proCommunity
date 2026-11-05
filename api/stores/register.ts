import { commerceSupabase, json, normalizeSlug, requireUser, storeHostname } from './_lib';

type Req = {
  method?: string;
  body?: {
    businessName?: string;
    legalName?: string;
    contactEmail?: string;
    phone?: string;
    country?: string;
    storeName?: string;
    slug?: string;
    tagline?: string;
    description?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
};

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  const body = req.body ?? {};
  const businessName = body.businessName?.trim();
  const contactEmail = body.contactEmail?.trim() || user.email?.trim();
  const storeName = body.storeName?.trim();
  const slug = normalizeSlug(body.slug || storeName || '');

  if (!businessName || !contactEmail || !storeName || !slug) {
    json(res, 400, {
      error: 'validation_error',
      message: 'businessName, contactEmail and storeName are required',
    });
    return;
  }

  const db = commerceSupabase();

  const existing = await db
    .from('sellers')
    .select('id')
    .eq('core_user_id', user.id)
    .maybeSingle();

  if (existing.error) {
    json(res, 500, { error: 'seller_lookup_failed' });
    return;
  }

  if (existing.data) {
    json(res, 409, { error: 'seller_exists', sellerId: existing.data.id });
    return;
  }

  const sellerInsert = await db
    .from('sellers')
    .insert({
      core_user_id: user.id,
      business_name: businessName,
      legal_name: body.legalName?.trim() || null,
      contact_email: contactEmail,
      phone: body.phone?.trim() || null,
      country: body.country?.trim() || 'NG',
      onboarding_step: 'store',
    })
    .select('id')
    .single();

  if (sellerInsert.error || !sellerInsert.data) {
    json(res, 400, {
      error: 'seller_create_failed',
      detail: sellerInsert.error?.message,
    });
    return;
  }

  const sellerId = sellerInsert.data.id;

  const storeInsert = await db
    .from('stores')
    .insert({
      seller_id: sellerId,
      name: storeName,
      slug,
      tagline: body.tagline?.trim() || '',
      description: body.description?.trim() || '',
      currency: 'NGN',
      status: 'pending',
    })
    .select('id, name, slug, status')
    .single();

  if (storeInsert.error || !storeInsert.data) {
    await db.from('sellers').delete().eq('id', sellerId);
    json(res, 400, {
      error: 'store_create_failed',
      detail: storeInsert.error?.message,
    });
    return;
  }

  const store = storeInsert.data;

  await db.from('store_domains').insert({
    store_id: store.id,
    hostname: storeHostname(slug),
    type: 'subdomain',
    status: 'pending',
  });

  const subscription = await db
    .from('store_subscriptions')
    .insert({
      seller_id: sellerId,
      store_id: store.id,
      plan_code: 'founding_store',
      status: 'pending',
    })
    .select('id, plan_code, status, amount, currency')
    .single();

  if (subscription.error || !subscription.data) {
    await db.from('stores').delete().eq('id', store.id);
    await db.from('sellers').delete().eq('id', sellerId);
    json(res, 400, {
      error: 'subscription_create_failed',
      detail: subscription.error?.message,
    });
    return;
  }

  await db.from('store_activation_events').insert({
    seller_id: sellerId,
    store_id: store.id,
    event_type: 'seller_registered',
    actor_user_id: user.id,
    payload: { onboardingStep: 'payment' },
  });

  await db.from('sellers').update({ onboarding_step: 'payment' }).eq('id', sellerId);

  json(res, 201, {
    sellerId,
    store,
    domain: storeHostname(slug),
    subscription: subscription.data,
    nextStep: 'payment',
  });
}
