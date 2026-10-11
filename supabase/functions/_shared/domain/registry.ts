import type { RegistryDomain } from "./types.ts";

type Json = Record<string, unknown>;
type Store = { rows(path: string): Promise<Json[]> };

let memoryCache: { at: number; domains: RegistryDomain[] } | null = null;
const CACHE_MS = 5 * 60_000;

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function loadDomainRegistry(store: Store | null): Promise<RegistryDomain[]> {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) return memoryCache.domains;
  if (!store) return seedFallback();

  const domainRows = await store.rows(
    "domain_registry?select=id,canonical_name,slug,status,is_official&status=in.(official,inferred,proposed)&order=canonical_name.asc",
  );
  const aliasRows = await store.rows("domain_aliases?select=domain_id,normalized_alias");
  const aliasByDomain = new Map<string, string[]>();
  for (const a of aliasRows) {
    const did = str(a.domain_id, 40);
    const list = aliasByDomain.get(did) ?? [];
    list.push(str(a.normalized_alias, 120));
    aliasByDomain.set(did, list);
  }

  const domains: RegistryDomain[] = domainRows.map((d) => ({
    id: str(d.id, 40),
    canonicalName: str(d.canonical_name, 80),
    slug: str(d.slug, 64),
    status: str(d.status, 20) as RegistryDomain["status"],
    isOfficial: Boolean(d.is_official),
    aliases: aliasByDomain.get(str(d.id, 40)) ?? [],
  }));

  memoryCache = { at: Date.now(), domains };
  return domains.length ? domains : seedFallback();
}

function seedFallback(): RegistryDomain[] {
  return [
    { id: "a1000001-0000-4000-8000-000000000001", canonicalName: "Tech", slug: "tech", status: "official", isOfficial: true, aliases: ["electronics", "gadgets"] },
    { id: "a1000001-0000-4000-8000-000000000002", canonicalName: "Beauty", slug: "beauty", status: "official", isOfficial: true, aliases: ["cosmetics", "skincare"] },
    { id: "a1000001-0000-4000-8000-000000000003", canonicalName: "Home Appliances", slug: "home-appliances", status: "official", isOfficial: true, aliases: ["kitchen appliances"] },
  ];
}

export function registrySlugMap(domains: RegistryDomain[]): Map<string, { id: string; status: string }> {
  const m = new Map<string, { id: string; status: string }>();
  for (const d of domains) m.set(d.slug, { id: d.id, status: d.status });
  return m;
}
