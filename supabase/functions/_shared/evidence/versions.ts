/** Bump when identity resolution logic changes materially. */
export const EVIDENCE_IDENTITY_VERSION = "identity-v2";
/** Bump when dimension relevance / mapping changes. */
export const EVIDENCE_RELEVANCE_VERSION = "relevance-v2";
/** Bump when per-dimension statement extraction changes. */
export const EVIDENCE_EXTRACTION_VERSION = "extraction-v1";
/** Bump when score aggregation / confidence composition changes. */
export const DIMENSION_SCORING_VERSION = "dim-scoring-v1";
/** Composite pipeline package version (client-facing). */
export const DIMENSION_EVIDENCE_ALGO = "dim-evidence-v2";

export type EvidenceAlgorithmFingerprint = {
  dimensionEvidenceAlgorithm: string;
  evidenceIdentityVersion: string;
  evidenceRelevanceVersion: string;
  evidenceExtractionVersion: string;
  dimensionScoringVersion: string;
};

export function currentEvidenceFingerprint(): EvidenceAlgorithmFingerprint {
  return {
    dimensionEvidenceAlgorithm: DIMENSION_EVIDENCE_ALGO,
    evidenceIdentityVersion: EVIDENCE_IDENTITY_VERSION,
    evidenceRelevanceVersion: EVIDENCE_RELEVANCE_VERSION,
    evidenceExtractionVersion: EVIDENCE_EXTRACTION_VERSION,
    dimensionScoringVersion: DIMENSION_SCORING_VERSION,
  };
}

export function fingerprintsMatch(
  stored: Partial<EvidenceAlgorithmFingerprint> | undefined,
  current: EvidenceAlgorithmFingerprint = currentEvidenceFingerprint(),
): boolean {
  if (!stored) return false;
  return (
    stored.dimensionEvidenceAlgorithm === current.dimensionEvidenceAlgorithm &&
    stored.evidenceIdentityVersion === current.evidenceIdentityVersion &&
    stored.evidenceRelevanceVersion === current.evidenceRelevanceVersion &&
    stored.evidenceExtractionVersion === current.evidenceExtractionVersion &&
    stored.dimensionScoringVersion === current.dimensionScoringVersion
  );
}
