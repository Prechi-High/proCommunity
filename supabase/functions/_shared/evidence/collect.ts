import type { RawEvidenceInput } from "./types.ts";

type Json = Record<string, unknown>;

export function collectRawEvidenceFromProfile(profile: Json): RawEvidenceInput[] {
  const out: RawEvidenceInput[] = [];
  const seen = new Set<string>();

  const push = (row: RawEvidenceInput) => {
    const key = row.text.trim().toLowerCase().slice(0, 200);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  for (const v of (Array.isArray(profile.voices) ? profile.voices : []) as Json[]) {
    push({
      id: String(v.id ?? `voice_${out.length}`),
      text: String(v.text ?? ""),
      platform: String(v.platform ?? "owner"),
      author: String(v.author ?? ""),
      url: String(v.url ?? ""),
      sourceTitle: String(v.where ?? ""),
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
