import type { DimensionExperiencePackage, NormalizedEvidenceRow } from "./types.ts";

type Json = Record<string, unknown>;

type Store = {
  upsert(table: string, row: Json): Promise<void>;
  upsertMany?(table: string, rows: Json[]): Promise<void>;
  insertMany(table: string, rows: Json[]): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
};

export async function persistDimensionEvidence(
  store: Store,
  productId: string,
  blueprintId: string,
  dimensionKeys: string[],
  package_: DimensionExperiencePackage,
  rows: NormalizedEvidenceRow[],
): Promise<void> {
  const dimIds = dimensionKeys.map((k) => `${blueprintId}_dim_${k}`);
  await Promise.all(dimIds.map((dimId) =>
    store.remove("dimension_evidence", `dimension_id=eq.${encodeURIComponent(dimId)}`),
  ));

  const evidenceRows: Json[] = [];
  const linkRows: Json[] = [];

  for (const row of rows) {
    evidenceRows.push({
      id: row.evidenceId,
      intel_product_id: productId,
      product_id: null,
      source_url: row.url || null,
      source_title: row.sourceTitle || null,
      content: row.text,
      content_summary: row.extractedStatement,
      extracted_statement: row.extractedStatement,
      evidence_type: "social_media",
      platform: row.platform,
      author: row.author || null,
      product_match_level: row.productMatch.level,
      product_match_confidence: row.productMatch.confidence,
      source_reliability: row.productMatch.affectsScore ? 0.7 : 0.35,
      content_hash: row.evidenceId,
      provider: (row as { provider?: string }).provider ?? row.platform,
      source_id: (row as { sourceId?: string }).sourceId ?? row.evidenceId,
      conversation_id: (row as { conversationId?: string }).conversationId ?? null,
      parent_id: (row as { parentId?: string }).parentId ?? null,
    });

    for (const link of row.dimensionLinks) {
      const dimId = `${blueprintId}_dim_${link.dimensionKey}`;
      linkRows.push({
        dimension_id: dimId,
        evidence_id: row.evidenceId,
        stance: link.stance,
        strength: link.strength,
        relevance_confidence: link.relevanceConfidence,
        product_match_confidence: row.productMatch.confidence,
        extracted_statement: row.extractedStatement,
        affects_score: link.affectsScore && row.productMatch.affectsScore,
        context: link.reason,
      });
    }
  }

  // PostgREST rejects duplicate conflict keys within a single upsert statement.
  const unique = [...new Map(evidenceRows.map((row) => [row.id, row])).values()];
  for (let offset = 0; offset < unique.length; offset += 200) {
    const batch = unique.slice(offset, offset + 200);
    if (store.upsertMany) await store.upsertMany("evidence", batch);
    else {
      for (let i = 0; i < batch.length; i += 8) {
        await Promise.all(batch.slice(i, i + 8).map((row) => store.upsert("evidence", row)));
      }
    }
  }
  if (linkRows.length) await store.insertMany("dimension_evidence", linkRows);
}
