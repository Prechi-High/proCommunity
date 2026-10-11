import { currentEvidenceFingerprint, fingerprintsMatch } from "../evidence/versions.ts";
import type { ProductPresentationContract } from "./types.ts";

type Json = Record<string, unknown>;

export function conversationEvidenceCount(profile: Json): number {
  const rows = profile.conversationEvidence;
  return Array.isArray(rows) ? rows.length : 0;
}

export function evidenceCorpusFingerprint(profile: Json): string {
  const rows = (Array.isArray(profile.conversationEvidence) ? profile.conversationEvidence : []) as Json[];
  const n = rows.length;
  const first = n ? String(rows[0]?.id ?? rows[0]?.sourceId ?? "") : "";
  const last = n ? String(rows[n - 1]?.id ?? rows[n - 1]?.sourceId ?? "") : "";
  return `${n}:${first}:${last}`;
}

/** Presentation must rebuild when corpus or any evidence algorithm version changes. */
export function presentationMatchesConversationEvidence(
  profile: Json,
  presentation: ProductPresentationContract | undefined,
): boolean {
  if (!presentation?.version) return false;
  const meta = presentation.intelligenceMeta;
  const fp = currentEvidenceFingerprint();
  if (!fingerprintsMatch(meta, fp)) return false;
  if (meta?.conversationEvidenceCount !== conversationEvidenceCount(profile)) return false;
  if (meta?.evidenceCorpusFingerprint !== evidenceCorpusFingerprint(profile)) return false;
  if (presentation.blueprintVersion && meta?.blueprintVersion !== presentation.blueprintVersion) return false;
  return presentation.dimensionEvidenceAlgorithm === fp.dimensionEvidenceAlgorithm;
}

export { currentEvidenceFingerprint };
