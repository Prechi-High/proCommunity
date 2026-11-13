const BEAUTY =
  /beauty|skin|cosmetic|cream|serum|lotion|oil|soap|shampoo|conditioner|makeup|fragrance|perfume|sunscreen|cleanser|toner|moistur|hair|body care|personal care|caro|carotone/i;

const NOT_BEAUTY =
  /electronics|laptop|smartphone|appliances|grocery|dairy|alcoholic|pantry|kitchen|computer|tv|phone|solar|charger|refrigerator/i;

const TEST_ID =
  /^(minute-|modal-|atomic-|nano-|siliconflow-|__|.*-speed-check$|.*live-test.*)/i;

export function isBeautyCatalogItem(category: string | null | undefined, name: string, brand?: string | null) {
  const blob = `${category || ""} ${name} ${brand || ""}`.toLowerCase();
  if (NOT_BEAUTY.test(blob)) return false;
  return BEAUTY.test(blob);
}

export function isTestCatalogId(id: string) {
  return TEST_ID.test(id);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function catalogIdentityKey(name: string, brand?: string | null) {
  return norm(`${brand || ""}${name}`);
}

/** Prefer stable catalog ids over one-off intel duplicates. */
export function preferCatalogRow(a: { id: string }, b: { id: string }) {
  const score = (id: string) => {
    if (isTestCatalogId(id)) return 100;
    if (id.length > 48) return 50;
    return 0;
  };
  return score(a.id) <= score(b.id);
}

export function dedupeCatalogProducts<
  T extends { id: string; name: string; brand?: string | null },
>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = catalogIdentityKey(row.name, row.brand);
    const prev = map.get(key);
    if (!prev || preferCatalogRow(row, prev)) map.set(key, row);
  }
  return [...map.values()];
}
