import { commerceSupabase, json } from './_lib';

type Req = { method?: string; query?: { slug?: string } };
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

export default async function handler(req: Req, res: Res) {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const slug = req.query?.slug?.trim().toLowerCase();
  if (!slug) {
    json(res, 400, { error: 'slug_required' });
    return;
  }

  const db = commerceSupabase();
  const store = await db
    .from('stores')
    .select('id, name, slug, tagline, description, logo_url, cover_image_url, currency, status, activated_at, expires_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (store.error) {
    json(res, 500, { error: 'store_lookup_failed' });
    return;
  }

  if (!store.data) {
    json(res, 404, { error: 'store_not_found' });
    return;
  }

  const products = await db
    .from('store_products')
    .select('id, unmask_product_id, title, description, sku, price, compare_at_price, currency, inventory_quantity, in_stock, product_url_slug, hero_image_url')
    .eq('store_id', store.data.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (products.error) {
    json(res, 500, { error: 'products_lookup_failed' });
    return;
  }

  json(res, 200, { store: store.data, products: products.data ?? [] });
}
