import { commerceSupabase, json, requireUser } from './_lib';

type Req = {
  method?: string;
  body?: {
    title?: string;
    description?: string;
    sku?: string;
    price?: number;
    compareAtPrice?: number;
    currency?: string;
    inventoryQuantity?: number;
    productUrlSlug?: string;
    heroImageUrl?: string;
    unmaskProductId?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void } };

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
  const title = body.title?.trim();
  const price = Number(body.price);
  const productUrlSlug = body.productUrlSlug?.trim().toLowerCase();

  if (!title || !productUrlSlug || !Number.isFinite(price) || price < 0) {
    json(res, 400, { error: 'validation_error', message: 'title, productUrlSlug and a valid price are required' });
    return;
  }

  const db = commerceSupabase();
  const seller = await db.from('sellers').select('id').eq('core_user_id', user.id).eq('status', 'approved').maybeSingle();
  if (seller.error || !seller.data) {
    json(res, 403, { error: 'seller_not_active' });
    return;
  }

  const store = await db.from('stores').select('id, status').eq('seller_id', seller.data.id).maybeSingle();
  if (store.error || !store.data || store.data.status !== 'active') {
    json(res, 403, { error: 'store_not_active' });
    return;
  }

  const inventoryQuantity = Math.max(0, Math.floor(Number(body.inventoryQuantity ?? 0)));

  const result = await db
    .from('store_products')
    .insert({
      store_id: store.data.id,
      unmask_product_id: body.unmaskProductId?.trim() || null,
      title,
      description: body.description?.trim() || '',
      sku: body.sku?.trim() || null,
      price,
      compare_at_price: body.compareAtPrice ?? null,
      currency: body.currency?.trim() || 'NGN',
      inventory_quantity: inventoryQuantity,
      in_stock: inventoryQuantity > 0,
      product_url_slug: productUrlSlug,
      hero_image_url: body.heroImageUrl?.trim() || null,
      status: 'draft',
    })
    .select('*')
    .single();

  if (result.error || !result.data) {
    json(res, 400, { error: 'product_create_failed', detail: result.error?.message });
    return;
  }

  json(res, 201, { product: result.data });
}
