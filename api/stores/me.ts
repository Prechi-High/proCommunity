import { commerceSupabase, json, requireUser } from './_lib';

type Req = { method?: string; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  const db = commerceSupabase();
  const seller = await db.from('sellers').select('*').eq('core_user_id', user.id).maybeSingle();

  if (seller.error) {
    json(res, 500, { error: 'seller_lookup_failed' });
    return;
  }

  if (!seller.data) {
    json(res, 404, { error: 'seller_not_found' });
    return;
  }

  const [store, subscriptions] = await Promise.all([
    db.from('stores').select('*').eq('seller_id', seller.data.id).maybeSingle(),
    db.from('store_subscriptions').select('*').eq('seller_id', seller.data.id).order('created_at', { ascending: false }),
  ]);

  if (store.error || subscriptions.error) {
    json(res, 500, { error: 'store_lookup_failed' });
    return;
  }

  let domain = null;
  if (store.data) {
    const d = await db.from('store_domains').select('*').eq('store_id', store.data.id).maybeSingle();
    domain = d.data ?? null;
  }

  json(res, 200, {
    seller: seller.data,
    store: store.data ?? null,
    domain,
    subscriptions: subscriptions.data ?? [],
  });
}
