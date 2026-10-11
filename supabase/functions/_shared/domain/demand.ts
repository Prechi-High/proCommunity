import type { Store } from "./resolve.ts";

export async function recordDomainDemand(
  store: Store,
  domainId: string,
  metric: "search" | "unmask" | "question" | "vote",
  opts?: { visitorKey?: string; productId?: string },
): Promise<void> {
  if (!domainId) return;
  const today = new Date().toISOString().slice(0, 10);
  const rows = await store.rows(
    `domain_demand_daily?domain_id=eq.${encodeURIComponent(domainId)}&metric_date=eq.${today}&limit=1`,
  );
  const row = rows[0];
  const inc = (field: string, by = 1) => ({ [field]: Number(row?.[field] ?? 0) + by });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (metric === "search") Object.assign(patch, inc("search_count"));
  if (metric === "unmask") Object.assign(patch, inc("unmask_count"));
  if (metric === "question") Object.assign(patch, inc("question_count"));
  if (metric === "vote") Object.assign(patch, inc("vote_count"));

  if (row?.id) {
    await store.patch("domain_demand_daily", `id=eq.${encodeURIComponent(String(row.id))}`, patch);
  } else {
    await store.insert("domain_demand_daily", {
      domain_id: domainId,
      metric_date: today,
      search_count: metric === "search" ? 1 : 0,
      unmask_count: metric === "unmask" ? 1 : 0,
      question_count: metric === "question" ? 1 : 0,
      vote_count: metric === "vote" ? 1 : 0,
      distinct_products: opts?.productId ? 1 : 0,
      unique_searchers: opts?.visitorKey ? 1 : 0,
    });
  }

  await store.patch("domain_registry", `id=eq.${encodeURIComponent(domainId)}`, { last_seen_at: new Date().toISOString() });
}
