import type { ClaimComparison } from '@/lib/claims/types';
import type { ProductProfile } from '@/lib/types';

import { deriveUnmaskBundle } from './derive';
import type { AskResult, AskSuggestion } from './types';

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreClaim(question: string, claim: ClaimComparison): number {
  const tokens = tokenize(question);
  const hay = `${claim.topic} ${claim.brandStatement} ${claim.criterion} ${claim.buyingImplication}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 2;
  }
  if (tokens.some((t) => claim.topic.toLowerCase().includes(t))) score += 3;
  return score;
}

function bucketsFromClaim(claim: ClaimComparison) {
  const eligible = claim.evidence.filter((e) => e.eligible);
  const support = eligible.filter((e) => e.classification === 'support').length;
  const partial = eligible.filter((e) => e.classification === 'partial').length;
  const against = eligible.filter((e) => e.classification === 'contradict').length;
  const total = Math.max(support + partial + against, 1);
  const mixed = partial + Math.min(support, against);
  const pos = Math.max(support - Math.floor(partial / 2), 0);
  const neg = Math.max(against - Math.floor(partial / 2), 0);
  const norm = pos + neg + mixed || total;
  return [
    { label: 'Aligns with positive reports', pct: Math.round((pos / norm) * 100), count: pos, tone: 'positive' as const },
    { label: 'Mixed or depends', pct: Math.round((mixed / norm) * 100), count: mixed, tone: 'mixed' as const },
    { label: 'Critical reports', pct: Math.round((neg / norm) * 100), count: neg, tone: 'negative' as const },
  ].filter((b) => b.pct > 0);
}

export function investigateQuestion(profile: ProductProfile, question: string): AskResult {
  const q = question.trim();
  const bundle = deriveUnmaskBundle(profile);
  const claims = profile.findings?.claims ?? [];
  if (!q || !claims.length) {
    return {
      kind: 'insufficient',
      hint: 'We need more owner evidence on this product before we can answer confidently.',
      suggestions: bundle.suggestions,
    };
  }

  const ranked = [...claims]
    .map((c) => ({ c, score: scoreClaim(q, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 3 || best.c.eligibleOwnerCount < 3) {
    return {
      kind: 'insufficient',
      hint: 'We found a few related comments, but not enough consistent evidence for a clear answer yet.',
      suggestions: pickSuggestions(bundle.suggestions, q),
    };
  }

  const claim = best.c;
  const eligible = claim.evidence.filter((e) => e.eligible);
  const shortAnswer =
    claim.buyingImplication ||
    claim.findingLabel ||
    (claim.score !== null && claim.score >= 8
      ? 'Most collected owner reports lean positive on this.'
      : claim.score !== null && claim.score < 3
        ? 'Many owner reports push back on this.'
        : 'Owners disagree — context matters.');

  const findings = [
    claim.criterion ? `What we looked for: ${claim.criterion}` : '',
    claim.agreementLabel,
    claim.confidenceReasons[0] ?? '',
    claim.independentTestNote ?? '',
  ].filter(Boolean);

  return {
    kind: 'answer',
    answer: {
      question: q,
      shortAnswer,
      buckets: bucketsFromClaim(claim),
      findings,
      evidence: eligible.slice(0, 4).map((e) => ({ summary: e.summary, origin: e.origin || 'Owner report' })),
      claimId: claim.id,
    },
  };
}

function pickSuggestions(all: AskSuggestion[], question: string): AskSuggestion[] {
  const tokens = tokenize(question);
  const scored = all
    .map((s) => ({
      s,
      score: s.keywords.filter((k) => tokens.some((t) => k.includes(t) || t.includes(k))).length,
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.s);
}
