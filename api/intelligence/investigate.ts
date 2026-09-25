/**
 * POST /api/intelligence/investigate
 * Full product intelligence investigation
 */

type ReqReq = {
  method?: string;
  body?: {
    query?: string;
  };
};

type ReqRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: ReqReq, res: ReqRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const query = req.body?.query;

  if (!query) {
    return res.status(400).json({ error: 'missing_query' });
  }

  try {
    const { ProductIntelligenceService } = await import('@/lib/services/productIntelligence');
    const service = new ProductIntelligenceService();

    const intelligence = await service.investigateProduct(query);

    return res.status(200).json({
      success: true,
      intelligence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'investigation_failed', message });
  }
}
