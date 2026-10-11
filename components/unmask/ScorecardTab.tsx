import { Pressable, Text, View } from 'react-native';

import { CaretRight } from '@/components/icons';
import { Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { dynamicProductUiEnabled } from '@/lib/product-result/flags';
import { getDimensionExperience, resolveDimensionKey } from '@/lib/unmask/dimensionEvidence';
import type { UnmaskBundle, UnmaskDimension } from '@/lib/unmask/types';
import type { ProductProfile } from '@/lib/types';

import { EvidenceClustersSection } from './EvidenceClustersSection';
import { ScoreBar, ScoreRing, SectionTitle, UnmaskedBadge, toneColors } from './shared';

type Props = {
  profile: ProductProfile;
  bundle: UnmaskBundle;
  onDimension: (id: string) => void;
  onOpenSources: () => void;
  mode?: 'overview' | 'evidence';
};

export function ScorecardTab({ profile, bundle, onDimension, onOpenSources, mode = 'overview' }: Props) {
  const strengths = bundle.dimensions.filter((d) => d.score !== null && d.score >= 75).slice(0, 3);
  const weaknesses = bundle.dimensions.filter((d) => d.score !== null && d.score < 65).slice(0, 3);
  const overallDisplay = bundle.overallScoreDisplay ?? (bundle.overallScore != null ? 'numeric' : 'unavailable');
  const showOverallRing = overallDisplay === 'numeric' && bundle.overallScore != null;
  const overallTitle =
    showOverallRing ? `${bundle.overallScore} / 100` : overallDisplay === 'limited' ? 'Limited evidence' : 'Unmask score';

  return (
    <View style={{ gap: 24 }}>
      {mode === 'overview' ? (
        <Tile style={{ gap: 16, padding: 18 }}>
          <UnmaskedBadge />
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            {showOverallRing ? (
              <ScoreRing score={bundle.overallScore} size={108} />
            ) : (
              <View
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  borderWidth: 2,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bone2, textAlign: 'center' }}>
                  {overallDisplay === 'limited' ? 'Limited evidence' : 'No score yet'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, letterSpacing: -0.3, color: colors.bone }}>
                {overallTitle}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{bundle.verdictLine}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                Based on {bundle.experienceCount || 'available'} owner experiences
                {bundle.discussionCount ? ` · ${bundle.discussionCount} themes` : ''}
              </Text>
            </View>
          </View>
        </Tile>
      ) : (
        <SectionTitle title="Evidence by area" subtitle="Tap a dimension to see sentiment and owner quotes" />
      )}

      {mode === 'overview' ? (
        <SectionTitle title="Score breakdown" subtitle="How owners say it performs in key areas" />
      ) : null}

      <View style={{ gap: 10 }}>
        {bundle.dimensions.map((dim) => (
          <DimensionRow key={dim.id} dim={dim} onPress={() => onDimension(dim.id)} />
        ))}
      </View>

      {(strengths.length || weaknesses.length) ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {strengths.length ? (
            <View style={{ flex: 1, borderRadius: radii.card, backgroundColor: colors.sageSoft, padding: 14, gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sageInk }}>Top strengths</Text>
              {strengths.map((d) => (
                <Text key={d.id} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.sageInk }}>
                  · {d.label} {d.score !== null ? `(${d.score}/100)` : ''}
                </Text>
              ))}
            </View>
          ) : null}
          {weaknesses.length ? (
            <View style={{ flex: 1, borderRadius: radii.card, backgroundColor: colors.coralSoft, padding: 14, gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.coral }}>Watch for</Text>
              {weaknesses.map((d) => (
                <Text key={d.id} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.coral }}>
                  · {d.label} {d.score !== null ? `(${d.score}/100)` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {bundle.clusters.length ? <EvidenceClustersSection clusters={bundle.clusters} onOpenSources={onOpenSources} /> : null}

      <Pressable onPress={onOpenSources} style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>View all sources</Text>
      </Pressable>
    </View>
  );
}

function DimensionRow({ dim, onPress }: { dim: UnmaskDimension; onPress: () => void }) {
  const tone = toneColors(dim.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.lac,
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tone.fg }}>{dim.label.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{dim.label}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone2 }}>{dim.subtitle}</Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: tone.fg }}>{dim.score ?? '—'}</Text>
        <CaretRight size={14} color={colors.bone3} weight="bold" />
      </View>
      <ScoreBar score={dim.score} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.bone2 }} numberOfLines={2}>{dim.takeaway}</Text>
    </Pressable>
  );
}

