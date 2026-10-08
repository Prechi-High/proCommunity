import type { ClaimComparison } from '@/lib/claims/types';
import type { ProductProfile } from '@/lib/types';

import type {
  DisagreementCard,
  EvidenceCluster,
  UnmaskBundle,
  UnmaskDimension,
  UnmaskHighlight,
  DimensionTone,
  AskSuggestion,
} from './types';

const DIMENSION_SEEDS: { id: string; label: string; subtitle: string; keywords: string[] }[] = [
  { id: 'camera', label: 'Camera', subtitle: 'Photo and video quality', keywords: ['camera', 'photo', 'video', 'lens', 'night', 'selfie'] },
  { id: 'performance', label: 'Performance', subtitle: 'Speed and responsiveness', keywords: ['performance', 'speed', 'chip', 'processor', 'lag', 'smooth'] },
  { id: 'display', label: 'Display', subtitle: 'Screen quality and brightness', keywords: ['display', 'screen', 'brightness', 'oled', 'refresh'] },
  { id: 'battery', label: 'Battery life', subtitle: 'Day-to-day endurance', keywords: ['battery', 'charge', 'charging', 'endurance', 'drain'] },
  { id: 'durability', label: 'Durability', subtitle: 'Build and long-term wear', keywords: ['durability', 'build', 'scratch', 'drop', 'case', 'glass'] },
  { id: 'heat', label: 'Heat management', subtitle: 'Warmth under load', keywords: ['heat', 'warm', 'thermal', 'gaming', 'throttle'] },
];

function toneFromScore(score: number | null): DimensionTone {
  if (score === null) return 'mixed';
  if (score >= 75) return 'positive';
  if (score >= 55) return 'mixed';
  return 'negative';
}

function claimScore100(claim: ClaimComparison): number | null {
  if (claim.score === null) return null;
  return Math.round(claim.score * 10);
}

function matchClaim(claims: ClaimComparison[], keywords: string[]): ClaimComparison | null {
  const scored = claims.filter((c) => c.score !== null);
  let best: ClaimComparison | null = null;
  let bestScore = 0;
  for (const c of scored) {
    const hay = `${c.topic} ${c.brandStatement} ${c.criterion}`.toLowerCase();
    const hits = keywords.filter((k) => hay.includes(k)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c;
    }
  }
  if (best) return best;
  return scored[0] ?? null;
}

function dimensionFromClaim(seed: typeof DIMENSION_SEEDS[0], claim: ClaimComparison | null): UnmaskDimension {
  const score = claim ? claimScore100(claim) : null;
  const takeaway =
    claim?.buyingImplication ||
    claim?.findingLabel ||
    (claim?.evidence[0]?.summary ?? 'Not enough owner reports yet for a clear read.');
  return {
    id: seed.id,
    label: seed.label,
    subtitle: seed.subtitle,
    score,
    tone: toneFromScore(score),
    takeaway,
    claimId: claim?.id,
  };
}

