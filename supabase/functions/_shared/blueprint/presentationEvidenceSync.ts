import { currentEvidenceFingerprint, fingerprintsMatch } from "../evidence/versions.ts";
import type { ProductPresentationContract } from "./types.ts";

type Json = Record<string, unknown>;

export function conversationEvidenceCount(profile: Json): number {
  const rows = profile.conversationEvidence;
  return Array.isArray(rows) ? rows.length : 0;
}

export function evidenceCorpusFingerprint(profile: Json): string {
  const rows = (Array.isArray(profile.conversationEvidence) ? profile.conversationEvidence : []) as Json[];
  const corpus = JSON.stringify([rows, profile.communityEvidence ?? [], profile.semanticReview ?? null]);
  let h = 2166136261;
  for (let i = 0; i < corpus.length; i++) h = Math.imul(h ^ corpus.charCodeAt(i), 16777619) >>> 0;
  return `${rows.length}:${h.toString(16)}`;
}

/** Presentation must rebuild when corpus or any evidence algorithm version changes. */
export function presentationMatchesConversationEvidence(
  profile: Json,
  presentation: ProductPresentationContract | undefined,
): boolean {
  if (!presentation?.version) return false;
  if ((profile.semanticReview as { complete?: boolean } | undefined)?.complete === false) return false;
  const meta = presentation.intelligenceMeta;
  const fp = currentEvidenceFingerprint();
  if (!fingerprintsMatch(meta, fp)) return false;
  if (meta?.conversationEvidenceCount !== conversationEvidenceCount(profile)) return false;
  if (meta?.evidenceCorpusFingerprint !== evidenceCorpusFingerprint(profile)) return false;
  if (presentation.blueprintVersion && meta?.blueprintVersion !== presentation.blueprintVersion) return false;
  return presentation.dimensionEvidenceAlgorithm === fp.dimensionEvidenceAlgorithm;
}

export { currentEvidenceFingerprint };
