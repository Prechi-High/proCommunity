import { markPhraseInText } from './markPhrase.ts';
import { buildOwnerThemeRows, expandVoicesForThemes, type OwnerThemeRaw } from './ownerThemes.ts';
import { CLAIM_POLICY_VERSION, CLAIM_SCORE_DISCLAIMER } from './policy.ts';
import {
  buildScoreExplanation,
  evidenceConfidence,
  findingLabelFromScore,
  scoringGates,
  type ClaimCounts,
} from './scoring.ts';

type Voice = { ref: string; mark: string; stance: string; topic: string; text?: string; author?: string };
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
  marker_phrase?: string;
  refs?: string[];
  context?: string;
  buying_implication?: string;
};

type ProductMatchLevel = 'exact' | 'possible' | 'unknown';
type ProductFindings = Record<string, unknown>;
type ClaimComparison = Record<string, unknown>;
type OwnerDiscovery = Record<string, unknown> & { observationType?: string };
type KeyFinding = Record<string, unknown>;
type ClaimOrigin = 'owner' | 'brand';

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
  if (ref.startsWith('C') || ref.startsWith('P') || ref.startsWith('X')) return 'owner_comment';
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
  ownerClaimsRaw?: OwnerThemeRaw[];
  discoveriesRaw: DiscoveryRaw[];
  voices: Voice[];
  reveals: Array<{ text: string; mark: string }>;
  praise: Array<{ text: string; source: number | null }>;
  complaints: Array<{ text: string; source: number | null }>;
  uses?: string[];
  bestFor?: string[];
  summary?: string;
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
  const voicePool = expandVoicesForThemes(input.voices, input.praise, input.complaints);
  const voiceByRef = new Map(voicePool.map((v) => [v.ref, v]));
  const themeRows = buildOwnerThemeRows(voicePool, input.ownerClaimsRaw ?? [], input.brandClaims);

  themeRows.forEach((row, idx) => {
    const topic = row.topic;
    const claimOrigin = row.origin;
    const brandStatement = row.summary;
    const criterion = defaultCriterion(topic).criterion;
    const partialCriterion = defaultCriterion(topic).partial;
    const claimType = /health|medical|cure|safe for all|dermatologist/i.test(`${brandStatement} ${topic}`)
      ? 'health_efficacy'
      : 'general';

    const related = row.voiceRefs.map((r) => voiceByRef.get(r)).filter((v): v is Voice => Boolean(v));

    const mergedEvidence = related.map((v, i) => {
      const classification = stanceToClass(v.stance, true);
      const origin = originFromRef(v.ref, input.sources);
      const eligible = classification !== 'unclear';
      const summary = (v.text || v.mark || v.topic).trim().slice(0, 360);
      return {
        id: `ev_${idx}_${i}`,
        summary,
        markerPhrase: markPhraseInText(summary, v.mark),
        classification,
        sourceType: 'owner_report' as const,
        sourceId: null,
        origin,
        eligible,
        exclusionReason: eligible ? undefined : 'Missing context for partial classification',
      };
    });

    const counts: ClaimCounts = {
      support: mergedEvidence.filter((e) => e.classification === 'support' && e.eligible).length,
      partial: mergedEvidence.filter((e) => e.classification === 'partial' && e.eligible).length,
      contradict: mergedEvidence.filter((e) => e.classification === 'contradict' && e.eligible).length,
      excluded: mergedEvidence.filter((e) => !e.eligible).length,
    };

    const distinctUnits = new Set(related.map((v) => v.ref)).size;
    const origins = countOrigins(mergedEvidence.filter((e) => e.eligible));
    const ownerTheme = claimOrigin === 'owner';

    const gate = scoringGates({
      identityExact: ownerTheme || match.canScoreClaims,
      hasCriterion: true,
      claimType,
      counts,
      distinctOwnerUnits: distinctUnits,
      independentOrigins: origins,
      hasMaterialTestConflict: false,
      hasIndependentTestCorroboration: false,
      contextCompleteRatio: 0.85,
      minDistinctOwnerUnits: ownerTheme ? 1 : undefined,
      minIndependentOrigins: ownerTheme ? 1 : undefined,
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
      claimOrigin,
      findingLabel: topic,
      brandStatement,
      brandSourceId: row.brandSource ?? null,
      conditions: String(row.conditions || ''),
      criterion,
      partialCriterion,
      claimType,
      score: rawScore,
      unavailableReason: gate.unavailableReason,
      agreementLabel: ownerTheme ? themeLabelFromScore(rawScore) : findingLabelFromScore(rawScore, false),
      confidence: conf.level,
      confidenceReasons: conf.reasons,
      eligibleOwnerCount: counts.support + counts.partial + counts.contradict,
      buyingImplication: buyingImplication(rawScore, topic, claimOrigin),
      evidence: mergedEvidence,
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
      markerPhrase: markPhraseInText(String(d.summary || ''), d.marker_phrase),
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
        text: `${c.topic}: ${String(c.agreementLabel).toLowerCase()} in collected reports (${c.score}/10).`,
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

function defaultCriterion(topic: string): { criterion: string; partial: string } {
  const t = topic.toLowerCase();
  return {
    criterion: `Owner comments and discussions about “${t}”.`,
    partial: `Mixed reports on “${t}” depending on use case.`,
  };
}

function themeLabelFromScore(raw: number | null): string {
  if (raw === null) return 'Insufficient evidence';
  if (raw >= 8) return 'Supported by collected reports';
  if (raw >= 3) return 'Mixed';
  return 'Contradicted by collected reports';
}

function synthesizeDiscoveries(reveals: Array<{ text: string; mark: string }>): DiscoveryRaw[] {
  return reveals.map((r) => ({
    topic: 'What owners also noticed',
    observation_type: /worst|broke|issue|problem|watch|avoid|fail/i.test(r.text) ? 'concern' : 'usage',
    summary: r.text,
    marker_phrase: r.mark,
    buying_implication: 'Factor this into your decision alongside official specs.',
  }));
}

function buyingImplication(score: number | null, topic: string, origin: ClaimOrigin): string {
  const t = topic.toLowerCase();
  if (score === null) return `Read more discussions about ${t} before you decide.`;
  if (origin === 'owner') {
    if (score >= 8) return `Discussions on ${t} skew positive — still read the threads below.`;
    if (score >= 3) return `People are split on ${t}; the comments below show both sides.`;
    return `Discussions on ${t} skew negative — weigh that before you buy.`;
  }
  if (score >= 8) return `Owner comments mostly back up what the brand says about ${t}.`;
  if (score >= 3) return `Expect mixed owner experiences on ${t}; read the reports below.`;
  return `Owner comments often push back on the brand line about ${t}.`;
}
