import { commerceSupabase, json } from './_lib';

type Req = { method?: string; query?: { productId?: string } };
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const productId = req.query?.productId?.trim();
  if (!productId) {
    json(res, 400, { error: 'productId_required' });
    return;
  }

  const db = commerceSupabase();
  const result = await db
    .from('store_products')
    .select('id, store_id, unmask_product_id, title, price, compare_at_price, currency, inventory_quantity, in_stock, product_url_slug, hero_image_url, stores!inner(id, name, slug, tagline, logo_url, status)')
    .eq('unmask_product_id', productId)
    .eq('status', 'active')
    .eq('stores.status', 'active')
    .order('price', { ascending: true });

  if (result.error) {
    json(res, 500, { error: 'partner_store_lookup_failed' });
    return;
  }

  json(res, 200, { productId, stores: result.data ?? [] });
}
