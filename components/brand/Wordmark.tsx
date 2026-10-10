import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Sparkle } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

type Tone = 'ink' | 'white';

export function Wordmark({
  height = 28,
  tone = 'ink',
  showStar = true,
  style,
}: {
  height?: number;
  tone?: Tone;
  showStar?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = tone === 'white' ? colors.white : colors.bone;
  const fontSize = height * 0.82;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start' }, style]} accessibilityRole="image" accessibilityLabel="Unmask">
      <Text style={{ fontFamily: fonts.serifBold, fontSize, lineHeight: fontSize * 1.05, color, letterSpacing: -0.5 }}>Unmask</Text>
      {showStar ? (
        <View style={{ marginLeft: 2, marginTop: -2 }}>
          <Sparkle size={Math.max(10, height * 0.32)} color={colors.gold} weight="fill" />
        </View>
      ) : null}
    </View>
  );
}

export function BrandTagline({ tone = 'ink', style }: { tone?: Tone; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: fonts.medium, fontSize: 12, color: tone === 'white' ? 'rgba(255,255,255,0.85)' : colors.bone2 }, style]}>
      Know before you buy.
    </Text>
  );
}
