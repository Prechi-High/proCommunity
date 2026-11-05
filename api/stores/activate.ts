import { commerceSupabase, json, webhookSecret } from './_lib';

type Req = {
  method?: string;
  body?: {
    subscriptionId?: string;
    paymentReference?: string;
    paymentProvider?: string;
    startsAt?: string;
    endsAt?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};

type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  if (!webhookSecret(req)) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  const subscriptionId = req.body?.subscriptionId?.trim();
  if (!subscriptionId) {
    json(res, 400, { error: 'subscriptionId_required' });
    return;
  }

  const db = commerceSupabase();
  const subscription = await db
    .from('store_subscriptions')
    .select('id, seller_id, store_id')
    .eq('id', subscriptionId)
    .single();

  if (subscription.error || !subscription.data) {
    json(res, 404, { error: 'subscription_not_found' });
    return;
  }

  const now = new Date();
  const startsAt = req.body?.startsAt || now.toISOString();
  const endsAt = req.body?.endsAt || new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const updated = await db
    .from('store_subscriptions')
    .update({
      status: 'active',
      payment_provider: req.body?.paymentProvider?.trim() || null,
      payment_reference: req.body?.paymentReference?.trim() || null,
      paid_at: now.toISOString(),
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .eq('id', subscriptionId)
    .select('id, status, payment_provider, payment_reference, starts_at, ends_at')
    .single();

  if (updated.error || !updated.data) {
    json(res, 400, { error: 'subscription_activation_failed', detail: updated.error?.message });
    return;
  }

  await Promise.all([
    db.from('sellers').update({ status: 'approved', onboarding_step: 'active' }).eq('id', subscription.data.seller_id),
    db.from('stores').update({
      status: 'active',
      activated_at: startsAt,
      expires_at: endsAt,
    }).eq('id', subscription.data.store_id),
    db.from('store_domains').update({
      status: 'active',
      verified_at: now.toISOString(),
    }).eq('store_id', subscription.data.store_id),
    db.from('store_activation_events').insert({
      seller_id: subscription.data.seller_id,
      store_id: subscription.data.store_id,
      event_type: 'store_activated',
      payload: { subscriptionId, paymentReference: req.body?.paymentReference ?? null },
    }),
  ]);

  json(res, 200, {
    ok: true,
    subscription: updated.data,
    storeStatus: 'active',
    nextStep: 'store_setup',
  });
}
