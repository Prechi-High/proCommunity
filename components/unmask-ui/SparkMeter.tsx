import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { sparkProgress, sparkNaira } from '@/lib/unmask/status';

export function SparkMeter({
  weight = 0,
  compact,
  goal,
}: {
  weight?: number;
  compact?: boolean;
  goal?: number;
}) {
  const p = sparkProgress(weight, goal);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Investigation support" accessibilityValue={{ min: 0, max: p.goal, now: Math.min(p.weight, p.goal), text: `${p.weight} of ${p.goal} Sparks` }} style={{ gap: compact ? 6 : 8 }}>
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
            width: `${p.ratio * 100}%`,
            height: '100%',
            backgroundColor: p.ready ? colors.gold : colors.brandDeep,
            borderRadius: 99,
          }}
        />
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: compact ? 12 : 13, lineHeight: 18, color: colors.inkSoft }}>
        {p.ready
          ? `${p.weight} Sparks · ${sparkNaira(p.weight)}. Target reached · awaiting team confirmation.`
          : `${p.weight} of ${p.goal} Sparks toward this investigation · ${sparkNaira(p.remaining)} to go.`}
      </Text>
    </View>
  );
}
