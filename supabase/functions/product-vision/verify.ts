import { userFromRequest } from "../_shared/core/auth.ts";

type Json = Record<string, unknown>;
type GeminiJson = (key: string, parts: unknown[], budgetMs: number) => Promise<{ data: Json | null; model: string; errors: string[] }>;

const MAX_PER_PRODUCT_PER_DAY = 6;
const MAX_PER_USER_PER_HOUR = 10;

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function rest() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    async rows(path: string): Promise<Json[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers }).catch(() => null);
      if (!r?.ok) return [];
      return ((await r.json().catch(() => [])) as Json[]) ?? [];
    },
    async upsert(table: string, row: Json, onConflict: string): Promise<Json | null> {
      const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(row),
      }).catch(() => null);
      if (!r?.ok) return null;
      const out = (await r.json().catch(() => [])) as Json[];
      return out[0] ?? null;
    },
    async patch(table: string, filter: string, row: Json): Promise<void> {
      await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(row),
      }).catch(() => undefined);
    },
    async uploadPrivate(path: string, b64: string, mime: string): Promise<boolean> {
      try {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const r = await fetch(`${url}/storage/v1/object/verifications/${path}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": mime, "x-upsert": "true" },
          body: bytes,
        });
        return r.ok;
      } catch {
        return false;
      }
    },
  };
}

async function referenceImage(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!/^https:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const mime = (r.headers.get("content-type") ?? "").split(";")[0];
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > 2_500_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { inlineData: { mimeType: mime, data: btoa(bin) } };
  } catch {
    return null;
  }
}

function prompt(p: { name: string; brand: string; category: string }, hasReference: boolean): string {
  return `A shopper says they OWN this product and took the FIRST photo just now with their phone camera to prove it.
Claimed product: ${[p.brand, p.name].filter(Boolean).join(" ")}${p.category ? ` (category: ${p.category})` : ""}.
${hasReference ? "The SECOND image is a reference picture of the claimed product from a store listing.\n" : ""}
Judge the FIRST photo only. Be fair to ordinary owners (messy rooms, odd angles, cases, worn items, low light are fine)
but strict about fakes:
- is_physical_photo: a real camera photo of a physical object in a real space.
- is_screen_or_print: the product is shown on a phone/computer/TV screen or a printed page/box art only (moire, pixels, bezels, glare lines, flat paper).
- is_stock_or_marketing: looks like a studio/marketing/listing image (seamless background, perfect lighting, watermark, text overlays).
- matches_product: the physical item is plausibly the claimed product — same brand and product line; accept when the exact
  model cannot be told apart visually, reject when it is clearly a different product or category.
Return JSON only:
{"is_physical_photo":true,"is_screen_or_print":false,"is_stock_or_marketing":false,"matches_product":true,
"seen":"what item you actually see, 3-8 words","confidence":0.0,
"tip":"if not accepted: one short friendly instruction for a better retake, else empty"}`;
}

export async function verifyOwner(req: Request, body: Json, b64: string, mime: string, geminiJson: GeminiJson, gKey: string): Promise<{ status: number; body: Json }> {
  const user = await userFromRequest(req);
  if (!user) return { status: 401, body: { error: "sign_in_required" } };
  const store = rest();
  if (!store) return { status: 503, body: { error: "storage_unavailable" } };
  if (!gKey) return { status: 503, body: { error: "check_unavailable" } };
  if (body.source !== "camera") return { status: 400, body: { error: "live_photo_required" } };
  if (b64.length > 8_500_000 || !/^image\/(jpeg|png|webp)$/.test(mime)) return { status: 400, body: { error: "invalid_image" } };

  const product = (body.product ?? {}) as Json;
  const productId = str(product.id, 100);
  const name = str(product.name, 160);
  const brand = str(product.brand, 60);
  const category = str(product.category, 60);
  const image = str(product.image, 500);
  if (!productId || !name) return { status: 400, body: { error: "missing_product" } };

  const uid = encodeURIComponent(user.id);
  const pid = encodeURIComponent(productId);
  const [existing] = await store.rows(`owner_verifications?select=*&user_id=eq.${uid}&product_id=eq.${pid}&limit=1`);
  if (existing?.status === "verified") {
    return { status: 200, body: { success: true, status: "verified", verification: publicRow(existing) } };
  }
  const dayAgo = Date.now() - 86400_000;
  const recentAttempts = existing && +new Date(String(existing.last_attempt_at)) > dayAgo ? Number(existing.attempts ?? 0) : 0;
  if (recentAttempts >= MAX_PER_PRODUCT_PER_DAY) return { status: 429, body: { error: "too_many_attempts", hint: "Try again tomorrow." } };
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const lastHour = await store.rows(`owner_verifications?select=id&user_id=eq.${uid}&last_attempt_at=gte.${encodeURIComponent(hourAgo)}`);
  if (lastHour.length >= MAX_PER_USER_PER_HOUR) return { status: 429, body: { error: "too_many_attempts", hint: "Take a short break and try again." } };

  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const photoPath = `${user.id}/${productId}/${crypto.randomUUID()}.${ext}`;
  const [uploaded, reference] = await Promise.all([store.uploadPrivate(photoPath, b64, mime), referenceImage(image)]);

  const parts: unknown[] = [{ text: prompt({ name, brand, category }, Boolean(reference)) }, { inlineData: { mimeType: mime, data: b64 } }];
  if (reference) parts.push(reference);
  const check = await geminiJson(gKey, parts, 25000);
  const d = check.data;
  if (!d) return { status: 503, body: { error: "check_unavailable", hint: "We couldn’t check the photo right now. Try again in a moment." } };

  const confidence = Math.max(0, Math.min(1, Number(d.confidence) || 0));
  const physical = d.is_physical_photo === true && d.is_screen_or_print !== true && d.is_stock_or_marketing !== true;
  const verified = physical && d.matches_product === true && confidence >= 0.6;
  const reason = verified
    ? ""
    : !physical
    ? "This needs to be a live photo of the item itself, not a screen, print or product image."
    : d.matches_product !== true
    ? `This looks like ${str(d.seen, 60) || "a different item"}, not the ${name}.`
    : "We couldn’t see the product clearly enough.";
  const now = new Date().toISOString();

  const row = await store.upsert(
    "owner_verifications",
    {
      user_id: user.id,
      product_id: productId,
      product_name: name,
      brand: brand || null,
      category: category || null,
      product_image: image || null,
      photo_path: uploaded ? photoPath : null,
      status: verified ? "verified" : "rejected",
      confidence,
      reason: reason || null,
      attempts: recentAttempts + 1,
      last_attempt_at: now,
      verified_at: verified ? now : null,
    },
    "user_id,product_id",
  );
  if (!row) return { status: 500, body: { error: "save_failed" } };

  if (verified) await backfill(store, user.id, row);

  return {
    status: 200,
    body: {
      success: true,
      status: verified ? "verified" : "rejected",
      reason,
      tip: verified ? "" : str(d.tip, 160),
      attemptsLeft: Math.max(0, MAX_PER_PRODUCT_PER_DAY - (recentAttempts + 1)),
      verification: verified ? publicRow(row) : null,
    },
  };
}

function publicRow(r: Json): Json {
  return {
    productId: r.product_id,
    productName: r.product_name,
    brand: r.brand ?? null,
    category: r.category ?? null,
    productImage: r.product_image ?? null,
    verifiedAt: r.verified_at ?? null,
  };
}

/** Earlier posts by this member about this product now carry the verified-owner mark. */
async function backfill(store: NonNullable<ReturnType<typeof rest>>, userId: string, row: Json) {
  const pid = encodeURIComponent(String(row.product_id));
  const uid = encodeURIComponent(userId);
  const mark = {
    is_owner: true,
    owner_product_id: row.product_id,
    owner_product_name: row.product_name,
    owner_product_image: row.product_image ?? null,
  };
  const threads = await store.rows(`community_threads?select=id&or=(product_id.eq.${pid},compare_id.eq.${pid})&limit=500`);
  const ids = threads.map((t) => String(t.id));
  await Promise.all([
    store.patch("community_threads", `author_id=eq.${uid}&product_id=eq.${pid}`, mark),
    ids.length ? store.patch("community_replies", `author_id=eq.${uid}&thread_id=in.(${ids.join(",")})`, mark) : Promise.resolve(),
  ]);
}
