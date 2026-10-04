/** Claim agreement policy — versioned server-side rules (not a scientific rating). */
export const CLAIM_POLICY_VERSION = '1.0.0';

export const CLAIM_SCORE_DISCLAIMER =
  'Collected reports are not a representative survey of all owners.';

export const SCORE_UNAVAILABLE_REASONS = {
  identity_not_exact: 'Exact model not confirmed',
  no_criterion: 'Claim not testable yet',
  insufficient_owners: 'Not enough eligible owner reports',
  insufficient_origins: 'Reports need more independent sources',
  zero_denominator: 'No eligible reports addressed this claim',
  similar_product_only: 'Evidence is for similar products, not this exact model',
  health_or_efficacy: 'Owner agreement cannot score health or efficacy claims',
} as const;

export type ScoreUnavailableReason = keyof typeof SCORE_UNAVAILABLE_REASONS;

export type EvidenceConfidenceLevel = 'unavailable' | 'limited' | 'moderate' | 'strong';

export type ClaimFindingLabel =
  | 'Supported by collected reports'
  | 'Mixed'
  | 'Contradicted by collected reports'
  | 'Insufficient evidence'
  | 'Claim not testable'
  | 'Conflicting evidence';