function overallFromProfile(profile: ProductProfile, dimensions: UnmaskDimension[]): number | null {
  if (profile.score !== null && profile.score !== undefined) return Math.round(profile.score);
  const scored = dimensions.map((d) => d.score).filter((s): s is number => s !== null);
  if (!scored.length) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

function buildHighlights(dimensions: UnmaskDimension[], claims: ClaimComparison[]): UnmaskHighlight[] {
  const scored = dimensions.filter((d) => d.score !== null) as (UnmaskDimension & { score: number })[];
  if (!scored.length) return [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const strength = sorted[0];
  const weakness = sorted[sorted.length - 1];
  const divisiveClaim = claims
    .filter((c) => c.score !== null && c.score >= 3 && c.score < 8)
    .sort((a, b) => (b.eligibleOwnerCount ?? 0) - (a.eligibleOwnerCount ?? 0))[0];
  const divisiveDim =
    divisiveClaim
      ? dimensions.find((d) => d.claimId === divisiveClaim.id) ??
        dimensions.find((d) => d.score !== null && d.score >= 55 && d.score < 75)
      : dimensions.find((d) => d.score !== null && d.score >= 55 && d.score < 75);

  const mk = (
    kind: UnmaskHighlight['kind'],
    dim: UnmaskDimension,
    label: string,
  ): UnmaskHighlight => ({
    id: `${kind}-${dim.id}`,
    kind,
    label,
    title: dim.label,
    score: dim.score,
    body: dim.takeaway,
    mentionCount: claims.find((c) => c.id === dim.claimId)?.eligibleOwnerCount ?? 0,
    dimensionId: dim.id,
  });

  const out: UnmaskHighlight[] = [];
  if (strength && strength.id !== weakness?.id) out.push(mk('strength', strength, 'Biggest strength'));
  if (weakness) out.push(mk('weakness', weakness, 'Biggest weakness'));
  if (divisiveDim && divisiveDim.id !== strength?.id && divisiveDim.id !== weakness?.id) {
    out.push(mk('divisive', divisiveDim, 'Most divisive'));
  }
  return out;
}

function buildClusters(claims: ClaimComparison[]): EvidenceCluster[] {
  return claims
    .filter((c) => c.evidence.some((e) => e.eligible))
    .slice(0, 6)
    .map((c) => {
      const eligible = c.evidence.filter((e) => e.eligible);
      const support = eligible.filter((e) => e.classification === 'support');
      const against = eligible.filter((e) => e.classification === 'contradict');
      const tone: DimensionTone =
        c.score !== null && c.score >= 8 ? 'positive' : c.score !== null && c.score < 3 ? 'negative' : 'mixed';
      const quotes = [...support, ...against, ...eligible]
        .slice(0, 2)
        .map((e) => ({ text: e.summary, origin: e.origin || 'Owner report' }));
      return {
        id: `cluster-${c.id}`,
        title: c.topic,
        summary: c.buyingImplication || c.findingLabel,
        ownerCount: c.eligibleOwnerCount || eligible.length,
        tone,
        quotes,
        claimId: c.id,
      };
    });
}

function buildDisagreements(claims: ClaimComparison[]): DisagreementCard[] {
  return claims
    .filter((c) => c.score !== null && c.score >= 3 && c.score < 8)
    .slice(0, 4)
    .map((c) => {
      const eligible = c.evidence.filter((e) => e.eligible);
      const support = eligible.filter((e) => e.classification === 'support');
      const against = eligible.filter((e) => e.classification === 'contradict');
      const partial = eligible.filter((e) => e.classification === 'partial');
      const posN = support.length + Math.floor(partial.length / 2);
      const negN = against.length + Math.ceil(partial.length / 2);
      const total = Math.max(posN + negN, 1);
      const posPct = Math.round((posN / total) * 100);
      return {
        id: `disagree-${c.id}`,
        title: c.topic,
        positive: {
          label: posPct >= 50 ? 'Leans positive' : 'Some agree',
          pct: posPct,
          count: posN,
          quote: support[0]?.summary || partial[0]?.summary || 'Owners mention mixed results.',
        },
        negative: {
          label: posPct < 50 ? 'Leans critical' : 'Some disagree',
          pct: 100 - posPct,
          count: negN,
          quote: against[0]?.summary || partial[1]?.summary || 'Others report different experiences.',
        },
        claimId: c.id,
      };
    });
}

const DEFAULT_SUGGESTIONS: AskSuggestion[] = [
  { id: 'battery-day', question: 'Does it last all day?', keywords: ['battery', 'day', 'charge', 'drain'] },
  { id: 'camera-night', question: 'Is the camera good in low light?', keywords: ['camera', 'night', 'low light', 'photo'] },
  { id: 'heat-game', question: 'Does it overheat when gaming?', keywords: ['heat', 'warm', 'gaming', 'thermal'] },
  { id: 'worth-price', question: 'Is it worth the price?', keywords: ['price', 'value', 'worth', 'expensive'] },
  { id: 'compare-prev', question: 'How does it compare to the previous model?', keywords: ['compare', 'previous', 'older', 'upgrade'] },
  { id: 'creators', question: 'Is it good for content creators?', keywords: ['video', 'creator', 'vlog', 'content'] },
];

export function deriveUnmaskBundle(profile: ProductProfile): UnmaskBundle {
  const claims = profile.findings?.claims ?? [];
  const dimensions = DIMENSION_SEEDS.map((seed) => dimensionFromClaim(seed, matchClaim(claims, seed.keywords)));
  const experienceCount =
    profile.people?.ratings ?? profile.ratingCount ?? profile.voices?.length ?? claims.reduce((n, c) => n + c.eligibleOwnerCount, 0);
  const discussionCount = profile.people?.discussions ?? claims.length;
  const videoCount = profile.people?.commenters ?? 0;

  const overallScore = overallFromProfile(profile, dimensions);
  const verdictLine =
    profile.consensus?.replace(/<[^>]+>/g, '') ||
    profile.verdict ||
    profile.summary ||
    'We’re still organising what owners report about this product.';

  return {
    overallScore,
    verdictLine,
    experienceCount: experienceCount || 0,
    videoCount,
    discussionCount,
    dimensions,
    highlights: buildHighlights(dimensions, claims),
    clusters: buildClusters(claims),
    disagreements: buildDisagreements(claims),
    uncovered: profile.findings?.discoveries ?? [],
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export function dimensionById(bundle: UnmaskBundle, id: string): UnmaskDimension | undefined {
  return bundle.dimensions.find((d) => d.id === id);
}

export function claimForDimension(profile: ProductProfile, dim: UnmaskDimension): ClaimComparison | undefined {
  if (!dim.claimId) return undefined;
  return profile.findings?.claims.find((c) => c.id === dim.claimId);
}
