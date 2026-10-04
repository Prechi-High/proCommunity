import {
  CLAIM_POLICY_VERSION,
  type ClaimFindingLabel,
  type EvidenceConfidenceLevel,
  type ScoreUnavailableReason,
} from './policy.ts';

export type ClaimCounts = {
  support: number;
  partial: number;
  contradict: number;
  excluded: number;
};

export type ScoreInputs = {
  identityExact: boolean;
  hasCriterion: boolean;
  claimType: 'general' | 'health_efficacy';
  counts: ClaimCounts;
  distinctOwnerUnits: number;
  independentOrigins: number;
  hasMaterialTestConflict: boolean;
  hasIndependentTestCorroboration: boolean;
  contextCompleteRatio: number;
};

export function roundDisplayScore(raw: number): number {
  return Math.round(raw * 10) / 10;
}

export function computeRawClaimScore(counts: ClaimCounts): number | null {
  const eligible = counts.support + counts.partial + counts.contradict;
  if (eligible <= 0) return null;
  return (10 * (counts.support + 0.5 * counts.partial)) / eligible;
}

export function scoringGates(inputs: ScoreInputs): { score: number | null; unavailableReason: ScoreUnavailableReason | null } {
  if (!inputs.identityExact) return { score: null, unavailableReason: 'similar_product_only' };
  if (inputs.claimType === 'health_efficacy') return { score: null, unavailableReason: 'health_or_efficacy' };
  if (!inputs.hasCriterion) return { score: null, unavailableReason: 'no_criterion' };
  if (inputs.distinctOwnerUnits < 5) return { score: null, unavailableReason: 'insufficient_owners' };
  if (inputs.independentOrigins < 2) return { score: null, unavailableReason: 'insufficient_origins' };
  const raw = computeRawClaimScore(inputs.counts);
  if (raw === null) return { score: null, unavailableReason: 'zero_denominator' };
  return { score: roundDisplayScore(raw), unavailableReason: null };
}

export function findingLabelFromScore(raw: number | null, hasTestConflict: boolean): ClaimFindingLabel {
  if (hasTestConflict) return 'Conflicting evidence';
  if (raw === null) return 'Insufficient evidence';
  if (raw >= 8) return 'Supported by collected reports';
  if (raw >= 3) return 'Mixed';
  return 'Contradicted by collected reports';
}

export function evidenceConfidence(inputs: {
  eligibleOwners: number;
  origins: number;
  contextCompleteRatio: number;
  hasIndependentTest: boolean;
  hasTestConflict: boolean;
  hasAnyEligible: boolean;
}): { level: EvidenceConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];
  if (!inputs.hasAnyEligible) return { level: 'unavailable', reasons: ['No eligible owner evidence for this claim'] };
  let level: EvidenceConfidenceLevel = 'limited';
  if (inputs.eligibleOwners >= 30 && inputs.origins >= 3 && inputs.contextCompleteRatio >= 0.9 && inputs.hasIndependentTest) {
    level = 'strong';
  } else if (inputs.eligibleOwners >= 15 && inputs.origins >= 3 && inputs.contextCompleteRatio >= 0.8) {
    level = 'moderate';
  }
  if (inputs.hasTestConflict && level !== 'unavailable') {
    level = 'limited';
    reasons.push('Independent test conflicts with owner reports');
  }
  if (level === 'limited' && inputs.hasAnyEligible) {
    reasons.push('Evidence volume or context does not meet Moderate thresholds yet');
  }
  return { level, reasons };
}

export function buildScoreExplanation(counts: ClaimCounts, policyVersion: string = CLAIM_POLICY_VERSION) {
  const eligible = counts.support + counts.partial + counts.contradict;
  const raw = computeRawClaimScore(counts);
  return {
    policyVersion,
    formula: '10 × (support + 0.5 × partial) / eligible',
    supportCount: counts.support,
    partialCount: counts.partial,
    contradictCount: counts.contradict,
    excludedCount: counts.excluded,
    eligibleCount: eligible,
    rawScore: raw,
    computedAt: new Date().toISOString(),
  };
}