export function DimensionDetail({
  profile,
  bundle,
  dimensionId,
  onBack,
}: {
  profile: ProductProfile;
  bundle: UnmaskBundle;
  dimensionId: string;
  onBack: () => void;
}) {
  const dimKey = resolveDimensionKey(profile, dimensionId);
  const dim = bundle.dimensions.find((d) => d.id === dimKey || d.id === dimensionId);
  const dynamic = dynamicProductUiEnabled();
  const experience = dynamic ? getDimensionExperience(profile, dimKey) : null;

  if (!dim && !experience) return null;

  const contractDim = profile.uiContract?.overview.dimensions.find((d) => d.key === dimKey);
  const label = experience?.label ?? dim?.label ?? dimKey;
  const items = experience?.items ?? [];
  const scoreDisplay =
    contractDim?.score_display ??
    (experience as { scoreDisplay?: 'numeric' | 'limited' | 'unavailable' } | null)?.scoreDisplay ??
    (experience?.score != null || dim?.score != null ? 'numeric' : 'limited');
  const score =
    scoreDisplay === 'numeric' ? (experience?.score ?? dim?.score ?? null) : null;
  const validatedCount =
    contractDim?.validated_report_count ??
    (experience as { validatedReportCount?: number } | null)?.validatedReportCount ??
    items.filter((e) => e.affectsScore).length;
  const finding = experience?.finding ?? dim?.takeaway ?? '';
  const confidence = experience?.confidence;
  const pos = experience?.positiveCount ?? 0;
  const mix = experience?.mixedCount ?? 0;
  const neg = experience?.negativeCount ?? 0;

  const limitedLabel =
    validatedCount <= 2 && validatedCount > 0
      ? 'Early signal'
      : scoreDisplay === 'limited'
        ? 'Limited evidence'
        : scoreDisplay === 'unavailable'
          ? 'Not enough evidence'
          : null;

  return (
    <View style={{ gap: 20 }}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>← Back to scorecard</Text>
      </Pressable>
      <SectionTitle title={label} subtitle="Evidence mapped to this experience area" />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {scoreDisplay === 'numeric' && score != null ? (
          <ScoreRing score={score} size={96} />
        ) : (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 2,
              borderColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.bone2, textAlign: 'center' }}>
              {limitedLabel ?? 'Limited evidence'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 6, borderRadius: radii.card, backgroundColor: colors.wineDeep, padding: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>Reasoning summary</Text>
          {limitedLabel ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{limitedLabel}</Text>
          ) : null}
          {validatedCount > 0 && scoreDisplay !== 'numeric' ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone2 }}>
              Based on {validatedCount} validated report{validatedCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>{finding}</Text>
          {scoreDisplay === 'numeric' && confidence != null ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.bone3 }}>
              Confidence {Math.round(confidence * 100)}% · {pos} positive · {mix} mixed · {neg} negative
            </Text>
          ) : null}
        </View>
      </View>
      {items.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Supporting evidence</Text>
          {items.map((e) => (
            <Tile key={e.evidenceId} style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone }}>{e.statement}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.bone3 }}>
                {e.platform}
                {e.stance ? ` · ${e.stance}` : ''}
                {e.strength ? ` · strength ${Math.round(e.strength * 100)}%` : ''}
                {!e.affectsScore ? ' · contextual (not scored)' : ''}
              </Text>
              {e.url ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.hi }} numberOfLines={1}>{e.url}</Text>
              ) : null}
            </Tile>
          ))}
        </View>
      ) : score != null ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>
          No validated evidence rows are attached yet. Re-investigate with force refresh after deploying dimension evidence.
        </Text>
      ) : null}
    </View>
  );
}
