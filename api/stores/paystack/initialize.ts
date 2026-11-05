import { commerceSupabase, json, requireUser } from '../_lib';

type Req = {
  method?: string;
  body?: { subscriptionId?: string };
  headers?: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

function env(name: string, fallback = '') {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '') || fallback;
}

function baseUrl(req: Req) {
  const configured = env('STORE_PUBLIC_URL');
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers?.host;
  const raw = Array.isArray(host) ? host[0] : host;
  return raw ? `https://${raw}` : '';
}

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

  const db = commerceSupabase();
  const seller = await db.from('sellers').select('id').eq('core_user_id', user.id).maybeSingle();
  if (seller.error || !seller.data) {
    json(res, 404, { error: 'seller_not_found' });
    return;
  }

  const subscription = await db
    .from('store_subscriptions')
    .select('id, seller_id, store_id, plan_code, status, amount, currency')
    .eq('id', req.body?.subscriptionId ?? '')
    .eq('seller_id', seller.data.id)
    .single();

  if (subscription.error || !subscription.data) {
    json(res, 404, { error: 'subscription_not_found' });
    return;
  }

  const amountNgn = Number(env('STORE_FOUNDING_PRICE_NGN'));
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
    json(res, 503, { error: 'store_price_not_configured', message: 'STORE_FOUNDING_PRICE_NGN must be configured before checkout.' });
    return;
  }

  const reference = `unmask-store-${subscription.data.id}-${Date.now()}`;
  const callback = `${baseUrl(req)}/api/stores/paystack/callback`;
  const payload = {
    email: user.email,
    amount: String(Math.round(amountNgn * 100)),
    currency: subscription.data.currency || 'NGN',
    reference,
    callback_url: callback,
    metadata: JSON.stringify({
      type: 'unmask_store_activation',
      subscription_id: subscription.data.id,
      seller_id: seller.data.id,
      store_id: subscription.data.store_id,
    }),
  };

  const secret = env('PAYSTACK_SECRET_KEY');
  if (!secret) {
    json(res, 503, { error: 'paystack_not_configured' });
    return;
  }

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    json(res, 502, { error: 'paystack_initialize_failed', message: result?.message || 'Paystack could not initialize checkout.' });
    return;
  }

  const updated = await db
    .from('store_subscriptions')
    .update({
      amount: amountNgn,
      payment_provider: 'paystack',
      payment_reference: reference,
      checkout_reference: result.data.access_code ?? null,
      payment_status: 'initialized',
    })
    .eq('id', subscription.data.id)
    .select('id, amount, currency, status, payment_provider, payment_reference, checkout_reference')
    .single();

  if (updated.error) {
    json(res, 500, { error: 'subscription_update_failed' });
    return;
  }

  await db.from('store_activation_events').insert({
    seller_id: seller.data.id,
    store_id: subscription.data.store_id,
    event_type: 'payment_initialized',
    actor_user_id: user.id,
    payload: { provider: 'paystack', reference, amount: amountNgn },
  });

  json(res, 200, {
    ok: true,
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference,
    amount: amountNgn,
    currency: subscription.data.currency || 'NGN',
  });
}
