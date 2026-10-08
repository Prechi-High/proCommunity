import { Text, View } from 'react-native';

import { Marker } from '@/components/community';
import { DiscoveryCard } from '@/components/findings/FindingsPane';
import { Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import type { UnmaskBundle } from '@/lib/unmask/types';

import { SectionTitle, ScoreBar, toneColors } from './shared';

type Props = {
  bundle: UnmaskBundle;
  onDimension?: (id: string) => void;
};

export function HighlightsTab({ bundle, onDimension }: Props) {
  return (
    <View style={{ gap: 28 }}>
      <SectionTitle title="What stands out" subtitle={`Based on ${bundle.experienceCount || 'available'} owner experiences`} />
      <View style={{ gap: 12 }}>
        {bundle.highlights.map((h) => {
          const tone =
            h.kind === 'strength'
              ? toneColors('positive')
              : h.kind === 'weakness'
                ? toneColors('negative')
                : toneColors('mixed');
          return (
            <View
              key={h.id}
              style={{
                borderRadius: radii.card,
                backgroundColor: tone.bg,
                borderWidth: 1,
                borderColor: colors.line,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: tone.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {h.label}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone, flex: 1 }}>{h.title}</Text>
                {h.score !== null ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: tone.fg }}>{h.score}/100</Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>{h.body}</Text>
              {h.mentionCount ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {h.mentionCount} owner experiences mention this
                </Text>
              ) : null}
              <ScoreBar score={h.score} />
            </View>
          );
        })}
        {!bundle.highlights.length ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>We need more themes before highlights appear.</Text>
        ) : null}
      </View>

      {bundle.disagreements.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle
            title="Where people disagree"
            subtitle="Not everyone has the same experience — here are the biggest splits"
          />
          {bundle.disagreements.map((d) => (
            <View key={d.id} style={{ borderRadius: radii.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lac, padding: 14, gap: 10 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{d.title}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SplitCol tone="positive" label={d.positive.label} pct={d.positive.pct} count={d.positive.count} quote={d.positive.quote} />
                <SplitCol tone="negative" label={d.negative.label} pct={d.negative.pct} count={d.negative.count} quote={d.negative.quote} />
              </View>
            </View>
          ))}
          <Tile style={{ backgroundColor: colors.hiSoft, gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hiInk }}>Why the difference?</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>
              Usage patterns, settings, and environment all change what people report. We show the split instead of picking a winner.
            </Text>
          </Tile>
        </View>
      ) : null}

      {bundle.uncovered.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle
            title="What we uncovered"
            subtitle="Less obvious findings from owner experiences"
          />
          {bundle.uncovered.map((d) => (
            <DiscoveryCard key={d.id} d={d} />
          ))}
        </View>
      ) : null}

      {bundle.highlights[0] && onDimension && bundle.highlights[0].dimensionId ? (
        <Tile style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>What this means</Text>
          <Marker
            text={bundle.verdictLine}
            marks={[]}
            instant
            style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}
          />
        </Tile>
      ) : null}
    </View>
  );
}

function SplitCol({
  tone,
  label,
  pct,
  count,
  quote,
}: {
  tone: 'positive' | 'negative';
  label: string;
  pct: number;
  count: number;
  quote: string;
}) {
  const c = toneColors(tone === 'positive' ? 'positive' : 'negative');
  return (
    <View style={{ flex: 1, borderRadius: 12, backgroundColor: c.bg, padding: 10, gap: 4 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.fg }}>{label}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.fg }}>{pct}% · {count} reports</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.bone2 }}>{quote}</Text>
    </View>
  );
}
