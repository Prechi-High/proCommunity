/**
 * POST /api/intelligence/classify
 * Category Classification with template assignment
 */

type ReqReq = {
  method?: string;
  body?: {
    query?: string;
    productName?: string;
    brand?: string;
  };
};

type ReqRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: ReqReq, res: ReqRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const query = req.body?.query || '';
  const productName = req.body?.productName || '';
  const brand = req.body?.brand || '';

  if (!productName && !brand && !query) {
    return res.status(400).json({ error: 'missing_product_info' });
  }

  try {
    const { CategoryClassificationService } = await import('@/lib/services/category-classification/categoryClassification');
    const service = new CategoryClassificationService();

    const result = await service.classify(query, productName, brand);

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'classification_failed', message });
  }
}
