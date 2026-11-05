import { commerceSupabase, json } from '../_lib';

type Req = { method?: string; query?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void; setHeader?: (name: string, value: string) => void; end?: () => void } };

function env(name: string, fallback = '') {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '') || fallback;
}

function getParam(req: Req, name: string) {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

async function activate(reference: string, verified: any) {
  const db = commerceSupabase();
  const metadata = verified?.data?.metadata || {};
  const subscriptionId = metadata.subscription_id;
  if (!subscriptionId) return { ok: false, error: 'subscription_missing' };

  const subscription = await db
    .from('store_subscriptions')
    .select('id, seller_id, store_id, amount, currency, status')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (subscription.error || !subscription.data) return { ok: false, error: 'subscription_not_found' };
  if (subscription.data.status === 'active') return { ok: true, alreadyActive: true };

  const expectedAmount = Math.round(Number(subscription.data.amount ?? 0) * 100);
  if (verified.data.status !== 'success' || Number(verified.data.amount) !== expectedAmount || verified.data.currency !== subscription.data.currency) {
    return { ok: false, error: 'payment_mismatch' };
  }

  const now = new Date();
  const ends = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  await db.from('store_subscriptions').update({
    status: 'active',
    payment_provider: 'paystack',
    payment_reference: reference,
    provider_transaction_id: String(verified.data.id),
    payment_status: 'success',
    paid_at: now.toISOString(),
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  }).eq('id', subscriptionId);

  await Promise.all([
    db.from('sellers').update({ status: 'approved', onboarding_step: 'active' }).eq('id', subscription.data.seller_id),
    db.from('stores').update({ status: 'active', activated_at: now.toISOString(), expires_at: ends.toISOString() }).eq('id', subscription.data.store_id),
    db.from('store_domains').update({ status: 'active', verified_at: now.toISOString() }).eq('store_id', subscription.data.store_id),
    db.from('store_activation_events').insert({
      seller_id: subscription.data.seller_id,
      store_id: subscription.data.store_id,
      event_type: 'store_activated',
      payload: { provider: 'paystack', reference, transactionId: verified.data.id, source: 'callback' },
    }),
  ]);

  return { ok: true };
}

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const reference = getParam(req, 'reference');
  if (!reference) {
    json(res, 400, { error: 'reference_required' });
    return;
  }

  const secret = env('PAYSTACK_SECRET_KEY');
  if (!secret) {
    json(res, 503, { error: 'paystack_not_configured' });
    return;
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const verified = await response.json();

  if (!response.ok || !verified?.status) {
    json(res, 502, { error: 'paystack_verification_failed' });
    return;
  }

  const result = await activate(reference, verified);
  if (!result.ok) {
    json(res, 400, result);
    return;
  }

  const redirectBase = env('STORE_PUBLIC_URL') || '/';
  const destination = `${redirectBase.replace(/\/$/, '')}/seller/onboarding?payment=success&reference=${encodeURIComponent(reference)}`;

  if (typeof res.status(302).setHeader === 'function' && typeof res.status(302).end === 'function') {
    res.status(302).setHeader('Location', destination);
    res.status(302).end();
    return;
  }

  json(res, 200, { ok: true, destination });
}
