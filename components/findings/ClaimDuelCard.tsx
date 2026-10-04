import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Marker } from '@/components/community';
import { CaretRight } from '@/components/icons';
import { Eyebrow } from '@/components/kit';
import { markPhraseInText } from '@/lib/claims/markPhrase';
import { SCORE_UNAVAILABLE_REASONS } from '@/lib/claims/policy';
import type { ClaimComparison } from '@/lib/claims/types';
import { colors, fonts, radii } from '@/constants/theme';

function verdictTone(claim: ClaimComparison): { bg: string; fg: string; label: string } {
  if (claim.score === null) return { bg: colors.mist, fg: colors.bone2, label: 'Still gathering evidence' };
  if (claim.score >= 8) return { bg: colors.markGood, fg: colors.markGoodInk, label: 'Mostly holds up' };
  if (claim.score >= 3) return { bg: colors.marker, fg: colors.markerInk, label: 'Mixed in practice' };
  return { bg: colors.markBad, fg: colors.markBadInk, label: 'Owners push back' };
}

function bucketLabel(c: 'support' | 'partial' | 'contradict') {
  if (c === 'support') return 'Backs it up';
  if (c === 'partial') return 'Partly — depends';
  return 'Pushes back';
}

function bucketColor(c: 'support' | 'partial' | 'contradict') {
  if (c === 'support') return colors.sage;
  if (c === 'partial') return colors.honey;
  return colors.coral;
}

export function ClaimDuelCard({
  claim,
  index,
  defaultOpen,
}: {
  claim: ClaimComparison;
  index: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? index === 0);
  const [explain, setExplain] = useState(false);
  const reveal = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(reveal, { toValue: open ? 1 : 0, duration: open ? 220 : 160, useNativeDriver: true }).start();
  }, [open, reveal]);

  const tone = verdictTone(claim);
  const supporting = claim.evidence.filter((e) => e.classification === 'support' && e.eligible);
  const partial = claim.evidence.filter((e) => e.classification === 'partial' && e.eligible);
  const against = claim.evidence.filter((e) => e.classification === 'contradict' && e.eligible);
  const teaser = against[0]?.summary || partial[0]?.summary || supporting[0]?.summary || claim.buyingImplication;

  const scoreDisplay = claim.score !== null ? `${claim.score}` : '—';

  return (
    <View style={{ borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lac }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ gap: 0 }}
      >
        <View style={{ backgroundColor: colors.bone, paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              Promise {index + 1}
            </Text>
            <View style={{ backgroundColor: tone.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: tone.fg }}>{tone.label}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.4, color: colors.white }}>{claim.topic}</Text>
          {!open && teaser ? (
            <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.72)' }}>
              {teaser}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 72 }}>
          <View style={{ flex: 1, padding: 14, gap: 6, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.bone3 }}>Agreement</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, color: colors.bone }}>{scoreDisplay}</Text>
              {claim.score !== null ? <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.bone3 }}>/10</Text> : null}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone2 }}>{claim.eligibleOwnerCount} owner reports weighed</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.line }} />
          <View style={{ width: 52, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
              <CaretRight size={18} color={colors.bone3} weight="bold" />
            </View>
          </View>
        </View>
      </Pressable>

      {open ? (
        <Animated.View style={{ opacity: reveal, gap: 0 }}>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ padding: 16, gap: 18, backgroundColor: colors.wine }}>
            <View style={{ gap: 8 }}>
              <Eyebrow color={colors.bone3}>The brand says</Eyebrow>
              <View style={{ backgroundColor: colors.lac, borderRadius: radii.card, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.hi }}>
                <Marker
                  text={claim.brandStatement}
                  marks={[pickMark(claim.brandStatement)]}
                  tone="hint"
                  instant={index > 0}
                  style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.bone }}
                />
                {claim.conditions ? (
                  <Text style={{ marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>When: {claim.conditions}</Text>
                ) : null}
                {claim.brandSourceId ? (
                  <Text style={{ marginTop: 6, fontFamily: fonts.medium, fontSize: 11, color: colors.hi }}>Source [{claim.brandSourceId}]</Text>
                ) : null}
              </View>
            </View>

            <View style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.bone2 }}>vs</Text>
              </View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bone3 }}>What owners experienced</Text>
            </View>

            <OwnerBucket title={bucketLabel('support')} color={bucketColor('support')} rows={supporting} tone="good" />
            <OwnerBucket title={bucketLabel('partial')} color={bucketColor('partial')} rows={partial} tone="hint" />
            <OwnerBucket title={bucketLabel('contradict')} color={bucketColor('contradict')} rows={against} tone="bad" />

            <View style={{ gap: 6, paddingTop: 4 }}>
              <Eyebrow>Before you buy</Eyebrow>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>{claim.buyingImplication}</Text>
            </View>

            <Pressable onPress={() => setExplain(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>How we scored this promise</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <ScoreExplainModal claim={claim} visible={explain} onClose={() => setExplain(false)} />
    </View>
  );
}

function OwnerBucket({
  title,
  color,
  rows,
  tone,
}: {
  title: string;
  color: string;
  rows: ClaimComparison['evidence'];
  tone: 'good' | 'bad' | 'hint';
}) {
  if (!rows.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>({rows.length})</Text>
      </View>
      {rows.slice(0, 4).map((e) => {
        const rowTone =
          e.classification === 'contradict' ? 'bad' : e.classification === 'support' ? 'good' : tone;
        const phrase = markPhraseInText(e.summary, e.markerPhrase);
        return (
          <View key={e.id} style={{ backgroundColor: colors.lac, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: color }}>
            <Marker
              text={e.summary}
              marks={[phrase]}
              tone={rowTone}
              instant
              style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone }}
            />
          </View>
        );
      })}
    </View>
  );
}

function pickMark(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return text;
  const start = Math.max(0, Math.floor(words.length / 3));
  return words.slice(start, start + 4).join(' ');
}

function ScoreExplainModal({ claim, visible, onClose }: { claim: ClaimComparison; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(22,22,22,0.55)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.lac, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, maxHeight: '78%' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.bone, marginBottom: 8 }}>How we scored this promise</Text>
          <ScrollView style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2 }}>
              {claim.scoreExplanation.formula}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone, marginTop: 12 }}>
              {claim.scoreExplanation.supportCount} back it up · {claim.scoreExplanation.partialCount} partial · {claim.scoreExplanation.contradictCount} push back ·{' '}
              {claim.scoreExplanation.excludedCount} excluded
            </Text>
            {claim.unavailableReason ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, marginTop: 8 }}>
                {SCORE_UNAVAILABLE_REASONS[claim.unavailableReason]}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 16 }}>
              Policy {claim.scoreExplanation.policyVersion}
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
