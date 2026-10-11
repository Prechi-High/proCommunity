import { resolveSourceProvenance } from "./sourceEvidenceQuality.ts";
import type { RawEvidenceInput } from "./types.ts";

type Json = Record<string, unknown>;

export function collectRawEvidenceFromProfile(profile: Json): RawEvidenceInput[] {
  const out: RawEvidenceInput[] = [];
  const seen = new Set<string>();

  const push = (row: RawEvidenceInput) => {
    const prov = resolveSourceProvenance(row);
    const enriched: RawEvidenceInput = {
      ...row,
      provenanceTier: prov.tier,
      provenanceWeight: prov.weight,
    };
    const key = enriched.id || enriched.text.trim().toLowerCase().slice(0, 200);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(enriched);
  };

  for (const row of (Array.isArray(profile.conversationEvidence) ? profile.conversationEvidence : []) as Json[]) {
    const eq = row.experienceQuality as { affectsScoring?: boolean } | undefined;
    push({
      id: String(row.id ?? `${row.provider}:${row.sourceId}`),
      text: String(row.text ?? ""),
      platform: String(row.platform ?? row.provider ?? "conversation"),
      author: String(row.author ?? ""),
      url: String(row.url ?? ""),
      sourceTitle: String(row.title ?? ""),
      provider: String(row.provider ?? ""),
      sourceId: String(row.sourceId ?? ""),
      conversationId: row.conversationId ? String(row.conversationId) : undefined,
      parentId: row.parentId ? String(row.parentId) : undefined,
      contextText: row.contextText ? String(row.contextText) : undefined,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      experienceAffectsScoring: eq?.affectsScoring ?? true,
    });
  }

  for (const v of (Array.isArray(profile.voices) ? profile.voices : []) as Json[]) {
    const vid = String(v.id ?? `voice_${out.length}`);
    if (seen.has(vid)) continue;
    push({
      id: vid,
      text: String(v.text ?? ""),
      platform: String(v.platform ?? "owner"),
      author: String(v.author ?? ""),
      url: String(v.url ?? ""),
      sourceTitle: String(v.where ?? ""),
      provider: v.provider ? String(v.provider) : undefined,
      conversationId: v.conversationId ? String(v.conversationId) : undefined,
      parentId: v.parentId ? String(v.parentId) : undefined,
      contextText: v.contextText ? String(v.contextText) : undefined,
      experienceAffectsScoring: true,
    });
  }

  for (const [i, p] of (Array.isArray(profile.praise) ? profile.praise : []).entries()) {
    const row = p as Json;
    push({
      id: `praise_${i}`,
      text: String(row.text ?? ""),
      platform: "review",
      url: "",
      sourceTitle: "Review snippet",
    });
  }

  for (const [i, c] of (Array.isArray(profile.complaints) ? profile.complaints : []).entries()) {
    const row = c as Json;
    push({
      id: `complaint_${i}`,
      text: String(row.text ?? ""),
      platform: "review",
      url: "",
      sourceTitle: "Review snippet",
    });
  }

  for (const s of (Array.isArray(profile.sources) ? profile.sources : []) as Json[]) {
    const n = Number(s.n);
    const snippet = String(s.snippet ?? s.title ?? "");
    if (!snippet) continue;
    push({
      id: `src_${n || out.length}`,
      text: snippet,
      platform: String(s.kind ?? "web"),
      url: String(s.url ?? ""),
      sourceTitle: String(s.title ?? s.domain ?? ""),
    });
  }

  return out.filter((r) => r.text.trim().length >= 12);
}
