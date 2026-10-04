import { CLAIM_POLICY_VERSION, CLAIM_SCORE_DISCLAIMER } from './policy';
import {
  buildScoreExplanation,
  evidenceConfidence,
  findingLabelFromScore,
  scoringGates,
  type ClaimCounts,
} from './scoring';
import type { ClaimComparison, KeyFinding, OwnerDiscovery, ProductFindings, ProductMatchLevel } from './types';

type Voice = { ref: string; mark: string; stance: string; topic: string; author?: string };
type Source = { n: number; domain: string; kind: string };
type BrandClaimRaw = {
  topic?: string;
  exact_text?: string;
  conditions?: string;
  criterion?: string;
  partial_criterion?: string;
  brand_source?: number;
  claim_type?: string;
};
type DiscoveryRaw = {
  topic?: string;
  observation_type?: string;
  summary?: string;
  refs?: string[];
  context?: string;
  buying_implication?: string;
};

function stanceToClass(stance: string, hasPartial: boolean): 'support' | 'partial' | 'contradict' | 'unclear' {
  const s = stance.toLowerCase();
  if (s === 'love') return 'support';
  if (s === 'warn') return 'contradict';
  if (s === 'mixed') return hasPartial ? 'partial' : 'unclear';
  return 'unclear';
}

function originFromRef(ref: string, sources: Source[]): string {
  const m = ref.match(/^S(\d+)$/);
  if (m) {
    const src = sources.find((s) => s.n === Number(m[1]));
    return src?.domain || 'unknown';
  }
  if (ref.startsWith('C')) return 'owner_comment';
  return 'unknown';
}

function countOrigins(units: { origin: string }[]): number {
  const set = new Set(units.map((u) => u.origin).filter((o) => o && o !== 'unknown'));
  return set.size;
}

