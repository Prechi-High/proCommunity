import { Text, View } from 'react-native';

import { Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import type { EvidenceCluster } from '@/lib/unmask/types';

import { SectionTitle, toneColors } from './shared';

export function EvidenceClustersSection({
  clusters,
  onOpenSources,
}: {
  clusters: EvidenceCluster[];
  onOpenSources: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title="Evidence clusters" subtitle="Common findings grouped from owner reports" />
      {clusters.map((c) => {
        const tone = toneColors(c.tone);
        return (
          <View
            key={c.id}
            style={{
              borderRadius: radii.card,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: tone.bg,
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, flex: 1 }}>{c.title}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: tone.fg }}>{c.ownerCount} owners</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>{c.summary}</Text>
            {c.quotes.map((q, i) => (
              <Tile key={i} style={{ backgroundColor: colors.lac, gap: 4 }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone }}>&ldquo;{q.text}&rdquo;</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{q.origin}</Text>
              </Tile>
            ))}
          </View>
        );
      })}
      <Text onPress={onOpenSources} style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi, textAlign: 'center' }}>
        Open source list
      </Text>
    </View>
  );
}
