import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MarkerText } from '@/components/findings/MarkerText';
import { Eyebrow, Group, GroupRow, Tile } from '@/components/kit';
import { SCORE_UNAVAILABLE_REASONS } from '@/lib/claims/policy';
import type { ClaimComparison, ProductFindings } from '@/lib/claims/types';
import type { EvidenceSource, ProductProfile } from '@/lib/types';
import { colors, fonts } from '@/constants/theme';

function ProductMatchNotice({ findings }: { findings: ProductFindings }) {
  const m = findings.match;
  const tone = m.level === 'exact' ? colors.sageInk : m.level === 'possible' ? colors.honeyInk : colors.bone2;
  return (
    <Tile style={{ gap: 6, borderWidth: 1, borderColor: colors.line }}>
      <Eyebrow>Product match</Eyebrow>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone }}>
        {m.level === 'exact' ? 'Exact match' : m.level === 'possible' ? 'Possible match' : 'Unknown model'}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{m.message}</Text>
    </Tile>
  );
}

function ClaimAgreementScore({
  claim,
  onExplain,
}: {
  claim: ClaimComparison;
  onExplain: () => void;
}) {
  const scoreText = claim.score !== null ? `${claim.score}/10` : 'Not enough evidence to score';
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2 }}>Claim agreement</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <Text accessibilityLabel={`Claim agreement ${scoreText}`} style={{ fontFamily: fonts.bold, fontSize: 36, color: colors.bone, letterSpacing: -1 }}>
          {claim.score !== null ? scoreText : '—'}
        </Text>
        <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{claim.agreementLabel}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>
            Evidence confidence: {claim.confidence.charAt(0).toUpperCase() + claim.confidence.slice(1)}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
            Based on {claim.eligibleOwnerCount} eligible owner reports
          </Text>
        </View>
      </View>
      {claim.score !== null ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }}>
          <View style={{ width: `${(claim.score / 10) * 100}%`, height: 6, backgroundColor: colors.hi }} />
        </View>
      ) : null}
      {claim.unavailableReason ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>
          {SCORE_UNAVAILABLE_REASONS[claim.unavailableReason]}
        </Text>
      ) : null}
      <Pressable onPress={onExplain} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>How this was calculated</Text>
      </Pressable>
    </View>
  );
}

function ClaimComparisonCard({ claim, sources }: { claim: ClaimComparison; sources: EvidenceSource[] }) {
  const [open, setOpen] = useState(Boolean(claim.defaultExpanded));
  const [explain, setExplain] = useState(false);
  const collapsedLabel = claim.score !== null ? `${claim.score}/10 · ${claim.agreementLabel}` : 'Not enough evidence to score';

  return (
    <Tile style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ padding: 16, gap: 6, minHeight: 44 }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>{claim.topic}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>{collapsedLabel}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
          {claim.eligibleOwnerCount} eligible reports · {claim.confidence} confidence
        </Text>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
          <ClaimAgreementScore claim={claim} onExplain={() => setExplain(true)} />
          <View style={{ gap: 6 }}>
            <Eyebrow>Brand claim</Eyebrow>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>{claim.brandStatement}</Text>
            {claim.conditions ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>Conditions: {claim.conditions}</Text> : null}
          </View>
          <View style={{ gap: 8 }}>
            <Eyebrow>Owner reports</Eyebrow>
            {claim.evidence.slice(0, 6).map((e) => (
              <View key={e.id} style={{ gap: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>{e.summary}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {e.classification} · {e.sourceType} · {e.origin}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            <Eyebrow>Buying implication</Eyebrow>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{claim.buyingImplication}</Text>
          </View>
        </View>
      ) : null}
      <Modal visible={explain} transparent animationType="fade" onRequestClose={() => setExplain(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(22,22,22,0.5)', justifyContent: 'flex-end' }} onPress={() => setExplain(false)}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: colors.lac, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 10, maxHeight: '80%' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>How this was calculated</Text>
            <ScrollView>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>
                {claim.scoreExplanation.formula}
                {'\n\n'}
                {claim.scoreExplanation.supportCount} support · {claim.scoreExplanation.partialCount} partial · {claim.scoreExplanation.contradictCount} conflict ·{' '}
                {claim.scoreExplanation.excludedCount} excluded
                {'\n\n'}
                Policy {claim.scoreExplanation.policyVersion} · {claim.scoreExplanation.computedAt}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Tile>
  );
}

export function FindingsPane({ profile, onOpenSources }: { profile: ProductProfile; onOpenSources: () => void }) {
  const findings = profile.findings;
  if (!findings) {
    return (
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
        Findings are still loading. Try refreshing this product.
      </Text>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <ProductMatchNotice findings={findings} />
      <View style={{ gap: 10 }}>
        <Eyebrow>Key findings</Eyebrow>
        {findings.keyFindings.map((kf) => (
          <Tile key={kf.id} style={{ gap: 8 }}>
            {kf.markerPhrase ? <MarkerText text={kf.text} highlight={kf.markerPhrase} /> : <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone }}>{kf.text}</Text>}
          </Tile>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Eyebrow>Claims & evidence</Eyebrow>
        {findings.claims.map((c) => (
          <ClaimComparisonCard key={c.id} claim={c} sources={profile.sources} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Eyebrow>What owners also noticed</Eyebrow>
        {findings.discoveries.map((d) => (
          <Tile key={d.id} style={{ gap: 8 }}>
            <MarkerText text={d.summary} highlight="also noticed" variant="underline" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{d.topic}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>{d.mentionLabel}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>{d.manufacturerRelation}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{d.buyingImplication}</Text>
          </Tile>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.bone3 }}>{findings.disclaimer}</Text>
      <Pressable onPress={onOpenSources} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>View all sources</Text>
      </Pressable>
    </View>
  );
}
