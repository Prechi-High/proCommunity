/**
 * Verification Service
 * Verifies extracted intelligence and calculates confidence scores
 */

interface VerificationResult {
  isValid: boolean;
  confidence: number;
  contradictions: VerificationContradiction[];
  supportingSources: string[];
}

interface VerificationContradiction {
  field: string;
  originalValue: unknown;
  conflictingValue: unknown;
  sources: string[];
}

interface Claim {
  field: string;
  value: unknown;
  evidenceIds: string[];
  sourceUrls: string[];
}

export class VerificationService {
  /**
   * Verify a single claim against evidence
   */
  async verifyClaim(claim: Claim, evidence: Record<string, string>): Promise<VerificationResult> {
    const contradictions: VerificationContradiction[] = [];
    const supportingSources: string[] = [];

    // Check each piece of evidence
    for (const evidenceId of claim.evidenceIds) {
      const content = evidence[evidenceId] || '';
      const sourceUrl = claim.sourceUrls.find((url) => content.includes(url.substring(0, 50))) || '';

      if (content && sourceUrl) {
        supportingSources.push(sourceUrl);

        // Check for contradictions
        if (this.findContradiction(claim, content)) {
          contradictions.push({
            field: claim.field,
            originalValue: claim.value,
            conflictingValue: 'conflicting evidence',
            sources: [sourceUrl],
          });
        }
      }
    }

    // Calculate confidence
    const baseConfidence = this.calculateBaseConfidence(claim);
    const sourceReliability = this.calculateSourceReliability(supportingSources);
    const consistencyBonus = contradictions.length === 0 ? 0.1 : -0.2;

    const finalConfidence = Math.max(0, Math.min(1, baseConfidence + sourceReliability + consistencyBonus));

    return {
      isValid: contradictions.length === 0 && finalConfidence > 0.5,
      confidence: finalConfidence,
      contradictions,
      supportingSources,
    };
  }

  private findContradiction(claim: Claim, evidenceContent: string): boolean {
    // Simple contradiction detection
    const contentLower = evidenceContent.toLowerCase();
    const valueLower = String(claim.value).toLowerCase();

    // If claim says something is true but evidence says it's false
    if (valueLower.includes('yes') && contentLower.includes('no')) return true;
    if (valueLower.includes('true') && contentLower.includes('false')) return true;
    if (contentLower.includes('not') && contentLower.includes(valueLower)) return true;

    return false;
  }

  private calculateBaseConfidence(claim: Claim): number {
    let confidence = 0.5;

    // More evidence = higher confidence
    if (claim.evidenceIds.length >= 3) confidence += 0.2;
    else if (claim.evidenceIds.length >= 1) confidence += 0.1;

    // Direct evidence is better than indirect
    if (claim.sourceUrls.some((url) => url.includes('official') || url.includes('manufacturer'))) {
      confidence += 0.2;
    }

    return Math.min(0.8, confidence);
  }

  private calculateSourceReliability(sources: string[]): number {
    if (sources.length === 0) return 0;

    let totalReliability = 0;

    for (const source of sources) {
      if (source.includes('official') || source.includes('manufacturer')) {
        totalReliability += 0.9;
      } else if (source.includes('retailer') || source.includes('amazon') || source.includes('jumia')) {
        totalReliability += 0.7;
      } else if (source.includes('review') || source.includes('blog')) {
        totalReliability += 0.5;
      } else if (source.includes('forum') || source.includes('reddit')) {
        totalReliability += 0.4;
      } else {
        totalReliability += 0.3;
      }
    }

    return totalReliability / sources.length;
  }

  /**
   * Verify multiple claims and detect conflicts
   */
  async verifyClaims(claims: Claim[]): Promise<VerificationResult[]> {
    return Promise.all(claims.map((claim) => this.verifyClaim(claim, {})));
  }

  /**
   * Merge conflicting claims and resolve
   */
  resolveConflicts(claims: Claim[]): Claim[] {
    const resolved: Claim[] = [];
    const fieldMap = new Map<string, Claim>();

    for (const claim of claims) {
      const existing = fieldMap.get(claim.field);
      if (existing) {
        // Keep the one with higher confidence
        if (this.calculateClaimConfidence(claim) > this.calculateClaimConfidence(existing)) {
          fieldMap.set(claim.field, claim);
        }
      } else {
        fieldMap.set(claim.field, claim);
      }
    }

    return Array.from(fieldMap.values());
  }

  private calculateClaimConfidence(claim: Claim): number {
    return claim.evidenceIds.length + (claim.sourceUrls.some((u) => u.includes('official')) ? 2 : 0);
  }

  /**
   * Get confidence breakdown for a claim
   */
  getConfidenceBreakdown(claim: Claim, result: VerificationResult): Record<string, unknown> {
    return {
      baseConfidence: this.calculateBaseConfidence(claim),
      sourceReliability: result.supportingSources.length > 0
        ? result.supportingSources.length * 0.1
        : 0,
      consistency: result.contradictions.length === 0 ? 0.1 : -0.2,
      finalConfidence: result.confidence,
      supportingSources: result.supportingSources.length,
      contradictions: result.contradictions.length,
    };
  }
}