export function buildProductFindings(input: {
  identityConfidence: number;
  identity: { model: string; variant: string; name: string };
  brandClaims: BrandClaimRaw[];
  discoveriesRaw: DiscoveryRaw[];
  voices: Voice[];
  reveals: Array<{ text: string; mark: string }>;
  praise: Array<{ text: string; source: number | null }>;
  complaints: Array<{ text: string; source: number | null }>;
  sources: Source[];
  matchOverride?: ProductMatchLevel;
}): ProductFindings {
  const level: ProductMatchLevel =
    input.matchOverride ??
    (input.identityConfidence >= 0.75 && (input.identity.model || input.identity.variant)
      ? 'exact'
      : input.identityConfidence >= 0.45
        ? 'possible'
        : 'unknown');

  const match = {
    level,
    message:
      level === 'exact'
        ? 'Matched to this model and variant from available sources.'
        : level === 'possible'
          ? 'Possible match — confirm the label or model before relying on exact scores.'
          : 'Model not confirmed — add a label photo or search by exact name.',
    canScoreClaims: level === 'exact',
  };

  const claims: ClaimComparison[] = [];
  const claimRows = input.brandClaims.length
    ? input.brandClaims
    : synthesizeClaimsFromBullets(input.praise, input.complaints);

  claimRows.slice(0, 5).forEach((raw, idx) => {
    const topic = String(raw.topic || `Topic ${idx + 1}`).slice(0, 80);
    const criterion = String(raw.criterion || '').trim();
    const partialCriterion = String(raw.partial_criterion || '').trim();
    const claimType = /health|medical|cure|safe for all|dermatologist/i.test(`${raw.exact_text} ${topic}`)
      ? 'health_efficacy'
      : 'general';

    const related = input.voices.filter((v) => overlap(v.topic, topic) > 0.2 || overlap(v.mark, topic) > 0.15);
    const pool = related.length ? related : input.voices.slice(0, 8);

    const evidenceRows = pool.map((v, i) => {
      const classification = stanceToClass(v.stance, Boolean(partialCriterion));
      const origin = originFromRef(v.ref, input.sources);
      const eligible = classification !== 'unclear';
      return {
        id: `ev_${idx}_${i}`,
        summary: v.mark || v.topic,
        classification,
        sourceType: 'owner_report' as const,
        sourceId: null,
        origin,
        eligible,
        exclusionReason: eligible ? undefined : 'Missing context for partial classification',
      };
    });

    const counts: ClaimCounts = {
      support: evidenceRows.filter((e) => e.classification === 'support' && e.eligible).length,
      partial: evidenceRows.filter((e) => e.classification === 'partial' && e.eligible).length,
      contradict: evidenceRows.filter((e) => e.classification === 'contradict' && e.eligible).length,
      excluded: evidenceRows.filter((e) => !e.eligible).length,
    };

    const distinctUnits = new Set(pool.map((v) => v.ref)).size;
    const origins = countOrigins(evidenceRows.filter((e) => e.eligible));

    const gate = scoringGates({
      identityExact: match.canScoreClaims,
      hasCriterion: Boolean(criterion),
      claimType,
      counts,
      distinctOwnerUnits: distinctUnits,
      independentOrigins: origins,
      hasMaterialTestConflict: false,
      hasIndependentTestCorroboration: false,
      contextCompleteRatio: 0.85,
    });

    const rawScore = gate.score;
    const conf = evidenceConfidence({
      eligibleOwners: counts.support + counts.partial + counts.contradict,
      origins,
      contextCompleteRatio: 0.85,
      hasIndependentTest: false,
      hasTestConflict: false,
      hasAnyEligible: counts.support + counts.partial + counts.contradict > 0,
    });

    claims.push({
      id: `claim_${idx}`,
      topic,
      findingLabel: topic,
      brandStatement: String(raw.exact_text || 'No relevant statement found in reviewed brand material.'),
      brandSourceId: typeof raw.brand_source === 'number' ? raw.brand_source : null,
      conditions: String(raw.conditions || ''),
      criterion,
      partialCriterion,
      claimType,
      score: rawScore,
      unavailableReason: gate.unavailableReason,
      agreementLabel: findingLabelFromScore(rawScore, false),
      confidence: conf.level,
      confidenceReasons: conf.reasons,
      eligibleOwnerCount: counts.support + counts.partial + counts.contradict,
      buyingImplication: buyingImplication(rawScore, topic),
      evidence: evidenceRows,
      scoreExplanation: buildScoreExplanation(counts),
      defaultExpanded: idx === 0,
    });
  });

  const discoveries: OwnerDiscovery[] = (input.discoveriesRaw.length ? input.discoveriesRaw : synthesizeDiscoveries(input.reveals))
    .slice(0, 8)
    .map((d, i) => ({
      id: `disc_${i}`,
      topic: String(d.topic || 'Owner observation').slice(0, 80),
      observationType: (['benefit', 'concern', 'usage'].includes(String(d.observation_type))
        ? d.observation_type
        : 'usage') as OwnerDiscovery['observationType'],
      summary: String(d.summary || '').slice(0, 400),
      markerPhrase: String(d.summary || '').split(/\s+/).slice(0, 4).join(' '),
      sourceCount: Array.isArray(d.refs) ? d.refs.length : 1,
      mentionLabel: `Mentioned in ${Array.isArray(d.refs) ? d.refs.length : 1} distinct owner reports`,
      context: String(d.context || ''),
      confidence: 'limited' as const,
      confidenceReasons: ['Owner-reported context; not a systematic survey'],
      manufacturerRelation: 'No relevant statement found in reviewed brand material.',
      buyingImplication: String(d.buying_implication || 'Weigh this against your own use case.'),
      sourceIds: [],
      modelMatch: match.canScoreClaims ? 'exact' : 'similar',
    }));

  const keyFindings: KeyFinding[] = [];
  if (input.reveals[0]) {
    keyFindings.push({
      id: 'kf_0',
      text: input.reveals[0].text,
      markerPhrase: input.reveals[0].mark,
      sourceIds: [],
    });
  }
  for (const c of claims.slice(0, 3)) {
    if (c.score !== null) {
      keyFindings.push({
        id: `kf_${c.id}`,
        text: `${c.topic}: ${c.agreementLabel.toLowerCase()} in collected reports (${c.score}/10).`,
        sourceIds: c.brandSourceId ? [c.brandSourceId] : [],
      });
    }
  }
  if (discoveries[0] && keyFindings.length < 5) {
    keyFindings.push({
      id: 'kf_disc',
      text: discoveries[0].summary,
      markerPhrase: discoveries[0].markerPhrase,
      sourceIds: discoveries[0].sourceIds,
    });
  }

  return {
    policyVersion: CLAIM_POLICY_VERSION,
    match,
    keyFindings: keyFindings.slice(0, 5),
    claims,
    discoveries,
    disclaimer: CLAIM_SCORE_DISCLAIMER,
  };
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  ta.forEach((w) => {
    if (tb.has(w)) hit += 1;
  });
  return hit / Math.max(ta.size, tb.size);
}

function synthesizeClaimsFromBullets(
  praise: Array<{ text: string; source: number | null }>,
  complaints: Array<{ text: string; source: number | null }>,
): BrandClaimRaw[] {
  const rows: BrandClaimRaw[] = [];
  if (praise[0]) {
    rows.push({
      topic: 'Performance',
      exact_text: 'Manufacturer information unavailable',
      criterion: 'Owners report the product performs as expected for typical use.',
      partial_criterion: 'Some owners report mixed performance in specific conditions.',
      brand_source: praise[0].source ?? undefined,
    });
  }
  if (complaints[0]) {
    rows.push({
      topic: 'Durability',
      exact_text: 'Manufacturer information unavailable',
      criterion: 'Owners report acceptable durability over months of regular use.',
      partial_criterion: 'Some owners report early wear under heavy use.',
      brand_source: complaints[0].source ?? undefined,
    });
  }
  return rows;
}

function synthesizeDiscoveries(reveals: Array<{ text: string; mark: string }>): DiscoveryRaw[] {
  return reveals.map((r) => ({
    topic: 'What owners also noticed',
    observation_type: 'usage',
    summary: r.text,
    buying_implication: 'Factor this into your decision alongside official specs.',
  }));
}

function buyingImplication(score: number | null, topic: string): string {
  if (score === null) return `Check more owner reports on ${topic.toLowerCase()} before you decide.`;
  if (score >= 8) return `Collected reports mostly align with the brand promise on ${topic.toLowerCase()}.`;
  if (score >= 3) return `Expect mixed owner experiences on ${topic.toLowerCase()}; read the reports below.`;
  return `Many collected reports disagree with the promise on ${topic.toLowerCase()}.`;
}
