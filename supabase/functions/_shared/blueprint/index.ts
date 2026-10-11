import { buildBlueprintRows, buildPresentationFromProfile } from "./build.ts";
import { loadPresentationFromDb } from "./load.ts";
import { persistBlueprint } from "./persist.ts";

type Json = Record<string, unknown>;

type Store = {
  select(table: string, filter: string): Promise<Json | null>;
  upsert(table: string, row: Json): Promise<void>;
  insertMany(table: string, rows: Json[]): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
  rows(path: string): Promise<Json[]>;
};

function blueprintEnabled(): boolean {
  const v = (Deno.env.get("DYNAMIC_BLUEPRINT_ENABLED") ?? "true").toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Redis → Supabase → generate (spec §8.1). Redis hookup is optional; DB + inline build always available. */
export async function attachProductPresentation(
  store: Store | null,
  productId: string,
  query: string,
  profile: Json,
  opts?: { force?: boolean },
): Promise<Json> {
  if (!blueprintEnabled()) return profile;

  const existing = profile.presentation as Json | undefined;
  if (!opts?.force && existing?.version) return profile;

  if (store && !opts?.force) {
    const loaded = await loadPresentationFromDb(store, productId).catch(() => null);
    if (loaded) {
      return { ...profile, presentation: loaded };
    }
  }

  const built = buildBlueprintRows(productId, query, profile);
  const presentation = store
    ? await persistBlueprint(store, productId, query, profile, built).catch(() =>
      buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version),
    )
    : buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version);

  return { ...profile, presentation };
}

export type { ProductPresentationContract } from "./types.ts";
