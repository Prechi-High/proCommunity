/**
 * POST /api/intelligence/discover
 * Web discovery for product intelligence
 */

type ReqReq = {
  method?: string;
  body?: {
    productName?: string;
    brand?: string;
    fields?: string[];
  };
};

type ReqRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: ReqReq, res: ReqRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const productName = req.body?.productName || '';
  const brand = req.body?.brand || '';
  const fields = req.body?.fields || [];

  if (!productName || !brand) {
    return res.status(400).json({ error: 'missing_product_info' });
  }

  try {
    const { SearchDiscoveryService } = await import('@/lib/services/search-discovery/searchDiscovery');
    const service = new SearchDiscoveryService();

    const results = await service.discoverForProduct(productName, brand, fields);

    return res.status(200).json({
      success: true,
      results,
      summary: {
        queries: results.length,
        totalEvidence: results.reduce((sum, r) => sum + r.evidence.length, 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'discovery_failed', message });
  }
}
