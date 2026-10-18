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

function overallHeadline(overall: ProductUIContractV1['overview']['overall']) {
  const display = overall?.score_display ?? (overall?.score != null ? 'numeric' : 'unavailable');
  if (display === 'numeric' && overall?.score != null) return `${overall.score} / 100`;
  if (display === 'limited') return 'Limited evidence';
  return 'Unmask score';
}

export function DynamicOverview({ contract, onDimension }: Props) {
  const { overview } = contract;
  const dims = [...overview.dimensions].sort((a, b) => a.display_order - b.display_order);
  const overallDisplay = overview.overall?.score_display ?? (overview.overall?.score != null ? 'numeric' : 'unavailable');
  const showOverallRing = overallDisplay === 'numeric' && overview.overall?.score != null;

  return (
    <View style={{ gap: 20 }}>
      <Tile style={{ gap: 16, padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          {showOverallRing ? (
            <ScoreRing score={overview.overall?.score ?? null} size={108} />
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
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, color: colors.bone }}>
              {overallHeadline(overview.overall)}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
              {overview.overall?.verdict ?? 'Owner-backed scores for what matters on this product.'}
            </Text>
          </View>
        </View>
      </Tile>

      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Score breakdown</Text>
      {!dims.length ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
          Dimension assessments are still developing. Available sources and observations remain accessible.
        </Text>
      ) : null}
      <View style={{ gap: 10 }}>
        {dims.map((dim) => {
          const scoreDisplay = dim.score_display ?? (dim.score != null ? 'numeric' : 'limited');
          const showNumeric = scoreDisplay === 'numeric' && dim.score != null;
          const tone = !showNumeric ? 'mixed' : dim.score! >= 75 ? 'positive' : dim.score! >= 55 ? 'mixed' : 'negative';
          const tc = toneColors(tone);
          const validated = dim.validated_report_count;
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
                  {dim.finding ??
                    (scoreDisplay === 'limited'
                      ? validated != null
                        ? `Based on ${validated} validated report${validated === 1 ? '' : 's'}`
                        : 'Limited evidence'
                      : scoreDisplay === 'unavailable'
                        ? 'Not enough validated reports yet'
                        : '')}
                </Text>
                {showNumeric && dim.confidence_label ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.bone3 }}>
                    {dim.confidence_label} confidence
                    {validated != null ? ` · ${validated} validated reports` : ''}
                  </Text>
                ) : scoreDisplay === 'limited' && validated != null ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.bone3 }}>
                    {validated <= 2 ? 'Early signal' : 'Limited evidence'} · {validated} validated report
                    {validated === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
              {showNumeric ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: tc.fg }}>{dim.score}</Text>
              ) : scoreDisplay === 'limited' ? (
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2, maxWidth: 72, textAlign: 'right' }}>
                  Limited evidence
                </Text>
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
