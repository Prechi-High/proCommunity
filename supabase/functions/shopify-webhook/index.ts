import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!secret || !hmac) {
    return new Response("unauthorized", { status: 401 });
  }
  // HMAC verification belongs here before any listing upsert.
  return new Response(JSON.stringify({ ok: true, deferred: "verify-hmac-then-upsert-listings" }), {
    headers: { "Content-Type": "application/json" },
  });
});
