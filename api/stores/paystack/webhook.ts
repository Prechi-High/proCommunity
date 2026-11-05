import { createHmac, timingSafeEqual } from 'node:crypto';
import { commerceSupabase } from '../_lib';

export const config = { api: { bodyParser: false } };

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
};

type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

function env(name: string, fallback = '') {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '') || fallback;
}

function header(req: Req, name: string) {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

function readBody(req: Req): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on?.('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on?.('end', () => resolve(Buffer.concat(chunks)));
    req.on?.('error', reject);
  });
}

function validSignature(raw: Buffer, signature: string, secret: string) {
  const digest = createHmac('sha512', secret).update(raw).digest('hex');
  if (!/^[0-9a-f]{128}$/.test(signature) || signature.length !== digest.length) return false;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function validTimestampedSignature(raw: Buffer, headerValue: string, secret: string) {
  const parts = headerValue.split(',').map((v) => v.trim());
  const timestamp = parts.find((v) => v.startsWith('t='))?.slice(2);
  const signatures = parts.filter((v) => v.startsWith('v1=')).map((v) => v.slice(3).split(':').pop() || '');
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) return false;
  const expected = createHmac('sha512', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return signatures.some((sig) => /^[0-9a-f]{128}$/.test(sig) && timingSafeEqual(Buffer.from(expected), Buffer.from(sig)));
}

async function activate(reference: string, data: any) {
  const db = commerceSupabase();
  const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata || '{}') : (data.metadata || {});
  const subscriptionId = metadata.subscription_id;
  if (!subscriptionId) return;

  const subscription = await db
    .from('store_subscriptions')
    .select('id, seller_id, store_id, amount, currency, status')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (subscription.error || !subscription.data || subscription.data.status === 'active') return;

  const expectedAmount = Math.round(Number(subscription.data.amount ?? 0) * 100);
  if (data.status !== 'success' || Number(data.amount) !== expectedAmount || data.currency !== subscription.data.currency) return;

  const now = new Date();
  const ends = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  await db.from('store_subscriptions').update({
    status: 'active',
    payment_provider: 'paystack',
    payment_reference: reference,
    provider_transaction_id: String(data.id),
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
      payload: { provider: 'paystack', reference, transactionId: data.id, source: 'webhook' },
    }),
  ]);
}

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const secret = env('PAYSTACK_SECRET_KEY');
  if (!secret) {
    res.status(503).send('Paystack is not configured');
    return;
  }

  const raw = await readBody(req);
  const signature = header(req, 'x-paystack-signature');
  const timestamped = header(req, 'paystack-signature');

  if (!signature && !timestamped) {
    res.status(401).send('Missing signature');
    return;
  }

  if ((signature && !validSignature(raw, signature, secret)) || (timestamped && !validTimestampedSignature(raw, timestamped, secret))) {
    res.status(401).send('Invalid signature');
    return;
  }

  let event: any;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  if (event.event === 'charge.success') {
    await activate(event.data?.reference, event.data);
  }

  res.status(200).send('OK');
}
