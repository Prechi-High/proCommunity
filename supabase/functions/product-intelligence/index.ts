/**
 * POST /functions/v1/product-intelligence
 * Product Intelligence Organisation - Main entry point
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReqBody = {
  action?: string;
  query?: string;
  productId?: string;
  productName?: string;
  brand?: string;
  fields?: string[];
  imageUrl?: string;
};

function secretValue(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  let body: ReqBody | null = null;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    body = null;
  }

  if (!body) {
    return json({ error: "missing_body" }, 400);
  }

  try {
    const { action, query, productId, productName, brand, fields, imageUrl } = body;

    // Product identification from text or image
    if (action === "identify") {
      if (!query && !imageUrl) {
        return json({ error: "missing_query_or_image" }, 400);
      }

      // Use Serper for identification
      const serperKey = secretValue("SERPER_API_KEY");
      if (!serperKey) {
        return json({ error: "missing_serper_key", hint: "Set SERPER_API_KEY as a Supabase Edge secret" }, 503);
      }

      const searchQuery = query || imageUrl || "";
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: searchQuery, num: 10 }),
      });

      if (!response.ok) {
        return json({ error: "serper_error", http: response.status }, 503);
      }

      const result = await response.json();
      const organic = result.organic ?? [];

      return json({
        success: true,
        query,
        imageUrl,
        candidates: organic.slice(0, 5).map((item: any, idx: number) => ({
          id: `prod_${idx}`,
          name: item.title,
          brand: item.link.includes("amazon") ? "Amazon" : "Unknown",
          category: "unknown",
          confidence: 0.5 + idx * 0.1,
          evidence: [item.snippet],
          url: item.link,
        })),
      });
    }

    // Category classification
    if (action === "classify") {
      if (!productName && !brand) {
        return json({ error: "missing_product_info" }, 400);
      }

      const combined = `${productName} ${brand}`.toLowerCase();

      const categories = [
        { id: "skincare", name: "Skincare", slug: "skincare" },
        { id: "cleanser", name: "Cleanser", slug: "cleanser" },
        { id: "serum", name: "Serum", slug: "serum" },
        { id: "moisturizer", name: "Moisturizer", slug: "moisturizer" },
        { id: "spf", name: "Sunscreen", slug: "spf" },
      ];

      let bestMatch = categories[0];
      let bestScore = 0;

      for (const cat of categories) {
        const score = combined.includes(cat.slug) ? 0.8 : combined.includes("skincare") ? 0.5 : 0.2;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = cat;
        }
      }

      return json({
        success: true,
        category: bestMatch,
        templateId: `${bestMatch.slug}_default`,
        confidence: bestScore,
      });
    }

    // Full investigation
    if (action === "investigate") {
      if (!query) {
        return json({ error: "missing_query" }, 400);
      }

      // Use Serper for search
      const serperKey = secretValue("SERPER_API_KEY");
      if (!serperKey) {
        return json({ error: "missing_serper_key" }, 503);
      }

      // LLM keys for extraction
      const openRouterKey = secretValue("OPENROUTER_API_KEY");
      const geminiKey = secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY");

      // Run Serper search
      const searchResponse = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 10 }),
      });

      if (!searchResponse.ok) {
        return json({ error: "serper_error" }, 503);
      }

      const searchResult = await searchResponse.json();
      const organic = searchResult.organic ?? [];

      // Extract product info from search results
      let productName = query;
      let brand = "Unknown";
      if (organic.length > 0) {
        const firstResult = organic[0];
        const title = firstResult.title || "";
        const parts = title.split(/[-—|]/);
        if (parts.length > 0) {
          productName = parts[0].trim();
          brand = parts[1]?.trim() || "Unknown";
        }
      }

      // Classify product
      const combined = `${productName} ${brand}`.toLowerCase();
      let category = "skincare";
      if (combined.includes("cleanser") || combined.includes("wash")) category = "cleanser";
      else if (combined.includes("serum")) category = "serum";
      else if (combined.includes("moistur") || combined.includes("cream")) category = "moisturizer";
      else if (combined.includes("sunscreen") || combined.includes("spf")) category = "spf";

      // Prepare extraction prompt
      const extractionPrompt = `Extract product intelligence for: ${brand} ${productName}

Category: ${category}

Available search results:
${organic.slice(0, 5).map((item: any) => `${item.title}: ${item.snippet}`).join("\n\n")}

Extract these fields as JSON:
- product_name
- brand
- category
- description
- price (if visible)
- availability (if visible)

Return ONLY valid JSON.`;

      // Try Gemini first, then OpenRouter
      let extracted: Record<string, unknown> | null = null;

      if (geminiKey) {
        const geminiResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: extractionPrompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: "application/json" },
            }),
          }
        );

        if (geminiResponse.ok) {
          const geminiResult = await geminiResponse.json();
          const text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          try {
            extracted = JSON.parse(text);
          } catch {
            // Ignore parse error
          }
        }
      }

      if (!extracted && openRouterKey) {
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
            "HTTP-Referer": secretValue("PUBLIC_SITE_ORIGIN") || "https://pro-community.vercel.app",
            "X-Title": "Sourced",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            max_tokens: 2000,
            messages: [{ role: "user", content: extractionPrompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (openRouterResponse.ok) {
          const result = await openRouterResponse.json();
          const text = result.choices?.[0]?.message?.content ?? "";
          try {
            extracted = JSON.parse(text);
          } catch {
            // Ignore parse error
          }
        }
      }

      // Build intelligence result
      const intelligence = extracted || {
        product_name: productName,
        brand: brand,
        category: category,
        description: "No intelligent extraction available",
        confidence: extracted ? 0.9 : 0.5,
      };

      return json({
        success: true,
        intelligence,
        searchResults: {
          query,
          total: organic.length,
          topMatches: organic.slice(0, 3).map((item: any) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
          })),
        },
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "internal_error", message }, 500);
  }
});
