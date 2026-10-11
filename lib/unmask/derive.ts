import type { ClaimComparison } from '@/lib/claims/types';
import type { ProductProfile } from '@/lib/types';

import { dynamicProductUiEnabled } from '@/lib/product-result/flags';
import { getUIContract, type ScoreDisplay } from '@/lib/product-result/contract';

import { getPresentation } from './presentation';
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

function overallFromLegacyProfile(profile: ProductProfile, dimensions: UnmaskDimension[]): number | null {
  if (profile.score !== null && profile.score !== undefined) return Math.round(profile.score);
  const scored = dimensions.map((d) => d.score).filter((s): s is number => s !== null);
  if (!scored.length) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

function resolveDynamicOverall(profile: ProductProfile): { score: number | null; display: ScoreDisplay } {
  const contract = getUIContract(profile);
  const pres = getPresentation(profile);
  let display: ScoreDisplay =
    contract?.overview.overall?.score_display ??
    pres?.overview?.scoreDisplay ??
    'unavailable';
  if (display === 'numeric') {
    const raw = contract?.overview.overall?.score ?? pres?.overview?.score ?? null;
    if (raw == null) return { score: null, display: 'limited' };
    return { score: Math.round(raw), display: 'numeric' };
  }
  if (
    display === 'unavailable' &&
    (contract?.overview.dimensions.some((d) => d.score_display === 'limited') ||
      pres?.overview?.dimensions?.some((d) => d.limitedEvidence))
  ) {
    display = 'limited';
  }
  return { score: null, display };
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

function buildClustersFromDimensionExperience(profile: ProductProfile): EvidenceCluster[] {
  const byKey = profile.dimensionExperience?.byKey;
  if (!byKey) return [];
  return Object.values(byKey)
    .filter((b) => b.items.length > 0)
    .slice(0, 8)
    .map((b) => ({
      id: `cluster-${b.dimensionKey}`,
      title: b.label,
      summary: b.finding,
      ownerCount: b.evidenceCount,
      tone: toneFromScore(b.score),
      quotes: b.items.slice(0, 2).map((e) => ({ text: e.statement, origin: e.platform })),
      claimId: '',
    }));
}

function buildClusters(claims: ClaimComparison[], dimensions: UnmaskDimension[]): EvidenceCluster[] {
  const keyed = claims
    .filter((c) => c.evidence.some((e) => e.eligible))
    .map((c) => {
      const hay = `${c.topic} ${c.criterion}`.toLowerCase();
      const dim = dimensions.find(
        (d) => hay.includes(d.id.replace(/_/g, ' ')) || hay.includes(d.label.toLowerCase()),
      );
      return { c, dim };
    });
  return keyed
    .slice(0, 8)
    .map(({ c, dim }) => {
      const eligible = c.evidence.filter((e) => e.eligible);
      const support = eligible.filter((e) => e.classification === 'support');
      const against = eligible.filter((e) => e.classification === 'contradict');
      const tone: DimensionTone =
        c.score !== null && c.score >= 8 ? 'positive' : c.score !== null && c.score < 3 ? 'negative' : 'mixed';
      const quotes = [...support, ...against, ...eligible]
        .slice(0, 2)
        .map((e) => ({ text: e.summary, origin: e.origin || 'Owner report' }));
      return {
        id: `cluster-${dim?.id ?? c.id}`,
        title: dim?.label ?? c.topic,
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

function dimensionsFromPresentation(profile: ProductProfile): UnmaskDimension[] | null {
  const pres = getPresentation(profile);
  if (!pres?.overview?.dimensions?.length) return null;
  return pres.overview.dimensions.map((d) => ({
    id: d.key,
    label: d.label,
    subtitle: d.limitedEvidence ? 'Limited evidence' : `${Math.round(d.confidence * 100)}% confidence`,
    score: d.score,
    tone: toneFromScore(d.score),
    takeaway: d.finding ?? (d.limitedEvidence ? 'Not enough owner reports yet for a clear read.' : 'Based on owner-backed evidence.'),
  }));
}

function dimensionsFromUIContract(profile: ProductProfile): UnmaskDimension[] | null {
  const contract = getUIContract(profile);
  if (!contract?.overview.dimensions.length) return null;
  return [...contract.overview.dimensions]
    .sort((a, b) => a.display_order - b.display_order)
    .map((d) => ({
      id: d.key,
      label: d.label,
      subtitle: d.description ?? (d.confidence_label ? `${d.confidence_label} confidence` : ''),
      score: d.score ?? null,
      tone: toneFromScore(d.score ?? null),
      takeaway: d.finding ?? 'Not enough owner reports yet for a clear read.',
    }));
}

export function deriveUnmaskBundle(profile: ProductProfile): UnmaskBundle {
  const claims = profile.findings?.claims ?? [];
  const dynamic = dynamicProductUiEnabled();
  const fromContract = dynamic ? dimensionsFromUIContract(profile) : null;
  const fromBlueprint = fromContract ?? dimensionsFromPresentation(profile);
  const dimensions =
    fromBlueprint ??
    (dynamic
      ? []
      : DIMENSION_SEEDS.map((seed) => dimensionFromClaim(seed, matchClaim(claims, seed.keywords))));
  const experienceCount =
    profile.people?.ratings ?? profile.ratingCount ?? profile.voices?.length ?? claims.reduce((n, c) => n + c.eligibleOwnerCount, 0);
  const discussionCount = profile.people?.discussions ?? claims.length;
  const videoCount = profile.people?.commenters ?? 0;

  const contract = getUIContract(profile);
  const pres = getPresentation(profile);
  const dynamicOverall = dynamic ? resolveDynamicOverall(profile) : null;
  const overallScore = dynamic
    ? dynamicOverall!.score
    : contract?.overview.overall?.score ?? pres?.overview?.score ?? overallFromLegacyProfile(profile, dimensions);
  const overallScoreDisplay = dynamic ? dynamicOverall!.display : overallScore != null ? 'numeric' : 'unavailable';
  const verdictLine =
    contract?.overview.overall?.verdict ||
    pres?.overview?.verdict ||
    profile.consensus?.replace(/<[^>]+>/g, '') ||
    profile.verdict ||
    profile.summary ||
    'We’re still organising what owners report about this product.';

  return {
    overallScore,
    overallScoreDisplay,
    verdictLine,
    experienceCount: experienceCount || 0,
    videoCount,
    discussionCount,
    dimensions,
    highlights: buildHighlights(dimensions, claims),
    clusters: dynamic && profile.dimensionExperience
      ? buildClustersFromDimensionExperience(profile)
      : dynamic && dimensions.length
        ? []
        : buildClusters(claims, dimensions),
    disagreements: buildDisagreements(claims),
    uncovered: profile.findings?.discoveries ?? [],
    suggestions: dynamic && dimensions.length
      ? dimensions.slice(0, 6).map((d) => ({
          id: `dim-${d.id}`,
          question: `How is ${d.label.toLowerCase()}?`,
          keywords: [d.id, ...d.label.toLowerCase().split(/\s+/)],
        }))
      : DEFAULT_SUGGESTIONS,
  };
}

export function dimensionById(bundle: UnmaskBundle, id: string): UnmaskDimension | undefined {
  return bundle.dimensions.find((d) => d.id === id);
}

export function claimForDimension(profile: ProductProfile, dim: UnmaskDimension): ClaimComparison | undefined {
  if (!dim.claimId) return undefined;
  return profile.findings?.claims.find((c) => c.id === dim.claimId);
}
