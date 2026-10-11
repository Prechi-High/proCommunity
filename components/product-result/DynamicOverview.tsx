import { Pressable, Text, View } from 'react-native';

import { CaretRight } from '@/components/icons';
import { Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import type { ProductUIContractV1 } from '@/lib/product-result/contract';
import { ScoreRing, toneColors } from '@/components/unmask/shared';

type Props = {
  contract: ProductUIContractV1;
  onDimension: (filterKey: string) => void;
};

export function DynamicOverview({ contract, onDimension }: Props) {
  const { overview } = contract;
  const dims = [...overview.dimensions].sort((a, b) => a.display_order - b.display_order);

  return (
    <View style={{ gap: 20 }}>
      <Tile style={{ gap: 16, padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <ScoreRing score={overview.overall?.score ?? null} size={108} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, color: colors.bone }}>
              {overview.overall?.score != null ? `${overview.overall.score} / 100` : 'Unmask score'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
              {overview.overall?.verdict ?? 'Owner-backed scores for what matters on this product.'}
            </Text>
          </View>
        </View>
      </Tile>

      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Score breakdown</Text>
      <View style={{ gap: 10 }}>
        {dims.map((dim) => {
          const tone = dim.score == null ? 'mixed' : dim.score >= 75 ? 'positive' : dim.score >= 55 ? 'mixed' : 'negative';
          const tc = toneColors(tone);
          return (
            <Pressable
              key={dim.id}
              onPress={() => onDimension(dim.evidence_filter_key ?? dim.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: radii.card,
                backgroundColor: colors.lac,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{dim.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }} numberOfLines={2}>
                  {dim.finding ?? (dim.score == null ? 'Limited evidence so far' : '')}
                </Text>
                {dim.confidence_label ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.bone3 }}>
                    {dim.confidence_label} confidence
                    {dim.evidence_count != null ? ` · ${dim.evidence_count} reports` : ''}
                  </Text>
                ) : null}
              </View>
              {dim.score != null ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: tc.fg }}>{dim.score}</Text>
              ) : null}
              <CaretRight size={18} color={colors.bone3} weight="bold" />
            </Pressable>
          );
        })}
      </View>

      {overview.discoveries?.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>What we uncovered</Text>
          {overview.discoveries.map((d) => (
            <View key={d.id} style={{ padding: 14, borderRadius: radii.card, backgroundColor: colors.lac, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{d.title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2, lineHeight: 18 }}>{d.finding}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
