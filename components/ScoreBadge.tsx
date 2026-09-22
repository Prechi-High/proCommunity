import { useMemo } from 'react';
import { View, Text } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { scoreBand } from '@/lib/scoreBand';

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const band = scoreBand(score);
  const tone = band === 'Excellent' ? colors.sage : band === 'Good' ? colors.honey : band === 'Average' ? colors.honey : colors.coral;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, backgroundColor: `${tone}22`, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: tone }}>{band}</Text>
    </View>
  );
}
