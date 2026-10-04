import { markPhraseInText } from './markPhrase.ts';
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
  const claimRows = resolveClaimRows(input);

  claimRows.slice(0, 8).forEach((raw, idx) => {
    const topic = String(raw.topic || `Topic ${idx + 1}`).slice(0, 80);
    const brandStatement = String(raw.exact_text || '').trim() || topic;
    const criterion = String(raw.criterion || '').trim() || defaultCriterion(topic).criterion;
    const partialCriterion = String(raw.partial_criterion || '').trim() || defaultCriterion(topic).partial;
    const claimType = /health|medical|cure|safe for all|dermatologist/i.test(`${brandStatement} ${topic}`)
      ? 'health_efficacy'
      : 'general';

    const claimBlob = `${topic} ${brandStatement} ${criterion}`;
    const related = input.voices
      .map((v) => ({ v, rel: voiceClaimRelevance(v, claimBlob, topic) }))
      .filter((x) => x.rel >= 0.1)
      .sort((a, b) => b.rel - a.rel)
      .slice(0, 12)
      .map((x) => x.v);

    const evidenceRows = related.map((v, i) => {
      const classification = stanceToClass(v.stance, Boolean(partialCriterion));
      const origin = originFromRef(v.ref, input.sources);
      const eligible = classification !== 'unclear';
      const summary = (v.text || v.mark || v.topic).trim().slice(0, 360);
      const markerPhrase = markPhraseInText(summary, v.mark);
      return {
        id: `ev_${idx}_${i}`,
        summary,
        markerPhrase,
        classification,
        sourceType: 'owner_report' as const,
        sourceId: null,
        origin,
        eligible,
        exclusionReason: eligible ? undefined : 'Missing context for partial classification',
      };
    });

    const complaintRows = input.complaints
      .filter((c) => overlap(c.text, claimBlob) >= 0.1)
      .slice(0, 4)
      .map((c, i) => {
        const summary = c.text.trim().slice(0, 360);
        return {
          id: `ev_${idx}_c_${i}`,
          summary,
          markerPhrase: markPhraseInText(summary),
          classification: 'contradict' as const,
          sourceType: 'owner_report' as const,
          sourceId: c.source,
          origin: c.source != null ? originFromRef(`S${c.source}`, input.sources) : 'review',
          eligible: true,
        };
      });

    const mergedEvidence = [...evidenceRows, ...complaintRows].filter(
      (row, i, arr) => arr.findIndex((r) => r.summary === row.summary) === i,
    );

    const counts: ClaimCounts = {
      support: mergedEvidence.filter((e) => e.classification === 'support' && e.eligible).length,
      partial: mergedEvidence.filter((e) => e.classification === 'partial' && e.eligible).length,
      contradict: mergedEvidence.filter((e) => e.classification === 'contradict' && e.eligible).length,
      excluded: mergedEvidence.filter((e) => !e.eligible).length,
    };

    const distinctUnits = new Set(related.map((v) => v.ref)).size;
    const origins = countOrigins(mergedEvidence.filter((e) => e.eligible));

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
      brandStatement: brandStatement || 'No relevant statement found in reviewed brand material.',
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

function resolveClaimRows(input: {
  brandClaims: BrandClaimRaw[];
  praise: Array<{ text: string; source: number | null }>;
  uses?: string[];
  bestFor?: string[];
  summary?: string;
}): BrandClaimRaw[] {
  const fromLlm = input.brandClaims.filter((c) => c.topic && c.exact_text && !isGenericClaimRow(c));
  const synth = synthesizeClaimsFromProductSignals(input);
  const merged: BrandClaimRaw[] = [...fromLlm];
  for (const row of synth) {
    if (merged.some((m) => overlap(String(m.topic), String(row.topic)) > 0.55)) continue;
    merged.push(row);
  }
  return merged.length ? merged : synth;
}

function isGenericClaimRow(c: BrandClaimRaw): boolean {
  const t = String(c.topic || '').toLowerCase();
  const text = String(c.exact_text || '').toLowerCase();
  if (t === 'performance' || t === 'durability' || t === 'quality') return true;
  if (text.includes('manufacturer information unavailable')) return true;
  return false;
}

function synthesizeClaimsFromProductSignals(input: {
  praise: Array<{ text: string; source: number | null }>;
  uses?: string[];
  bestFor?: string[];
  summary?: string;
}): BrandClaimRaw[] {
  const rows: BrandClaimRaw[] = [];
  const pushLine = (line: string, source?: number) => {
    const text = line.trim();
    if (!text || text.length < 8) return;
    const topic = topicFromLine(text);
    const { criterion, partial } = defaultCriterion(topic);
    rows.push({
      topic,
      exact_text: text.slice(0, 400),
      criterion,
      partial_criterion: partial,
      brand_source: source,
    });
  };

  for (const p of input.praise) pushLine(p.text, p.source ?? undefined);
  for (const u of input.uses ?? []) pushLine(u);
  for (const b of input.bestFor ?? []) pushLine(`Best for ${b.replace(/^best for\s+/i, '')}`);
  const summary = (input.summary || '').trim();
  if (summary.length >= 12 && summary.length <= 200 && rows.length < 3) pushLine(summary);

  return rows.slice(0, 8);
}

function topicFromLine(text: string): string {
  let s = text.replace(/^[\s•\-*]+/, '').trim();
  s = s.split(/\n/)[0].trim();
  const clause = s.split(/[.;:!?—–]/)[0].trim();
  const words = clause.split(/\s+/).filter(Boolean);
  const skip = new Set(['the', 'a', 'an', 'this', 'that', 'with', 'for', 'and', 'or', 'is', 'are', 'to', 'in', 'on', 'it', 'its', 'best']);
  const meaningful = words.filter((w) => !skip.has(w.toLowerCase()));
  let topic = meaningful.slice(0, 5).join(' ');
  if (!topic) topic = words.slice(0, 4).join(' ');
  if (topic.length > 56) topic = `${topic.slice(0, 53)}…`;
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function defaultCriterion(topic: string): { criterion: string; partial: string } {
  const t = topic.toLowerCase();
  return {
    criterion: `Owners describe real-world experience related to “${t}”.`,
    partial: `Some owners report mixed results on “${t}” depending on conditions.`,
  };
}

function voiceClaimRelevance(v: Voice, claimBlob: string, topic: string): number {
  return Math.max(
    overlap(v.topic, topic),
    overlap(v.topic, claimBlob),
    overlap(v.mark, claimBlob),
    overlap(v.text || '', claimBlob),
    overlap(v.text || '', topic),
  );
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

function buyingImplication(score: number | null, topic: string): string {
  if (score === null) return `Check more owner reports on ${topic.toLowerCase()} before you decide.`;
  if (score >= 8) return `Collected reports mostly align with the brand promise on ${topic.toLowerCase()}.`;
  if (score >= 3) return `Expect mixed owner experiences on ${topic.toLowerCase()}; read the reports below.`;
  return `Many collected reports disagree with the promise on ${topic.toLowerCase()}.`;
}
