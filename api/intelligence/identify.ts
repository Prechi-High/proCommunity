/**
 * POST /api/intelligence/identify
 * Product Identification from text or image clues
 */

type ReqReq = {
  method?: string;
  body?: {
    query?: string;
    imageUrl?: string;
  };
};

type ReqRes = { status: (code: number) => { json: (body: unknown) => void } };

function secret(name: string): string {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '');
}

export default async function handler(req: ReqReq, res: ReqRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const query = req.body?.query;
  const imageUrl = req.body?.imageUrl;

  if (!query && !imageUrl) {
    return res.status(400).json({ error: 'missing_query_or_image' });
  }

  try {
    const { ProductIdentificationService } = await import('@/lib/services/product-identification/productIdentification');
    const service = new ProductIdentificationService();

    let result;
    if (query) {
      result = await service.identifyFromText(query);
    } else if (imageUrl) {
      result = await service.identifyFromImage(imageUrl);
    }

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'identification_failed', message });
  }
}
