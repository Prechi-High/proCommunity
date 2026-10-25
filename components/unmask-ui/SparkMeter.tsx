import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { sparkProgress, sparkNaira } from '@/lib/unmask/status';

export function SparkMeter({
  weight = 0,
  compact,
}: {
  weight?: number;
  compact?: boolean;
}) {
  const p = sparkProgress(weight);
  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View
        style={{
          height: compact ? 6 : 8,
          borderRadius: 99,
          backgroundColor: colors.mist,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(6, p.ratio * 100)}%`,
            height: '100%',
            backgroundColor: p.ready ? colors.gold : colors.brandDeep,
            borderRadius: 99,
          }}
        />
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: compact ? 12 : 13, lineHeight: 18, color: colors.inkSoft }}>
        {p.ready
          ? `${p.weight} Sparks · ${sparkNaira(p.weight)}. Ready for an Unmasker.`
          : `${p.weight} of ${p.goal} Sparks to start an Ultra Unmask · ${sparkNaira(p.remaining)} to go.`}
      </Text>
    </View>
  );
}
