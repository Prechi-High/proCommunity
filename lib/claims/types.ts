import type { ClaimFindingLabel, EvidenceConfidenceLevel, ScoreUnavailableReason } from './policy';

export type ProductMatchLevel = 'exact' | 'possible' | 'unknown';

export type ProductMatchNotice = {
  level: ProductMatchLevel;
  message: string;
  canScoreClaims: boolean;
};

export type KeyFinding = {
  id: string;
  text: string;
  markerPhrase?: string;
  sourceIds: number[];
};

export type ClaimEvidenceRow = {
  id: string;
  summary: string;
  markerPhrase?: string;
  classification: 'support' | 'partial' | 'contradict' | 'unclear';
  sourceType: 'owner_report' | 'brand_claim' | 'independent_test' | 'ai_summary';
  sourceId: number | null;
  origin: string;
  useDuration?: string;
  eligible: boolean;
  exclusionReason?: string;
};

export type ClaimOrigin = 'owner' | 'brand';

export type ClaimComparison = {
  id: string;
  topic: string;
  /** Owner themes from reviews/comments; brand when official copy exists and owners discuss it. */
  claimOrigin: ClaimOrigin;
  findingLabel: string;
  brandStatement: string;
  brandSourceId: number | null;
  conditions: string;
  criterion: string;
  partialCriterion: string;
  claimType: 'general' | 'health_efficacy';
  score: number | null;
  unavailableReason: ScoreUnavailableReason | null;
  agreementLabel: ClaimFindingLabel;
  confidence: EvidenceConfidenceLevel;
  confidenceReasons: string[];
  eligibleOwnerCount: number;
  buyingImplication: string;
  evidence: ClaimEvidenceRow[];
  scoreExplanation: ReturnType<typeof import('./scoring').buildScoreExplanation>;
  independentTestNote?: string;
  defaultExpanded?: boolean;
};

export type OwnerDiscovery = {
  id: string;
  topic: string;
  observationType: 'benefit' | 'concern' | 'usage';
  summary: string;
  markerPhrase?: string;
  sourceCount: number;
  mentionLabel?: string;
  context?: string;
  confidence: EvidenceConfidenceLevel;
  confidenceReasons: string[];
  manufacturerRelation: string;
  buyingImplication: string;
  sourceIds: number[];
  modelMatch: 'exact' | 'similar';
};

export type ProductFindings = {
  policyVersion: string;
  match: ProductMatchNotice;
  keyFindings: KeyFinding[];
  claims: ClaimComparison[];
  discoveries: OwnerDiscovery[];
  disclaimer: string;
};
