import { resolveProvenanceFromRawEvidence } from "./sourceEvidenceQuality.ts";
import type { RawEvidence } from "./providers/types.ts";

function normUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function normText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Cross-provider deduplication before scoring (keeps higher-provenance copy). */
export function dedupeRawEvidence(items: RawEvidence[]): RawEvidence[] {
  const sorted = [...items].sort(
    (a, b) => resolveProvenanceFromRawEvidence(b).weight - resolveProvenanceFromRawEvidence(a).weight,
  );
  const out: RawEvidence[] = [];
  const seenUrl = new Set<string>();
  const seenId = new Set<string>();
  const seenText = new Set<string>();

  for (const item of sorted) {
    const idKey = `${item.provider}:${item.sourceId}`;
    if (seenId.has(idKey)) continue;

    const urlKey = normUrl(item.url);
    if (urlKey && seenUrl.has(urlKey)) continue;

    const textKey = normText(item.text).slice(0, 220);
    if (textKey.length >= 40) {
      const dup = [...seenText].some((prev) => prev.length >= 40 && (prev.includes(textKey) || textKey.includes(prev)));
      if (dup) continue;
      seenText.add(textKey);
    }

    if (urlKey) seenUrl.add(urlKey);
    seenId.add(idKey);
    out.push(item);
  }
  return out;
}
