import { Pressable, Text, View } from 'react-native';

import { CaretRight } from '@/components/icons';
import { Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { claimForDimension } from '@/lib/unmask/derive';
import type { UnmaskBundle, UnmaskDimension } from '@/lib/unmask/types';
import type { ProductProfile } from '@/lib/types';

import { EvidenceClustersSection } from './EvidenceClustersSection';
import { ScoreBar, ScoreRing, SectionTitle, UnmaskedBadge, toneColors } from './shared';

type Props = {
  profile: ProductProfile;
  bundle: UnmaskBundle;
  onDimension: (id: string) => void;
  onOpenSources: () => void;
};

export function ScorecardTab({ profile, bundle, onDimension, onOpenSources }: Props) {
  const strengths = bundle.dimensions.filter((d) => d.score !== null && d.score >= 75).slice(0, 3);
  const weaknesses = bundle.dimensions.filter((d) => d.score !== null && d.score < 65).slice(0, 3);

  return (
    <View style={{ gap: 24 }}>
      <Tile style={{ gap: 16, padding: 18 }}>
        <UnmaskedBadge />
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <ScoreRing score={bundle.overallScore} size={108} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.bone }}>The verdict</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{bundle.verdictLine}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
              Based on {bundle.experienceCount || 'available'} owner experiences
              {bundle.discussionCount ? ` · ${bundle.discussionCount} themes` : ''}
            </Text>
          </View>
        </View>
      </Tile>

      <SectionTitle title="Product scorecard" subtitle="How owners say it performs in key areas" />

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
  const dim = bundle.dimensions.find((d) => d.id === dimensionId);
  if (!dim) return null;
  const claim = claimForDimension(profile, dim);
  const eligible = claim?.evidence.filter((e) => e.eligible) ?? [];

  return (
    <View style={{ gap: 20 }}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>← Back to scorecard</Text>
      </Pressable>
      <SectionTitle title={dim.label} subtitle="Deep dive into real owner experiences" />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <ScoreRing score={dim.score} size={96} />
        <View style={{ flex: 1, gap: 6, borderRadius: radii.card, backgroundColor: colors.wineDeep, padding: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>What owners report</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>{dim.takeaway}</Text>
        </View>
      </View>
      {eligible.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Key findings</Text>
          {eligible.slice(0, 5).map((e) => (
            <Tile key={e.id} style={{ gap: 4 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone }}>{e.summary}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{e.origin}</Text>
            </Tile>
          ))}
        </View>
      ) : null}
    </View>
  );
}
